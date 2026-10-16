// 测试用“通关机器人”：用引擎公开的视图自动玩完一局。
import { hubView, newGame, nodeView, perform } from '../src/game/engine';
import type { CommandInput, FamilyId, GameState, LuckTier, Command } from '../src/game/types';

export type Goal = 'hidden' | 'normal';

export interface BotResult {
  state: GameState;
  steps: number;
  log: string[];
}

function score(s: GameState, goal: Goal): number {
  let v = 0;
  if (s.ending) {
    if (s.ending.id === 'hidden') v += 100000;
    else if (s.ending.id === 'normal') v += goal === 'hidden' ? 20000 : 100000;
    else v -= 50000;
  }
  v += (Number(s.docs.form) + Number(s.docs.proof) + Number(s.docs.auth)) * 1000;
  v += Object.values(s.clues).filter((c) => c === 'confirmed').length * 3;
  v += Object.keys(s.clues).length;
  if (goal === 'hidden') {
    for (const k of ['help_done', 'ledger_found', 'xu_done', 'key_got']) if (s.flags[k]) v += 200;
  }
  if (s.flags['dadConfessed']) v += 20;
  v -= s.stats.fear * 0.5;
  v += s.stats.health * 0.1;
  v += s.stats.stamina * 0.05;
  return v;
}

function send(s: GameState, cmd: Command): { ok: boolean; state: GameState; reason?: string } {
  const input = { ...cmd, seq: s.seq, confirm: true } as CommandInput;
  const r = perform(s, input);
  if (r.ok) return { ok: true, state: r.state };
  return { ok: false, state: s, reason: r.reason };
}

/** 动作会不会让“中午约定”或“饭”出问题。 */
function harmless(before: GameState, after: GameState): boolean {
  if (after.ending && after.ending.id !== 'normal' && after.ending.id !== 'hidden') return false;
  if (after.day !== before.day) return true;
  if (before.noon[before.day] === 'pending' && after.noon[after.day] === 'missed') return false;
  if (after.counters.missedMeals > before.counters.missedMeals) return false;
  return true;
}

export interface BotOptions {
  seed: number;
  helper: FamilyId;
  luck: LuckTier;
  goal: Goal;
  maxSteps?: number;
}

