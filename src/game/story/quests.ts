import type { MealSlot, QuickQuest } from '../types';
import { R, hasClue } from './helpers';
import type { GameState } from '../types';

// 短行动：不进入长剧情，直接结算。它们是材料的“保底路线”，不会替代主线里的好剧情。
// 其中 from: ['gate'] 的几个，只在第 1 天还站在小区门口时出现：问清为什么不能直接离开，再决定回不回家。

/** 第一次回家：家里人当面说起门卡的事。走回家的选项和日程页的“回家”共用这段文字。 */
export const ARRIVAL_FIRST =
  '你一口气爬上五楼，门没锁。妈妈系着围裙从厨房探出头：“可算回来了，先洗手。”你把爸爸发来的短信递到他面前，问新卡的事。爸爸扫了一眼屏幕：“办过了。该交的我都交了，大概是他们那边还没录进去，我晚点打电话问。”他把手机扣回桌上，没说是哪天去的，也没说在哪儿办的。厨房里翻锅的声音顿了一下，没有人接话。';

export const ARRIVAL_AGAIN = '你沿着楼道一层层往上走，推开家门。屋里有饭菜的味道，家里人各忙各的，看见你回来，有人点了点头。';

export const GATE_BOOK_RESULT =
  '周叔把登记本整本推到你面前，手指顺着日期一页页划过去：新卡申领的名单里，三栋有好几户，唯独没有五零二。“白班夜班我都问过老刘了，都说没见过。”他又拉开抽屉翻了一遍，没有任何留给五零二的卡和单子。他合上本子，“不过倒班的时候漏记，也不是头一回。我只能说我这儿没有，别的我不敢替人打包票。”你没有再追问，只把这一页的日期记在了心里。';

export const GATE_NOTICE_RESULT =
  '你站在公告栏前，一张一张读下去。最上面那张写着：旧门禁卡自即日起停用，新卡及临时通行单一律在物业值班室办理，须出示业主相关材料。落款是新物业的公章，日期就在上个月。你把几个关键的词默默记在心里，又抬头看了一眼闸机旁边那扇小铁门。';

export const QUICKS: QuickQuest[] = [
  {
    id: 'q_gate_book',
    label: '请周叔把登记本翻给你看',
    note: '小区门口',
    minutes: 10,
    from: ['gate'],
    visible: (s) => s.day === 1 && s.place === 'gate' && !s.flags['asked_book'],
    requires: [],
    effect: (g) => {
      g.favor('zhou', 4, '你耐心请他再查了一遍');
      g.clue('c_gate', 'confirmed');
      g.flag('asked_book');
    },
    result: GATE_BOOK_RESULT,
  },
  {
    id: 'q_gate_notice',
    label: '走到公告栏前，把每一张都读完',
    note: '小区门口',
    minutes: 20,
    stamina: 2,
    from: ['gate'],
    visible: (s) => s.day === 1 && s.place === 'gate' && !s.clues['c_notice1'],
    requires: [],
    effect: (g) => {
      g.clue('c_notice1', 'confirmed');
      g.clue('c_exits', 'suspect');
    },
    result: GATE_NOTICE_RESULT,
  },
  {
    id: 'q_gate_escort',
    label: '问周叔：能不能让家里人带我出去？',
    note: '小区门口',
    minutes: 10,
    from: ['gate'],
    visible: (s) => s.day === 1 && s.place === 'gate',
    requires: [],
    effect: (g) => {
      g.favor('zhou', 2, '你耐心听他讲了闸机的规矩');
      g.clue('c_gate', 'confirmed');
      g.clue('c_escort', 'confirmed');
    },
    result:
      '你问周叔，能不能让家里人把你带出去。周叔摇头：“新闸机一人一刷，两个人挤一次，会被拍照，杆子当场锁死，还要找物业来解。你家里人的卡，只能带他们自己出去。”他想了想，补了一句：“要走，只有你自己的新卡，或者物业开的、写着你名字的临时通行单。”你把这两条记在心里：谁的卡，都替不了你的那一刷。',
  },
  {
    id: 'q_gate_office',
    label: '问周叔：直接去物业值班室问行不行？',
    note: '小区门口',
    minutes: 10,
    from: ['gate'],
    visible: (s) => s.day === 1 && s.place === 'gate',
    requires: [],
    effect: (g) => {
      g.favor('zhou', 2, '你向他请教了找物业的门道');
      g.clue('c_office', 'confirmed');
      g.clue('c_notice2', 'suspect');
    },
    result:
      '你问周叔，能不能直接去值班室问个明白。周叔苦笑：“值班室随时能去，可那儿只认业主本人，或者有授权的人。你一个孩子，空着手进去，只会被请回来。”他压低声音，“我还听说，新系统里不少户显示欠着费，欠着费就办不了新卡。你们家是什么情况，得先弄清楚，别白跑一趟。”',
  },
  {
    id: 'q_gate_card',
    label: '掏出旧门禁卡，试着刷一下闸机',
    note: '小区门口',
    minutes: 5,
    from: ['gate'],
    visible: (s) => s.day === 1 && s.place === 'gate',
    requires: [],
    effect: (g) => {
      g.stat('fear', 3, '红灯亮起，闸机冷冰冰地拒绝了你');
      g.clue('c_gate', 'confirmed');
    },
    result:
      '你掏出那张用了好几年的旧卡，贴上读卡区。“嘀嘀”两声，红灯亮起，屏幕上滚出一行字：卡片已失效。周叔在亭子里探头：“看吧，我说什么来着。”你收起卡，心里沉了一下。',
  },
  {
    id: 'q_form',
    label: '去值班室补领登记表',
    note: '值班室',
    minutes: 30,
    stamina: 3,
    // 剧情里点名过登记表（许阿姨或值班员说过）之后，才会出现这个行动
    visible: (s) => s.day >= 3 && !s.docs.form && !!s.flags['mention_form'],
    requires: [R('已经知道办理需要什么条件', hasClue('c_notice2'))],
    effect: (g) => {
      g.doc('form');
      g.favor('duty', 1, '你按规矩来领表');
    },
    result:
      '你到值班室，说想领一份登记表。值班员从抽屉里抽出一张，推给你：“带回去填，产权人那栏要签字。”表格不复杂，一页纸，写着房号、姓名、联系方式和一栏“办理事由”。你把它折好，放进日记本里，顺着原路回来。',
  },
  {
    id: 'q_print',
    label: '请小陈打印缴费记录',
    note: '便利店 · 2 元打印费',
    minutes: 30,
    money: 2,
    // 小陈说过他的机器能查流水之后，才会出现这个行动
    visible: (s) => !s.docs.proof && s.npcs.chen.known && !!s.clues['c_chen_records'],
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
      '你拿着房号去找小陈，他在缴费机上敲了几下，机器吐出一张窄窄的热敏纸：三栋502，上个月的日期，金额，缴费成功。他撕下来递给你，又盖了店里的章：“打印费两块，你扫一下。”你把纸对折，夹进日记本，道了谢往回走。纸上的字有点淡，但是够清楚。',
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
