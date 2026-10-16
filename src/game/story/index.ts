import type { MainSlot, SideDef, StoryNode } from '../types';
import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { DAY3 } from './day3';
import { DAY4 } from './day4';
import { DAY5 } from './day5';
import { DAY6 } from './day6';
import { DAY7 } from './day7';
import { SIDE_DEFS, SIDE_NODES } from './sides';
import { TALK_DEFS, TALK_NODES } from './talks';

export { ARRIVAL_AGAIN, ARRIVAL_FIRST, QUICKS, mealVignette } from './quests';

export const ALL_NODES: StoryNode[] = [
  ...DAY1,
  ...DAY2,
  ...DAY3,
  ...DAY4,
  ...DAY5,
  ...DAY6,
  ...DAY7,
  ...SIDE_NODES,
  ...TALK_NODES,
];

export const NODES: Record<string, StoryNode> = Object.fromEntries(ALL_NODES.map((n) => [n.id, n]));

export const SIDES: SideDef[] = [...SIDE_DEFS, ...TALK_DEFS];

const T3: Record<number, number> = { 1: 960, 2: 960, 3: 960, 4: 1020, 5: 1020, 6: 960, 7: 840 };

// 睡前提醒用的话：只说“什么时候有什么事”，不透露还没发生的剧情，也不替玩家提前交代没人说过的委托。
// 真正的委托（比如妈妈让去便利店）走 task 标记：被交代之后才会在日程里出现名字、目标和时间。
const REMIND: Record<number, [string, string]> = {
  1: ['小区门口那件对不上的事，还没有问个明白', '下午的事'],
  2: ['早饭桌上的事', '傍晚前后的事'],
  3: ['早晨家里的事', '下午的事'],
  4: ['上午家里的事', '傍晚的事'],
  5: ['早晨饭桌上的事', '晚饭前后的事'],
  6: ['上午的事', '傍晚的事'],
  7: ['最后一天早晨的事', '下午的事'],
};

/** 哪些主线节点是“别人交代的委托”。 */
const SLOT_TASK: Record<string, string> = { d1n3: 'store_errand' };

function slots(day: number): MainSlot[] {
  const title = (id: string) => NODES[id]?.title ?? id;
  const [r1, r3] = REMIND[day];
  const n3 = `d${day}n3`;
  return [
    { nodeId: `d${day}n1`, label: title(`d${day}n1`), remind: r1 },
    { nodeId: `d${day}n2`, label: title(`d${day}n2`), noon: true, remind: '中午十二点，陪爷爷去阳台' },
    { nodeId: n3, label: title(n3), minTime: T3[day], remind: r3, task: SLOT_TASK[n3] },
  ];
}

export const MAIN_SLOTS: Record<number, MainSlot[]> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((d) => [d, slots(d)]),
);
