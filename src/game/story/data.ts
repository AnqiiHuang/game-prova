import type { ItemId, NpcId } from '../types';

// ---------------- 家规 ----------------
// 注意：这里只放玩家可以看到的原文，绝不放真假答案。

export const RULES: { n: number; text: string }[] = [
  { n: 1, text: '一定要听家里人的话！尤其是爸爸的。' },
  { n: 2, text: '爷爷生病中，需要你在中午12点带他到阳台晒太阳。' },
  { n: 3, text: '妈妈不会害你的，可以相信妈妈！' },
  { n: 4, text: '弟弟还小，会经常哭闹，奶奶会因为弟弟哭闹慢慢生气，请照顾好弟弟！' },
  { n: 5, text: '必须吃饭！饭是最重要的！' },
];
export const RULE_NOTE = '以上前五条规则有一项是假的，注意甄别。';

// ---------------- 人物 ----------------

export interface NpcDef {
  name: string;
  identity: string;
  family: boolean;
  // 初见好感范围（家人在开局随机 30-70）
  init: [number, number];
}

export const NPCS: Record<NpcId, NpcDef> = {
  mom: { name: '妈妈', identity: '家人', family: true, init: [30, 70] },
  dad: { name: '爸爸', identity: '家人', family: true, init: [30, 70] },
  bro: { name: '弟弟小宇', identity: '家人', family: true, init: [30, 70] },
  grandma: { name: '奶奶', identity: '家人', family: true, init: [30, 70] },
  grandpa: { name: '爷爷', identity: '家人', family: true, init: [30, 70] },
  zhou: { name: '周叔', identity: '小区门卫', family: false, init: [40, 60] },
  chen: { name: '小陈', identity: '便利店店员', family: false, init: [35, 60] },
  xu: { name: '许阿姨', identity: '邻居（501）', family: false, init: [35, 60] },
  duty: { name: '物业值班员', identity: '物业值班员', family: false, init: [30, 55] },
};

// ---------------- 物品 ----------------

export interface ItemDef {
  name: string;
  desc: string;
  quest?: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  pen: { name: '笔', desc: '一支用惯了的黑色水笔。填表、签字、写日记都要用到。', quest: true },
  diary: { name: '日记本', desc: '随身的小本子。游戏里的“日记”会记下你已经发现的信息。', quest: true },
  meds: { name: '药品', desc: '小区便利店卖的常备药，使用后健康 +20。（游戏道具，不构成任何用药建议。）' },
  bento: { name: '便当', desc: '一份热过的盒饭，可以完成当前餐次，健康 +5。' },
  drink: { name: '黄牛饮料', desc: '包装上印着一头卡通黄牛的虚构饮料，使用后体力 +25。' },
  car: { name: '小汽车模型', desc: '红色的小汽车模型，漆面很亮。小朋友会喜欢。', quest: true },
};

export const SHOP_ORDER: ('meds' | 'bento' | 'drink' | 'car')[] = ['meds', 'bento', 'drink', 'car'];

// ---------------- 线索（日记） ----------------

export interface ClueDef {
  id: string;
  cat: '声音与期限' | '门禁与出口' | '物业与费用' | '家人' | '旧账与储物间';
  title: string;
  suspect: string; // 怀疑时显示
  confirmed: string; // 已证实时显示
}

