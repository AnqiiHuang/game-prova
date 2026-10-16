import type { GameState } from '../types';

// “新卡到底办了没有”这件事可能的解释。
// 日记里只摆出当前能看到的证据和对不上的地方，不替玩家下结论；
// 能被排除的，只能靠亲眼见到的事实（值班室的系统、值班员的话）排除。

interface Evidence {
  side: 'for' | 'against';
  text: string;
  test: (s: GameState) => boolean;
}

interface Hypothesis {
  id: string;
  title: string;
  evidence: Evidence[];
}

const confirmed = (id: string) => (s: GameState) => s.clues[id] === 'confirmed';
const exists = (id: string) => (s: GameState) => !!s.clues[id];

export const HYPOTHESES: Hypothesis[] = [
  {
    id: 'h_book',
    title: '登记遗漏：门卫的本子记漏了',
    evidence: [
      { side: 'for', text: '周叔自己说过，倒班交接的时候漏记也不是没有过。', test: (s) => !!s.flags['zhou_handover'] },
      { side: 'against', text: '周叔把本子整本翻给我看了，别户都在，唯独没有五零二；他还问过夜班的老刘，也没人见过。', test: confirmed('c_zhou_book') },
      { side: 'against', text: '值班室的系统里也查不到五零二的新卡申请，不只是门卫的本子。', test: confirmed('c_dad_card') },
    ],
  },
  {
    id: 'h_handover',
    title: '交接问题：卡办了，但压在物业手里或放错了地方',
    evidence: [
      { side: 'for', text: '爸爸说新卡“应该在周叔那儿”，周叔却说他这儿没留过卡，这中间有没有人传话，我不知道。', test: exists('c_dad_card') },
      { side: 'against', text: '周叔把抽屉也翻了一遍，没有留给五零二的卡和单子。', test: confirmed('c_zhou_book') },
      { side: 'against', text: '值班室的系统里没有申请记录，没有申请就谈不上有卡压在谁手里。', test: confirmed('c_dad_card') },
    ],
  },
  {
    id: 'h_progress',
    title: '理解不同：爸爸说的“办过了”只是办了其中一部分',
    evidence: [
      { side: 'for', text: '爸爸说的是“办过了”，没说“办好了”，也没说哪天去的、在哪儿办的。', test: exists('c_dad_hides') },
      { side: 'against', text: '许阿姨说，听周叔念叨过爸爸一直没去值班室登记。（她也是听说，不能当凭据。）', test: (s) => !!s.flags['met_xu'] },
      { side: 'against', text: '值班员亲口说：户主一直没来登记，电话也打不通。连登记都没有，谈不上办了一部分。', test: confirmed('c_dad_not_reg') },
    ],
  },
  {
    id: 'h_hide',
    title: '有人隐瞒：谁没把话说全',
    evidence: [
      { side: 'for', text: '问到新卡和物业，爸爸只说了“办过了”，没有细节。', test: exists('c_dad_hides') },
      { side: 'for', text: '爸爸要停掉中午晒太阳，和冰箱上的便条写的相反。', test: exists('c_dad_conflict') },
      { side: 'for', text: '妈妈接电话时说“钱的事先别告诉孩子”。', test: exists('c_mom_call') },
      { side: 'for', text: '值班员说户主一直没来登记，爸爸那句“办过了”没有对上任何记录。', test: confirmed('c_dad_card') },
    ],
  },
];

export type HypothesisStatus = 'open' | 'doubtful' | 'unlikely';

export interface HypothesisView {
  id: string;
  title: string;
  status: HypothesisStatus;
  statusText: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
}

const STATUS_TEXT: Record<HypothesisStatus, string> = {
  open: '目前说得通',
  doubtful: '出现了对不上的地方',
  unlikely: '很难再成立',
};

/** 这件事从爸爸的短信出现就开始记录；之后随证据变化，状态只描述“证据对得上多少”，不宣布答案。 */
export function hypothesisViews(s: GameState): HypothesisView[] {
  if (!s.clues['c_dad_card']) return [];
  return HYPOTHESES.map((h) => {
    const hits = h.evidence.filter((e) => e.test(s));
    const against = hits.filter((e) => e.side === 'against');
    const status: HypothesisStatus = against.length >= 2 ? 'unlikely' : against.length === 1 ? 'doubtful' : 'open';
    return {
      id: h.id,
      title: h.title,
      status,
      statusText: STATUS_TEXT[status],
      evidenceFor: hits.filter((e) => e.side === 'for').map((e) => e.text),
      evidenceAgainst: against.map((e) => e.text),
    };
  });
}
