// 第二轮优化：行动分层、委托的出现顺序、开场疑点的层次与日记分类。
import { describe, expect, it } from 'vitest';
import { hubAlerts, hubView, nodeView, pendingThings, perform } from '../src/game/engine';
import { MAIN_SLOTS, NODES } from '../src/game/story';
import { ARRIVAL_FIRST, GATE_BOOK_RESULT } from '../src/game/story/quests';
import { hypothesisViews } from '../src/game/story/hypotheses';
import { TASKS, TASK_MAP, taskGiven, taskViews } from '../src/game/story/tasks';
import type { GameState } from '../src/game/types';
import { playBot } from './bot';
import { atDay, fresh, memorySession, reload, run, tryRun } from './helpers';

const atGateNode = (seed = 777) => run(fresh(seed), { kind: 'ackRules' });
const atGateHub = (seed = 777) => run(atGateNode(seed), { kind: 'choose', choiceId: 'd1n1_b' });
const atHomeHub = (seed = 777) => run(atGateNode(seed), { kind: 'choose', choiceId: 'd1n1_c' });

const SECRET = /便利店|酱油|托你|小陈/;

describe('一、行动分层：此刻最相关 / 更多探索 / 日常行动', () => {
  it('在门口：默认只突出 3–4 个行动，其中有当前要处理的事和回家', () => {
    const hv = hubView(atGateHub());
    expect(hv.primary.length).toBeGreaterThanOrEqual(3);
    expect(hv.primary.length).toBeLessThanOrEqual(4);
    expect(hv.primary.map((a) => a.id)).toEqual(expect.arrayContaining(['main', 'go_home']));
  });

  it('在家里：默认也是 3–4 个，主线在最前面', () => {
    for (const t of [10 * 60 + 10, 11 * 60 + 20, 15 * 60, 19 * 60 + 30]) {
      const s = atHomeHub();
      s.time = t;
      const hv = hubView(s);
      expect(hv.primary.length, `time ${t}`).toBeGreaterThanOrEqual(1);
      expect(hv.primary.length).toBeLessThanOrEqual(4);
      expect(hv.primary[0].id).toBe('main');
    }
  });

  it('吃饭、休息、购物、要零花钱、睡觉都收进“日常行动”，不会占在默认区域', () => {
    const s = atHomeHub();
    s.time = 15 * 60; // 不在用餐时间
    const hv = hubView(s);
    const prim = hv.primary.map((a) => a.id);
    for (const id of ['eat_home', 'eat_bento', 'rest30', 'rest60', 'shop', 'sleep']) expect(prim).not.toContain(id);
    const routine = hv.routine.map((a) => a.id);
    expect(routine).toEqual(expect.arrayContaining(['eat_home', 'eat_bento', 'rest30', 'rest60', 'shop', 'sleep']));
  });

  it('其他调查与对话收进“更多探索”：三个分组没有重复，也没有遗漏', () => {
    for (const s of [atGateHub(), atHomeHub(), atDay(atHomeHub(), 4, 10 * 60)]) {
      const hv = hubView(s);
      const all = [...hv.primary, ...hv.more, ...hv.routine].map((a) => a.id);
      expect(new Set(all).size).toBe(all.length);
      const want = [...hv.sides, ...hv.quests, ...hv.daily.filter((a) => a.id !== 'go_home'), hv.sleep, hv.main]
        .map((a) => a.id)
        .filter((id, i, arr) => arr.indexOf(id) === i);
      for (const id of want) expect(all, id).toContain(id);
      // 探索类（支线、短行动）不会混进日常行动
      const routine = new Set(hv.routine.map((a) => a.id));
      for (const a of [...hv.sides, ...hv.quests]) expect(routine.has(a.id)).toBe(false);
    }
  });

  it('门口：多出来的探索进了“更多探索”，默认区域不被塞满', () => {
    const hv = hubView(atGateHub());
    expect(hv.quests.length).toBeGreaterThanOrEqual(3);
    expect(hv.more.length).toBeGreaterThan(0);
    expect(hv.primary.length + hv.more.length).toBeGreaterThanOrEqual(hv.quests.length + 2);
  });

  it('每个选项继续显示耗时和必要条件', () => {
    const hv = hubView(atGateHub());
    for (const a of [...hv.primary, ...hv.more, ...hv.routine]) {
      if (a.id === 'sleep' || a.id === 'main') continue;
      expect(a.sub, a.id).toBeTruthy();
    }
    // 不能做的会写明为什么
    const eat = hv.routine.find((a) => a.id === 'eat_home')!;
    expect(eat.disabled).toBeTruthy();
    expect(hv.main.disabled).toMatch(/回家/);
  });

  it('当前必须处理的事保持清晰：日程提醒、主线按钮永远在默认区域', () => {
    const s = atHomeHub();
    const hv = hubView(s);
    expect(hv.reminder).toMatch(/中午十二点/);
    expect(hv.primary[0].id).toBe('main');
    // 到了午餐时间并且还没吃：吃饭也提到默认区域，但主线仍然在
    const lunch = atHomeHub();
    lunch.time = 11 * 60 + 20;
    const h2 = hubView(lunch);
    expect(h2.primary.map((a) => a.id)).toEqual(expect.arrayContaining(['main', 'eat_home']));
  });

  it('临近用餐和中午约定时，给出简短提醒；没到时候不啰嗦', () => {
    const early = atHomeHub();
    early.time = 10 * 60 + 10;
    expect(hubAlerts(early)).toEqual([]);
    const near = atHomeHub();
    near.time = 11 * 60 + 5;
    const a = hubAlerts(near);
    expect(a.join('')).toMatch(/十二点/);
    expect(a.join('')).toMatch(/午餐/);
    expect(a.length).toBeLessThanOrEqual(2);
    const late = atHomeHub();
    late.time = 12 * 60 + 20;
    expect(hubAlerts(late).join('')).toMatch(/13:00/);
    const eve = atDay(atHomeHub(), 2, 16 * 60 + 45);
    eve.noon[2] = 'done';
    expect(hubAlerts(eve).join('')).toMatch(/晚餐/);
    // 提醒文字也是视图的一部分
    expect(hubView(near).alerts).toEqual(a);
  });

  it('生成视图不会改变时间和属性（展开、收起只是界面状态，没有对应的游戏命令）', () => {
    const s = atGateHub();
    const before = JSON.stringify(s);
    for (let i = 0; i < 5; i++) hubView(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(tryRun(s, { kind: 'toggleFold' } as never).ok).toBe(false);
  });
});

/** 走完第 1 天中午之前的某条路线，停在中午剧情之后的日程页。 */
function toAfternoon(opt: { first: 'a' | 'b' | 'c'; noon: 'a' | 'b' | 'c'; missNoon?: boolean; viaHub?: boolean }): GameState {
  let s = atGateNode(900 + opt.first.charCodeAt(0));
  s = run(s, { kind: 'choose', choiceId: `d1n1_${opt.first}` });
  if (s.place === 'gate') s = run(s, { kind: 'go', to: 'home' });
  if (opt.missNoon) {
    while (s.time < 13 * 60 + 5) s = run(s, { kind: 'rest', minutes: 60 });
  }
  s = run(s, { kind: 'main' });
  expect(s.nodeId).toBe('d1n2');
  return run(s, { kind: 'choose', choiceId: `d1n2_${opt.noon}` });
}

describe('二、任务的出现顺序：剧情交代 → 玩家得知 → 记录任务 → 开放行动', () => {
  it('委托发生之前：日程、提醒、主线按钮和日记里都没有便利店任务', () => {
    for (const s of [atGateNode(), atGateHub(), atHomeHub()]) {
      if (s.mode === 'hub') {
        const hv = hubView(s);
        expect(hv.reminder).not.toMatch(SECRET);
        expect(hv.main.label + (hv.main.sub ?? '')).not.toMatch(SECRET);
        expect(pendingThings(s).join('')).not.toMatch(SECRET);
        expect(hv.alerts.join('')).not.toMatch(SECRET);
        expect(JSON.stringify(hv.primary.map((a) => a.label))).not.toMatch(/酱油/);
      }
      expect(taskGiven(s, 'store_errand')).toBe(false);
      expect(taskViews(s)).toEqual([]);
    }
  });

  it('中午还没到：睡前提醒只说“下午还没有安排”，不泄露目标和时间', () => {
    const s = atHomeHub();
    const hv = hubView(s);
    expect(hv.reminder).toMatch(/下午还没有安排/);
    const slot3 = MAIN_SLOTS[1][2];
    expect(slot3.task).toBe('store_errand');
    expect(TASK_MAP['store_errand'].nodeId).toBe(slot3.nodeId);
  });

  it('强行开始还没被交代的委托：引擎拒绝（不只是隐藏按钮）', () => {
    const s = atHomeHub();
    s.mainIdx = 2;
    s.noon[1] = 'done';
    s.time = 16 * 60 + 10;
    s.flags = Object.fromEntries(Object.entries(s.flags).filter(([k]) => !k.startsWith('task_')));
    const hv = hubView(s);
    expect(hv.main.disabled).toMatch(/还没有人交代/);
    expect(hv.main.label).not.toMatch(SECRET);
    const r = tryRun(s, { kind: 'main' });
    expect(r.ok).toBe(false);
  });

  const FIRSTS = ['a', 'b', 'c'] as const;
  const NOONS = ['a', 'b', 'c'] as const;
  for (const first of FIRSTS) {
    for (const noon of NOONS) {
      for (const missNoon of [false, true]) {
        it(`所有分支都能合理得到委托：开场=${first} 中午=${noon} ${missNoon ? '错过中午' : '准时'}`, () => {
          const s = toAfternoon({ first, noon, missNoon });
          expect(taskGiven(s, 'store_errand')).toBe(true);
          // 剧情里交代了，原话在结果里
          expect(s.lastResult).toMatch(/酱油/);
          expect(s.lastResult).toMatch(/四点以后/);
          // 日记里有待办，写明目标和时间
          const tv = taskViews(s);
          expect(tv).toHaveLength(1);
          expect(tv[0].goal).toMatch(/酱油/);
          expect(tv[0].when).toMatch(/16:00/);
          expect(tv[0].done).toBe(false);
          // 日程里现在才出现名称和时间
          const hv = hubView(s);
          expect(hv.reminder).toMatch(/便利店/);
          expect(hv.reminder).toMatch(/16:00/);
          // 主线不会卡住：到了 16:00 可以开始
          let t = structuredClone(s);
          t.time = 16 * 60 + 5;
          if (t.noon[1] === 'pending') t.noon[1] = 'done';
          expect(hubView(t).main.disabled).toBeNull();
          t = run(t, { kind: 'main' });
          expect(t.nodeId).toBe('d1n3');
          // 在门口也能出发（出门办事）
          const g = structuredClone(s);
          g.time = 16 * 60 + 5;
          g.place = 'gate';
          g.location = '小区大门';
          expect(hubView(g).main.disabled).toBeNull();
        });
      }
    }
  }

  it('通过日程页的“回家”回来，同样会在中午得到委托', () => {
    let s = atGateHub();
    s = run(s, { kind: 'go', to: 'home' });
    s = run(s, { kind: 'main' });
    s = run(s, { kind: 'choose', choiceId: 'd1n2_b' });
    expect(taskGiven(s, 'store_errand')).toBe(true);
  });

  it('同一任务只触发一次：不重复提示，也不重复写进日记', () => {
    let s = toAfternoon({ first: 'c', noon: 'a' });
    expect(s.notices.join('')).toMatch(/待办/);
    // 后面再做别的事，不会再次出现“交代”
    s = run(s, { kind: 'rest', minutes: 30 });
    expect(s.notices.join('')).not.toMatch(/待办/);
    s = run(s, { kind: 'ask', npc: 'mom' });
    expect(s.notices.join('')).not.toMatch(/待办/);
    expect(taskViews(s)).toHaveLength(1);
    // 完成之后，状态变成“已完成”，仍然只有一条
    s.time = 16 * 60 + 5;
    s = run(s, { kind: 'main' });
    s = run(s, { kind: 'choose', choiceId: 'd1n3_c' });
    expect(taskViews(s)).toEqual([expect.objectContaining({ id: 'store_errand', done: true })]);
  });

  it('旧存档或跳转没有触发交代：妈妈发消息补上，且只补一次', () => {
    let s = atHomeHub();
    s.mainIdx = 2;
    s.noon[1] = 'done';
    s.time = 14 * 60;
    expect(taskGiven(s, 'store_errand')).toBe(false);
    s = run(s, { kind: 'rest', minutes: 30 });
    expect(taskGiven(s, 'store_errand')).toBe(true);
    expect(s.notices.join('')).toMatch(/妈妈发来消息/);
    const n1 = s.notices.filter((n) => /酱油/.test(n)).length;
    expect(n1).toBe(1);
    s = run(s, { kind: 'rest', minutes: 30 });
    expect(s.notices.join('')).not.toMatch(/酱油/);
  });

  it('刷新和读档后任务状态保持：已交代的还在、没交代的不出现、不会重复触发', () => {
    const { sess, store } = memorySession();
    sess.startNew({ name: '林夏', gender: 'female', call: '', seed: 4321 });
    const d = (cmd: Parameters<typeof sess.dispatch>[0]) => {
      const r = sess.dispatch(cmd, (sess.state as GameState).seq, true);
      expect(r.ok).toBe(true);
    };
    d({ kind: 'ackRules' });
    d({ kind: 'choose', choiceId: 'd1n1_c' });
    // 交代之前刷新
    let again = reload(store);
    again.continueRun();
    expect(taskGiven(again.state as GameState, 'store_errand')).toBe(false);
    expect(hubView(again.state as GameState).reminder).not.toMatch(SECRET);
    // 交代
    d({ kind: 'main' });
    d({ kind: 'choose', choiceId: 'd1n2_a' });
    expect(taskGiven(sess.state as GameState, 'store_errand')).toBe(true);
    // 交代之后刷新
    again = reload(store);
    again.continueRun();
    const st = again.state as GameState;
    expect(taskGiven(st, 'store_errand')).toBe(true);
    expect(taskViews(st)).toHaveLength(1);
    expect(hubView(st).reminder).toMatch(/便利店/);
    // 读档后继续行动，不会再次交代
    const r = again.dispatch({ kind: 'rest', minutes: 30 }, st.seq, true);
    expect(r.ok).toBe(true);
    expect((again.state as GameState).notices.join('')).not.toMatch(/待办/);
  });

  it('每个委托都对应一个存在的主线节点，且不会被其他路线绕开', () => {
    for (const t of TASKS) {
      expect(NODES[t.nodeId], t.id).toBeTruthy();
      const slot = Object.values(MAIN_SLOTS).flat().find((x) => x.nodeId === t.nodeId);
      expect(slot?.task, t.id).toBe(t.id);
    }
    // 所有带 task 的主线位置，都有对应的委托定义
    for (const slot of Object.values(MAIN_SLOTS).flat()) if (slot.task) expect(TASK_MAP[slot.task]).toBeTruthy();
  });

  it('其他天的提醒也不提前剧透：没被交代的事，只说时间段，不说具体地点和人物', () => {
    for (let day = 1; day <= 7; day++) {
      const s = atDay(atHomeHub(), day, 7 * 60 + 5);
      const text = pendingThings(s).join('；');
      expect(text, `day ${day}`).not.toMatch(/值班室|便利店|许阿姨|物业|爸爸要回来|邻居|奶奶|小宇|储物间/);
      const hv = hubView(s);
      // 还没到时间的下午/傍晚节点：按钮不提前说出这一段的标题
      s.mainIdx = 2;
      s.noon[day] = 'done';
      const wait = hubView({ ...s, time: 9 * 60 }).main.label;
      if (day > 1) expect(wait).not.toContain(NODES[`d${day}n3`].title);
      expect(hv.main.label).toBeTruthy();
    }
  });
});

describe('三、开场疑点有层次：说法、事实、怀疑分开记录', () => {
  it('周叔和爸爸的措辞不直接指向爸爸，保留多种合理解释', () => {
    const text = nodeView(atGateNode())!.paragraphs.join('');
    expect(text).toMatch(/漏记/); // 登记遗漏、交接
    expect(text).toMatch(/压在物业/); // 流转问题
    expect(text).toMatch(/别的手续/); // 办理进度理解不同
    expect(text).toMatch(/谁没把话说全/); // 有人隐瞒，只是其中一种
    expect(text).not.toMatch(/你爸记错了|说的和做的/);
    expect(text).not.toMatch(/撒谎|说谎|骗/);
    expect(ARRIVAL_FIRST).not.toMatch(/周叔白班记漏了|别去烦|办好了/);
    expect(GATE_BOOK_RESULT).not.toMatch(/你爸要是真办过/);
    expect(GATE_BOOK_RESULT).toMatch(/漏记/);
  });

  it('开场：爸爸和周叔各自的话先是“人物的说法”，不是已证实的事实', () => {
    const s = atGateNode();
    expect(s.clues['c_dad_card']).toBe('claim');
    expect(s.clues['c_zhou_book']).toBe('claim');
    expect(Object.values(s.clues).filter((l) => l === 'confirmed').sort()).toEqual(['confirmed']); // 只有“那个声音”
    const home = run(s, { kind: 'choose', choiceId: 'd1n1_c' });
    expect(home.clues['c_dad_card']).toBe('claim'); // 回家问了一句，也还不是事实
    expect(home.clues['c_dad_hides']).toBe('suspect');
    expect(home.clues['c_zhou_book']).toBe('claim');
  });

  it('亲眼看过登记本，才把“周叔的登记本”记成事实', () => {
    const s = run(atGateNode(), { kind: 'choose', choiceId: 'd1n1_a' });
    expect(s.clues['c_zhou_book']).toBe('confirmed');
    expect(s.clues['c_dad_card']).toBe('claim');
  });

  it('许阿姨的话是“说法”，进了值班室才被证实；怀疑不会被自动当成事实', () => {
    let s = atDay(atHomeHub(), 2, 17 * 60);
    s.noon[2] = 'done';
    s.mainIdx = 2;
    s = run(s, { kind: 'main' });
    expect(s.nodeId).toBe('d2n3');
    expect(s.clues['c_dad_not_reg']).toBe('claim');
    expect(s.clues['c_xu_old']).toBe('claim');
    const text = nodeView(s)!.paragraphs.join('');
    expect(text).toMatch(/我也是听说/);
    expect(text).not.toMatch(/一回都没去/);
    // 第 3 天值班室
    let d3 = atDay(atHomeHub(), 3, 16 * 60);
    d3.mainIdx = 2;
    d3.noon[3] = 'done';
    d3 = run(d3, { kind: 'main' });
    expect(d3.nodeId).toBe('d3n3');
    expect(d3.clues['c_dad_card']).toBe('confirmed');
    expect(d3.clues['c_dad_not_reg']).toBe('confirmed');
    expect(nodeView(d3)!.paragraphs.join('')).toMatch(/没有五零二的新卡申请/);
  });

  it('几种可能：开场都说得通，后来的证据逐个排除；“有人隐瞒”不被排除，但也没有被宣布', () => {
    let s = atGateNode();
    let hv = hypothesisViews(s);
    expect(hv.map((h) => h.id)).toEqual(['h_book', 'h_handover', 'h_progress', 'h_hide']);
    expect(hv.every((h) => h.status === 'open')).toBe(true);
    // 看过登记本：登记遗漏出现了对不上的地方
    s = run(s, { kind: 'choose', choiceId: 'd1n1_a' });
    hv = hypothesisViews(s);
    expect(hv.find((h) => h.id === 'h_book')!.status).toBe('doubtful');
    expect(hv.find((h) => h.id === 'h_handover')!.status).toBe('doubtful');
    expect(hv.find((h) => h.id === 'h_hide')!.status).toBe('open');
    // 值班室之后（这条路线看过登记本）
    let d3 = atDay(s, 3, 16 * 60);
    d3.flags['met_xu'] = true; // 第 2 天傍晚听许阿姨说过
    d3.mainIdx = 2;
    d3.noon[3] = 'done';
    d3 = run(d3, { kind: 'main' });
    hv = hypothesisViews(d3);
    const by = Object.fromEntries(hv.map((h) => [h.id, h]));
    expect(by.h_book.status).toBe('unlikely');
    expect(by.h_handover.status).toBe('unlikely');
    expect(by.h_progress.status).toBe('unlikely');
    expect(by.h_hide.status).toBe('open');
    expect(by.h_hide.evidenceAgainst).toEqual([]);
    // 没有哪一条写着“答案”
    for (const h of hv) expect(JSON.stringify(h)).not.toMatch(/真相|答案是|就是爸爸/);
  });

  it('线索与既有真相和结局不矛盾：所有机器人通关路线里，爸爸“办过”的说法最终都被值班室证实为没办成', () => {
    for (const goal of ['normal', 'hidden'] as const) {
      const r = playBot({ seed: 31337, helper: 'dad', luck: 'mid', goal });
      expect(r.state.ending?.id).toBe(goal);
      expect(r.state.clues['c_dad_card']).toBe('confirmed');
      expect(r.state.clues['c_zhou_book']).toBeTruthy();
      expect(r.state.rules[1]).toBe('false');
      expect(taskViews(r.state)).toEqual([expect.objectContaining({ done: true })]);
      const hv = hypothesisViews(r.state);
      expect(hv.find((h) => h.id === 'h_hide')!.status).toBe('open');
      expect(hv.filter((h) => h.status === 'unlikely').length).toBeGreaterThanOrEqual(1);
      expect(hv.filter((h) => h.status !== 'open').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('小陈的话也是“说法”；只买酱油就走的路线，仍然有办法拿到缴费凭证的线索', () => {
    const s = toAfternoon({ first: 'c', noon: 'b' });
    s.time = 16 * 60 + 5;
    let t = run(s, { kind: 'main' });
    expect(t.clues['c_store_pay']).toBe('claim');
    t = run(t, { kind: 'choose', choiceId: 'd1n3_c' }); // 买完就回去
    expect(t.clues['c_chen_records']).toBeUndefined();
    expect(hubView(t).quests.some((q) => q.id === 'q_print')).toBe(false); // 还没听说过，不提前出现
    const shelf = hubView(t).sides.find((a) => a.id === 'side_chen_shelf');
    expect(shelf).toBeTruthy(); // 之后仍可以回去，从小陈那里听说
    expect(shelf!.disabled).toBeNull();
    let u = run(t, { kind: 'side', id: 'side_chen_shelf' });
    u = run(u, { kind: 'choose', choiceId: 'chen_a' });
    expect(u.clues['c_chen_records']).toBe('confirmed');
    expect(hubView(u).quests.some((q) => q.id === 'q_print')).toBe(true);
  });

  it('旧存档里没有交代标记但已经做完便利店剧情：读取后补上，不会再出现重复委托', () => {
    const s = toAfternoon({ first: 'c', noon: 'a' });
    s.time = 16 * 60 + 5;
    let t = run(s, { kind: 'main' });
    t = run(t, { kind: 'choose', choiceId: 'd1n3_c' });
    delete t.flags['task_store_errand'];
    const { sess, store } = memorySession();
    store.saveCache(t);
    store.saveMeta({ version: 1, runId: t.runId, failCount: 0, countedFailures: [], over: false, overReason: null });
    const again = reload(store);
    again.continueRun();
    const st = again.state as GameState;
    expect(taskGiven(st, 'store_errand')).toBe(true);
    expect(taskViews(st)[0].done).toBe(true);
    void sess;
  });
});

void perform;
