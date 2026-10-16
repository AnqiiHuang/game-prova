import type { EndingId, FamilyId, GameState } from '../types';
import { fmt, makeVoice } from '../text';

export interface EndingView {
  id: EndingId;
  title: string;
  tone: 'good' | 'hidden' | 'fail';
  paragraphs: string[];
  closure: string; // 一句话收束（分享图也用）
}

const HELP_LINE: Record<FamilyId, string> = {
  mom: '后来你才明白，一直默默替你把账一页一页留着的人，是妈妈。',
  dad: '后来你才明白，肯在最后一刻把真话说出来的人，是爸爸。',
  bro: '后来你才明白，最先把秘密托付给你的人，是年纪最小的小宇。',
  grandma: '后来你才明白，一直把联名册收在柜子里的人，是奶奶。',
  grandpa: '后来你才明白，把一生的认真都留在账本里的人，是爷爷。',
};

function normal(s: GameState): EndingView {
  const paras = [
    '值班员把三份材料一份一份核对完，在系统里敲了很久的字。你站在柜台外面，听着键盘声一下一下，像雨点落在窗台上。过了很久，他抬起头，把一张薄薄的卡片从窗口推了出来：“新卡，登记好了。欠费记录我已经备注为已缴，后续系统会更正。”',
    '你接过那张卡，指尖有一点发凉。卡片很轻，轻得不像是决定了一个星期的东西。周叔在旁边笑着说：“早点来就好了，其实不难。”你也笑了，没有说什么。不难，是因为你们花了七天，才把每一个“难”拆成了一张纸。',
    '你走出值班室，雨后的空气里有青草和泥土的味道。大门口的闸机亮着绿灯，你把卡轻轻一刷，嘀的一声，横杆缓缓抬起。你停在闸机前，没有马上走。身后是三栋，是五零二，是那张还没收拾的餐桌，和一个坐在阳台上的老人。',
    '那个只有你能听见的声音，在你跨出去的那一刻，轻轻响了一下：“恭喜。你找到了离开的办法。”你回头看了一眼，大门外的路灯一盏盏亮起来，把小区的名字照得清清楚楚：幸福小区。你想，这个名字从来没有错，只是需要有人去把它认认真真地写完整。',
    '回到家的时候，全家人都在等你。妈妈把热好的饭端上桌，奶奶给小宇夹菜，爸爸坐在你对面，什么也没说，只是把你的碗添满。爷爷看着你们，笑得很淡。你知道，这一家人，还有很多话要慢慢说，可是今天，先吃饭。',
  ];
  return {
    id: 'normal',
    title: '出口在登记表后面',
    tone: 'good',
    paragraphs: paras,
    closure: '出口一直都在，只是需要一张一张纸，把它办出来。',
  };
}

function hidden(s: GameState): EndingView {
  const paras = [
    '你把三份材料推到柜台上，又把那本深蓝色的旧账本，轻轻放在了最上面。值班员愣了一下，没有马上去拿。他低头看着那本褪了色的硬壳账，看了很久，才伸手翻开第一页。扉页上写着：幸福小区业委会收支明细。字迹工整，一笔一画。',
    '周叔也凑了过来，戴上老花镜看了几页，忽然说：“这是老吴的字。”他抬起头，眼睛有点红，“我跟他一起在这个小区干过十几年。”屋里一下子安静了。打印机偶尔响一声，像是替谁叹了口气。',
    '值班员把账本最后夹着的那页交接说明抽了出来，认认真真读了两遍，然后拿起电话，拨了一个内线：“喂，请经理下来一趟。有一份旧账，需要核。”他放下电话，对你说：“你们家的事，我一定帮你们办清楚。不只是你们家，还有那些交了费却显示欠费的住户。”',
    '经理很快下来了。他看了账本，看了你们的材料，又看了许阿姨递来的联名册。没有人大声说话，可每个人都站得很直。经理最终点了点头：“新系统有问题，是我们的责任。今天起，全小区按住户收据核销，并且公开更正名单。”他看着你，“谢谢你们，把这件事摊开说。”',
    '你走出值班室的时候，天边已经有了一点橘红的光。大门口的闸机向你亮起绿灯，你没有急着刷卡，而是站在门边，回头望了一会儿。三栋的窗户一扇一扇亮着，那一扇是你家的，窗帘被风吹得轻轻动。',
    '那个声音在这时又响了，比之前更轻：“你不只找到了离开的办法，还替大家把门留好了。”你笑了，把新卡贴在读卡器上，嘀的一声，横杆抬起。你知道，今晚许阿姨会在楼道里放一盏灯，周叔会泡上新茶，而你们一家，会坐在一张完整的桌子旁，吃一顿没有人缺席的饭。',
  ];
  if (s.flags['help_done']) paras.push(HELP_LINE[s.helper]);
  return {
    id: 'hidden',
    title: '那本旧账本',
    tone: 'hidden',
    paragraphs: paras,
    closure: '你不只替自己找到了出口，也替这个小区把门留好了。',
  };
}

