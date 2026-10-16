import { describe, expect, it } from 'vitest';
import { playBot } from './bot';
import type { FamilyId, LuckTier } from '../src/game/types';

const HELPERS: FamilyId[] = ['mom', 'dad', 'bro', 'grandma', 'grandpa'];
const LUCKS: LuckTier[] = ['high', 'mid', 'low'];

describe('通关机器人：5 位帮助者 × 3 档幸运', () => {
  for (const helper of HELPERS) {
    for (const luck of LUCKS) {
      it(`隐藏结局可达：帮助者=${helper}，幸运=${luck}`, () => {
        const r = playBot({ seed: 1000 + HELPERS.indexOf(helper) * 10 + LUCKS.indexOf(luck), helper, luck, goal: 'hidden' });
        if (r.state.ending?.id !== 'hidden') console.log(r.log.slice(-25).join('\n'));
        expect(r.state.ending?.id).toBe('hidden');
      });
      it(`普通结局可达：帮助者=${helper}，幸运=${luck}`, () => {
        const r = playBot({ seed: 2000 + HELPERS.indexOf(helper) * 10 + LUCKS.indexOf(luck), helper, luck, goal: 'normal' });
        if (r.state.ending?.id !== 'normal') console.log(r.log.slice(-25).join('\n'));
        expect(r.state.ending?.id).toBe('normal');
      });
    }
  }
});
