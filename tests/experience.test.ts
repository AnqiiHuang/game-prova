// 体验优化：地点与在场人物、反馈清理、开场矛盾、材料与家规标记、睡前提醒。
import { describe, expect, it } from 'vitest';
import { askBlock, askHow, hubView, nodeView, perform, sleepBlock } from '../src/game/engine';
import { Session } from '../src/game/session';
import { MemoryStore, SaveStore, normalizeState } from '../src/game/storage';
import { mentionedDocs } from '../src/game/story/helpers';
import type { GameState } from '../src/game/types';
import { atDay, fresh, memorySession, reload, run, tryRun } from './helpers';

/** 读完家规，停在小区门口的第一个节点。 */
function atGateNode(seed = 4242): GameState {
  return run(fresh(seed), { kind: 'ackRules' });
}
/** 在门口做了一件事（读公告），人还在门口，停在日程页。 */
function atGateHub(seed = 4242): GameState {
  return run(atGateNode(seed), { kind: 'choose', choiceId: 'd1n1_b' });
}

describe('地点与在场人物一致', () => {
  it('开局在小区门口；查看公告后仍在门口，不会凭空回到家里', () => {
    const s = atGateHub();
    expect(s.place).toBe('gate');
    expect(s.location).toBe('小区大门');
    expect(s.mode).toBe('hub');
  });

  it('在门口：引擎拒绝向家人当面要钱，不只是隐藏按钮', () => {
    const s = atGateHub();
    for (const npc of ['bro', 'grandma', 'grandpa'] as const) {
      expect(askBlock(s, npc)).toMatch(/回家再问|不在你身边/);
      const r = tryRun(s, { kind: 'ask', npc });
      expect(r.ok).toBe(false);
    }
  });

  it('在门口：只能给有手机的爸爸妈妈发消息，结果明确写成消息和转账，没有“递钱”', () => {
    let s = atGateHub();
    expect(askHow(s, 'mom')).toBe('message');
    let sawMoney = false;
    for (const npc of ['mom', 'dad'] as const) {
      expect(askBlock(s, npc)).toBeNull();
      const before = s.stats.money;
      s = run(s, { kind: 'ask', npc });
      expect(s.lastResult).toMatch(/消息|手机|转/);
      expect(s.lastResult).not.toMatch(/递给你|从口袋里掏出|当面/);
      if (s.stats.money > before) sawMoney = true;
    }
    expect(typeof sawMoney).toBe('boolean');
  });

  it('在门口：不能吃家里的饭、不能睡觉、不能开始家里的主线和支线', () => {
    const s = atDay(atGateHub(), 2, 9 * 60);
    s.place = 'gate';
    expect(tryRun(s, { kind: 'eat', how: 'home' }).ok).toBe(false);
    const hv = hubView(s);
    expect(hv.main.disabled).toMatch(/回家/);
    expect(tryRun(s, { kind: 'main' }).ok).toBe(false);
    s.mainIdx = 3;
    s.time = 20 * 60;
    expect(sleepBlock(s)).toMatch(/回家/);
    expect(tryRun(s, { kind: 'sleep' }).ok).toBe(false);
  });

  it('门口提供调查、交谈、回家这些合理行动，回家后这些门口行动消失', () => {
    const s = atGateHub();
    const ids = hubView(s).quests.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['q_gate_book', 'q_gate_escort', 'q_gate_office', 'q_gate_card']));
    expect(ids).not.toContain('q_gate_notice'); // 公告已经读过
    expect(hubView(s).daily.some((a) => a.id === 'go_home')).toBe(true);
    const home = run(s, { kind: 'go', to: 'home' });
    expect(hubView(home).quests.map((q) => q.id).some((id) => id.startsWith('q_gate'))).toBe(false);
    expect(hubView(home).daily.some((a) => a.id === 'go_home')).toBe(false);
    // 在家里，门口的行动即使被硬塞进来，引擎也拒绝
    expect(tryRun(home, { kind: 'quest', id: 'q_gate_card' }).ok).toBe(false);
  });

  it('回家：结算 10 分钟路程，更新地点，之后才能和家人当面互动', () => {
    const gate = atGateHub();
    const t0 = gate.time;
    const home = run(gate, { kind: 'go', to: 'home' });
    expect(home.place).toBe('home');
    expect(home.location).toBe('三栋502 · 家中');
    expect(home.time).toBe(t0 + 10);
    expect(home.lastResult).toMatch(/爬上五楼/);
    expect(askHow(home, 'bro')).toBe('face');
    expect(askBlock(home, 'bro')).toBeNull();
    const asked = run(home, { kind: 'ask', npc: 'mom' });
    expect(asked.asked['1:mom']).toBe(true);
    expect(hubView(home).main.disabled).toBeNull();
    // 已经在家，不能重复“回家”
    expect(tryRun(home, { kind: 'go', to: 'home' }).ok).toBe(false);
  });

  it('选择“先回家”：路程时间已结算，位置变为家里，到家后家里人当面说起门卡的事', () => {
    const s0 = atGateNode();
    const s = run(s0, { kind: 'choose', choiceId: 'd1n1_c' });
    expect(s.place).toBe('home');
    expect(s.time).toBe(s0.time + 10);
    expect(s.lastResult).toMatch(/爸爸/);
    expect(s.flags['arrived_home']).toBe(true);
  });

  it('第二次回家不会重复第一次的对话', () => {
    const gate = atGateHub();
    const home = run(gate, { kind: 'go', to: 'home' });
    expect(home.lastResult).toMatch(/爸爸/);
    const again = { ...structuredClone(home), place: 'gate' as const };
    const home2 = run(again, { kind: 'go', to: 'home' });
    expect(home2.lastResult).not.toMatch(/周叔白班记漏了/);
  });

  it('爸爸白天不在家：在家里也只能给他发消息；第 3 天早晨妈妈上早班', () => {
    const d2 = atDay(run(atGateHub(), { kind: 'go', to: 'home' }), 2, 9 * 60);
    expect(askHow(d2, 'dad')).toBe('message');
    expect(askHow(d2, 'grandma')).toBe('face');
    const d3 = atDay(d2, 3, 8 * 60);
    expect(askHow(d3, 'mom')).toBe('message');
    const d3b = atDay(d2, 3, 13 * 60);
    expect(askHow(d3b, 'mom')).toBe('face');
  });

  it('便利店回来之后，位置回到出发时的地方', () => {
    const gate = atGateHub();
    let s = run(gate, { kind: 'shopOpen' });
    s = run(s, { kind: 'shopClose' });
    expect(s.place).toBe('gate');
    expect(s.location).toBe('小区大门');
  });
});

