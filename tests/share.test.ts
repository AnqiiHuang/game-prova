import { describe, expect, it } from 'vitest';
import { excerptOf, wrapLines, FOOTER } from '../src/utils/shareImage';
import { makeVoice } from '../src/game/text';

// 用等宽的假画布测量文字：每个字 10 像素
const fakeCtx = { measureText: (t: string) => ({ width: Array.from(t).length * 10 }) } as unknown as CanvasRenderingContext2D;

describe('分享图的文字排版', () => {
  it('长文本被完整换行，不丢字、不超宽', () => {
    const text = '这是一段很长的中文，需要在分享图里自动换行，并且不能丢掉任何一个字。标点符号不应该出现在行首！';
    const lines = wrapLines(fakeCtx, text, 100);
    expect(lines.join('')).toBe(text);
    for (const ln of lines) expect(Array.from(ln).length).toBeLessThanOrEqual(11); // 最多允许标点挂在行尾
    for (const ln of lines.slice(1)) expect('，。！？、；：'.includes(Array.from(ln)[0])).toBe(false);
  });

  it('保留手动换行', () => {
    expect(wrapLines(fakeCtx, '甲\n乙', 100)).toEqual(['甲', '乙']);
  });

  it('剧情卡摘录只取完整的句子，不会拦腰截断', () => {
    const ex = excerptOf('d1n1', makeVoice({ name: '林夏', gender: 'female', call: '' }));
    expect(ex.text.length).toBeGreaterThan(40);
    expect(/[。！？”]$/.test(ex.text)).toBe(true);
  });

  it('默认不会把自定义名字写进摘录', () => {
    const ex = excerptOf('side_bro_garage', makeVoice({ name: '林夏', gender: 'female', call: '' }));
    expect(ex.text).not.toContain('{');
  });

  it('页脚文案固定', () => {
    expect(FOOTER).toBe('虚构互动故事｜AI辅助创作');
  });
});
