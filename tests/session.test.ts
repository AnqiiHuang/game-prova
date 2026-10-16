import { describe, expect, it } from 'vitest';
import { MemoryStore, SaveStore, KEYS, detectStore } from '../src/game/storage';
import { Session } from '../src/game/session';
import { memorySession, reload } from './helpers';
import type { GameState } from '../src/game/types';

function start(sess: Session, seed = 321) {
  sess.startNew({ name: '林夏', gender: 'female', call: '', seed });
  const s = sess.state as GameState;
  expect(sess.dispatch({ kind: 'ackRules' }, s.seq).ok).toBe(true);
}

/** 让主角“吓到上限”：把恐惧调到 100，再做一个会触发结算的小动作。 */
function collapse(sess: Session) {
  const s = sess.state as GameState;
  // 先到日程页
  if (s.mode === 'node') sess.dispatch({ kind: 'choose', choiceId: 'd1n1_c' }, s.seq);
  const t = sess.state as GameState;
  t.stats.fear = 100;
  const r = sess.dispatch({ kind: 'rest', minutes: 30 }, t.seq, true);
  expect(r.ok).toBe(true);
}

describe('存档与继续', () => {
  it('开始新游戏后刷新页面可以继续，随机结果和价格保持不变', () => {
    const { sess, store } = memorySession();
    start(sess);
    const before = structuredClone(sess.state) as GameState;
    expect(store.loadStart().status).toBe('ok');
    const again = reload(store);
    expect(again.canContinue().ok).toBe(true);
    expect(again.continueRun()).toBe(true);
    const after = again.state as GameState;
    expect(after.prices).toEqual(before.prices);
    expect(after.player).toEqual(before.player);
    expect(after.helper).toBe(before.helper);
    expect(after.rng).toBe(before.rng);
    expect(after.time).toBe(before.time);
  });

  it('没有存档时“继续”不可用，并说明原因', () => {
    const { sess } = memorySession();
    const c = sess.canContinue();
    expect(c.ok).toBe(false);
    expect(c.reason.length).toBeGreaterThan(0);
    expect(sess.continueRun()).toBe(false);
  });

  it('每次有效操作后都会写入缓存；无效操作不写入', () => {
    const { sess, store } = memorySession();
    start(sess);
    const s0 = sess.state as GameState;
    const bad = sess.dispatch({ kind: 'sleep' }, s0.seq);
    expect(bad.ok).toBe(false);
    const cached = store.loadCache();
    expect(cached.status === 'ok' && cached.data.seq).toBe(s0.seq);
    expect(sess.dispatch({ kind: 'choose', choiceId: 'd1n1_c' }, s0.seq).ok).toBe(true);
    const cached2 = store.loadCache();
    expect(cached2.status === 'ok' && cached2.data.seq).toBe(s0.seq + 1);
  });

  it('重复提交同一个序号的命令只生效一次', () => {
    const { sess } = memorySession();
    start(sess);
    const s = sess.state as GameState;
    expect(sess.dispatch({ kind: 'choose', choiceId: 'd1n1_c' }, s.seq).ok).toBe(true);
    const r = sess.dispatch({ kind: 'choose', choiceId: 'd1n1_c' }, s.seq);
    expect(r.ok).toBe(false);
  });
});

