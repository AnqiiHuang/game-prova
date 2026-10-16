import { useBlock as engineUseBlock } from '../game/engine';
import type { GameState } from '../game/types';

/** 把引擎里的 useBlock 包成一个小函数，方便在组件里使用。 */
export function useBlockUse(s: GameState) {
  return (item: 'meds' | 'drink' | string) => (item === 'meds' || item === 'drink' ? engineUseBlock(s, item) : null);
}
