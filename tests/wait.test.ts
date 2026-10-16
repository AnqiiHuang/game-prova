// 主线做完以后的“等待到睡觉时间”：显示条件、晚餐处理、事件停点、重复点击与刷新。
import { describe, expect, it } from 'vitest';
import { hubView, nodeView, perform, SLEEP_MIN, waitBlock } from '../src/game/engine';
import { MAIN_SLOTS } from '../src/game/story';
import type { Command, GameState } from '../src/game/types';
import { atDay, fresh, memorySession, reload, run, tryRun } from './helpers';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const WAIT = (dinner?: 'home' | 'bento' | 'skip'): Command => ({ kind: 'waitSleep', dinner });

/** 某一天、某个时刻：主线全部完成、中午已陪过、早午餐已吃，人在家里。 */
function doneDay(day: number, time: number, o: { dinner?: boolean; place?: 'home' | 'gate' } = {}): GameState {
  const s = atDay(fresh(), day, time);
  s.mainIdx = MAIN_SLOTS[day].length;
  s.noon[day] = 'done';
  for (const sl of ['breakfast', 'lunch'] as const) {
    s.meals[day][sl] = { eaten: true, settled: true, by: 'home' };
  }
  if (o.dinner) s.meals[day].dinner = { eaten: true, settled: true, by: 'home' };
  s.place = o.place ?? 'home';
  s.stats.stamina = 50;
  return s;
}

describe('等待到睡觉时间：显示条件', () => {
  it('主线全部完成、早于 19:00 时出现，并写明到几点、用多久', () => {
    const v = hubView(doneDay(1, h(15, 30)));
    expect(v.wait).not.toBeNull();
    expect(v.primary.map((a) => a.id)).toContain('wait_sleep');
    expect(v.wait!.label).toBe('等待到睡觉时间');
    expect(v.wait!.sub).toContain('3 小时 30 分钟');
    expect(v.wait!.sub).toContain('19:00');
    expect(v.wait!.needDinner).toBe(true);
  });

  it('主线还没做完、已经到 19:00 之后，都不出现；可以睡觉的时候只剩“睡觉并存档”', () => {
    const early = doneDay(2, h(15));
    early.mainIdx = 2;
    expect(hubView(early).wait).toBeNull();
    const late = hubView(doneDay(2, SLEEP_MIN));
    expect(late.wait).toBeNull();
    expect(late.sleep.disabled).toBeNull();
    expect(waitBlock(doneDay(2, h(20)))).not.toBeNull();
  });

  it('已经吃过晚餐时不再提示晚餐', () => {
    expect(hubView(doneDay(1, h(15), { dinner: true })).wait!.needDinner).toBe(false);
  });
});

