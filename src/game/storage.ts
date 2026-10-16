// 本地存档：带版本号的 localStorage，读写出错时降级为“临时游玩”（只存在内存里）。

import { SAVE_VERSION, type EndingId, type GameState, type RunMeta } from './types';

export const KEYS = {
  meta: 'xfq.v1.meta',
  cache: 'xfq.v1.cache',
  sleep: 'xfq.v1.sleep',
  start: 'xfq.v1.start',
  settings: 'xfq.v1.settings',
} as const;

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class MemoryStore implements KV {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

/** 尝试使用 localStorage；不可用（隐私模式、被禁用、空间满）时退回内存。 */
export function detectStore(): { store: KV; persistent: boolean } {
  try {
    const ls = globalThis.localStorage;
    if (!ls) throw new Error('no localStorage');
    const probe = '__xfq_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { store: ls, persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

interface Envelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

export type LoadResult<T> = { status: 'ok'; data: T; savedAt: number } | { status: 'none' } | { status: 'corrupt'; why: string };

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const ENDINGS: EndingId[] = ['normal', 'hidden', 'fail_fear', 'fail_health', 'timeout', 'fail_run'];

export function validateState(x: unknown): x is GameState {
  if (!isObj(x)) return false;
  if (x.version !== SAVE_VERSION) return false;
  if (typeof x.runId !== 'string' || typeof x.seed !== 'number' || typeof x.rng !== 'number') return false;
  if (typeof x.seq !== 'number' || typeof x.day !== 'number' || typeof x.time !== 'number') return false;
  if (x.day < 1 || x.day > 7 || x.time < 0 || x.time > 24 * 60) return false;
  if (!['rules', 'hub', 'node', 'brief', 'ended'].includes(x.mode as string)) return false;
  if (!isObj(x.stats) || !isObj(x.inventory) || !isObj(x.npcs) || !isObj(x.player)) return false;
  for (const k of ['stamina', 'health', 'fear', 'int', 'luck', 'money']) {
    if (typeof (x.stats as Record<string, unknown>)[k] !== 'number') return false;
  }
  if (!isObj(x.meals) || !isObj(x.clues) || !isObj(x.flags) || !isObj(x.docs) || !isObj(x.prices) || !isObj(x.stock)) return false;
  if (!Array.isArray(x.sideDone) || !Array.isArray(x.questDone)) return false;
  if (typeof x.helper !== 'string') return false;
  if (x.mode === 'ended' && !(isObj(x.ending) && ENDINGS.includes(x.ending.id as EndingId))) return false;
  if (!isObj((x.meals as Record<string, unknown>)[String(x.day)])) return false;
  return true;
}

export function validateMeta(x: unknown): x is RunMeta {
  return (
    isObj(x) &&
    x.version === SAVE_VERSION &&
    typeof x.runId === 'string' &&
    typeof x.failCount === 'number' &&
    Array.isArray(x.countedFailures) &&
    typeof x.over === 'boolean'
  );
}

export class SaveStore {
  persistent: boolean;
  constructor(private kv: KV, persistent: boolean) {
    this.persistent = persistent;
  }

  private write<T>(key: string, data: T): boolean {
    const env: Envelope<T> = { v: SAVE_VERSION, savedAt: Date.now(), data };
    try {
      this.kv.setItem(key, JSON.stringify(env));
      return true;
    } catch {
      // 写入失败（空间满、被禁用）：以后只在内存里玩
      if (this.persistent) {
        this.persistent = false;
        const mem = new MemoryStore();
        this.kv = mem;
        try {
          mem.setItem(key, JSON.stringify(env));
        } catch {
          /* ignore */
        }
      }
      return false;
    }
  }

  private read<T>(key: string, check: (x: unknown) => boolean): LoadResult<T> {
    let raw: string | null;
    try {
      raw = this.kv.getItem(key);
    } catch {
      return { status: 'none' };
    }
    if (raw === null) return { status: 'none' };
    try {
      const env = JSON.parse(raw) as Envelope<unknown>;
      if (!isObj(env) || env.v !== SAVE_VERSION) return { status: 'corrupt', why: '存档版本不匹配' };
      if (!check(env.data)) return { status: 'corrupt', why: '存档内容不完整' };
      return { status: 'ok', data: env.data as T, savedAt: Number(env.savedAt) || 0 };
    } catch {
      return { status: 'corrupt', why: '存档无法解析' };
    }
  }

  remove(key: string) {
    try {
      this.kv.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  saveMeta(m: RunMeta) {
    return this.write(KEYS.meta, m);
  }
  loadMeta() {
    return this.read<RunMeta>(KEYS.meta, validateMeta);
  }
  saveCache(s: GameState) {
    return this.write(KEYS.cache, s);
  }
  loadCache() {
    return this.read<GameState>(KEYS.cache, validateState);
  }
  saveSleep(s: GameState) {
    return this.write(KEYS.sleep, s);
  }
  loadSleep() {
    return this.read<GameState>(KEYS.sleep, validateState);
  }
  saveStart(s: GameState) {
    return this.write(KEYS.start, s);
  }
  loadStart() {
    return this.read<GameState>(KEYS.start, validateState);
  }

  clearRun() {
    this.remove(KEYS.cache);
    this.remove(KEYS.sleep);
    this.remove(KEYS.start);
  }
  clearAll() {
    this.clearRun();
    this.remove(KEYS.meta);
  }

  saveSettings(s: unknown) {
    return this.write(KEYS.settings, s);
  }
  loadSettings<T>(check: (x: unknown) => boolean) {
    return this.read<T>(KEYS.settings, check);
  }
}
