// 游戏引擎：统一处理行动、条件、资源、时间。
// 所有命令都是“一次完整操作”：先检查，再结算，最后产生新的状态（输入状态不被修改）。

import { MAIN_SLOTS, NODES, QUICKS, SIDES, mealVignette } from './story';
import { CLUE_MAP, DOC_INFO, ITEMS, NPCS, RULES } from './story/data';
import { pickMany, pick, randInt, nextFloat } from './random';
import { fmt, fmtTime, makeVoice } from './text';
import {
  ALL_TRAITS,
  Choice,
  ClueLevel,
  Command,
  CommandInput,
  CommandResult,
  Ctx,
  DocKey,
  EndingId,
  FAMILY_IDS,
  FamilyId,
  GameState,
  Gender,
  ItemId,
  LUCK_VALUE,
  LuckTier,
  MealRec,
  MealSlot,
  NpcId,
  QuickQuest,
  SAVE_VERSION,
  ShopItemId,
  SideDef,
  StatKey,
  StoryNode,
  Trait,
} from './types';

// ---------------- 常量 ----------------

export const WAKE = 7 * 60;
export const START_TIME = 10 * 60;
export const NOON_START = 12 * 60;
export const NOON_END = 13 * 60; // 13:00 之后视为错过
export const DAY_END = 24 * 60;
export const SLEEP_MIN = 19 * 60;
export const LAST_DAY = 7;
export const MAX_FAILS_RESTORABLE = 3;

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_NAME: Record<MealSlot, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
export const MEAL_WINDOW: Record<MealSlot, [number, number]> = {
  breakfast: [6 * 60, 10 * 60],
  lunch: [11 * 60, 14 * 60],
  dinner: [17 * 60, 21 * 60],
};