describe('存档损坏与存储不可用', () => {
  it('缓存内容损坏时不会抛错，继续按钮不可用，可以开始新游戏', () => {
    const { sess, store } = memorySession();
    start(sess);
    const kv = new MemoryStore();
    kv.setItem(KEYS.cache, '{这不是 JSON');
    const broken = new Session(new SaveStore(kv, true));
    expect(() => broken.init()).not.toThrow();
    expect(broken.canContinue().ok).toBe(false);
    expect(broken.notice).toBeTruthy();
    broken.startNew({ name: '林夏', gender: 'female', call: '', seed: 1 });
    expect(broken.state?.mode).toBe('rules');
    expect(store).toBeTruthy();
  });

  it('版本不匹配或结构不完整的存档会被拒绝', () => {
    const kv = new MemoryStore();
    kv.setItem(KEYS.cache, JSON.stringify({ v: 999, savedAt: 1, data: {} }));
    const s1 = new Session(new SaveStore(kv, true));
    s1.init();
    expect(s1.canContinue().ok).toBe(false);
    kv.setItem(KEYS.cache, JSON.stringify({ v: 1, savedAt: 1, data: { version: 1, day: 3 } }));
    const s2 = new Session(new SaveStore(kv, true));
    s2.init();
    expect(s2.canContinue().ok).toBe(false);
  });

  it('localStorage 不可用时降级为临时游玩，仍然可以玩', () => {
    const { store, persistent } = detectStore(); // 测试环境没有 localStorage
    expect(persistent).toBe(false);
    const sess = new Session(new SaveStore(store, persistent));
    sess.init();
    sess.startNew({ name: '林夏', gender: 'female', call: '', seed: 1 });
    expect(sess.persistent).toBe(false);
    const s = sess.state as GameState;
    expect(sess.dispatch({ kind: 'ackRules' }, s.seq).ok).toBe(true);
  });

  it('写入失败（空间满）时转为内存模式，游戏不中断', () => {
    const bad = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const sess = new Session(new SaveStore(bad, true));
    sess.init();
    expect(() => sess.startNew({ name: '林夏', gender: 'female', call: '', seed: 2 })).not.toThrow();
    expect(sess.persistent).toBe(false);
    const s = sess.state as GameState;
    expect(sess.dispatch({ kind: 'ackRules' }, s.seq).ok).toBe(true);
  });
});

describe('失败：次数只记一次，不随读档回滚，第 4 次结束本局', () => {
  it('第 1 次失败计数为 1；刷新页面、重复读取不会再加', () => {
    const { sess, store } = memorySession();
    start(sess);
    collapse(sess);
    expect(sess.state?.ending?.id).toBe('fail_fear');
    expect(sess.meta?.failCount).toBe(1);
    let again = reload(store);
    expect(again.meta?.failCount).toBe(1);
    expect(again.continueRun()).toBe(true);
    expect(again.meta?.failCount).toBe(1);
    again = reload(store);
    again.continueRun();
    again.continueRun();
    expect(again.meta?.failCount).toBe(1);
    expect(again.meta?.countedFailures).toHaveLength(1);
  });

  it('读档不会让失败计数归零；第一次睡觉前失败，读取的是开局存档', () => {
    const { sess } = memorySession();
    start(sess);
    collapse(sess);
    expect(sess.canRestore()).toBe(true);
    const r = sess.restoreAfterFailure();
    expect(r.ok).toBe(true);
    expect(r.from).toBe('start');
    expect(sess.state?.mode).toBe('rules');
    expect(sess.state?.ending).toBeNull();
    expect(sess.meta?.failCount).toBe(1);
    expect(sess.state?.runId).toBe(sess.meta?.runId);
  });

  it('读档之后再次失败，会计为新的一次（失败标识不会撞车）', () => {
    const { sess } = memorySession();
    start(sess);
    for (let i = 1; i <= 3; i++) {
      collapse(sess);
      expect(sess.meta?.failCount).toBe(i);
      expect(sess.canRestore()).toBe(true);
      expect(sess.restoreAfterFailure().ok).toBe(true);
      const s = sess.state as GameState;
      if (s.mode === 'rules') expect(sess.dispatch({ kind: 'ackRules' }, s.seq).ok).toBe(true);
    }
    expect(sess.meta?.countedFailures).toHaveLength(3);
    expect(new Set(sess.meta?.countedFailures).size).toBe(3);
  });

  it('第 4 次失败直接结束本局：不能读档、不能继续、旧存档作废', () => {
    const { sess, store } = memorySession();
    start(sess);
    for (let i = 1; i <= 3; i++) {
      collapse(sess);
      sess.restoreAfterFailure();
      const s = sess.state as GameState;
      if (s.mode === 'rules') sess.dispatch({ kind: 'ackRules' }, s.seq);
    }
    collapse(sess);
    expect(sess.meta?.failCount).toBe(4);
    expect(sess.state?.ending?.id).toBe('fail_run');
    expect(sess.meta?.over).toBe(true);
    expect(sess.canRestore()).toBe(false);
    expect(sess.restoreAfterFailure().ok).toBe(false);
    expect(store.loadStart().status).toBe('none');
    expect(store.loadSleep().status).toBe('none');
    const again = reload(store);
    expect(again.canContinue().ok).toBe(false);
  });

  it('睡觉之后失败，读取的是睡觉存档（第 2 天清晨），而不是开局', () => {
    const { sess } = memorySession();
    start(sess);
    // 构造：第 1 天主线全部完成后睡觉
    const s = sess.state as GameState;
    s.mode = 'hub';
    s.place = 'home';
    s.mainIdx = 3;
    s.time = 20 * 60;
    s.noon[1] = 'done';
    s.meals[1].lunch = { eaten: true, settled: true, by: 'home' };
    s.meals[1].dinner = { eaten: true, settled: true, by: 'home' };
    expect(sess.dispatch({ kind: 'sleep' }, s.seq).ok).toBe(true);
    expect(sess.sleepSaveDay()).toBe(2);
    const b = sess.state as GameState;
    expect(sess.dispatch({ kind: 'nextDay' }, b.seq).ok).toBe(true);
    collapse(sess);
    expect(sess.meta?.failCount).toBe(1);
    const r = sess.restoreAfterFailure();
    expect(r.from).toBe('sleep');
    expect(sess.state?.day).toBe(2);
    expect(sess.state?.mode).toBe('hub');
    expect(sess.state?.stats.fear).toBeLessThan(100);
    expect(sess.meta?.failCount).toBe(1);
  });
});

