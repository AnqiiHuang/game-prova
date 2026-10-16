import { devJumpToDay, newGame, perform } from '../src/game/engine';
import { Session } from '../src/game/session';
import { MemoryStore, SaveStore } from '../src/game/storage';
import type { Command, CommandInput, FamilyId, GameState, LuckTier } from '../src/game/types';

export function fresh(seed = 12345, force?: { helper?: FamilyId; luckTier?: LuckTier }): GameState {
  return newGame({ name: '林夏', gender: 'female', call: '', seed, runId: `t-${seed}`, force });
}

/** 执行命令；失败会抛错，方便测试里直接链式使用。 */
export function run(s: GameState, cmd: Command, confirm = true): GameState {
  const r = perform(s, { ...cmd, seq: s.seq, confirm } as CommandInput);
  if (!r.ok) throw new Error(`命令失败：${JSON.stringify(cmd)} → ${r.reason}`);
  return r.state;
}

export function tryRun(s: GameState, cmd: Command, confirm = true) {
  return perform(s, { ...cmd, seq: s.seq, confirm } as CommandInput);
}

/** 第 1 天 10:15，读完家规并做完第一个选择，停在日程页。 */
export function toHub(seed = 12345, force?: { helper?: FamilyId; luckTier?: LuckTier }): GameState {
  let s = run(fresh(seed, force), { kind: 'ackRules' });
  s = run(s, { kind: 'choose', choiceId: 'd1n1_a' });
  return s;
}

export function memorySession(store?: SaveStore) {
  const st = store ?? new SaveStore(new MemoryStore(), true);
  const sess = new Session(st);
  sess.init();
  return { sess, store: st };
}

/** 模拟刷新页面：用同一个存储新建会话并读档。 */
export function reload(store: SaveStore) {
  const sess = new Session(store);
  sess.init();
  return sess;
}

/** 跳到某一天的指定时刻（保持日程、餐次等数据一致）。 */
export function atDay(s: GameState, day: number, time = 7 * 60): GameState {
  const c = devJumpToDay(s, day);
  c.time = time;
  c.mode = 'hub';
  return c;
}
