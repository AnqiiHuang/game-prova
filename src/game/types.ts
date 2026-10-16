// 游戏核心类型：人物、状态、剧情节点、选项、命令。

export const SAVE_VERSION = 1;

export type NpcId = 'mom' | 'dad' | 'bro' | 'grandma' | 'grandpa' | 'zhou' | 'chen' | 'xu' | 'duty';
export type FamilyId = 'mom' | 'dad' | 'bro' | 'grandma' | 'grandpa';
export const FAMILY_IDS: FamilyId[] = ['mom', 'dad', 'bro', 'grandma', 'grandpa'];

export type Trait = '沉稳' | '细心' | '谨慎' | '健谈' | '急性子';
export const ALL_TRAITS: Trait[] = ['沉稳', '细心', '谨慎', '健谈', '急性子'];

export type Gender = 'female' | 'male' | 'custom';
export type LuckTier = 'high' | 'mid' | 'low';
export const LUCK_VALUE: Record<LuckTier, number> = { high: 100, mid: 50, low: -10 };
export const LUCK_LABEL: Record<LuckTier, string> = { high: '欧皇', mid: '一般', low: '衰仔' };

export type StatKey = 'stamina' | 'health' | 'fear' | 'int' | 'luck' | 'money';
export type ItemId = 'pen' | 'diary' | 'meds' | 'bento' | 'drink' | 'car';
export type ShopItemId = 'meds' | 'bento' | 'drink' | 'car';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type ClueLevel = 'suspect' | 'confirmed';
export type DocKey = 'form' | 'proof' | 'auth';
export type RuleStatus = 'unknown' | 'true' | 'false';

export type EndingId =
  | 'normal'
  | 'hidden'
  | 'fail_fear'
  | 'fail_health'
  | 'timeout'
  | 'fail_run';

export interface NpcState {
  known: boolean;
  favor: number;
  delta: number;
  reason: string;
  day: number;
}

export interface MealRec {
  eaten: boolean;
  settled: boolean;
  by: 'none' | 'home' | 'bento' | 'missed';
}

export interface Delta {
  label: string;
  delta: number;
  reason: string;
}

export interface BriefData {
  day: number; // 刚刚结束的这一天
  lines: string[];
}

export interface EndingState {
  id: EndingId;
  // 失败唯一标识：同一次失败只计数一次
  failureId?: string;
}

export interface PlayerInfo {
  name: string;
  gender: Gender;
  call: string; // 自定义称呼
  traits: Trait[];
  luckTier: LuckTier;
}

export interface GameState {
  version: number;
  runId: string;
  seed: number;
  rng: number;
  seq: number;
  day: number;
  time: number; // 当天从 0:00 起算的分钟数
  location: string;
  mode: 'rules' | 'hub' | 'node' | 'brief' | 'ended';
  nodeId: string | null;
  mainIdx: number;
  lastResult: string | null;
  lastNodeId: string | null; // 最近读过的剧情节点（分享图用）
  player: PlayerInfo;
  stats: Record<StatKey, number>;
  inventory: Record<ItemId, number>;
  npcs: Record<NpcId, NpcState>;
  helper: FamilyId;
  clues: Record<string, ClueLevel>;
  notes: Record<string, string>;
  flags: Record<string, boolean | number | string>;
  rules: Record<number, RuleStatus>;
  docs: Record<DocKey, boolean>;
  sideDone: string[];
  questDone: string[];
  meals: Record<number, Record<MealSlot, MealRec>>;
  noon: Record<number, 'pending' | 'done' | 'missed'>;
  noonLate: Record<number, boolean>;
  prices: Record<ShopItemId, number>;
  stock: Record<ShopItemId, number>;
  shopOpen: boolean;
  asked: Record<string, boolean>;
  mishaps: string[];
  visited: string[];
  notices: string[];
  deltas: Delta[];
  brief: BriefData | null;
  ending: EndingState | null;
  rulesAck: boolean;
  counters: { steps: number; missedMeals: number; missedNoon: number; minutes: number };
}

