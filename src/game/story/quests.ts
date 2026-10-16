import type { MealSlot, QuickQuest } from '../types';
import { R, hasClue } from './helpers';
import type { GameState } from '../types';

// 短行动：不进入长剧情，直接结算。它们是材料的“保底路线”，不会替代主线里的好剧情。

export const QUICKS: QuickQuest[] = [
  {
    id: 'q_form',
    label: '去值班室补领登记表',
    note: '值班室',
    minutes: 30,
    stamina: 3,
    visible: (s) => s.day >= 3 && !s.docs.form,
    requires: [R('已经知道办理需要什么条件', hasClue('c_notice2'))],
    effect: (g) => {
      g.doc('form');
      g.favor('duty', 1, '你按规矩来领表');
    },
    result:
      '你到值班室，说想领一份登记表。值班员从抽屉里抽出一张，推给你：“带回去填，产权人那栏要签字。”表格不复杂，一页纸，写着房号、姓名、联系方式和一栏“办理事由”。你把它折好，放进日记本里。',
  },
  {
    id: 'q_print',
    label: '请小陈打印缴费记录',
    note: '便利店 · 2 元打印费',
    minutes: 30,
    money: 2,
    visible: (s) => !s.docs.proof && s.npcs.chen.known,
    requires: [
      R('听说过妈妈交过费', hasClue('c_store_pay')),
      R('知道系统里显示欠费', hasClue('c_arrears')),
    ],
    effect: (g) => {
      g.doc('proof');
      g.clue('c_chen_records', 'confirmed');
      g.clue('c_store_pay', 'confirmed');
      g.favor('chen', 2, '你按规矩付了打印费');
    },
    result:
      '你拿着房号去找小陈，他在缴费机上敲了几下，机器吐出一张窄窄的热敏纸：三栋502，上个月的日期，金额，缴费成功。他撕下来递给你，又盖了店里的章：“打印费两块，你扫一下。”你把纸对折，夹进日记本。纸上的字有点淡，但是够清楚。',
  },
];

const VIGNETTES: Record<number, Record<MealSlot, string>> = {
  1: {
    breakfast: '你吃完了早饭。',
    lunch: '午饭是奶奶煮的面条，热气腾腾，你吃得很干净。',
    dinner: '晚饭桌上，每个人都吃得很快，没有人多说话。',
  },
  2: {
    breakfast: '早饭是白粥和小菜，奶奶说，粥要趁热喝。',
    lunch: '午饭有妈妈留下的炒蛋，你配着米饭吃完了。',
    dinner: '晚饭时电视开着，声音调得很小，爷爷慢慢地喝着汤。',
  },
  3: {
    breakfast: '早饭是煎蛋和馒头，小宇把蛋黄留到了最后。',
    lunch: '午饭是剩的青菜和一碗汤，你吃得不多，也没有剩。',
    dinner: '你坐下来，把饭吃完了。',
  },
  4: {
    breakfast: '早饭有一碟腌萝卜，咸得刚刚好，你多添了半碗粥。',
    lunch: '午饭很简单，一碗面，一个荷包蛋。',
    dinner: '晚饭桌上，爸爸的位置依旧空着一半。',
  },
  5: {
    breakfast: '早饭的时候，家里的气氛有点紧，你还是认真地吃完了。',
    lunch: '午饭是妈妈做的，她做得很慢，每一样都认真盛好。',
    dinner: '你坐下来把饭吃完，米饭有点硬，但是很香。',
  },
  6: {
    breakfast: '早饭是热豆浆和包子，小宇把包子皮撕开，只吃馅。',
    lunch: '午饭吃得安静，窗外一直在下雨。',
    dinner: '晚饭有你小时候爱吃的菜，你不由得多吃了一碗。',
  },
  7: {
    breakfast: '最后一天的早饭，奶奶煮了你爱吃的红糖鸡蛋。',
    lunch: '午饭很简单，你吃得很专心，没有说话。',
    dinner: '晚饭时，每个人都朝你看了一眼，又低头吃饭。',
  },
};

export function mealVignette(s: GameState, slot: MealSlot): string {
  const day = Math.min(7, Math.max(1, s.day));
  return VIGNETTES[day][slot];
}