const STAT_LABEL: Record<StatKey, string> = {
  stamina: '体力',
  health: '健康',
  fear: '恐惧',
  int: '智力',
  luck: '幸运',
  money: '零花钱',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function emptyMeals(): Record<MealSlot, MealRec> {
  return {
    breakfast: { eaten: false, settled: false, by: 'none' },
    lunch: { eaten: false, settled: false, by: 'none' },
    dinner: { eaten: false, settled: false, by: 'none' },
  };
}

// ---------------- 新游戏 ----------------

export interface NewGameOptions {
  name: string;
  gender: Gender;
  call: string;
  seed: number;
  runId: string;
  // 只用于开发环境与测试：固定某些抽取结果
  force?: { helper?: FamilyId; luckTier?: LuckTier; traits?: Trait[] };
}

export function newGame(o: NewGameOptions): GameState {
  const h = { rng: o.seed >>> 0 };
  const traits = o.force?.traits ?? pickMany(h, ALL_TRAITS, 2);
  const luckTier: LuckTier = pick(h, ['high', 'mid', 'low'] as LuckTier[]);
  const health = randInt(h, 75, 100);
  const int = randInt(h, 60, 100);
  const helper: FamilyId = pick(h, FAMILY_IDS);
  const npcs = {} as GameState['npcs'];
  (Object.keys(NPCS) as NpcId[]).forEach((id) => {
    npcs[id] = { known: false, favor: 0, delta: 0, reason: '', day: 1 };
  });
  FAMILY_IDS.forEach((id) => {
    npcs[id] = { known: true, favor: randInt(h, 30, 70), delta: 0, reason: '', day: 1 };
  });
  const prices = {
    meds: randInt(h, 10, 18),
    bento: randInt(h, 8, 12),
    drink: randInt(h, 6, 10),
    car: randInt(h, 15, 25),
  };
  const tier = o.force?.luckTier ?? luckTier;
  const meals1 = emptyMeals();
  // 第一天从上午开始：早餐已在到家前吃过
  meals1.breakfast = { eaten: true, settled: true, by: 'home' };
  const s: GameState = {
    version: SAVE_VERSION,
    runId: o.runId,
    seed: o.seed >>> 0,
    rng: h.rng,
    seq: 0,
    day: 1,
    time: START_TIME,
    location: '小区大门',
    mode: 'rules',
    nodeId: null,
    mainIdx: 0,
    lastResult: null,
    lastNodeId: null,
    player: {
      name: o.name.trim() || '林夏',
      gender: o.gender,
      call: o.call.trim(),
      traits,
      luckTier: tier,
    },
    stats: {
      stamina: 100,
      health,
      fear: 0,
      int,
      luck: LUCK_VALUE[tier],
      money: 20,
    },
    inventory: { pen: 1, diary: 1, meds: 0, bento: 0, drink: 0, car: 0 },
    npcs,
    helper: o.force?.helper ?? helper,
    clues: {},
    notes: {},
    flags: {},
    rules: { 1: 'unknown', 2: 'unknown', 3: 'unknown', 4: 'unknown', 5: 'unknown' },
    docs: { form: false, proof: false, auth: false },
    sideDone: [],
    questDone: [],
    meals: { 1: meals1 },
    noon: { 1: 'pending' },
    noonLate: {},
    prices,
    stock: { meds: 3, bento: 2, drink: 3, car: 1 },
    shopOpen: false,
    asked: {},
    mishaps: [],
    visited: [],
    notices: [],
    deltas: [],
    brief: null,
    ending: null,
    rulesAck: false,
    counters: { steps: 0, missedMeals: 0, missedNoon: 0, minutes: 0 },
  };
  return s;
}

// ---------------- 上下文（剧情效果使用） ----------------

class Context implements Ctx {
  talkBonus = false;
  constructor(public s: GameState) {}

  private hasTrait(t: Trait) {
    return this.s.player.traits.includes(t);
  }

  stat(k: StatKey, d: number, why: string) {
    if (!d) return;
    let delta = d;
    if (k === 'fear' && d > 0 && this.hasTrait('沉稳')) delta = Math.max(1, Math.round(d * 0.6));
    if (k === 'health' && d < 0 && this.hasTrait('谨慎')) delta = Math.min(-1, Math.round(d * 0.8));
    const before = this.s.stats[k];
    let after = before + delta;
    if (k === 'money') after = Math.max(0, after);
    else if (k === 'luck') return;
    else after = clamp(after, 0, 100);
    this.s.stats[k] = after;
    if (after !== before) this.s.deltas.push({ label: STAT_LABEL[k], delta: after - before, reason: why });
  }

  favor(n: NpcId, d: number, why: string) {
    if (!this.s.npcs[n].known) this.meet(n);
    let delta = d;
    if (d > 0 && this.talkBonus) delta += 1;
    const npc = this.s.npcs[n];
    const before = npc.favor;
    npc.favor = clamp(before + delta, 0, 100);
    const real = npc.favor - before;
    if (real !== 0) {
      npc.delta = real;
      npc.reason = why;
      npc.day = this.s.day;
      this.s.deltas.push({ label: `${NPCS[n].name}好感`, delta: real, reason: why });
    }
  }

  meet(n: NpcId) {
    const npc = this.s.npcs[n];
    if (npc.known) return;
    const [lo, hi] = NPCS[n].init;
    npc.known = true;
    npc.favor = randInt(this.s, lo, hi);
    npc.delta = 0;
    npc.reason = '初次见面';
    npc.day = this.s.day;
    this.s.notices.push(`*提示：你认识了${NPCS[n].name}（${NPCS[n].identity}）。`);
  }

  clue(id: string, lvl: ClueLevel = 'suspect') {
    const def = CLUE_MAP[id];
    if (!def) throw new Error(`未知线索：${id}`);
    const cur = this.s.clues[id];
    if (cur === 'confirmed') return;
    if (cur === 'suspect' && lvl === 'suspect') return;
    this.s.clues[id] = lvl;
    this.s.notices.push(`*提示：日记新增${lvl === 'confirmed' ? '【已证实】' : '【怀疑】'}${def.title}。`);
  }

  note(key: string, text: string) {
    if (this.s.notes[key]) return;
    this.s.notes[key] = text;
    this.s.notices.push('*提示：日记里多了一条观察。');
  }

  flag(k: string, v: boolean | number | string = true) {
    this.s.flags[k] = v;
  }
  num(k: string) {
    const v = this.s.flags[k];
    return typeof v === 'number' ? v : 0;
  }
  has(k: string) {
    return !!this.s.flags[k];
  }

  item(id: ItemId, n: number) {
    this.s.inventory[id] = Math.max(0, this.s.inventory[id] + n);
  }

  rule(n: number, st: 'true' | 'false') {
    if (this.s.rules[n] === st) return;
    this.s.rules[n] = st;
    this.s.notices.push(`*提示：家规第${n}条，已证实为${st === 'true' ? '真' : '假'}。`);
  }

  doc(k: DocKey) {
    if (this.s.docs[k]) return;
    this.s.docs[k] = true;
    this.s.notices.push(`*提示：你拿到了「${DOC_INFO[k].name}」。`);
  }

  say(t: string) {
    this.s.notices.push(`*提示：${t}`);
  }

  rand() {
    return nextFloat(this.s);
  }
}

// ---------------- 时间与结算 ----------------

function missMeal(g: Context, slot: MealSlot) {
  const m = g.s.meals[g.s.day][slot];
  m.settled = true;
  m.by = 'missed';
  g.s.counters.missedMeals++;
  g.stat('stamina', -10, `没吃${SLOT_NAME[slot]}`);
  g.stat('health', -6, `没吃${SLOT_NAME[slot]}`);
  g.stat('fear', 3, `没吃${SLOT_NAME[slot]}，心里发慌`);
  g.say(`你没有吃${SLOT_NAME[slot]}，有些头晕乏力。`);
  g.rule(5, 'true');
}

/** 推进游戏时间，并结算跨过的中午约定与餐次检查点。 */
function advance(g: Context, minutes: number) {
  const s = g.s;
  const end = Math.min(DAY_END, s.time + Math.max(0, minutes));
  s.counters.minutes += end - s.time;
  s.time = end;
  if (s.noon[s.day] === 'pending' && end >= NOON_END) {
    s.noon[s.day] = 'missed';
    s.noonLate[s.day] = true;
    s.counters.missedNoon++;
    g.favor('grandpa', -6, '你错过了中午陪他晒太阳的约定');
    g.stat('fear', 6, '错过中午的约定，心里过意不去');
    g.say('你错过了中午的约定。爷爷自己在阳台门口坐了一会儿，被奶奶劝回了屋里。');
  }
  for (const slot of SLOTS) {
    const m = s.meals[s.day][slot];
    if (!m.settled && !m.eaten && end >= MEAL_WINDOW[slot][1]) missMeal(g, slot);
  }
}

export function crossWarning(s: GameState, minutes: number): string | null {
  if (minutes <= 0) return null;
  const end = Math.min(DAY_END, s.time + minutes);
  if (s.day === LAST_DAY && end >= DAY_END) {
    return '这个行动会用掉第七天的最后一点时间。结算后，本轮将因期限到而结束。确定要这样做吗？';
  }
  if (s.noon[s.day] === 'pending') {
    if (end >= NOON_END)
      return '这个行动会让你错过中午陪爷爷去阳台的约定（13:00 之后算错过）。确定继续吗？';
    if (s.time < NOON_START && end > NOON_START)
      return '这个行动会跨过中午 12:00 的约定。12:00—13:00 之间还能补上，13:00 以后就算错过。确定继续吗？';
  }
  return null;
}

function failureCheck(g: Context) {
  const s = g.s;
  if (s.ending) return;
  if (s.stats.fear >= 100) {
    s.ending = { id: 'fail_fear', failureId: `${s.runId}:${s.seq}` };
  } else if (s.stats.health <= 0) {
    s.ending = { id: 'fail_health', failureId: `${s.runId}:${s.seq}` };
  } else if (s.day === LAST_DAY && s.time >= DAY_END) {
    s.ending = { id: 'timeout' };
  }
  if (s.ending) {
    s.mode = 'ended';
    s.nodeId = null;
    s.shopOpen = false;
  }
}

// ---------------- 节点进入 ----------------

function enterNode(g: Context, nodeId: string) {
  const s = g.s;
  const node = NODES[nodeId];
  if (!node) throw new Error(`节点不存在：${nodeId}`);
  s.mode = 'node';
  s.nodeId = nodeId;
  s.lastNodeId = nodeId;
  s.location = node.location;
  s.shopOpen = false;
  node.present.forEach((n) => g.meet(n));
  // 轻微意外：每个节点最多一次，不会丢任务道具
  if (node.kind !== 'mini' && !s.mishaps.includes(nodeId)) {
    s.mishaps.push(nodeId);
    const p = s.stats.luck < 20 ? 0.4 : s.stats.luck < 80 ? 0.05 : 0;
    const r = nextFloat(s);
    if (r < p) {
      const kind = Math.floor(nextFloat(s) * 3);
      if (kind === 0 && s.stats.money >= 2) {
        g.stat('money', -2, '路上掉了几枚硬币，滚进了排水沟');
        g.say('运气不太好：你路上掉了几枚硬币。');
      } else if (kind === 1) {
        g.stat('stamina', -(s.player.traits.includes('谨慎') ? 3 : 6), '走错了路，多绕了一段');
        g.say('运气不太好：你走错了路，多绕了一段。');
      } else {
        g.stat('stamina', -4, '踩空了一级台阶，崴了一下脚');
        g.say('运气不太好：你在楼梯上崴了一下脚，不严重。');
      }
    }
  }
  node.onEnter?.(g);
}

// ---------------- 选项相关计算 ----------------

export function choiceMinutes(s: GameState, c: Choice): number {
  let m = c.minutes;
  if (c.investigate) {
    m *= 1 - (clamp(s.stats.int, 60, 100) - 60) / 40 * 0.2;
    if (s.player.traits.includes('急性子')) m *= 0.85;
  }
  return m <= 0 ? 0 : Math.max(5, Math.round(m / 5) * 5);
}

export function choiceStamina(s: GameState, c: Choice): number {
  const base = c.stamina ?? 0;
  return base > 0 && s.player.traits.includes('急性子') ? base + 2 : base;
}

export function unmetReqs(s: GameState, reqs?: { text: string; test: (s: GameState) => boolean }[]): string[] {
  return (reqs ?? []).filter((r) => !r.test(s)).map((r) => r.text);
}

function choiceBlock(s: GameState, c: Choice): string | null {
  const miss = unmetReqs(s, c.requires);
  if (miss.length) return `缺少：${miss.join('、')}`;
  const st = choiceStamina(s, c);
  if (st > s.stats.stamina) return `体力不足（需要 ${st}，现在 ${s.stats.stamina}）。可以先休息或使用饮料。`;
  if (c.minHealth && s.stats.health < c.minHealth) return `健康偏低（需要 ${c.minHealth} 以上），先休息或用药。`;
  return null;
}

export function visibleChoices(s: GameState, node: StoryNode): Choice[] {
  return node.choices.filter((c) => !c.visible || c.visible(s));
}

// ---------------- 视图 ----------------

export interface ChoiceView {
  id: string;
  label: string;
  tag?: string;
  minutes: number;
  stamina: number;
  disabled: string | null;
  warn: string | null;
  risk?: string;
  hint?: string;
}

export interface NodeView {
  title: string;
  location: string;
  kind: StoryNode['kind'];
  paragraphs: string[];
  present: NpcId[];
  choices: ChoiceView[];
}

export function voiceOf(s: GameState) {
  return makeVoice(s.player);
}

export function nodeView(s: GameState): NodeView | null {
  if (!s.nodeId) return null;
  const node = NODES[s.nodeId];
  const v = voiceOf(s);
  const paragraphs = [...node.paragraphs];
  (node.variants ?? []).forEach((va) => {
    if (va.when(s)) paragraphs.push(...va.paragraphs);
  });
  const careful = s.player.traits.includes('细心');
  return {
    title: node.title,
    location: node.location,
    kind: node.kind,
    paragraphs: paragraphs.map((p) => fmt(p, v)),
    present: node.present,
    choices: visibleChoices(s, node).map((c) => {
      const minutes = choiceMinutes(s, c);
      const hintAt = c.hintInt ? c.hintInt.min - (careful ? 10 : 0) : 999;
      return {
        id: c.id,
        label: fmt(c.label, v),
        tag: c.tag,
        minutes,
        stamina: choiceStamina(s, c),
        disabled: choiceBlock(s, c),
        warn: crossWarning(s, minutes),
        risk: c.risk,
        hint: c.hintInt && s.stats.int >= hintAt ? fmt(c.hintInt.text, v) : undefined,
      };
    }),
  };
}

export interface ActionView {
  id: string;
  label: string;
  sub?: string;
  disabled: string | null;
  cmd: Command;
  warn?: string | null;
}

export interface HubView {
  main: ActionView;
  sides: ActionView[];
  quests: ActionView[];
  daily: ActionView[];
  sleep: ActionView;
  currentSlot: MealSlot | null;
  mainTotal: number;
}

export function currentMealSlot(s: GameState): MealSlot | null {
  for (const slot of SLOTS) {
    const [a, b] = MEAL_WINDOW[slot];
    if (s.time >= a && s.time < b && !s.meals[s.day][slot].eaten) return slot;
  }
  return null;
}

function mealWindowText() {
  return `早餐 06:00–10:00，午餐 11:00–14:00，晚餐 17:00–21:00`;
}

export function eatBlock(s: GameState, how: 'home' | 'bento'): string | null {
  if (s.shopOpen) return '你还在便利店里，先离开便利店。';
  const slot = currentMealSlot(s);
  if (!slot) {
    const open = SLOTS.find((sl) => {
      const [a, b] = MEAL_WINDOW[sl];
      return s.time >= a && s.time < b;
    });
    if (open) return `${SLOT_NAME[open]}已经吃过了。`;
    return `现在不是用餐时间（${mealWindowText()}）。`;
  }
  if (how === 'bento' && s.inventory.bento <= 0) return '背包里没有便当。';
  return null;
}

function healthyEnoughToTime(s: GameState) {
  return s.time < DAY_END;
}

export function useBlock(s: GameState, item: 'meds' | 'drink'): string | null {
  if (s.inventory[item] <= 0) return `背包里没有${ITEMS[item].name}。`;
  if (item === 'meds' && s.stats.health >= 100) return '健康已经是满的。';
  if (item === 'drink' && s.stats.stamina >= 100) return '体力已经是满的。';
  return null;
}

export function askBlock(s: GameState, npc: FamilyId): string | null {
  if (s.shopOpen) return '你还在便利店里，先离开便利店。';
  if (s.asked[`${s.day}:${npc}`]) return '今天已经问过了。';
  if (s.time >= DAY_END) return '太晚了。';
  return null;
}

export function buyBlock(s: GameState, item: ShopItemId): string | null {
  if (!s.shopOpen) return '你不在便利店。';
  if (s.stock[item] <= 0) return '已售罄。';
  if (s.stats.money < s.prices[item]) return `零花钱不够（需要 ${s.prices[item]} 元）。`;
  if (item === 'car' && !s.clues['c_bro_toy']) return '你还没有理由买它。（也许该先留意一下家里人想要什么。）';
  return null;
}

function sideBlock(s: GameState, d: SideDef): string | null {
  if (s.shopOpen) return '你还在便利店里，先离开便利店。';
  if (d.once && s.sideDone.includes(d.id)) return '已经完成。';
  const miss = unmetReqs(s, d.requires);
  if (miss.length) return `缺少：${miss.join('、')}`;
  if (d.minStamina && s.stats.stamina < d.minStamina) return `体力不足（需要 ${d.minStamina}）。`;
  if (d.minHealth && s.stats.health < d.minHealth) return `健康偏低（需要 ${d.minHealth} 以上）。`;
  return null;
}

function questBlock(s: GameState, q: QuickQuest): string | null {
  if (s.shopOpen) return '你还在便利店里，先离开便利店。';
  if (s.questDone.includes(q.id)) return '已经完成。';
  const miss = unmetReqs(s, q.requires);
  if (miss.length) return `缺少：${miss.join('、')}`;
  if ((q.stamina ?? 0) > s.stats.stamina) return `体力不足（需要 ${q.stamina}）。`;
  if ((q.money ?? 0) > s.stats.money) return `零花钱不够（需要 ${q.money} 元）。`;
  if (s.time + q.minutes > DAY_END) return '太晚了。';
  return null;
}

function mainPlan(s: GameState): { wait: number; nodeId: string; noon: boolean } | null {
  const slots = MAIN_SLOTS[s.day];
  if (!slots || s.mainIdx >= slots.length) return null;
  const slot = slots[s.mainIdx];
  const noon = !!slot.noon;
  const minTime = noon ? NOON_START : slot.minTime ?? 0;
  const wait = Math.max(0, minTime - s.time);
  return { wait, nodeId: slot.nodeId, noon };
}

export function sleepBlock(s: GameState): string | null {
  if (s.shopOpen) return '你还在便利店里，先离开便利店。';
  const total = MAIN_SLOTS[s.day]?.length ?? 3;
  if (s.mainIdx < total) return '今天的主线事件还没有完成，不能睡觉。';
  if (s.time < SLEEP_MIN) return `还没到睡觉的时候（${fmtTime(SLEEP_MIN)} 之后可以睡）。`;
  return null;
}

export function hubView(s: GameState): HubView {
  const slots = MAIN_SLOTS[s.day] ?? [];
  const plan = mainPlan(s);
  let main: ActionView;
  if (!plan) {
    main = { id: 'main', label: '今天的主线已经完成', sub: '处理支线或日常，然后睡觉并存档', disabled: '主线已完成', cmd: { kind: 'main' } };
  } else {
    const slot = slots[s.mainIdx];
    let label: string;
    let sub: string | undefined;
    if (plan.noon) {
      if (s.noon[s.day] === 'missed') {
        label = '补陪爷爷去阳台（已经错过中午）';
        sub = '不耗时，但约定已经错过';
      } else if (s.time < NOON_START) {
        label = '等到中午并陪爷爷去阳台';
        sub = `等待 ${plan.wait} 分钟，到 12:00`;
      } else {
        label = '现在就陪爷爷去阳台';
        sub = '已经过了 12:00，爷爷在等你';
      }
    } else if (plan.wait > 0) {
      label = `等到 ${fmtTime(s.time + plan.wait)} 之后，继续：${slot.label}`;
      sub = `等待 ${plan.wait} 分钟`;
    } else {
      label = `${s.mainIdx === 0 ? '开始' : '继续'}：${slot.label}`;
    }
    main = {
      id: 'main',
      label,
      sub,
      disabled: s.shopOpen ? '你还在便利店里，先离开便利店。' : null,
      cmd: { kind: 'main' },
      warn: crossWarning(s, plan.wait),
    };
  }
  const sides: ActionView[] = SIDES.filter((d) => d.visible(s) && !(d.once && s.sideDone.includes(d.id))).map((d) => ({
    id: d.id,
    label: d.label,
    sub: `${d.eta} · ${d.note}`,
    disabled: sideBlock(s, d),
    cmd: { kind: 'side', id: d.id } as Command,
  }));
  const quests: ActionView[] = QUICKS.filter((q) => q.visible(s) && !s.questDone.includes(q.id)).map((q) => ({
    id: q.id,
    label: q.label,
    sub: `${q.minutes} 分钟${q.money ? `，${q.money} 元` : ''} · ${q.note}`,
    disabled: questBlock(s, q),
    cmd: { kind: 'quest', id: q.id } as Command,
    warn: crossWarning(s, q.minutes),
  }));
  const slot = currentMealSlot(s);
  const daily: ActionView[] = [
    {
      id: 'eat_home',
      label: slot ? `吃家里的${SLOT_NAME[slot]}` : '吃家里的饭',
      sub: '30 分钟 · 体力 +10',
      disabled: eatBlock(s, 'home'),
      cmd: { kind: 'eat', how: 'home' },
      warn: crossWarning(s, 30),
    },
    {
      id: 'eat_bento',
      label: slot ? `吃便当当${SLOT_NAME[slot]}` : '吃便当',
      sub: `20 分钟 · 健康 +5 · 现有 ${s.inventory.bento} 份`,
      disabled: eatBlock(s, 'bento'),
      cmd: { kind: 'eat', how: 'bento' },
      warn: crossWarning(s, 20),
    },
    {
      id: 'rest30',
      label: '休息半小时',
      sub: '30 分钟 · 体力 +10',
      disabled: s.shopOpen ? '你还在便利店里，先离开便利店。' : s.time + 30 > DAY_END ? '太晚了。' : null,
      cmd: { kind: 'rest', minutes: 30 },
      warn: crossWarning(s, 30),
    },
    {
      id: 'rest60',
      label: '歇一个小时',
      sub: '60 分钟 · 体力 +18',
      disabled: s.shopOpen ? '你还在便利店里，先离开便利店。' : s.time + 60 > DAY_END ? '太晚了。' : null,
      cmd: { kind: 'rest', minutes: 60 },
      warn: crossWarning(s, 60),
    },
    {
      id: 'shop',
      label: '去小区便利店',
      sub: '往返 30 分钟 · 可以买东西',
      disabled: s.shopOpen ? '你已经在便利店了。' : s.time + 30 > 23 * 60 ? '便利店快关门了。' : null,
      cmd: { kind: 'shopOpen' },
      warn: crossWarning(s, 30),
    },
  ];
  return { main, sides, quests, daily, sleep: sleepView(s), currentSlot: slot, mainTotal: slots.length };
}

function sleepView(s: GameState): ActionView {
  return {
    id: 'sleep',
    label: '睡觉并存档',
    sub: s.day >= LAST_DAY ? '第七天结束，本轮将结算' : '结算今天，保存明天起床的状态',
    disabled: sleepBlock(s),
    cmd: { kind: 'sleep' },
  };
}

// ---------------- 命令执行 ----------------

function fail(reason: string): CommandResult {
  return { ok: false, reason };
}

function begin(s: GameState): Context {
  s.seq += 1;
  s.counters.steps += 1;
  s.notices = [];
  s.deltas = [];
  return new Context(s);
}

function finish(g: Context): CommandResult {
  failureCheck(g);
  return { ok: true, state: g.s };
}

export function perform(prev: GameState, input: CommandInput): CommandResult {
  if (input.seq !== prev.seq) return fail('stale');
  if (prev.mode === 'ended') return fail('本轮已经结束。');
  const cmd: Command = input;
  const s: GameState = structuredClone(prev);
  const v = voiceOf(s);

  if (prev.mode === 'rules') {
    if (cmd.kind !== 'ackRules') return fail('请先阅读家规。');
    const g = begin(s);
    s.rulesAck = true;
    s.mode = 'hub';
    s.location = '小区大门';
    // 读完家规后直接进入第一段剧情
    enterNode(g, MAIN_SLOTS[1][0].nodeId);
    return finish(g);
  }

  if (cmd.kind === 'nextDay') {
    if (prev.mode !== 'brief') return fail('现在不需要这个操作。');
    const g = begin(s);
    s.mode = 'hub';
    s.brief = null;
    return finish(g);
  }

  if (prev.mode === 'brief') return fail('请先看完昨天的简报。');

  // 剧情节点中：只能选择当前节点的选项
  if (prev.mode === 'node') {
    if (cmd.kind !== 'choose') return fail('请先做出选择。');
    const node = NODES[prev.nodeId!];
    const c = visibleChoices(prev, node).find((x) => x.id === cmd.choiceId);
    if (!c) return fail('这个选项不存在。');
    const block = choiceBlock(prev, c);
    if (block) return fail(block);
    const minutes = choiceMinutes(prev, c);
    const warn = crossWarning(prev, minutes);
    if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
    return applyChoice(s, node, c, minutes, v);
  }

  // 日程页
  switch (cmd.kind) {
    case 'choose':
      return fail('现在没有需要选择的剧情。');
    case 'ackRules':
      return fail('现在不需要这个操作。');
    case 'shopClose': {
      if (!s.shopOpen) return fail('你不在便利店。');
      const g = begin(s);
      s.shopOpen = false;
      s.location = '三栋502 · 家中';
      g.say('你离开了便利店，回到家里。');
      return finish(g);
    }
    case 'buy': {
      const block = buyBlock(prev, cmd.item);
      if (block) return fail(block);
      const g = begin(s);
      s.stats.money -= s.prices[cmd.item];
      s.stock[cmd.item] -= 1;
      s.inventory[cmd.item] += 1;
      s.deltas.push({ label: '零花钱', delta: -s.prices[cmd.item], reason: `买了${ITEMS[cmd.item].name}` });
      g.say(`买下了${ITEMS[cmd.item].name}，放进了背包。买到不等于用掉，需要时再使用。`);
      return finish(g);
    }
    case 'use': {
      const block = useBlock(prev, cmd.item);
      if (block) return fail(block);
      const warn = crossWarning(prev, 5);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      s.inventory[cmd.item] -= 1;
      if (cmd.item === 'meds') g.stat('health', 20, '用了药品');
      else g.stat('stamina', 25, '喝了黄牛饮料');
      advance(g, 5);
      return finish(g);
    }
    default:
      break;
  }

  // 以下命令在便利店内不可用
  if (s.shopOpen && cmd.kind !== 'shopOpen') return fail('你还在便利店里，先离开便利店。');

  switch (cmd.kind) {
    case 'main': {
      const plan = mainPlan(prev);
      if (!plan) return fail('今天的主线已经完成。');
      const warn = crossWarning(prev, plan.wait);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      if (plan.wait > 0) advance(g, plan.wait);
      if (plan.noon) {
        if (s.noon[s.day] === 'pending') {
          s.noon[s.day] = 'done';
          s.noonLate[s.day] = s.time > NOON_START + 10;
        }
      }
      if (s.ending) return finish(g);
      enterNode(g, plan.nodeId);
      return finish(g);
    }
    case 'side': {
      const def = SIDES.find((d) => d.id === cmd.id);
      if (!def || !def.visible(prev)) return fail('这个支线现在不存在。');
      const block = sideBlock(prev, def);
      if (block) return fail(block);
      const g = begin(s);
      enterNode(g, def.nodeId);
      return finish(g);
    }
    case 'quest': {
      const q = QUICKS.find((x) => x.id === cmd.id);
      if (!q || !q.visible(prev)) return fail('这个行动现在不存在。');
      const block = questBlock(prev, q);
      if (block) return fail(block);
      const warn = crossWarning(prev, q.minutes);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      if (q.stamina) g.stat('stamina', -q.stamina, q.label);
      if (q.money) g.stat('money', -q.money, q.label);
      advance(g, q.minutes);
      q.effect(g);
      s.questDone.push(q.id);
      s.lastResult = fmt(q.result, v);
      return finish(g);
    }
    case 'eat': {
      const block = eatBlock(prev, cmd.how);
      if (block) return fail(block);
      const slot = currentMealSlot(prev)!;
      const mins = cmd.how === 'home' ? 30 : 20;
      const warn = crossWarning(prev, mins);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      // 第 3 天的晚饭有一个“饭菜有问题”的小插曲
      if (s.day === 3 && slot === 'dinner' && cmd.how === 'home' && !s.flags['food3_seen']) {
        s.flags['food3_seen'] = true;
        enterNode(g, 'mini_d3_food');
        return finish(g);
      }
      const rec = s.meals[s.day][slot];
      rec.eaten = true;
      rec.settled = true;
      if (cmd.how === 'home') {
        rec.by = 'home';
        g.stat('stamina', 10, `吃了家里的${SLOT_NAME[slot]}`);
        g.say(mealVignette(s, slot));
      } else {
        rec.by = 'bento';
        s.inventory.bento -= 1;
        g.stat('health', 5, '吃了便当');
        g.stat('stamina', 5, '吃了便当');
        g.say(`你把便当当作${SLOT_NAME[slot]}，吃完了。`);
      }
      advance(g, mins);
      s.lastResult = null;
      return finish(g);
    }
    case 'rest': {
      if (s.time + cmd.minutes > DAY_END) return fail('太晚了。');
      const warn = crossWarning(prev, cmd.minutes);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      g.stat('stamina', cmd.minutes === 30 ? 10 : 18, '休息了一会儿');
      advance(g, cmd.minutes);
      return finish(g);
    }
    case 'shopOpen': {
      if (s.shopOpen) return fail('你已经在便利店了。');
      if (s.time + 30 > 23 * 60) return fail('便利店快关门了。');
      const warn = crossWarning(prev, 30);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      s.shopOpen = true;
      s.location = '小区便利店';
      g.meet('chen');
      advance(g, 30);
      g.say('你到了小区便利店。在这里买东西不再额外耗时。');
      return finish(g);
    }
    case 'ask': {
      const block = askBlock(prev, cmd.npc);
      if (block) return fail(block);
      const warn = crossWarning(prev, 5);
      if (warn && !input.confirm) return { ok: false, confirm: true, reason: warn };
      const g = begin(s);
      s.asked[`${s.day}:${cmd.npc}`] = true;
      const favor = s.npcs[cmd.npc].favor;
      const talk = s.player.traits.includes('健谈') ? 0.1 : 0;
      const p = clamp(0.15 + favor * 0.007 + talk, 0.1, 0.9);
      const amount = cmd.npc === 'bro' ? 3 : favor >= 60 ? 10 : 5;
      const roll = nextFloat(s);
      const name = NPCS[cmd.npc].name;
      if (roll < p) {
        g.stat('money', amount, `${name}给了零花钱`);
        g.favor(cmd.npc, 1, '你开口要零花钱，对方痛快地给了');
        s.lastResult = fmt(
          cmd.npc === 'bro'
            ? '小宇翻出他的小铁盒，数了半天，抓了几枚硬币放在你手里：“只能给这么多。”'
            : `${name}想了想，从口袋里掏出一些钱递给你：“省着点花。”`,
          v,
        );
      } else {
        s.lastResult = fmt(
          cmd.npc === 'dad'
            ? '爸爸皱了皱眉：“要钱做什么？家里有吃有住。”他没有再多说。今天看来是问不出了。'
            : cmd.npc === 'bro'
              ? '小宇把铁盒抱得紧紧的：“今天不行，我要攒钱买小汽车！”'
              : `${name}摇摇头：“今天手头紧，改天吧。”`,
          v,
        );
      }
      advance(g, 5);
      return finish(g);
    }
    case 'sleep': {
      const block = sleepBlock(prev);
      if (block) return fail(block);
      const g = begin(s);
      return doSleep(g);
    }
    default:
      return fail('未知命令。');
  }
}

function applyChoice(s: GameState, node: StoryNode, c: Choice, minutes: number, v: ReturnType<typeof voiceOf>): CommandResult {
  const g = begin(s);
  g.talkBonus = c.tag === '对话' && s.player.traits.includes('健谈');
  const st = choiceStamina(s, c);
  if (st) g.stat('stamina', -st, `${c.label.slice(0, 12)}…耗费体力`);
  advance(g, minutes);
  // 完成餐次（小插曲：饭菜有问题）
  if (c.meal) {
    const rec = s.meals[s.day].dinner;
    if (!rec.eaten && !rec.settled) {
      rec.eaten = true;
      rec.settled = true;
      rec.by = c.meal;
      if (c.meal === 'home') g.stat('stamina', 10, '吃了家里的晚饭');
    }
  }
  c.effect?.(g);
  g.talkBonus = false;
  const res = typeof c.result === 'function' ? c.result(g) : c.result;
  s.lastResult = fmt(res, v);
  // 节点完成
  if (!c.repeat) {
    if (node.kind === 'main') {
      s.mainIdx += 1;
      s.visited.push(node.id);
    } else if (node.kind === 'side') {
      const def = SIDES.find((d) => d.nodeId === node.id);
      if (def && !s.sideDone.includes(def.id)) s.sideDone.push(def.id);
    }
  }
  s.nodeId = null;
  s.mode = 'hub';
  if (c.ending) {
    s.ending = { id: c.ending };
    s.mode = 'ended';
    return { ok: true, state: s };
  }
  if (c.next) enterNode(g, c.next);
  return finish(g);
}

function doSleep(g: Context): CommandResult {
  const s = g.s;
  const day = s.day;
  for (const slot of SLOTS) {
    const m = s.meals[day][slot];
    if (!m.settled && !m.eaten) missMeal(g, slot);
  }
  if (s.noon[day] === 'pending') {
    s.noon[day] = 'missed';
    s.counters.missedNoon++;
  }
  const hadMiss = SLOTS.some((sl) => s.meals[day][sl].by === 'missed');
  const sym = (m: MealRec) => (m.by === 'missed' ? '✗' : '✓');
  const lines: string[] = [];
  lines.push(
    `三餐：早${sym(s.meals[day].breakfast)} 午${sym(s.meals[day].lunch)} 晚${sym(s.meals[day].dinner)}`,
  );
  lines.push(
    s.noon[day] === 'done' ? '中午：陪爷爷去了阳台。' : '中午：错过了陪爷爷去阳台的约定。',
  );
  g.stat('stamina', 45, '睡了一觉');
  if (!hadMiss) g.stat('health', 3, '三餐按时，睡得踏实');
  g.stat('fear', -8, '睡了一觉，心里安稳了些');
  const clueN = Object.keys(s.clues).length;
  const conf = Object.values(s.clues).filter((l) => l === 'confirmed').length;
  lines.push(`日记：已记录 ${clueN} 条线索，其中 ${conf} 条已证实。`);
  if (day >= LAST_DAY) {
    s.ending = { id: 'timeout' };
    s.mode = 'ended';
    s.brief = { day, lines };
    return { ok: true, state: s };
  }
  s.day = day + 1;
  s.time = WAKE;
  s.mainIdx = 0;
  s.noon[s.day] = 'pending';
  s.meals[s.day] = emptyMeals();
  s.shopOpen = false;
  s.location = '三栋502 · 家中';
  s.nodeId = null;
  s.lastResult = null;
  const left = LAST_DAY - day;
  g.stat('fear', s.day >= 3 ? 2 : 0, '清晨，那个声音又提醒了一次期限');
  lines.push(`清晨，那个声音说：“还剩 ${left} 天。”`);
  lines.push(`体力 ${s.stats.stamina}　健康 ${s.stats.health}　恐惧 ${s.stats.fear}　零花钱 ${s.stats.money} 元`);
  s.brief = { day, lines };
  s.mode = 'brief';
  return finish(g);
}

// ---------------- 其他工具 ----------------

export function ruleLines(): string[] {
  return RULES.map((r) => `${r.n}. ${r.text}`);
}

export function endingFailureKind(id: EndingId): boolean {
  return id === 'fail_fear' || id === 'fail_health';
}

/** 供睡眠存档使用：下一天起床的状态（去掉“简报”阶段，直接回到日程页）。 */
export function wakeSnapshot(s: GameState): GameState {
  const c = structuredClone(s);
  c.mode = 'hub';
  c.brief = null;
  return c;
}

/** 仅用于开发环境：跳到某一天的清晨。 */
export function devJumpToDay(s: GameState, day: number): GameState {
  const c = structuredClone(s);
  c.rulesAck = true;
  c.mode = 'hub';
  c.nodeId = null;
  c.day = day;
  c.time = WAKE;
  c.mainIdx = 0;
  c.noon[day] = 'pending';
  c.meals[day] = emptyMeals();
  c.ending = null;
  c.seq += 1;
  return c;
}