describe('期限到了', () => {
  it('第 7 天用完时间：本局立即结束，旧存档作废，不能继续', () => {
    const { sess, store } = memorySession();
    start(sess);
    const s = sess.state as GameState;
    s.mode = 'hub';
    s.day = 7;
    s.time = 23 * 60 + 30;
    s.noon[7] = 'done';
    s.meals[7] = {
      breakfast: { eaten: true, settled: true, by: 'home' },
      lunch: { eaten: true, settled: true, by: 'home' },
      dinner: { eaten: true, settled: true, by: 'home' },
    };
    const r = sess.dispatch({ kind: 'rest', minutes: 30 }, s.seq, true);
    expect(r.ok).toBe(true);
    expect(sess.state?.ending?.id).toBe('timeout');
    expect(sess.meta?.over).toBe(true);
    expect(sess.meta?.overReason).toBe('timeout');
    expect(sess.canRestore()).toBe(false);
    expect(store.loadSleep().status).toBe('none');
    expect(store.loadStart().status).toBe('none');
    const again = reload(store);
    expect(again.canContinue().ok).toBe(false);
  });

  it('通关后也不能“继续”旧存档，但可以重新开始', () => {
    const { sess, store } = memorySession();
    start(sess);
    const s = sess.state as GameState;
    s.mode = 'node';
    s.nodeId = 'd7n3';
    s.day = 7;
    s.time = 14 * 60;
    s.docs = { form: true, proof: true, auth: true };
    s.noon[7] = 'done';
    s.meals[7] = {
      breakfast: { eaten: true, settled: true, by: 'home' },
      lunch: { eaten: true, settled: true, by: 'home' },
      dinner: { eaten: false, settled: false, by: 'none' },
    };
    expect(sess.dispatch({ kind: 'choose', choiceId: 'd7n3_a' }, s.seq, true).ok).toBe(true);
    expect(sess.state?.ending?.id).toBe('normal');
    expect(reload(store).canContinue().ok).toBe(false);
    sess.wipe();
    sess.startNew({ name: '林夏', gender: 'male', call: '', seed: 9 });
    expect(sess.meta?.failCount).toBe(0);
    expect(sess.meta?.over).toBe(false);
  });
});
