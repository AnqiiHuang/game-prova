// 剧情体检的核心逻辑：字数、断链、禁用词。供脚本和测试共用。
import { ALL_NODES, ARRIVAL_AGAIN, ARRIVAL_FIRST, MAIN_SLOTS, NODES, QUICKS, SIDES } from '../src/game/story';
import { endingView } from '../src/game/story/endings';
import { newGame } from '../src/game/engine';
import { countCjk } from '../src/game/text';
import type { EndingId, StoryNode } from '../src/game/types';

// 默认可见正文的字数范围（不含“展开细节”）：
//   普通节点约 200–400 字，允许 180–470；重要节点约 600–800 字，允许 520–900。
export const RANGE = { normal: [180, 470], key: [520, 900] } as const;
const MAX_DETAILS = 700;
const BANNED = [
  '重合', '相同', '共鸣', '一致', '类似', '同样', '正好', '分毫不差', '如同', '暗合', '共振', '频率', '纹路', '印记',
  '量子', '能量', '机械', '植入', '哲学', '实验', '血', '器官', '伤疤', '排泄', '标本', '福尔马林', '病娇', '暴力', '乱伦', '幻觉', '宿命',
  '克苏鲁', '科幻', '尖叫', '现实世界也会死亡',
];
const AI_WORD = /(^|[^A-Za-z])AI([^A-Za-z]|$)/;


function nodeText(n: StoryNode, includeVariants: boolean, includeDetails = false): string {
  let t = n.paragraphs.join('');
  if (includeVariants) for (const v of n.variants ?? []) t += v.paragraphs.join('');
  if (includeDetails) t += (n.details ?? []).join('');
  return t;
}

export interface LintResult {
  errors: string[];
  report: { id: string; title: string; cjk: number; weight: 'normal' | 'key'; details: number }[];
  nodes: number;
  sides: number;
}

export function lintStory(): LintResult {
  const errors: string[] = [];
  const report: LintResult['report'] = [];
  const err = (m: string) => {
    errors.push(m);
  };
  // 1. 字数：只统计默认可见的正文（不含变体和“展开细节”），按节点篇幅分档
  for (const n of ALL_NODES) {
    if (n.kind === 'mini') continue;
    const c = countCjk(nodeText(n, false));
    report.push({ id: n.id, title: n.title, cjk: c, weight: n.weight ?? 'normal', details: countCjk((n.details ?? []).join('')) });
    const [lo, hi] = RANGE[n.weight ?? 'normal'];
    if (c < lo || c > hi) err(`${n.id}（${n.weight ?? 'normal'}）默认正文 ${c} 字，应在 ${lo}–${hi} 之间`);
    const d = countCjk((n.details ?? []).join(''));
    if (d > MAX_DETAILS) err(`${n.id} 的“展开细节”有 ${d} 字，超过 ${MAX_DETAILS}`);
  }
  if (ALL_NODES.filter((n) => n.weight === 'key').length < 5) err('重要节点（key）少于 5 个');

  // 2. 选项数量 / 断链
  const ids = new Set<string>();
  for (const n of ALL_NODES) {
    if (ids.has(n.id)) err(`重复的节点 id：${n.id}`);
    ids.add(n.id);
    if (n.kind !== 'mini' && (n.choices.length < 2 || n.choices.length > 4)) err(`${n.id} 的选项数量是 ${n.choices.length}，应为 2–4`);
    const cids = new Set<string>();
    for (const c of n.choices) {
      if (cids.has(c.id)) err(`${n.id} 里重复的选项 id：${c.id}`);
      cids.add(c.id);
      if (c.next && !NODES[c.next]) err(`${n.id}/${c.id} 指向不存在的节点 ${c.next}`);
    }
  }
  for (const [d, slots] of Object.entries(MAIN_SLOTS)) {
    if (slots.length < 3) err(`第 ${d} 天主线节点少于 3 个`);
    for (const sl of slots) if (!NODES[sl.nodeId]) err(`第 ${d} 天主线缺少节点 ${sl.nodeId}`);
  }
  for (const d of SIDES) if (!NODES[d.nodeId]) err(`支线 ${d.id} 缺少节点 ${d.nodeId}`);

  // 3. 禁用词与 AI 字样（正文、选项、结果）
  function lint(where: string, text: string) {
    for (const w of BANNED) if (text.includes(w)) err(`${where} 含有禁用词「${w}」`);
    if (AI_WORD.test(text)) err(`${where} 的剧情文本里出现了 “AI”`);
  }
  for (const n of ALL_NODES) {
    lint(`${n.id} 标题`, n.title);
    lint(`${n.id} 正文`, nodeText(n, true, true));
    for (const c of n.choices) {
      lint(`${n.id}/${c.id} 标签`, c.label);
      if (typeof c.result === 'string') lint(`${n.id}/${c.id} 结果`, c.result);
    }
  }
  for (const q of QUICKS) {
    lint(`短行动 ${q.id} 标签`, q.label);
    lint(`短行动 ${q.id} 结果`, q.result);
  }
  lint('回家文字', ARRIVAL_FIRST + ARRIVAL_AGAIN);
  const sample = newGame({ name: '林夏', gender: 'female', call: '', seed: 1, runId: 'check' });
  for (const id of ['normal', 'hidden', 'fail_fear', 'fail_health', 'timeout', 'fail_run'] as EndingId[]) {
    const v = endingView(sample, id);
    lint(`结局 ${id}`, v.title + v.paragraphs.join('') + v.closure);
  }

  // 4. 一个节点结尾必须有出口：每个节点至少有一个选项能结束它
  for (const n of ALL_NODES) {
    const exit = n.choices.some((c) => !c.repeat || c.ending);
    if (!exit) err(`${n.id} 的所有选项都是 repeat，玩家无法完成该节点`);
  }


  return { errors, report, nodes: ALL_NODES.length, sides: SIDES.length };
}