export const CLUES: ClueDef[] = [
  {
    id: 'c_voice',
    cat: '声音与期限',
    title: '那个声音',
    suspect: '只有我能听见的声音说，七天内要找到离开的办法。',
    confirmed: '只有我能听见的声音说，七天内要找到离开的办法，超过期限本局结束。别人听不见。',
  },
  {
    id: 'c_gate',
    cat: '门禁与出口',
    title: '新闸机',
    suspect: '小区大门换了新闸机，似乎出门也要刷卡。',
    confirmed: '旧门禁卡已停用。新闸机进出都要刷新卡，没有新卡要凭临时通行单。',
  },
  {
    id: 'c_notice1',
    cat: '门禁与出口',
    title: '大门公告',
    suspect: '公告栏里有一张关于换卡的通知，没读完。',
    confirmed: '公告：旧卡停用，新卡和临时通行单都在物业值班室办理，需要业主材料。',
  },
  {
    id: 'c_notice2',
    cat: '门禁与出口',
    title: '办理条件',
    suspect: '听说办理要业主本人签字，还不能欠费。',
    confirmed: '办理条件：登记表＋产权人签字（或书面授权）＋房产证复印件＋无欠费记录。',
  },
  {
    id: 'c_exits',
    cat: '门禁与出口',
    title: '小区的出口',
    suspect: '小区好像只有一个人行出口。',
    confirmed: '只有大门闸机能出去：应急门是消防门，侧门被挂锁封住，车库口也要刷卡。',
  },
  {
    id: 'c_escort',
    cat: '门禁与出口',
    title: '为什么不能让家人带我出去',
    suspect: '周叔好像说，闸机一次只放一个人。',
    confirmed: '新闸机一人一刷，两个人挤一次会被拍照并锁杆。家人的卡只能带他们自己出去，没法替我刷。要出去，只有我自己的新卡，或者写着我名字的临时通行单。',
  },
  {
    id: 'c_office',
    cat: '门禁与出口',
    title: '直接去物业问行不行',
    suspect: '值班室也许能问到办法，但周叔话里有保留。',
    confirmed: '值班室随时可以去，但只受理业主本人或有授权的人。空着手去只会被请回来；系统里这套房还显示欠着费，不先弄清楚，新卡办不下来。',
  },
  {
    id: 'c_dad_card',
    cat: '家人',
    title: '爸爸的短信和登记本',
    suspect: '爸爸发短信说新门禁卡早办好了，放在周叔那儿；周叔翻了登记本，说这个月五零二没有人来办过。',
    confirmed: '爸爸说“新卡办好了”，其实一直没去物业登记。周叔的登记本和值班员的记录都对得上，记漏的不是门卫。',
  },
  {
    id: 'c_store_pay',
    cat: '物业与费用',
    title: '妈妈交过物业费？',
    suspect: '小陈随口说，我妈上个月在他店里的机器上交过物业费。',
    confirmed: '缴费机的流水里，确实有三栋502上个月的物业费缴费记录。',
  },
  {
    id: 'c_new_sys',
    cat: '物业与费用',
    title: '新系统出错',
    suspect: '小陈说，好像有不少住户交了费还显示欠费。',
    confirmed: '不止一户反映：新物业换系统后，已交的费用还显示欠费。',
  },
  {
    id: 'c_chen_records',
    cat: '物业与费用',
    title: '便利店缴费流水',
    suspect: '便利店的缴费机也许能查到流水。',
    confirmed: '小陈可以按房号查缴费流水并打印小票（需要 2 元打印费）。',
  },
  {
    id: 'c_arrears',
    cat: '物业与费用',
    title: '系统里的欠费',
    suspect: '物业系统里似乎显示我家欠费。',
    confirmed: '物业系统显示三栋502欠两个月物业费，所以没法办新卡。这和小陈的说法对不上。',
  },
  {
    id: 'c_appeal',
    cat: '物业与费用',
    title: '可以申诉',
    suspect: '欠费好像可以申诉。',
    confirmed: '值班员说：拿得出缴费凭证，可以申诉并按已缴处理。',
  },
  {
    id: 'c_sun_note',
    cat: '家人',
    title: '冰箱上的便条',
    suspect: '冰箱上贴着一张便条，好像是写给晒太阳的事。',
    confirmed: '便条上是奶奶的字：医生交代，爷爷每天中午晒一阵太阳，戴帽子，晒完就进屋。',
  },
  {
    id: 'c_dad_conflict',
    cat: '家人',
    title: '爸爸的说法对不上',
    suspect: '爸爸说今天别带爷爷去阳台，可便条上写的不是这样。',
    confirmed: '爸爸要停掉晒太阳，与医生交代的便条相反，也和爷爷的状态相反。',
  },
  {
    id: 'c_dad_not_reg',
    cat: '家人',
    title: '“我来处理”？',
    suspect: '爸爸说物业的事他来处理，可邻居说他一直没去登记。',
    confirmed: '值班员亲口说：户主一直没来登记，电话也打不通。爸爸嘴上说“我来处理”，实际上没有。',
  },
  {
    id: 'c_dad_hides',
    cat: '家人',
    title: '爸爸在回避',
    suspect: '一提门禁和物业，爸爸就岔开话题。',
    confirmed: '爸爸一再回避门禁和物业的事，说“我会处理”，但他没有说是怎么处理。',
  },
  {
    id: 'c_dad_work',
    cat: '家人',
    title: '爸爸的工作',
    suspect: '爸爸的工牌一直挂在门口，他好像不怎么用。',
    confirmed: '爸爸这几个月没有去上班，他一直没告诉家里人。',
  },
  {
    id: 'c_mom_call',
    cat: '家人',
    title: '妈妈的电话',
    suspect: '妈妈接电话时说“钱的事先别告诉孩子”。',
    confirmed: '妈妈一直在替家里想办法，还答应过爸爸先不告诉我。',
  },
  {
    id: 'c_mom_books',
    cat: '家人',
    title: '妈妈的账本',
    suspect: '妈妈有一本记账的本子。',
    confirmed: '妈妈的账本里清楚记着：物业费，她用自己的工资交过，小票都收着。',
  },
  {
    id: 'c_bro_toy',
    cat: '家人',
    title: '小宇想要的玩具',
    suspect: '小宇一直念叨便利店里那辆红色小汽车。',
    confirmed: '小宇最想要便利店里的红色小汽车模型。奶奶不肯买。',
  },
  {
    id: 'c_bro_key',
    cat: '家人',
    title: '小宇的小钥匙',
    suspect: '小宇说他有个秘密，是一把小钥匙。',
    confirmed: '爷爷把储物间的小钥匙交给了小宇保管，小宇藏在他的玩具车库里。',
  },
  {
    id: 'c_grandma_tired',
    cat: '家人',
    title: '奶奶很累',
    suspect: '奶奶最近脾气不太好，一直在带小宇。',
    confirmed: '奶奶不是不讲理，是又累又没人替手。小宇哭得越久，她越没耐心；有人搭把手，她很快缓过来。',
  },
  {
    id: 'c_grandpa_owner',
    cat: '家人',
    title: '房子是谁的名字',
    suspect: '爷爷好像提过，房子不是写爸爸的名字。',
    confirmed: '房子是当年单位分给爷爷的，产权人是爷爷。爸爸只是户口本上的户主。',
  },
  {
    id: 'c_auth',
    cat: '物业与费用',
    title: '授权委托书',
    suspect: '需要爷爷签一份委托书。',
    confirmed: '爷爷看完内容，亲手签了授权委托书，房产证复印件附在后面。',
  },
  {
    id: 'c_old_hint',
    cat: '旧账与储物间',
    title: '小区以前的样子',
    suspect: '爷爷嘟囔了一句：这小区以前不是这样的。',
    confirmed: '爷爷说，小区以前每一笔钱都在公告栏上公示，谁管账，谁签字。',
  },
  {
    id: 'c_xu_old',
    cat: '旧账与储物间',
    title: '许阿姨提到的旧账',
    suspect: '许阿姨说，爷爷以前管过小区的账。',
    confirmed: '许阿姨说，爷爷当年是业委会管账的人，旧物业交接时的账都经过他的手。',
  },
  {
    id: 'c_old_admin',
    cat: '旧账与储物间',
    title: '爷爷管过账',
    suspect: '爷爷好像当过业委会的什么人。',
    confirmed: '爷爷当年管过业委会的账，旧物业交接时的记录，他手里留着一本账。',
  },
  {
    id: 'c_ledger',
    cat: '旧账与储物间',
    title: '旧账本',
    suspect: '爷爷提到“我管过的那本账”。',
    confirmed: '那本旧账本还在，放在家里的地下储物间里。',
  },
  {
    id: 'c_storage_loc',
    cat: '旧账与储物间',
    title: '储物间的位置',
    suspect: '家里好像有一间地下储物间。',
    confirmed: '三栋一单元楼下有间小储物间，是我们家的，门上挂着旧锁。',
  },
  {
    id: 'c_ledger_found',
    cat: '旧账与储物间',
    title: '找到旧账本',
    suspect: '',
    confirmed: '在储物间里找到了旧账本，记着旧物业交接时的缴费与结转。',
  },
];

export const CLUE_MAP: Record<string, ClueDef> = Object.fromEntries(CLUES.map((c) => [c.id, c]));

// 日记里的“观察”条目（带有动态文字，见 state.notes）
export const NOTE_LABEL: Record<string, string> = {
  obs_mom: '观察：妈妈',
  obs_dad: '观察：爸爸',
  obs_bro: '观察：小宇',
  obs_grandma: '观察：奶奶',
  obs_grandpa: '观察：爷爷',
  talk_mom: '谈话：妈妈',
  talk_dad: '谈话：爸爸',
  talk_bro: '谈话：小宇',
  talk_grandma: '谈话：奶奶',
  talk_grandpa: '谈话：爷爷',
};

export const DOC_INFO: Record<'form' | 'proof' | 'auth', { name: string; hint: string }> = {
  form: { name: '登记表', hint: '到物业值班室领取，用自己的笔填写。' },
  proof: { name: '缴费凭证', hint: '证明物业费已经缴过。' },
  auth: { name: '授权委托书', hint: '需要产权人本人看过并签字，附房产证复印件。' },
};
