import { createContext, useContext } from 'react';
import type { Session } from '../game/session';
import type { Command, GameState } from '../game/types';
import type { Settings } from '../settings';

export type PanelId = 'rules' | 'bag' | 'relations' | 'diary' | 'save' | 'share' | null;

export interface Ctx {
  session: Session;
  state: GameState;
  act: (cmd: Command) => void;
  openPanel: (p: PanelId) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  goHome: () => void;
  restart: () => void;
  restore: () => void;
}

export const GameContext = createContext<Ctx | null>(null);

export function useGame(): Ctx {
  const c = useContext(GameContext);
  if (!c) throw new Error('GameContext 未提供');
  return c;
}