const FAIL_FEAR: EndingView = {
  id: 'fail_fear',
  title: '心里的弦断了',
  tone: 'fail',
  paragraphs: [
    '这几天压在心里的东西，终于在这一刻全部涌了上来。你站在楼道里，手扶着墙，耳边一片嗡嗡声，什么也听不清。你知道，自己已经走得太久、绷得太紧，不能再往前了。',
    '提示：恐惧值到达了上限，这一次失败了。可以读取存档重来，但失败次数不会清零。记得多休息、多吃饭，心里难受的时候，先停一停。',
  ],
  closure: '走得太急，也要记得停下来歇一歇。',
};

const FAIL_HEALTH: EndingView = {
  id: 'fail_health',
  title: '身体撑不住了',
  tone: 'fail',
  paragraphs: [
    '你的腿一软，扶住了楼梯扶手。最近吃得不好，睡得也不好，身体终于发出了抗议。眼前一阵发黑，你缓缓坐在台阶上，想起奶奶说过的话：“人是铁，饭是钢。”',
    '提示：健康值到达了下限，这一次失败了。可以读取存档重来，但失败次数不会清零。记得按时吃饭、买点药，别硬撑。',
  ],
  closure: '饭是最重要的，这一条是真的。',
};

const TIMEOUT: EndingView = {
  id: 'timeout',
  title: '期限到了',
  tone: 'fail',
  paragraphs: [
    '第七天的夜里，那个平平的声音再次响起：“期限已到。本局游戏结束。”你站在窗边，看着小区里一盏盏熄灭的灯，手里还握着没来得及递出去的材料。',
    '提示：七天已经用完。这一局到这里为止，之前的存档不再可用。重新开始后，家规的真假、家人的态度和那位默默帮你的人，都会重新抽取。',
  ],
  closure: '七天太短，也太长。下一次，也许会走得更稳。',
};

const FAIL_RUN: EndingView = {
  id: 'fail_run',
  title: '四次都没能走出去',
  tone: 'fail',
  paragraphs: [
    '你已经倒下了好几次，每一次，都有人把你扶起来。可这一回，没有人再有力气扶了。你坐在小区的长椅上，看着手里写满字的日记本，慢慢合上。',
    '提示：本局累计失败达到了 4 次，本局结束，之前的存档不再可用。你可以重新开局，用这次学到的东西，换一种走法。',
  ],
  closure: '倒下又站起，已经比大多数人走得更远。',
};

export function endingView(s: GameState, id: EndingId = s.ending?.id ?? 'normal'): EndingView {
  const v = makeVoice(s.player);
  let view: EndingView;
  switch (id) {
    case 'normal':
      view = normal(s);
      break;
    case 'hidden':
      view = hidden(s);
      break;
    case 'fail_fear':
      view = FAIL_FEAR;
      break;
    case 'fail_health':
      view = FAIL_HEALTH;
      break;
    case 'timeout':
      view = TIMEOUT;
      break;
    default:
      view = FAIL_RUN;
  }
  return { ...view, paragraphs: view.paragraphs.map((p) => fmt(p, v)), closure: fmt(view.closure, v) };
}

export function isGoodEnding(id: EndingId): boolean {
  return id === 'normal' || id === 'hidden';
}

/** 不剧透的提示：完成普通结局之后，只说“还有别的收尾方式”，不透露条件。 */
export function lockedNote(id: EndingId): string | null {
  if (id === 'normal') return '这个故事里，也许还有别的收尾方式。';
  return null;
}
