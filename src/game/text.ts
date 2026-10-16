import type { Gender } from './types';

export function countCjk(s: string): number {
  return (s.match(/[\u4e00-\u9fff]/g) || []).length;
}

export interface Voice {
  name: string;
  nick: string;
  bro: string; // 弟弟对主角的称呼
  kid: string; // 长辈的称呼
  youth: string; // 外人的称呼
}

export function makeVoice(p: { name: string; gender: Gender; call: string }): Voice {
  const name = p.name.trim() || '林夏';
  const chars = Array.from(name);
  const last = chars[chars.length - 1];
  const nick = last + last;
  const call = p.call.trim();
  if (p.gender === 'female') return { name, nick, bro: '姐姐', kid: '丫头', youth: '姑娘' };
  if (p.gender === 'male') return { name, nick, bro: '哥哥', kid: '小子', youth: '小伙子' };
  return { name, nick, bro: call || name, kid: '孩子', youth: '同学' };
}

export function fmt(text: string, v: Voice): string {
  return text
    .replace(/\{name\}/g, v.name)
    .replace(/\{nick\}/g, v.nick)
    .replace(/\{bro\}/g, v.bro)
    .replace(/\{kid\}/g, v.kid)
    .replace(/\{youth\}/g, v.youth);
}

export const DEFAULT_VOICE: Voice = makeVoice({ name: '林夏', gender: 'female', call: '' });

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
