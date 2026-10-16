// 会话控制器：把引擎和本地存档接在一起。
// 失败计数、睡眠存档、开局恢复点、结束后作废旧存档，都在这里统一处理。

import { newGame, perform, wakeSnapshot, type NewGameOptions } from './engine';
import { freshSeed } from './random';
import { SaveStore } from './storage';
import {
  SAVE_VERSION,
  type Command,
  type CommandResult,
  type GameState,
  type Gender,
  type RunMeta,
} from './types';

export const MAX_RESTORABLE_FAILS = 3;

export interface StartOptions {
  name: string;
  gender: Gender;
  call: string;
  // 仅开发环境使用
  seed?: number;
  force?: NewGameOptions['force'];
}

export interface ContinueCheck {
  ok: boolean;
  reason: string;
}

function newRunId(): string {
  return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function freshMeta(runId: string): RunMeta {
  return { version: SAVE_VERSION, runId, failCount: 0, countedFailures: [], over: false, overReason: null };
}

export class Session {
  state: GameState | null = null;
  meta: RunMeta | null = null;
  /** 读取存档时发现的问题（损坏等），给界面展示一次。 */
  notice: string | null = null;
  private cacheOk = false;
  private cacheState: GameState | null = null;
  private cacheProblem: string | null = null;

  constructor(public store: SaveStore) {}

  get persistent() {
    return this.store.persistent;
  }

  /** 页面启动时调用：读取元数据与缓存，但不进入游戏。 */
  init() {
    this.notice = null;
    this.cacheProblem = null;
    const m = this.store.loadMeta();
    const c = this.store.loadCache();
    this.meta = m.status === 'ok' ? m.data : null;
    this.cacheState = c.status === 'ok' ? c.data : null;
    this.cacheOk = c.status === 'ok';
    if (c.status === 'corrupt') {
      this.cacheProblem = `本地存档已损坏（${c.why}），无法继续。可以开始新游戏。`;
      this.notice = this.cacheProblem;
    }
    if (m.status === 'corrupt' && this.cacheOk) {
      this.notice = '失败记录损坏，已按当前存档重新建立。';
    }
    if (this.cacheState && (!this.meta || this.meta.runId !== this.cacheState.runId)) {
      // 元数据缺失或不属于这局：以当前存档重建，失败计数从 0 开始
      this.meta = freshMeta(this.cacheState.runId);
      this.store.saveMeta(this.meta);
    }
  }

  canContinue(): ContinueCheck {
    if (this.cacheProblem) return { ok: false, reason: this.cacheProblem };
    if (!this.cacheState) return { ok: false, reason: '还没有进度。先开始一局新游戏。' };
    if (this.meta?.over) return { ok: false, reason: '上一局已经结束，旧存档不能再继续。请重新开始。' };
    return { ok: true, reason: '' };
  }

  startNew(o: StartOptions) {
    const runId = newRunId();
    const seed = (o.seed ?? freshSeed()) >>> 0;
    const state = newGame({ name: o.name, gender: o.gender, call: o.call, seed, runId, force: o.force });
    this.store.clearRun();
    this.meta = freshMeta(runId);
    this.state = state;
    this.cacheState = state;
    this.cacheOk = true;
    this.cacheProblem = null;
    this.notice = null;
    this.store.saveMeta(this.meta);
    this.store.saveStart(state);
    this.store.saveCache(state);
  }

  continueRun(): boolean {
    if (!this.canContinue().ok || !this.cacheState) return false;
    this.state = structuredClone(this.cacheState);
    this.reconcile();
    return true;
  }

  /** 读档时补算：失败只计一次，已经结束的局作废存档。 */
  private reconcile() {
    const s = this.state;
    if (!s || s.mode !== 'ended') return;
    this.settleEnding(s);
    this.store.saveCache(this.state as GameState);
  }

  /** 结束状态的统一结算（幂等）。 */
  private settleEnding(s: GameState) {
    if (!this.meta || !s.ending) return;
    const meta = this.meta;
    const id = s.ending.id;
    if (id === 'fail_fear' || id === 'fail_health') {
      const fid = s.ending.failureId ?? `${s.runId}:${s.seq}`;
      if (!meta.countedFailures.includes(fid)) {
        meta.countedFailures.push(fid);
        meta.failCount += 1;
      }
      if (meta.failCount > MAX_RESTORABLE_FAILS) {
        s.ending = { id: 'fail_run' };
        meta.over = true;
        meta.overReason = 'fail_run';
        this.store.clearRun();
      }
    } else {
      meta.over = true;
      meta.overReason = id;
      this.store.remove('xfq.v1.sleep');
      this.store.remove('xfq.v1.start');
    }
    this.store.saveMeta(meta);
  }

  /** 执行一条命令。seq 必须是界面当前看到的状态序号，防止重复点击。 */
  dispatch(cmd: Command, seq: number, confirm = false): CommandResult {
    const prev = this.state;
    if (!prev) return { ok: false, reason: '没有进行中的游戏。' };
    const r = perform(prev, { ...cmd, seq, confirm });
    if (!r.ok) return r;
    const next = r.state;
    this.state = next;
    if (next.mode === 'ended') {
      this.settleEnding(next);
    } else if (next.day !== prev.day && next.mode === 'brief') {
      this.store.saveSleep(wakeSnapshot(next));
    }
    this.store.saveCache(next);
    this.cacheState = next;
    return { ok: true, state: next };
  }

  failuresLeft(): number {
    return Math.max(0, MAX_RESTORABLE_FAILS - (this.meta?.failCount ?? 0));
  }

  canRestore(): boolean {
    const s = this.state;
    return !!s && s.mode === 'ended' && !!this.meta && !this.meta.over && (s.ending?.id === 'fail_fear' || s.ending?.id === 'fail_health');
  }

  /** 失败后读档：优先睡眠存档，没有就回到开局。失败计数保持不变。 */
  restoreAfterFailure(): { ok: boolean; from: 'sleep' | 'start' | null; reason?: string } {
    if (!this.canRestore() || !this.state) return { ok: false, from: null, reason: '现在不能读档。' };
    const failedSeq = this.state.seq;
    const runId = this.state.runId;
    const sl = this.store.loadSleep();
    let snap: GameState | null = null;
    let from: 'sleep' | 'start' | null = null;
    if (sl.status === 'ok' && sl.data.runId === runId) {
      snap = sl.data;
      from = 'sleep';
    } else {
      const st = this.store.loadStart();
      if (st.status === 'ok' && st.data.runId === runId) {
        snap = st.data;
        from = 'start';
      }
    }
    if (!snap) return { ok: false, from: null, reason: '没有找到可以恢复的存档，请重新开始。' };
    const restored = structuredClone(snap);
    restored.ending = null;
    restored.seq = Math.max(restored.seq, failedSeq); // 序号只增不减，失败标识不会重复
    this.state = restored;
    this.cacheState = restored;
    this.store.saveCache(restored);
    return { ok: true, from };
  }

  /** 回到首页（不删存档）。 */
  leave() {
    this.state = null;
    this.init();
  }

  /** 清除所有本地数据（用于重新开始和排错）。 */
  wipe() {
    this.store.clearAll();
    this.state = null;
    this.meta = null;
    this.cacheState = null;
    this.cacheOk = false;
    this.cacheProblem = null;
    this.notice = null;
  }

  sleepSaveDay(): number | null {
    const sl = this.store.loadSleep();
    return sl.status === 'ok' && this.state && sl.data.runId === this.state.runId ? sl.data.day : null;
  }
}