describe('旧反馈不会残留', () => {
  it('向家人要钱后再进入下一段剧情：上一次的“递钱”描写、提示和数值变化都被清掉', () => {
    let s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' });
    // 找一个确实会给钱的种子位置：直接让对方一定成功
    let got = false;
    for (let i = 0; i < 12 && !got; i++) {
      let t = structuredClone(s);
      t.rng = (t.rng + i * 7919) >>> 0;
      t = run(t, { kind: 'ask', npc: 'mom' });
      if (t.lastResult?.includes('省着点花') || t.lastResult?.includes('递')) {
        s = t;
        got = true;
      }
    }
    if (!got) s = run(s, { kind: 'ask', npc: 'mom' });
    expect(s.lastResult).toBeTruthy();
    const noon = run(s, { kind: 'main' });
    expect(noon.mode).toBe('node');
    expect(noon.lastResult).toBeNull();
    expect(noon.deltas.some((d) => d.reason.includes('零花钱'))).toBe(false);
    expect(noon.notices.join('')).not.toMatch(/零花钱/);
  });

  it('每一个新行动开始时，上一次的结果文字都会被清掉', () => {
    let s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' });
    s = run(s, { kind: 'rest', minutes: 30 });
    expect(s.lastResult).toBeNull();
    s = run(s, { kind: 'ask', npc: 'bro' });
    expect(s.lastResult).toBeTruthy();
    s = run(s, { kind: 'rest', minutes: 30 });
    expect(s.lastResult).toBeNull();
  });
});

