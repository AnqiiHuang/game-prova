import type { GameState, TaskDef } from '../types';

// 别人交代给玩家的事。顺序：剧情交代 → 玩家得知（设置 task_xxx 标记）→ 记入日记的“待办” → 开放行动。
// 交代发生之前，日程提醒、主线按钮和日记里都不会出现任务的名称、目标和时间。

export const TASKS: TaskDef[] = [
  {
    id: 'store_errand',
    title: '妈妈的委托：去便利店',
    giver: '妈妈',
    goal: '打一瓶酱油，顺手带一包盐，记在家里账上，小陈认得你。',
    when: '16:00 之后，晚饭前',
    nodeId: 'd1n3',
    // 中午的阳台剧情之后，妈妈一定会把这件事交代给你；万一没有（旧存档、跳转），由妈妈发消息补上
    due: (s) => s.day === 1 && s.mainIdx >= 2,
    fallback: '妈妈发来消息：“酱油见了底，晚饭前你去门口便利店打一瓶，顺手带包盐，记在家里账上，小陈认得你。四点以后再去，那会儿他补完货了。”',
  },
];

export const TASK_MAP: Record<string, TaskDef> = Object.fromEntries(TASKS.map((t) => [t.id, t]));

export const taskFlag = (id: string) => `task_${id}`;

export function taskGiven(s: GameState, id: string): boolean {
  return !!s.flags[taskFlag(id)];
}

export interface TaskView {
  id: string;
  title: string;
  goal: string;
  when: string;
  done: boolean;
}

/** 玩家已经被交代的事（日记“待办”用）。 */
export function taskViews(s: GameState): TaskView[] {
  return TASKS.filter((t) => taskGiven(s, t.id)).map((t) => ({
    id: t.id,
    title: t.title,
    goal: t.goal,
    when: t.when,
    done: s.visited.includes(t.nodeId),
  }));
}