export function playBot(o: BotOptions): BotResult {
  let s = newGame({
    name: '林夏',
    gender: 'female',
    call: '',
    seed: o.seed,
    runId: `bot-${o.seed}`,
    force: { helper: o.helper, luckTier: o.luck },
  });
  const log: string[] = [];
  let steps = 0;
  const max = o.maxSteps ?? 600;
  let carGifted = false;

  const apply = (cmd: Command, why: string): boolean => {
    const r = send(s, cmd);
    if (!r.ok) {
      log.push(`✗ ${why}: ${r.reason}`);
      return false;
    }
    s = r.state;
    log.push(`D${s.day} ${String(Math.floor(s.time / 60)).padStart(2, '0')}:${String(s.time % 60).padStart(2, '0')} ${why}`);
    return true;
  };

  while (steps++ < max && s.mode !== 'ended') {
    if (s.mode === 'rules') {
      apply({ kind: 'ackRules' }, '确认家规');
      continue;
    }
    if (s.mode === 'brief') {
      apply({ kind: 'nextDay' }, '进入新的一天');
      continue;
    }
    if (s.mode === 'node') {
      const nv = nodeView(s)!;
      let best: { id: string; v: number } | null = null;
      for (const c of nv.choices) {
        if (c.disabled) continue;
        const r = send(s, { kind: 'choose', choiceId: c.id });
        if (!r.ok) continue;
        const repeatPenalty = c.id.endsWith('_c') && s.nodeId === 'd7n3' ? -5000 : 0;
        const v = score(r.state, o.goal) + repeatPenalty;
        if (!best || v > best.v) best = { id: c.id, v };
      }
      if (!best) {
        log.push(`✗ 节点 ${s.nodeId} 没有可选的选项`);
        break;
      }
      apply({ kind: 'choose', choiceId: best.id }, `${s.nodeId} → ${best.id}`);
      continue;
    }

    // —— 日程页 ——
    const hv = hubView(s);

    if (s.shopOpen) {
      const owned = s.inventory.car > 0 || carGifted;
      if (!owned && o.goal === 'hidden' && send(s, { kind: 'buy', item: 'car' }).ok) {
        apply({ kind: 'buy', item: 'car' }, '买小汽车');
        continue;
      }
      if (s.inventory.bento < 1 && s.stats.money >= s.prices.bento + 5 && s.stock.bento > 0 && carGifted) {
        apply({ kind: 'buy', item: 'bento' }, '买便当');
        continue;
      }
      apply({ kind: 'shopClose' }, '离开便利店');
      continue;
    }

    if (s.stats.health < 45 && s.inventory.meds > 0) {
      apply({ kind: 'use', item: 'meds' }, '用药');
      continue;
    }
    if (s.stats.stamina < 25 && s.inventory.drink > 0) {
      apply({ kind: 'use', item: 'drink' }, '喝饮料');
      continue;
    }

    // 还在小区门口：先回家
    const goHome = hv.daily.find((a) => a.id === 'go_home');
    if (goHome && !goHome.disabled) {
      apply(goHome.cmd, '回家');
      continue;
    }

    // 吃饭优先
    const eat = hv.daily.find((a) => a.id === 'eat_home');
    if (eat && !eat.disabled) {
      apply(eat.cmd, '吃饭');
      continue;
    }

    // 体力低就休息
    if (s.stats.stamina < 22) {
      const rest = hv.daily.find((a) => a.id === 'rest60');
      if (rest && !rest.disabled) {
        apply(rest.cmd, '歇一个小时');
        continue;
      }
    }

    // 钱不够买小汽车时，向家人要零花钱
    if (
      o.goal === 'hidden' &&
      !carGifted &&
      s.inventory.car === 0 &&
      s.clues['c_bro_toy'] &&
      s.stats.money < s.prices.car
    ) {
      let asked = false;
      for (const npc of ['mom', 'grandma', 'grandpa', 'dad', 'bro'] as FamilyId[]) {
        const r = send(s, { kind: 'ask', npc });
        if (r.ok && r.state.noon[r.state.day] === s.noon[s.day]) {
          apply({ kind: 'ask', npc }, `向 ${npc} 要零花钱`);
          asked = true;
          break;
        }
      }
      if (asked) continue;
    }

    // 买小汽车
    if (
      o.goal === 'hidden' &&
      !carGifted &&
      s.inventory.car === 0 &&
      s.clues['c_bro_toy'] &&
      s.stats.money >= s.prices.car
    ) {
      const shop = hv.daily.find((a) => a.id === 'shop');
      if (shop && !shop.disabled) {
        const r = send(s, shop.cmd);
        if (r.ok && harmless(s, r.state)) {
          apply(shop.cmd, '去便利店');
          continue;
        }
      }
    }

    // 支线与短行动：只在不影响中午约定与吃饭时做
    if (o.goal === 'hidden') {
      let did = false;
      for (const a of [...hv.sides, ...hv.quests]) {
        if (a.disabled) continue;
        const r = send(s, a.cmd);
        if (!r.ok || !harmless(s, r.state)) continue;
        apply(a.cmd, `支线/行动 ${a.id}`);
        if (a.id === 'side_car_gift') carGifted = true;
        did = true;
        break;
      }
      if (did) continue;
    } else {
      let did = false;
      for (const a of hv.quests) {
        if (a.disabled) continue;
        const r = send(s, a.cmd);
        if (!r.ok || !harmless(s, r.state)) continue;
        apply(a.cmd, `行动 ${a.id}`);
        did = true;
        break;
      }
      if (did) continue;
    }

    if (!hv.main.disabled) {
      apply(hv.main.cmd, `主线：${hv.main.label}`);
      continue;
    }
    if (!hv.sleep.disabled) {
      apply(hv.sleep.cmd, '睡觉并存档');
      continue;
    }
    const rest = hv.daily.find((a) => a.id === 'rest60') ?? hv.daily.find((a) => a.id === 'rest30');
    if (rest && !rest.disabled) {
      apply(rest.cmd, '休息等待');
      continue;
    }
    log.push('✗ 没有可做的事');
    break;
  }
  return { state: s, steps, log };
}