describe('等待到睡觉时间：晚餐', () => {
  it('晚餐没吃时必须先选择，不能不带选择直接执行', () => {
    const s = doneDay(1, h(15));
    const r = tryRun(s, WAIT());
    expect(r.ok).toBe(false);
    expect(s.time).toBe(h(15));
  });

  it('“直接等待”：只推进到 19:00，晚餐保持没吃，提醒继续显示，不睡觉、不跨天、不回体力', () => {
    const s0 = doneDay(1, h(15));
    const s = run(s0, WAIT('skip'));
    expect(s.time).toBe(SLEEP_MIN);
    expect(s.day).toBe(1);
    expect(s.mode).toBe('hub');
    expect(s.brief).toBeNull();
    expect(s.meals[1].dinner).toEqual({ eaten: false, settled: false, by: 'none' });
    expect(s.stats.stamina).toBe(50);
    expect(s.counters.minutes - s0.counters.minutes).toBe(240);
    expect(hubView(s).alerts.join('')).toContain('晚餐');
    expect(hubView(s).wait).toBeNull();
    expect(hubView(s).sleep.disabled).toBeNull();
  });

  it('“先吃晚餐”，未到开饭时间：先等到 17:00，再按家里晚饭结算，然后等到 19:00', () => {
    const s0 = doneDay(1, h(15));
    const s = run(s0, WAIT('home'));
    expect(s.time).toBe(SLEEP_MIN);
    expect(s.meals[1].dinner).toMatchObject({ eaten: true, settled: true, by: 'home' });
    expect(s.stats.stamina).toBe(60); // 只有吃饭的 +10，等待本身不恢复
    expect(s.counters.minutes - s0.counters.minutes).toBe(240);
    expect(s.counters.missedMeals).toBe(0);
    expect(s.day).toBe(1);
  });

  it('“先吃晚餐”，已经过了开饭时间：立刻吃，吃完再等到 19:00', () => {
    const s = run(doneDay(1, h(17, 40)), WAIT('home'));
    expect(s.time).toBe(SLEEP_MIN);
    expect(s.meals[1].dinner.by).toBe('home');
    expect(s.stats.stamina).toBe(60);
  });

  it('吃饭本身会超过 19:00 时，不再多等', () => {
    const s = run(doneDay(1, h(18, 50)), WAIT('home'));
    expect(s.time).toBe(h(19, 20));
    expect(s.meals[1].dinner.by).toBe('home');
  });

  it('便当：消耗一份并按便当结算', () => {
    const s0 = doneDay(1, h(18));
    const bento = s0.inventory.bento;
    s0.inventory.bento = bento + 1;
    const s = run(s0, WAIT('bento'));
    expect(s.meals[1].dinner.by).toBe('bento');
    expect(s.inventory.bento).toBe(bento);
    expect(s.time).toBe(SLEEP_MIN);
  });

  it('已有晚餐记录：不会重复吃，也不会重复加体力或扣便当', () => {
    const s0 = doneDay(1, h(15), { dinner: true });
    s0.inventory.bento = 2;
    for (const d of [undefined, 'home', 'bento', 'skip'] as const) {
      const s = run(s0, WAIT(d));
      expect(s.time).toBe(SLEEP_MIN);
      expect(s.stats.stamina).toBe(50);
      expect(s.inventory.bento).toBe(2);
      expect(s.meals[1].dinner.by).toBe('home');
    }
  });

  it('不在家：家里的饭不能吃，状态不变；便当可以', () => {
    const s0 = doneDay(1, h(15), { place: 'gate' });
    const r = tryRun(s0, WAIT('home'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('回家');
    expect(s0.time).toBe(h(15));
    expect(s0.meals[1].dinner.eaten).toBe(false);
    s0.inventory.bento = 1;
    const s = run(s0, WAIT('bento'));
    expect(s.place).toBe('gate');
    expect(s.meals[1].dinner.by).toBe('bento');
    expect(s.inventory.bento).toBe(0);
    // 没有便当时也不行
    s0.inventory.bento = 0;
    expect(tryRun(s0, WAIT('bento')).ok).toBe(false);
  });

  it('在门口直接等待：到 19:00，睡觉要先回家', () => {
    const s = run(doneDay(1, h(15), { place: 'gate' }), WAIT('skip'));
    expect(s.time).toBe(SLEEP_MIN);
    expect(hubView(s).sleep.disabled).toContain('回家');
  });
});

describe('等待到睡觉时间：途中的事件与结算', () => {
  it('会错过午餐时先要求确认；确认后只结算一次', () => {
    const s0 = doneDay(1, h(13, 10));
    s0.meals[1].lunch = { eaten: false, settled: false, by: 'none' };
    const ask = tryRun(s0, WAIT('skip'), false);
    expect(ask.ok).toBe(false);
    expect(!ask.ok && ask.confirm).toBe(true);
    expect(s0.time).toBe(h(13, 10));
    const s = run(s0, WAIT('skip'));
    expect(s.meals[1].lunch.by).toBe('missed');
    expect(s.counters.missedMeals).toBe(1);
    expect(s.stats.health).toBe(s0.stats.health - 6);
    expect(s.stats.stamina).toBe(40);
    // 再来一次不会重复处罚
    expect(tryRun(s, WAIT('skip')).ok).toBe(false);
    expect(s.counters.missedMeals).toBe(1);
  });

  it('第 3 天第一次吃家里的晚饭会有小插曲：停在小插曲，不跳过；处理完再等到 19:00，不重复触发', () => {
    const s0 = doneDay(3, h(15));
    const a = run(s0, WAIT('home'));
    expect(a.mode).toBe('node');
    expect(a.nodeId).toBe('mini_d3_food');
    expect(a.time).toBe(h(17)); // 只等到开饭，还没有等到 19:00
    expect(a.meals[3].dinner.eaten).toBe(false);
    // 小插曲期间不能再点等待
    expect(tryRun(a, WAIT('skip')).ok).toBe(false);
    const choice = nodeView(a)!.choices.find((c) => c.id === 'd3food_eat')!;
    const b = run(a, { kind: 'choose', choiceId: choice.id });
    expect(b.mode).toBe('hub');
    expect(b.time).toBe(h(17, 30));
    expect(b.meals[3].dinner.by).toBe('home');
    const hv = hubView(b);
    expect(hv.wait!.needDinner).toBe(false);
    const c = run(b, WAIT());
    expect(c.time).toBe(SLEEP_MIN);
    expect(c.mode).toBe('hub');
    expect(c.flags['food3_seen']).toBe(true);
    expect(c.stats.stamina).toBe(b.stats.stamina);
  });

  it('选“直接等待”时不会触发晚饭的小插曲', () => {
    const s = run(doneDay(3, h(15)), WAIT('skip'));
    expect(s.mode).toBe('hub');
    expect(s.time).toBe(SLEEP_MIN);
    expect(s.flags['food3_seen']).toBeFalsy();
  });
});

describe('等待到睡觉时间：重复点击与刷新', () => {
  it('旧序号的重复点击会被识别为过期；到 19:00 之后再点会被拒绝，不会再推进', () => {
    const s0 = doneDay(1, h(15));
    const a = run(s0, WAIT('skip'));
    const stale = perform(a, { ...WAIT('skip'), seq: s0.seq, confirm: true });
    expect(!stale.ok && stale.reason).toBe('stale');
    const again = tryRun(a, WAIT('skip'));
    expect(again.ok).toBe(false);
    expect(a.time).toBe(SLEEP_MIN);
  });

  it('会话层：旧序号被拒绝；刷新后恢复到 19:00，晚餐与体力保持，且没有睡眠存档', () => {
    const { sess, store } = memorySession();
    sess.startNew({ name: '林夏', gender: 'female', call: '', seed: 321 });
    const prepared = doneDay(1, h(15));
    sess.state = { ...prepared, runId: (sess.state as GameState).runId, seq: (sess.state as GameState).seq };
    const seq = sess.state.seq;
    const r1 = sess.dispatch(WAIT('home'), seq);
    expect(r1.ok).toBe(true);
    const r2 = sess.dispatch(WAIT('home'), seq);
    expect(r2.ok).toBe(false);
    expect(!r2.ok && r2.reason).toBe('stale');
    const after = structuredClone(sess.state) as GameState;
    expect(after.time).toBe(SLEEP_MIN);
    expect(after.day).toBe(1);

    const again = reload(store);
    expect(again.continueRun()).toBe(true);
    const back = again.state as GameState;
    expect(back.time).toBe(SLEEP_MIN);
    expect(back.meals[1].dinner.by).toBe('home');
    expect(back.stats.stamina).toBe(after.stats.stamina);
    expect(back.mode).toBe('hub');
    expect(store.loadSleep().status).not.toBe('ok');
    // 刷新后仍然只能由玩家主动睡觉
    const slept = again.dispatch({ kind: 'sleep' }, back.seq);
    expect(slept.ok).toBe(true);
    expect((again.state as GameState).day).toBe(2);
  });
});