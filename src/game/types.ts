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
/**
 * 日记里的三种记录：
 * claim = 人物的说法（听来的，还没核实）；suspect = 我自己觉得蹊跷、还没有证据的地方；confirmed = 亲眼见到或有确凿凭证的事实。
 */
export type ClueLevel = 'claim' | 'suspect' | 'confirmed';
export type DocKey = 'form' | 'proof' | 'auth';
export type RuleStatus = 'unknown' | 'true' | 'false';
/** 玩家自己给家规做的判断标记，不代表系统公布答案。 */
export type RuleMark = 'none' | 'trust' | 'doubt';
export const RULE_MARK_LABEL: Record<RuleMark, string> = {
  none: '未判断',
  trust: '暂时相信',
  doubt: '怀疑有假',
};
/** 当前所在的位置：小区门口，或者回到了三栋502（家里）。便利店等短途行动结束后仍回到出发的位置。 */
export type Place = 'gate' | 'home';

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
  place: Place;
  marks: Record<number, RuleMark>;
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
  /** 剧情里明确提到了某份材料：之后才会出现在日记的“材料”里。 */
  mention(k: DocKey): void;
  /** 玩家确实被交代了一件事：记入日记的“待办”，之后才会在日程里显示名称、目标和时间。同一件事只会触发一次。 */
  task(id: string): void;
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
  goHome?: boolean; // 选择后走回家里（用时已包含在 minutes 中），位置变为“家里”
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
  /** 篇幅：普通节点约 200–400 字；重要节点约 600–800 字（不含“展开细节”）。 */
  weight?: 'normal' | 'key';
  title: string;
  location: string;
  /**
   * 开始这个节点需要玩家在哪里：
   * home（默认）：要先在家里，在场人物才合理；out：出门办事，在门口或家里都可以开始；gate：只在小区门口开始。
   */
  place?: 'home' | 'out' | 'gate';
  present: NpcId[];
  /** 默认可见的正文：关键线索和风险提示必须写在这里。 */
  paragraphs: string[];
  /** 折叠的“展开细节”：环境、心理和补充描写，不含必须看到的关键信息。 */
  details?: string[];
  variants?: Variant[];
  onEnter?: (g: Ctx) => void;
  choices: Choice[];
}

export interface MainSlot {
  nodeId: string;
  /** 睡前提醒里用的一句话，不剧透。 */
  remind?: string;
  /** 这个节点是某个委托：只有玩家真的被交代之后，才会显示它的名称、目标和时间要求，也才能开始。 */
  task?: string;
  minTime?: number; // 最早可进入的时刻（分钟）
  noon?: boolean; // 中午陪爷爷去阳台的节点
  label: string; // 日程页按钮文案
}

/** 别人交代给玩家的事。交代发生之前，日程、提醒和日记里都不会出现它。 */
export interface TaskDef {
  id: string;
  title: string;
  giver: string;
  goal: string;
  when: string; // 时间要求
  nodeId: string; // 完成它的主线节点
  /** 万一前面的对话没有触发（旧存档、跳转），这时候由消息补上。 */
  due: (s: GameState) => boolean;
  fallback: string;
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
  /** 可以在哪些位置开始。默认：门口或家里都可以（出门办事，办完回到出发的位置）。 */
  from?: Place[];
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
  | { kind: 'go'; to: 'home' }
  | { kind: 'markRule'; rule: number; mark: RuleMark }
  | { kind: 'sleep' }
  | { kind: 'nextDay' };

export type CommandInput = Command & { seq: number; confirm?: boolean };

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string; confirm?: false }
  | { ok: false; confirm: true; reason: string };
