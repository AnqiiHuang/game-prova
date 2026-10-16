import { describe, expect, it } from 'vitest';
import { hubView, nodeView, perform } from '../src/game/engine';
import { hiddenReady } from '../src/game/story/helpers';
import { NODES } from '../src/game/story';
import { atDay, fresh, run, toHub, tryRun } from './helpers';
import { playBot } from './bot';

describe('开局与随机', () => {
  it('同一个种子得到完全相同的角色、价格和家人好感', () => {
    const a = fresh(777);
    const b = fresh(777);
    expect(b.player).toEqual(a.player);
    expect(b.prices).toEqual(a.prices);
    expect(b.helper).toBe(a.helper);
    expect(b.npcs).toEqual(a.npcs);
    expect(JSON.stringify(fresh(778)) === JSON.stringify(a)).toBe(false);
  });

  it('初始数值落在要求的范围内', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = fresh(seed);
      expect([100, 50, -10]).toContain(s.stats.luck);
      expect(s.player.traits).toHaveLength(2);
      expect(new Set(s.player.traits).size).toBe(2);
      expect(s.stats.health).toBeGreaterThanOrEqual(75);
      expect(s.stats.health).toBeLessThanOrEqual(100);
      expect(s.stats.int).toBeGreaterThanOrEqual(60);
      expect(s.stats.int).toBeLessThanOrEqual(100);
      expect(s.stats.stamina).toBe(100);
      expect(s.stats.fear).toBe(0);
      expect(s.stats.money).toBe(20);
      expect(s.inventory).toMatchObject({ pen: 1, diary: 1, meds: 0, bento: 0, drink: 0, car: 0 });
      for (const id of ['mom', 'dad', 'bro', 'grandma', 'grandpa'] as const) {
        expect(s.npcs[id].favor).toBeGreaterThanOrEqual(30);
        expect(s.npcs[id].favor).toBeLessThanOrEqual(70);
      }
      expect(s.prices.meds).toBeGreaterThanOrEqual(10);
      expect(s.prices.meds).toBeLessThanOrEqual(18);
      expect(s.prices.bento).toBeGreaterThanOrEqual(8);
      expect(s.prices.bento).toBeLessThanOrEqual(12);
      expect(s.prices.drink).toBeGreaterThanOrEqual(6);
      expect(s.prices.drink).toBeLessThanOrEqual(10);
      expect(s.prices.car).toBeGreaterThanOrEqual(15);
      expect(s.prices.car).toBeLessThanOrEqual(25);
    }
  });

  it('五位帮助者都会被抽到，且整局固定不变', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) seen.add(fresh(seed).helper);
    expect(seen.size).toBe(5);
    const s = toHub(42);
    expect(s.helper).toBe(fresh(42).helper);
  });

  it('普通 NPC 在第一次见到时才初始化好感', () => {
    const s0 = fresh(5);
    expect(s0.npcs.zhou.known).toBe(false);
    const s1 = run(s0, { kind: 'ackRules' });
    expect(s1.npcs.zhou.known).toBe(true);
    expect(s1.npcs.zhou.favor).toBeGreaterThanOrEqual(40);
    expect(s1.npcs.zhou.favor).toBeLessThanOrEqual(60);
    expect(s1.npcs.chen.known).toBe(false);
  });

  it('读完家规后才开始计时：游戏从第 1 天 10:00 开始', () => {
    const s0 = fresh(5);
    expect(s0.mode).toBe('rules');
    expect(s0.day).toBe(1);
    expect(s0.time).toBe(600);
    expect(tryRun(s0, { kind: 'main' }).ok).toBe(false); // 没读家规不能做别的
  });
});

