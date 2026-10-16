import type { FamilyId, GameState, Req } from '../types';

export const R = (text: string, test: (s: GameState) => boolean): Req => ({ text, test });

export const hasClue = (id: string) => (s: GameState) => !!s.clues[id];
export const isConfirmed = (id: string) => (s: GameState) => s.clues[id] === 'confirmed';
export const hasFlag = (k: string) => (s: GameState) => !!s.flags[k];
export const isHelper = (s: GameState, who: FamilyId) => s.helper === who;
export const hasDoc = (k: 'form' | 'proof' | 'auth') => (s: GameState) => s.docs[k];

/** 隐藏结局需要的四件事 */
export function hiddenReady(s: GameState): boolean {
  return (
    s.docs.form &&
    s.docs.proof &&
    s.docs.auth &&
    !!s.flags['help_done'] &&
    !!s.flags['ledger_found'] &&
    !!s.flags['xu_done']
  );
}

export function missingDocs(s: GameState): string[] {
  const out: string[] = [];
  if (!s.docs.form) out.push('登记表');
  if (!s.docs.proof) out.push('缴费凭证');
  if (!s.docs.auth) out.push('授权委托书');
  return out;
}

/** 日记里可以出现的材料：已经拿到，或者剧情里明确提到过。没提到的不会提前露面。 */
export function mentionedDocs(s: GameState): ('form' | 'proof' | 'auth')[] {
  return (['form', 'proof', 'auth'] as const).filter((k) => s.docs[k] || !!s.flags[`mention_${k}`]);
}
