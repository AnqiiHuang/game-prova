// 分享图：完全在本地用 Canvas 绘制，1080×1440 PNG。
// 默认不暴露自定义名字、尚未揭晓的帮助者、没有证实的家规答案；不含二维码或外链。

import { RULES } from '../game/story/data';
import { NODES } from '../game/story';
import { endingView } from '../game/story/endings';
import { fmt, makeVoice } from '../game/text';
import type { GameState } from '../game/types';

export type ShareTemplate = 'cover' | 'story' | 'ending';

export const SHARE_W = 1080;
export const SHARE_H = 1440;
export const FOOTER = '虚构互动故事｜AI辅助创作';

const C = {
  bg: '#181B19',
  card: '#F3EBDD',
  text: '#292B26',
  accent: '#69765C',
  warn: '#8A4A43',
  soft: '#6B6A5F',
};

const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","WenQuanYi Micro Hei",sans-serif';

export interface ShareOptions {
  template: ShareTemplate;
  state: GameState | null;
  /** 是否在图上显示自定义名字（默认 false） */
  showName?: boolean;
}

// ---------- 文字排版 ----------

const NO_LINE_START = new Set('，。！？、；：）》」』”’…—,.!?;:)]}'.split(''));

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') {
      lines.push('');
      continue;
    }
    let line = '';
    for (const ch of Array.from(para)) {
      const w = ctx.measureText(line + ch).width;
      if (w > maxWidth && line) {
        if (NO_LINE_START.has(ch)) {
          // 标点不放行首：让它挂在上一行末尾
          line += ch;
          lines.push(line);
          line = '';
          continue;
        }
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface Fit {
  size: number;
  lines: string[];
  lh: number;
}

/** 在给定区域里自动缩小字号，保证全文放得下，不截断。 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxH: number,
  start: number,
  min: number,
  weight = '400',
  ratio = 1.65,
): Fit {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrapLines(ctx, text, maxW);
    const lh = Math.round(size * ratio);
    if (lines.length * lh <= maxH) return { size, lines, lh };
  }
  ctx.font = `${weight} ${min}px ${FONT}`;
  const lines = wrapLines(ctx, text, maxW);
  return { size: min, lines, lh: Math.round(min * ratio) };
}

function drawLines(ctx: CanvasRenderingContext2D, f: Fit, x: number, y: number, color: string, weight = '400', align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${f.size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  f.lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * f.lh));
  return y + f.lines.length * f.lh;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function frame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  // 细细的纸纹：几条淡淡的横线，装饰用
  ctx.strokeStyle = 'rgba(243,235,221,0.04)';
  ctx.lineWidth = 2;
  for (let y = 60; y < SHARE_H; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SHARE_W, y);
    ctx.stroke();
  }
  ctx.fillStyle = C.card;
  roundRect(ctx, 60, 60, SHARE_W - 120, SHARE_H - 200, 28);
  ctx.fill();
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 3;
  roundRect(ctx, 84, 84, SHARE_W - 168, SHARE_H - 248, 20);
  ctx.stroke();
}

function footer(ctx: CanvasRenderingContext2D) {
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = 'rgba(243,235,221,0.78)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(FOOTER, SHARE_W / 2, SHARE_H - 70);
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = `600 28px ${FONT}`;
  const w = ctx.measureText(text).width + 44;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#F3EBDD';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 22, y + 27);
  return w;
}

// ---------- 模板 ----------

function drawCover(ctx: CanvasRenderingContext2D) {
  const x = 140;
  const w = SHARE_W - 280;
  tag(ctx, '纯属虚构的互动文字游戏', x, 140, C.accent);

  let f = fitText(ctx, '逃离\n幸福小区', w, 330, 120, 80, '800', 1.25);
  let y = drawLines(ctx, f, x, 240, C.text, '800');

  f = fitText(ctx, '七天内，找出那条假的家规', w, 120, 50, 34, '700', 1.4);
  y = drawLines(ctx, f, x, y + 30, C.warn, '700');

  // 五条家规（只展示原文，不给任何答案）
  y += 40;
  ctx.strokeStyle = 'rgba(41,43,38,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  y += 30;
  const rulesText = RULES.map((r) => `${r.n}. ${r.text}`).join('\n');
  const maxH = SHARE_H - 200 - y - 160;
  const rf = fitText(ctx, rulesText, w, maxH, 38, 26, '500', 1.7);
  y = drawLines(ctx, rf, x, y, C.text, '500');
  ctx.font = `600 ${Math.max(26, rf.size - 2)}px ${FONT}`;
  const note = fitText(ctx, '以上前五条规则有一项是假的，注意甄别。', w, 100, 34, 26, '600', 1.5);
  drawLines(ctx, note, x, y + 18, C.warn, '600');
}

function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const ch of Array.from(text)) {
    buf += ch;
    if ('。！？'.includes(ch)) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** 从一个剧情节点里取一段完整的句子（不拦腰截断）。 */
export function excerptOf(nodeId: string | null, v: ReturnType<typeof makeVoice>, maxChars = 260): { title: string; text: string; location: string } {
  const node = (nodeId && NODES[nodeId]) || NODES['d1n1'];
  const sentences = sentencesOf(node.paragraphs.slice(0, 3).join(''));
  let text = '';
  for (const s of sentences) {
    if (text.length + s.length > maxChars && text) break;
    text += s;
  }
  return { title: node.title, text: fmt(text, v), location: node.location };
}

function drawStory(ctx: CanvasRenderingContext2D, s: GameState | null, showName: boolean) {
  const x = 140;
  const w = SHARE_W - 280;
  const voice = makeVoice(showName && s ? s.player : { name: '林夏', gender: 'female', call: '' });
  const ex = excerptOf(s?.lastNodeId ?? 'd1n1', voice);
  tag(ctx, s ? `第 ${s.day} 天` : '第 1 天', x, 140, C.accent);
  const tf = fitText(ctx, ex.title, w, 140, 70, 44, '800', 1.3);
  let y = drawLines(ctx, tf, x, 230, C.text, '800');
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = C.soft;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`地点：${ex.location}`, x, y + 6);
  y += 70;
  ctx.fillStyle = C.accent;
  ctx.fillRect(x, y, 96, 6);
  y += 36;
  const maxH = SHARE_H - 200 - y - 150;
  const bf = fitText(ctx, ex.text, w, maxH, 44, 28, '400', 1.85);
  y = drawLines(ctx, bf, x, y, C.text);
  const tip = fitText(ctx, '*提示：七天内，找出那条假的家规。', w, 80, 32, 24, '600', 1.4);
  drawLines(ctx, tip, x, SHARE_H - 200 - 90, C.warn, '600');
}

function drawEnding(ctx: CanvasRenderingContext2D, s: GameState | null, showName: boolean) {
  const x = 140;
  const w = SHARE_W - 280;
  if (!s || !s.ending) {
    drawStory(ctx, s, showName);
    return;
  }
  const view = endingView(s);
  const good = view.tone !== 'fail';
  tag(ctx, good ? (view.tone === 'hidden' ? '隐藏结局' : '结局') : '本局结束', x, 140, good ? C.accent : C.warn);
  const tf = fitText(ctx, view.title, w, 220, 84, 48, '800', 1.25);
  let y = drawLines(ctx, tf, x, 230, C.text, '800');
  y += 14;
  if (showName) {
    ctx.font = `500 32px ${FONT}`;
    ctx.fillStyle = C.soft;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`主角：${s.player.name}`, x, y);
    y += 56;
  }
  ctx.fillStyle = C.accent;
  ctx.fillRect(x, y, 96, 6);
  y += 34;
  const cf = fitText(ctx, `“${view.closure}”`, w, 230, 46, 30, '600', 1.6);
  y = drawLines(ctx, cf, x, y, C.warn, '600');
  y += 30;

  // 统计
  const confirmed = Object.values(s.clues).filter((l) => l === 'confirmed').length;
  const stats = [
    `已度过 ${Math.min(7, s.day)} 天`,
    `健康 ${s.stats.health}　恐惧 ${s.stats.fear}　体力 ${s.stats.stamina}`,
    `日记里已证实的线索：${confirmed} 条`,
  ];
  const sf = fitText(ctx, stats.join('\n'), w, 220, 34, 26, '500', 1.7);
  y = drawLines(ctx, sf, x, y, C.text, '500');
  y += 24;

  // 只展示已经证实的家规
  const lines: string[] = [];
  for (const r of RULES) {
    const st = s.rules[r.n];
    if (st === 'true') lines.push(`第 ${r.n} 条：已证实为真`);
    else if (st === 'false') lines.push(`第 ${r.n} 条：已证实为假`);
  }
  const rulesText = lines.length ? `已证实的家规\n${lines.join('\n')}` : '已证实的家规：暂无';
  const maxH = SHARE_H - 200 - y - 40;
  const rf = fitText(ctx, rulesText, w, maxH, 32, 22, '500', 1.65);
  drawLines(ctx, rf, x, y, C.text, '500');
}

export function renderShareCanvas(opts: ShareOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas');
  frame(ctx);
  if (opts.template === 'cover') drawCover(ctx);
  else if (opts.template === 'story') drawStory(ctx, opts.state, !!opts.showName);
  else drawEnding(ctx, opts.state, !!opts.showName);
  footer(ctx);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/png');
  });
}

export function shareFileName(t: ShareTemplate): string {
  const names: Record<ShareTemplate, string> = { cover: '封面', story: '剧情卡', ending: '结局卡' };
  return `逃离幸福小区-${names[t]}.png`;
}