describe('命令序号：重复点击不会重复结算', () => {
  it('旧序号的命令会被拒绝', () => {
    const s = toHub();
    const r1 = perform(s, { kind: 'rest', minutes: 30, seq: s.seq, confirm: true });
    expect(r1.ok).toBe(true);
    const r2 = perform(s, { kind: 'rest', minutes: 30, seq: s.seq - 1, confirm: true });
    expect(r2.ok).toBe(false);
    if (r1.ok) {
      const r3 = perform(r1.state, { kind: 'rest', minutes: 30, seq: s.seq, confirm: true });
      expect(r3.ok).toBe(false);
    }
  });

  it('引擎不会修改传入的状态', () => {
    const s = toHub();
    const snapshot = JSON.stringify(s);
    run(s, { kind: 'rest', minutes: 60 });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('时间与中午约定', () => {
  it('不读取信息就不耗时：查看节点视图不改变状态', () => {
    const s = toHub();
    const before = JSON.stringify(s);
    hubView(s);
    nodeView(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('跨过 12:00 的行动会先警告，确认后可以补救；过了 13:00 才算错过', () => {
    let s = toHub(); // 10:15
    s = run(s, { kind: 'rest', minutes: 60 }); // 11:15
    const warn = tryRun(s, { kind: 'rest', minutes: 60 }, false);
    expect(warn.ok).toBe(false);
    if (!warn.ok) expect(warn.confirm).toBe(true);
    s = run(s, { kind: 'rest', minutes: 60 }); // 12:15，仍然可以补上
    expect(s.noon[1]).toBe('pending');
    const warn2 = tryRun(s, { kind: 'rest', minutes: 60 }, false);
    expect(warn2.ok).toBe(false);
    if (!warn2.ok) expect(warn2.confirm).toBe(true);
    const grandpaBefore = s.npcs.grandpa.favor;
    s = run(s, { kind: 'rest', minutes: 60 }); // 13:15，错过
    expect(s.noon[1]).toBe('missed');
    expect(s.npcs.grandpa.favor).toBeLessThan(grandpaBefore);
    expect(s.counters.missedNoon).toBe(1);
  });

  it('“等到中午并陪爷爷”会等到 12:00 并完成约定，且主线节点仍在', () => {
    let s = toHub();
    s = run(s, { kind: 'main' });
    expect(s.time).toBe(720);
    expect(s.noon[1]).toBe('done');
    expect(s.nodeId).toBe('d1n2');
    expect(s.mainIdx).toBe(1);
  });

  it('最后一天用完时间会先警告', () => {
    let s = toHub();
    s = atDay(s, 7, 23 * 60 + 30);
    s.noon[7] = 'done';
    for (const k of ['breakfast', 'lunch', 'dinner'] as const) s.meals[7][k] = { eaten: true, settled: true, by: 'home' };
    const r = tryRun(s, { kind: 'rest', minutes: 30 }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.confirm).toBe(true);
    const done = run(s, { kind: 'rest', minutes: 30 });
    expect(done.ending?.id).toBe('timeout');
    expect(done.mode).toBe('ended');
  });
});

describe('三餐', () => {
  it('第 1 天早餐已经吃过，午餐窗口之外不能吃饭', () => {
    const s = toHub();
    expect(s.meals[1].breakfast.eaten).toBe(true);
    const r = tryRun(s, { kind: 'eat', how: 'home' });
    expect(r.ok).toBe(false);
  });

  it('同一餐只能吃一次，吃了只加一次体力', () => {
    let s = toHub();
    s = run(s, { kind: 'main' }); // 12:00
    s = run(s, { kind: 'choose', choiceId: 'd1n2_c' });
    s = { ...s, stats: { ...s.stats, stamina: 50 } };
    s = run(s, { kind: 'eat', how: 'home' });
    expect(s.meals[1].lunch.eaten).toBe(true);
    expect(s.stats.stamina).toBe(60);
    expect(tryRun(s, { kind: 'eat', how: 'home' }).ok).toBe(false);
    expect(s.stats.stamina).toBe(60);
  });

  it('错过一餐只扣一次，且不能事后补吃', () => {
    let s = toHub();
    s = run(s, { kind: 'rest', minutes: 60 });
    s = run(s, { kind: 'rest', minutes: 60 });
    s = run(s, { kind: 'rest', minutes: 60 });
    s = run(s, { kind: 'rest', minutes: 60 }); // 14:15，午餐窗口已过
    expect(s.meals[1].lunch.by).toBe('missed');
    expect(s.counters.missedMeals).toBe(1);
    const h = s.stats.health;
    s = run(s, { kind: 'rest', minutes: 30 });
    expect(s.counters.missedMeals).toBe(1);
    expect(s.stats.health).toBe(h);
    expect(tryRun(s, { kind: 'eat', how: 'home' }).ok).toBe(false);
  });
});

describe('商店与道具', () => {
  it('价格固定、不够钱不能买、库存有限、金额不为负', () => {
    let s = toHub();
    s = run(s, { kind: 'shopOpen' });
    s = { ...s, stats: { ...s.stats, money: 40 } };
    const price = s.prices.bento;
    const money0 = s.stats.money;
    s = run(s, { kind: 'buy', item: 'bento' });
    expect(s.stats.money).toBe(money0 - price);
    expect(s.inventory.bento).toBe(1);
    expect(s.stock.bento).toBe(1);
    s = run(s, { kind: 'buy', item: 'bento' });
    expect(s.stock.bento).toBe(0);
    expect(tryRun(s, { kind: 'buy', item: 'bento' }).ok).toBe(false); // 售罄
    // 把钱花光
    s = { ...s, stats: { ...s.stats, money: 1 } };
    expect(tryRun(s, { kind: 'buy', item: 'meds' }).ok).toBe(false);
    expect(s.stats.money).toBe(1);
    expect(s.inventory.meds).toBe(0);
  });

  it('不在便利店不能买东西；在便利店里不能做别的', () => {
    const s = toHub();
    expect(tryRun(s, { kind: 'buy', item: 'meds' }).ok).toBe(false);
    const inShop = run(s, { kind: 'shopOpen' });
    expect(tryRun(inShop, { kind: 'rest', minutes: 30 }).ok).toBe(false);
    expect(tryRun(inShop, { kind: 'main' }).ok).toBe(false);
  });

  it('小汽车需要先留意到弟弟想要什么，才能买', () => {
    let s = toHub();
    s = run(s, { kind: 'shopOpen' });
    s = { ...s, stats: { ...s.stats, money: 50 } };
    const had = !!s.clues['c_bro_toy'];
    const r = tryRun(s, { kind: 'buy', item: 'car' });
    expect(r.ok).toBe(had);
  });

  it('药品只能在有库存时使用，使用后健康 +20 且不超过 100', () => {
    let s = toHub();
    expect(tryRun(s, { kind: 'use', item: 'meds' }).ok).toBe(false);
    s = { ...s, inventory: { ...s.inventory, meds: 1 }, stats: { ...s.stats, health: 70 } };
    s = run(s, { kind: 'use', item: 'meds' });
    expect(s.stats.health).toBe(90);
    expect(s.inventory.meds).toBe(0);
    expect(tryRun(s, { kind: 'use', item: 'meds' }).ok).toBe(false);
  });

  it('零花钱：每位家人每天只能要一次', () => {
    let s = toHub();
    s = run(s, { kind: 'ask', npc: 'mom' });
    expect(tryRun(s, { kind: 'ask', npc: 'mom' }).ok).toBe(false);
    expect(tryRun(s, { kind: 'ask', npc: 'grandma' }).ok).toBe(true);
  });
});

describe('睡觉', () => {
  it('主线没做完，或者时间太早，都不能睡觉', () => {
    const s = toHub();
    expect(tryRun(s, { kind: 'sleep' }).ok).toBe(false);
  });

  it('睡觉进入下一天的清晨，需要点击才进入，主线进度归零', () => {
    let s = toHub();
    s = atDay(s, 1, 20 * 60);
    s.mainIdx = 2;
    expect(tryRun(s, { kind: 'sleep' }).ok).toBe(false); // 还差一个主线
    s.mainIdx = 3;
    s.noon[1] = 'done';
    s = run(s, { kind: 'sleep' });
    expect(s.mode).toBe('brief');
    expect(s.day).toBe(2);
    expect(s.time).toBe(7 * 60);
    expect(s.mainIdx).toBe(0);
    expect(s.brief?.day).toBe(1);
    expect(tryRun(s, { kind: 'rest', minutes: 30 }).ok).toBe(false); // 必须先看简报
    s = run(s, { kind: 'nextDay' });
    expect(s.mode).toBe('hub');
    expect(s.noon[2]).toBe('pending');
  });

  it('睡觉前会结算没吃的饭，三餐按时才有健康奖励', () => {
    let s = atDay(toHub(), 1, 20 * 60);
    s.mainIdx = 3;
    s.noon[1] = 'done';
    s.meals[1].breakfast = { eaten: true, settled: true, by: 'home' };
    s.meals[1].lunch = { eaten: true, settled: true, by: 'home' };
    s.meals[1].dinner = { eaten: true, settled: true, by: 'home' };
    const h = s.stats.health;
    const ok = run(s, { kind: 'sleep' });
    expect(ok.counters.missedMeals).toBe(0);
    expect(ok.stats.health).toBe(Math.min(100, h + 3));
    let s2 = atDay(toHub(), 1, 20 * 60);
    s2.mainIdx = 3;
    s2.noon[1] = 'done';
    s2.meals[1].breakfast = { eaten: true, settled: true, by: 'home' };
    const bad = run(s2, { kind: 'sleep' });
    expect(bad.counters.missedMeals).toBe(2);
  });

  it('第 7 天睡觉直接结束本局（没有第 8 天）', () => {
    let s = toHub();
    s = atDay(s, 7, 20 * 60);
    s.mainIdx = 3;
    s.noon[7] = 'done';
    for (const k of ['breakfast', 'lunch', 'dinner'] as const) s.meals[7][k] = { eaten: true, settled: true, by: 'home' };
    s = run(s, { kind: 'sleep' });
    expect(s.ending?.id).toBe('timeout');
    expect(s.day).toBe(7);
  });
});

describe('条件由引擎检查，不只靠界面', () => {
  it('没有材料时，直接发送“提交材料”命令会被拒绝', () => {
    let s = toHub();
    s = { ...atDay(s, 7, 14 * 60), nodeId: 'd7n3', mode: 'node' };
    expect(tryRun(s, { kind: 'choose', choiceId: 'd7n3_a' }).ok).toBe(false);
    expect(tryRun(s, { kind: 'choose', choiceId: 'd7n3_b' }).ok).toBe(false);
    expect(tryRun(s, { kind: 'choose', choiceId: 'nope' }).ok).toBe(false);
  });

  it('材料齐了但隐藏条件不满足时，隐藏结局的选项不存在', () => {
    let s = toHub();
    s = { ...atDay(s, 7, 14 * 60), nodeId: 'd7n3', mode: 'node', docs: { form: true, proof: true, auth: true } };
    expect(hiddenReady(s)).toBe(false);
    expect(tryRun(s, { kind: 'choose', choiceId: 'd7n3_b' }).ok).toBe(false);
    const ok = run(s, { kind: 'choose', choiceId: 'd7n3_a' });
    expect(ok.ending?.id).toBe('normal');
  });

  it('隐藏结局需要：三份材料 + 帮助者谈话 + 旧账本 + 许阿姨', () => {
    let s = toHub();
    s = { ...atDay(s, 7, 14 * 60), nodeId: 'd7n3', mode: 'node', docs: { form: true, proof: true, auth: true } };
    for (const f of ['help_done', 'ledger_found', 'xu_done']) {
      const miss = { ...s, flags: { help_done: true, ledger_found: true, xu_done: true } };
      delete (miss.flags as Record<string, unknown>)[f];
      expect(hiddenReady(miss)).toBe(false);
    }
    s = { ...s, flags: { help_done: true, ledger_found: true, xu_done: true } };
    expect(run(s, { kind: 'choose', choiceId: 'd7n3_b' }).ending?.id).toBe('hidden');
  });
});

describe('支线与奖励不能刷', () => {
  it('小汽车只能送一次：消耗道具、拿到钥匙、支线不再出现', () => {
    let s = toHub();
    s = atDay(s, 2, 9 * 60);
    s.inventory.car = 1;
    s = run(s, { kind: 'side', id: 'side_car_gift' });
    s = run(s, { kind: 'choose', choiceId: 'car_a' });
    expect(s.inventory.car).toBe(0);
    expect(s.flags['key_got']).toBe(true);
    const bro = s.npcs.bro.favor;
    expect(tryRun(s, { kind: 'side', id: 'side_car_gift' }).ok).toBe(false);
    expect(s.npcs.bro.favor).toBe(bro);
  });

  it('“先收回去”不会消耗小汽车，也不会算完成', () => {
    let s = toHub();
    s = atDay(s, 2, 9 * 60);
    s.inventory.car = 1;
    s = run(s, { kind: 'side', id: 'side_car_gift' });
    s = run(s, { kind: 'choose', choiceId: 'car_c' });
    expect(s.inventory.car).toBe(1);
    expect(s.sideDone).not.toContain('side_car_gift');
  });

  it('打工赚钱的支线只能做一次', () => {
    let s = toHub();
    s = run(s, { kind: 'shopOpen' });
    s = run(s, { kind: 'shopClose' });
    s = run(s, { kind: 'side', id: 'side_chen_shelf' });
    const m0 = s.stats.money;
    s = run(s, { kind: 'choose', choiceId: 'chen_a' });
    expect(s.stats.money).toBe(m0 + 12);
    expect(tryRun(s, { kind: 'side', id: 'side_chen_shelf' }).ok).toBe(false);
  });

  it('储物间需要钥匙和线索', () => {
    const s = toHub();
    expect(tryRun(atDay(s, 3, 9 * 60), { kind: 'side', id: 'side_storage' }).ok).toBe(false);
  });

  it('短行动只能完成一次，材料不会重复发', () => {
    let s = toHub();
    s = atDay(s, 3, 9 * 60);
    s.clues['c_notice2'] = 'confirmed';
    s = run(s, { kind: 'quest', id: 'q_form' });
    expect(s.docs.form).toBe(true);
    expect(tryRun(s, { kind: 'quest', id: 'q_form' }).ok).toBe(false);
  });
});

describe('家规与线索', () => {
  it('第 1 条在两条独立证据都到手之前，不会被标成假', () => {
    for (const helper of ['mom', 'dad', 'bro', 'grandma', 'grandpa'] as const) {
      const r = playBot({ seed: 50, helper, luck: 'mid', goal: 'normal' });
      expect(r.state.rules[1]).toBe('false');
      expect(r.state.clues['c_dad_conflict']).toBeTruthy();
      expect(r.state.clues['c_dad_not_reg']).toBeTruthy();
    }
    // 只有一条证据时
    const s = toHub();
    expect(s.rules[1] ?? 'unknown').not.toBe('false');
  });

  it('游戏开始时没有任何家规答案', () => {
    const s = fresh(9);
    expect(Object.values(s.rules).filter((v) => v === 'false' || v === 'true')).toHaveLength(0);
  });
});

describe('小意外', () => {
  it('每个节点最多发生一次，且不会丢任务物品', () => {
    for (const luck of ['low', 'mid', 'high'] as const) {
      const r = playBot({ seed: 900, helper: 'dad', luck, goal: 'hidden' });
      expect(new Set(r.state.mishaps).size).toBe(r.state.mishaps.length);
      expect(r.state.inventory.pen).toBe(1);
      expect(r.state.inventory.diary).toBe(1);
    }
  });

  it('幸运 100 时不会出现小意外', () => {
    const s = toHub(3, { luckTier: 'high' });
    expect(s.stats.luck).toBe(100);
    expect(s.notices.some((n) => n.includes('运气不太好'))).toBe(false);
  });
});

describe('剧情数据', () => {
  it('所有节点的选项都指向存在的节点或结局', () => {
    for (const n of Object.values(NODES)) {
      for (const c of n.choices) {
        if (c.next) expect(NODES[c.next], `${n.id}/${c.id}`).toBeTruthy();
      }
    }
  });
});
