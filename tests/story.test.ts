import { describe, expect, it } from 'vitest';
import { lintStory } from '../scripts/story-lint';
import { ALL_NODES, MAIN_SLOTS } from '../src/game/story';
import { RULES } from '../src/game/story/data';
import { playBot } from './bot';

describe('剧情体检', () => {
  const r = lintStory();

  it('没有断链、重复 id、禁用词，每个主线/支线节点正文不少于 800 个汉字', () => {
    expect(r.errors).toEqual([]);
    expect(r.report.length).toBeGreaterThanOrEqual(30);
    for (const n of r.report) expect(n.cjk).toBeGreaterThanOrEqual(800);
  });

  it('七天 × 每天 3 个主线节点', () => {
    for (let d = 1; d <= 7; d++) expect(MAIN_SLOTS[d]).toHaveLength(3);
    expect(MAIN_SLOTS[8]).toBeUndefined();
  });

  it('每个主线节点 2–4 个选项', () => {
    for (const n of ALL_NODES.filter((x) => x.kind !== 'mini')) {
      expect(n.choices.length).toBeGreaterThanOrEqual(2);
      expect(n.choices.length).toBeLessThanOrEqual(4);
    }
  });

  it('家规原文完整，且代码里的玩家可见文本不含真假答案', () => {
    expect(RULES).toHaveLength(5);
    expect(RULES[0].text).toBe('一定要听家里人的话！尤其是爸爸的。');
    for (const rule of RULES) expect(rule.text).not.toMatch(/假的|是真的|答案/);
  });
});

describe('第一条假规则不会在证实之前泄露', () => {
  it('玩家可以看到的节点正文里，不会提前写明“第一条是假的”', () => {
    for (const n of ALL_NODES) {
      const text = n.paragraphs.join('') + (n.variants ?? []).map((v) => v.paragraphs.join('')).join('');
      expect(text, n.id).not.toMatch(/第一条[^。]{0,6}是假|听爸爸的话[^。]{0,6}是假/);
    }
  });

  it('机器人通关全程：第 1 条家规只会在两条独立证据都有之后变成“假”', () => {
    const r = playBot({ seed: 77, helper: 'bro', luck: 'high', goal: 'hidden' });
    expect(r.state.rules[1]).toBe('false');
  });
});
