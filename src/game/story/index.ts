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

export { QUICKS, mealVignette } from './quests';

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

function slots(day: number): MainSlot[] {
  const title = (id: string) => NODES[id]?.title ?? id;
  return [
    { nodeId: `d${day}n1`, label: title(`d${day}n1`) },
    { nodeId: `d${day}n2`, label: title(`d${day}n2`), noon: true },
    { nodeId: `d${day}n3`, label: title(`d${day}n3`), minTime: T3[day] },
  ];
}

export const MAIN_SLOTS: Record<number, MainSlot[]> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((d) => [d, slots(d)]),
);
