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

// 睡前提醒用的话：说清楚还有什么事，但不剧透后面的内容。
const REMIND: Record<number, [string, string]> = {
  1: ['小区门口那件对不上的事，还没有问个明白', '妈妈托你下午去一趟便利店'],
  2: ['爸爸出门前留下的话，饭桌上还没有人接', '傍晚的楼道里，对门的邻居好像有话想说'],
  3: ['早晨的厨房里，奶奶和小宇那边需要人搭把手', '下午去一趟物业值班室，问问到底卡在哪里'],
  4: ['上午家里的杂事，每个人手上都有事', '傍晚爸爸要回来，有些话也许能当面说'],
  5: ['早晨饭桌上，爸爸留下的交代还悬着', '晚饭桌上，一家人都会在，要不要把话说开'],
  6: ['清点这几天攒下的东西，看看还缺什么', '傍晚家里安静下来，和家人好好待一会儿'],
  7: ['最后一天的早晨，出门前先把自己安顿好', '下午去值班室，把手里的东西交上去'],
};

function slots(day: number): MainSlot[] {
  const title = (id: string) => NODES[id]?.title ?? id;
  const [r1, r3] = REMIND[day];
  return [
    { nodeId: `d${day}n1`, label: title(`d${day}n1`), remind: r1 },
    { nodeId: `d${day}n2`, label: title(`d${day}n2`), noon: true, remind: '中午十二点，陪爷爷去阳台' },
    { nodeId: `d${day}n3`, label: title(`d${day}n3`), minTime: T3[day], remind: r3 },
  ];
}

export const MAIN_SLOTS: Record<number, MainSlot[]> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((d) => [d, slots(d)]),
);