export interface RunMeta {
  version: number;
  runId: string;
  failCount: number;
  countedFailures: string[];
  over: boolean; // 本轮已经结束，只能重新开局
  overReason: EndingId | null;
}

// ---------------- 剧情结构 ----------------

export interface Req {
  text: string; // 缺少什么（未满足时显示）
  test: (s: GameState) => boolean;
}

/** 剧情效果可以调用的接口，由引擎实现。 */
export interface Ctx {
  s: GameState;
  stat(k: StatKey, d: number, why: string): void;
  favor(n: NpcId, d: number, why: string): void;
  meet(n: NpcId): void;
  clue(id: string, lvl?: ClueLevel): void;
  note(key: string, text: string): void;
  flag(k: string, v?: boolean | number | string): void;
  num(k: string): number;
  has(k: string): boolean;
  item(id: ItemId, n: number): void;
  rule(n: number, st: 'true' | 'false'): void;
  doc(k: DocKey): void;
  say(t: string): void;
  rand(): number;
}

export interface Choice {
  id: string;
  label: string;
  tag?: string; // 对话 / 调查 / 行动 ……显示在按钮上
  minutes: number;
  stamina?: number;
  investigate?: boolean;
  minHealth?: number;
  requires?: Req[];
  visible?: (s: GameState) => boolean;
  risk?: string; // 风险提示（显示在按钮下方）
  effect?: (g: Ctx) => void;
  result: string | ((g: Ctx) => string);
  next?: string; // 进入另一个节点；缺省回到日程页
  repeat?: boolean; // 不算完成当前主线节点
  meal?: 'home' | 'bento'; // 选择后完成当前晚餐（仅小插曲使用）
  ending?: EndingId;
  hintInt?: { min: number; text: string };
}

export interface Variant {
  when: (s: GameState) => boolean;
  paragraphs: string[];
}

export interface StoryNode {
  id: string;
  kind: 'main' | 'side' | 'mini';
  title: string;
  location: string;
  present: NpcId[];
  paragraphs: string[];
  variants?: Variant[];
  onEnter?: (g: Ctx) => void;
  choices: Choice[];
}

export interface MainSlot {
  nodeId: string;
  minTime?: number; // 最早可进入的时刻（分钟）
  noon?: boolean; // 中午陪爷爷去阳台的节点
  label: string; // 日程页按钮文案
}

export interface SideDef {
  id: string;
  nodeId: string;
  label: string;
  eta: string; // 预计耗时描述
  note: string; // 一句话说明（不剧透）
  visible: (s: GameState) => boolean;
  requires: Req[];
  minHealth?: number;
  minStamina?: number;
  once: boolean;
}

export interface QuickQuest {
  id: string;
  label: string;
  note: string;
  minutes: number;
  stamina?: number;
  money?: number;
  visible: (s: GameState) => boolean;
  requires: Req[];
  effect: (g: Ctx) => void;
  result: string;
}

// ---------------- 命令 ----------------

export type Command =
  | { kind: 'ackRules' }
  | { kind: 'main' }
  | { kind: 'side'; id: string }
  | { kind: 'quest'; id: string }
  | { kind: 'choose'; choiceId: string }
  | { kind: 'eat'; how: 'home' | 'bento' }
  | { kind: 'use'; item: 'meds' | 'drink' }
  | { kind: 'rest'; minutes: 30 | 60 }
  | { kind: 'shopOpen' }
  | { kind: 'shopClose' }
  | { kind: 'buy'; item: ShopItemId }
  | { kind: 'ask'; npc: FamilyId }
  | { kind: 'sleep' }
  | { kind: 'nextDay' };

export type CommandInput = Command & { seq: number; confirm?: boolean };

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string; confirm?: false }
  | { ok: false; confirm: true; reason: string };
