import { SaveStore } from './game/storage';

export type Theme = 'dark' | 'light';
export interface Settings {
  theme: Theme;
  fontSize: number; // px：16–22
}

export const DEFAULT_SETTINGS: Settings = { theme: 'dark', fontSize: 17 };
export const FONT_SIZES = [16, 17, 18, 20, 22];

export function isSettings(x: unknown): x is Settings {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (o.theme === 'dark' || o.theme === 'light') && typeof o.fontSize === 'number' && o.fontSize >= 14 && o.fontSize <= 26;
}

export function loadSettings(store: SaveStore): Settings {
  const r = store.loadSettings<Settings>(isSettings);
  return r.status === 'ok' ? { ...DEFAULT_SETTINGS, ...r.data } : { ...DEFAULT_SETTINGS };
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.style.setProperty('--fs', `${s.fontSize}px`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', s.theme === 'dark' ? '#181B19' : '#E9E1D0');
}