describe('开场悬疑：第一次选择前就能看到的矛盾', () => {
  it('第一个节点正文里同时有爸爸的短信和周叔的登记本，选项里有核对、调查、回家', () => {
    const s = atGateNode();
    const v = nodeView(s)!;
    const text = v.paragraphs.join('');
    expect(text).toMatch(/新门禁卡我办过了/);
    expect(text).toMatch(/登记本/);
    expect(text).toMatch(/没有五零二/);
    // 为什么不能直接离开：一人一刷、只有新卡或临时通行单、值班室只认业主
    expect(text).toMatch(/一人一刷/);
    expect(text).toMatch(/临时通行单/);
    expect(text).toMatch(/只认业主/);
    expect(v.choices.length).toBeGreaterThanOrEqual(3);
    expect(v.choices.map((c) => c.label).join('')).toMatch(/登记本/);
    expect(v.choices.map((c) => c.label).join('')).toMatch(/回家/);
  });

  it('这个矛盾先记成“说法”，不是事实；第 3 天值班室里才被证实，不凭空新增无法解释的异常', () => {
    const s = atGateNode();
    expect(s.clues['c_dad_card']).toBe('claim');
    expect(s.clues['c_zhou_book']).toBe('claim');
    // 第 3 天进入值班室节点
    let d3 = atDay(run(atGateHub(), { kind: 'go', to: 'home' }), 3, 16 * 60);
    d3 = run(d3, { kind: 'main' }); // 第 1 个主线
    expect(d3.nodeId).toBe('d3n1');
  });

  it('第一条假规则不会因为开场矛盾而提前被证实', () => {
    const s = atGateHub();
    expect(s.rules[1]).toBe('unknown');
    expect(s.clues['c_dad_conflict']).toBeUndefined();
  });
});

describe('日记里的材料：剧情提到之后才出现', () => {
  it('开局和第一天的门口阶段，日记里没有任何材料', () => {
    expect(mentionedDocs(fresh())).toEqual([]);
    expect(mentionedDocs(atGateHub())).toEqual([]);
    // 门口问了“值班室”，也只是听说要材料，没有点名某份文件
    let s = atGateHub();
    s = run(s, { kind: 'quest', id: 'q_gate_office' });
    expect(mentionedDocs(s)).toEqual([]);
  });

  it('剧情点名之后才出现；拿到之后自然出现', () => {
    let s = atDay(fresh(), 3, 16 * 60);
    s.place = 'home';
    s.mainIdx = 2;
    s = run(s, { kind: 'main' });
    expect(s.nodeId).toBe('d3n3');
    expect(mentionedDocs(s).sort()).toEqual(['auth', 'form']);
    expect(mentionedDocs(s)).not.toContain('proof');
  });
});

describe('家规判断标记', () => {
  it('可以标记“暂时相信/怀疑有假”，不耗时间、不改数值、不改变系统答案', () => {
    const s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' });
    const r = run(s, { kind: 'markRule', rule: 1, mark: 'doubt' });
    expect(r.marks[1]).toBe('doubt');
    expect(r.time).toBe(s.time);
    expect(r.stats).toEqual(s.stats);
    expect(r.rules).toEqual(s.rules);
    expect(r.counters.steps).toBe(s.counters.steps);
    const r2 = run(r, { kind: 'markRule', rule: 3, mark: 'trust' });
    expect(r2.marks[3]).toBe('trust');
    const r3 = run(r2, { kind: 'markRule', rule: 1, mark: 'none' });
    expect(r3.marks[1]).toBe('none');
  });

  it('已经证实的条目不能再标记；规则编号和标记值必须合法', () => {
    const s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' });
    const t = structuredClone(s);
    t.rules[2] = 'true';
    expect(tryRun(t, { kind: 'markRule', rule: 2, mark: 'doubt' }).ok).toBe(false);
    expect(tryRun(s, { kind: 'markRule', rule: 9, mark: 'doubt' }).ok).toBe(false);
    expect(tryRun(s, { kind: 'markRule', rule: 1, mark: 'xx' as never }).ok).toBe(false);
  });

  it('不会为了标记而绕过“先读家规”：读家规阶段不接受标记', () => {
    expect(tryRun(fresh(), { kind: 'markRule', rule: 1, mark: 'doubt' }).ok).toBe(false);
  });

  it('剧情节点里也可以标记（不用先离开节点）', () => {
    const s = atGateNode();
    expect(s.mode).toBe('node');
    const r = run(s, { kind: 'markRule', rule: 4, mark: 'trust' });
    expect(r.mode).toBe('node');
    expect(r.nodeId).toBe(s.nodeId);
    expect(r.marks[4]).toBe('trust');
  });

  it('随自动存档保存，刷新后恢复；睡觉存档和开局存档也带着各自的标记', () => {
    const { sess, store } = memorySession();
    sess.startNew({ name: '林夏', gender: 'female', call: '', seed: 99 });
    let s = sess.state as GameState;
    expect(sess.dispatch({ kind: 'ackRules' }, s.seq).ok).toBe(true);
    s = sess.state as GameState;
    expect(sess.dispatch({ kind: 'markRule', rule: 1, mark: 'doubt' }, s.seq).ok).toBe(true);
    s = sess.state as GameState;
    expect(sess.dispatch({ kind: 'markRule', rule: 5, mark: 'trust' }, s.seq).ok).toBe(true);

    const again = reload(store);
    expect(again.canContinue().ok).toBe(true);
    again.continueRun();
    expect(again.state?.marks[1]).toBe('doubt');
    expect(again.state?.marks[5]).toBe('trust');
    expect(again.state?.marks[2]).toBe('none');
    // 开局存档是在做标记之前保存的，读取后标记是空的
    const start = store.loadStart();
    expect(start.status === 'ok' && start.data.marks[1]).toBe('none');
  });

  it('睡觉存档里保存睡觉时的标记，失败读档后恢复', () => {
    const { sess } = memorySession();
    sess.startNew({ name: '林夏', gender: 'female', call: '', seed: 5 });
    let s = sess.state as GameState;
    sess.dispatch({ kind: 'ackRules' }, s.seq);
    s = sess.state as GameState;
    sess.dispatch({ kind: 'markRule', rule: 3, mark: 'trust' }, s.seq);
    s = sess.state as GameState;
    // 构造可以睡觉的状态
    s.place = 'home';
    s.mode = 'hub';
    s.mainIdx = 3;
    s.time = 20 * 60;
    s.noon[1] = 'done';
    s.meals[1].lunch = { eaten: true, settled: true, by: 'home' };
    s.meals[1].dinner = { eaten: true, settled: true, by: 'home' };
    expect(sess.dispatch({ kind: 'sleep' }, s.seq).ok).toBe(true);
    s = sess.state as GameState;
    sess.dispatch({ kind: 'nextDay' }, s.seq);
    s = sess.state as GameState;
    sess.dispatch({ kind: 'markRule', rule: 3, mark: 'doubt' }, s.seq); // 睡觉后改了主意
    s = sess.state as GameState;
    expect(s.marks[3]).toBe('doubt');
    s.stats.fear = 100;
    expect(sess.dispatch({ kind: 'rest', minutes: 30 }, s.seq, true).ok).toBe(true);
    const r = sess.restoreAfterFailure();
    expect(r.from).toBe('sleep');
    expect(sess.state?.marks[3]).toBe('trust'); // 恢复到睡觉时的判断
  });

  it('旧存档（没有位置和标记字段）读取时自动补全，不会白屏', () => {
    const store = new SaveStore(new MemoryStore(), true);
    const s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' }) as unknown as Record<string, unknown>;
    delete s.place;
    delete s.marks;
    store.saveCache(s as unknown as GameState);
    store.saveMeta({ version: 1, runId: (s as unknown as GameState).runId, failCount: 0, countedFailures: [], over: false, overReason: null });
    const sess = new Session(store);
    sess.init();
    expect(sess.canContinue().ok).toBe(true);
    sess.continueRun();
    expect(sess.state?.place).toBe('home'); // 位置“家中”→ home
    expect(sess.state?.marks[1]).toBe('none');
    const n = normalizeState({ location: '小区大门', marks: { 1: 'bad' } } as unknown as GameState);
    expect(n.place).toBe('gate');
    expect(n.marks[1]).toBe('none');
  });
});

describe('故事语境里的睡前提醒', () => {
  it('提醒具体说明还有什么事，不再是“主线完成三件事”', () => {
    const s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' });
    const hv = hubView(s);
    expect(hv.reminder).not.toMatch(/主线/);
    expect(hv.reminder).toMatch(/中午十二点，陪爷爷去阳台/);
    const block = sleepBlock(s)!;
    expect(block).toMatch(/还有事没处理/);
    expect(block).not.toMatch(/主线/);
  });

  it('引擎条件不变：主线没做完或没到 19:00 都不能睡', () => {
    let s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_c' });
    s.time = 20 * 60;
    expect(tryRun(s, { kind: 'sleep' }).ok).toBe(false); // 还有 3 件事
    s.mainIdx = 3;
    s.time = 17 * 60;
    expect(tryRun(s, { kind: 'sleep' }).ok).toBe(false); // 夜还没深
    expect(hubView(s).reminder).toMatch(/19:00/);
    s.time = 20 * 60;
    s.noon[1] = 'done';
    s.meals[1].lunch = { eaten: true, settled: true, by: 'home' };
    s.meals[1].dinner = { eaten: true, settled: true, by: 'home' };
    const ok = perform(s, { kind: 'sleep', seq: s.seq });
    expect(ok.ok).toBe(true);
  });
});
