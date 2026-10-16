import { useEffect, useRef } from 'react';
import { hubView, nodeView, SLOT_NAME, askBlock, buyBlock, type ActionView } from '../game/engine';
import { ITEMS, NPCS, RULES, RULE_NOTE, SHOP_ORDER } from '../game/story/data';
import { fmtTime } from '../game/text';
import { FAMILY_IDS, LUCK_LABEL, type GameState, type MealSlot, type NpcId } from '../game/types';
import { useGame } from './ctx';

// ---------- 小部件 ----------

function Bar({ label, value, kind }: { label: string; value: number; kind: 'good' | 'warn' | 'plain' }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <i className={kind} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function TopBar({ s }: { s: GameState }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="chip strong">第 {s.day} 天 / 7</div>
        <div className="chip">{fmtTime(s.time)}</div>
        <div className="chip loc" title={s.location}>
          {s.location}
        </div>
      </div>
    </header>
  );
}

export function StatArea({ s }: { s: GameState }) {
  return (
    <section className="statarea" aria-label="状态">
      <div className="stat-grid">
        <Bar label="体力" value={s.stats.stamina} kind="good" />
        <Bar label="健康" value={s.stats.health} kind="good" />
        <Bar label="恐惧" value={s.stats.fear} kind="warn" />
      </div>
      <div className="stat-line">
        <span>智力 {s.stats.int}</span>
        <span>幸运 {s.stats.luck}</span>
        <span>零花钱 {s.stats.money} 元</span>
      </div>
    </section>
  );
}

export function Changes({ s }: { s: GameState }) {
  if (!s.deltas.length && !s.notices.length) return null;
  return (
    <section className="changes" aria-live="polite" aria-label="刚刚发生的变化">
      {s.deltas.length ? (
        <ul className="delta-list">
          {s.deltas.map((d, i) => (
            <li key={i} className={d.delta > 0 ? (d.label === '恐惧' ? 'bad' : 'up') : d.label === '恐惧' ? 'up' : 'bad'}>
              <b>
                {d.label} {d.delta > 0 ? '+' : '−'}
                {Math.abs(d.delta)}
              </b>
              <span>{d.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {s.notices.map((n, i) => (
        <p className="prompt" key={i}>
          {n}
        </p>
      ))}
    </section>
  );
}

function FavorChips({ ids, s }: { ids: NpcId[]; s: GameState }) {
  const list = ids.filter((id) => s.npcs[id].known);
  if (!list.length) return null;
  return (
    <div className="present" aria-label="在场的人">
      <span className="label">在场</span>
      {list.map((id) => (
        <span className="npc-chip" key={id}>
          {NPCS[id].name}
          <em>好感 {s.npcs[id].favor}</em>
        </span>
      ))}
    </div>
  );
}

function Paragraphs({ list }: { list: string[] }) {
  return (
    <div className="story">
      {list.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function ResultBox({ s }: { s: GameState }) {
  if (!s.lastResult) return null;
  return (
    <section className="result-box" aria-live="polite">
      <p>{s.lastResult}</p>
    </section>
  );
}

function costText(minutes: number, stamina: number) {
  const parts: string[] = [];
  parts.push(minutes > 0 ? `用时 ${minutes} 分钟` : '不耗时');
  if (stamina > 0) parts.push(`体力 −${stamina}`);
  return parts.join(' · ');
}

// ---------- 家规确认页 ----------

export function RulesScreen() {
  const { state: s, act } = useGame();
  return (
    <main className="page" id="main">
      <div className="paper">
        <p className="eyebrow">第 1 天 · 10:00 · 小区大门</p>
        <h1 className="title small">家规</h1>
        <p className="hint">进门前，你在手机里收到了家里发来的一张纸。请先读完。</p>
        <ol className="rules-list">
          {RULES.map((r) => (
            <li key={r.n}>{r.text}</li>
          ))}
        </ol>
        <p className="rule-note">{RULE_NOTE}</p>

        <div className="card">
          <h2>你的角色</h2>
          <p>
            {s.player.name}　特质：{s.player.traits.join('、')}　幸运：{s.stats.luck}（{LUCK_LABEL[s.player.luckTier]}）
          </p>
          <p className="hint">
            体力 {s.stats.stamina}　健康 {s.stats.health}　智力 {s.stats.int}　恐惧 {s.stats.fear}　零花钱 {s.stats.money} 元。
            背包里有一支笔和一本日记本。这些结果已经保存，刷新页面不会改变。
          </p>
        </div>

        <button type="button" className="btn primary big" onClick={() => act({ kind: 'ackRules' })}>
          我读完了，走进小区
        </button>
      </div>
    </main>
  );
}

// ---------- 剧情节点 ----------

function kindLabel(k: 'main' | 'side' | 'mini') {
  return k === 'main' ? '主线' : k === 'side' ? '支线' : '小插曲';
}

function NodeScreenBody() {
  const { state: s, act } = useGame();
  const v = nodeView(s);
  if (!v) return null;
  return (
    <>
      <article className="paper reading" aria-labelledby="node-title">
        <p className="eyebrow">
          <span className={`kind ${v.kind}`}>{kindLabel(v.kind)}</span>
        </p>
        <h1 id="node-title" className="title small">
          {v.title}
        </h1>
        <FavorChips ids={v.present} s={s} />
        <Paragraphs list={v.paragraphs} />
      </article>

      <section className="options" aria-label="选项">
        {v.choices.map((c) => (
          <div className="opt" key={c.id}>
            <button
              type="button"
              className={`choice ${c.disabled ? 'locked' : ''}`}
              disabled={!!c.disabled}
              onClick={() => act({ kind: 'choose', choiceId: c.id })}
            >
              <span className="choice-top">
                {c.tag ? <span className="tag">{c.tag}</span> : null}
                <span className="choice-label">{c.label}</span>
              </span>
              <span className="cost">{costText(c.minutes, c.stamina)}</span>
            </button>
            {c.disabled ? <p className="lock">{c.disabled}</p> : null}
            {c.risk ? <p className="risk">风险：{c.risk}</p> : null}
            {c.warn ? <p className="warn-line">*提示：{c.warn}</p> : null}
            {c.hint ? <p className="hint-line">*提示：{c.hint}</p> : null}
          </div>
        ))}
      </section>
    </>
  );
}

// ---------- 日程页 ----------

function ActionBtn({ a, kind }: { a: ActionView; kind?: 'main' | 'plain' }) {
  const { act } = useGame();
  return (
    <div className="opt">
      <button
        type="button"
        className={`choice ${kind === 'main' ? 'main' : ''} ${a.disabled ? 'locked' : ''}`}
        disabled={!!a.disabled}
        onClick={() => act(a.cmd)}
      >
        <span className="choice-top">
          <span className="choice-label">{a.label}</span>
        </span>
        {a.sub ? <span className="cost">{a.sub}</span> : null}
      </button>
      {a.disabled ? <p className="lock">{a.disabled}</p> : null}
      {a.warn ? <p className="warn-line">*提示：{a.warn}</p> : null}
    </div>
  );
}

function MealStatus({ s }: { s: GameState }) {
  const m = s.meals[s.day];
  const mark = (slot: MealSlot) => (m[slot].by === 'missed' ? '错过' : m[slot].eaten ? '已吃' : '未吃');
  const noon = s.noon[s.day];
  return (
    <div className="daystatus">
      <span>
        三餐：早餐 {mark('breakfast')} · 午餐 {mark('lunch')} · 晚餐 {mark('dinner')}
      </span>
      <span>中午：{noon === 'done' ? '已陪爷爷' : noon === 'missed' ? '已错过' : '还没到时间'}</span>
    </div>
  );
}

function HubBody() {
  const { state: s, act, openPanel } = useGame();
  const v = hubView(s);
  const slotName = v.currentSlot ? SLOT_NAME[v.currentSlot] : null;
  return (
    <>
      <article className="paper">
        <p className="eyebrow">日程</p>
        <h1 className="title small">第 {s.day} 天的安排</h1>
        <p className="hint">主线完成三件事后才能睡觉。其余行动都是可选的，但每一个都会用掉时间。</p>
        <MealStatus s={s} />
        {slotName ? <p className="prompt">*提示：现在是{slotName}时间。</p> : null}
      </article>

      <section className="group" aria-labelledby="g-main">
        <h2 id="g-main">
          主线 <small>{Math.min(s.mainIdx, v.mainTotal)} / {v.mainTotal}</small>
        </h2>
        <ActionBtn a={v.main} kind="main" />
      </section>

      {v.sides.length ? (
        <section className="group" aria-labelledby="g-side">
          <h2 id="g-side">
            支线 <small>可选</small>
          </h2>
          {v.sides.map((a) => (
            <ActionBtn key={a.id} a={a} />
          ))}
        </section>
      ) : null}

      {v.quests.length ? (
        <section className="group" aria-labelledby="g-quest">
          <h2 id="g-quest">
            短行动 <small>可选</small>
          </h2>
          {v.quests.map((a) => (
            <ActionBtn key={a.id} a={a} />
          ))}
        </section>
      ) : null}

      <section className="group" aria-labelledby="g-daily">
        <h2 id="g-daily">日常</h2>
        {v.daily.map((a) => (
          <ActionBtn key={a.id} a={a} />
        ))}
        <div className="opt">
          <p className="label">向家人要零花钱（每人每天一次，用时 5 分钟）</p>
          <div className="ask-grid">
            {FAMILY_IDS.map((id) => {
              const block = askBlock(s, id);
              return (
                <button
                  key={id}
                  type="button"
                  className="btn small"
                  disabled={!!block}
                  title={block ?? undefined}
                  onClick={() => act({ kind: 'ask', npc: id })}
                >
                  {NPCS[id].name}
                  {block ? '（已问）' : ''}
                </button>
              );
            })}
          </div>
        </div>
        <div className="opt">
          <button type="button" className="btn" onClick={() => openPanel('bag')}>
            打开背包（使用药品或饮料）
          </button>
        </div>
      </section>

      <section className="group" aria-labelledby="g-sleep">
        <h2 id="g-sleep">睡觉</h2>
        <ActionBtn a={v.sleep} />
      </section>
    </>
  );
}

// ---------- 便利店 ----------

function ShopBody() {
  const { state: s, act } = useGame();
  return (
    <>
      <article className="paper">
        <p className="eyebrow">小区便利店</p>
        <h1 className="title small">货架</h1>
        <p className="hint">店里的价格在这一局里是固定的。零花钱：{s.stats.money} 元。在店里买东西不再额外耗时。</p>
        <FavorChips ids={['chen']} s={s} />
      </article>
      <section className="group">
        {SHOP_ORDER.map((id) => {
          const block = buyBlock(s, id);
          return (
            <div className="shop-row card" key={id}>
              <div>
                <b>{ITEMS[id].name}</b>
                <p className="hint">{ITEMS[id].desc}</p>
                <p className="hint">
                  价格 {s.prices[id]} 元 · 库存 {s.stock[id]} · 背包 {s.inventory[id]}
                </p>
                {block ? <p className="lock">{block}</p> : null}
              </div>
              <button type="button" className="btn primary" disabled={!!block} onClick={() => act({ kind: 'buy', item: id })}>
                买
              </button>
            </div>
          );
        })}
        <div className="opt">
          <button type="button" className="btn big" onClick={() => act({ kind: 'shopClose' })}>
            离开便利店
          </button>
        </div>
      </section>
    </>
  );
}

// ---------- 睡觉简报 ----------

function BriefBody() {
  const { state: s, act } = useGame();
  const b = s.brief;
  if (!b) return null;
  return (
    <>
      <article className="paper">
        <p className="eyebrow">已睡觉并存档</p>
        <h1 className="title small">第 {b.day} 天结束</h1>
        <ul className="brief">
          {b.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <p className="prompt">*提示：进度已经保存。点击下面的按钮，进入第 {s.day} 天。</p>
        <button type="button" className="btn primary big" onClick={() => act({ kind: 'nextDay' })}>
          进入第 {s.day} 天
        </button>
      </article>
    </>
  );
}

// ---------- 总装 ----------

export function GameScreen() {
  const { state: s, openPanel } = useGame();
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [s.seq, s.mode]);

  let body;
  if (s.mode === 'brief') body = <BriefBody />;
  else if (s.mode === 'node') body = <NodeScreenBody />;
  else if (s.shopOpen) body = <ShopBody />;
  else body = <HubBody />;

  return (
    <div className="game" ref={topRef}>
      <TopBar s={s} />
      <main className="page with-bar" id="main">
        <StatArea s={s} />
        <Changes s={s} />
        <ResultBox s={s} />
        {body}
      </main>
      <nav className="bottombar" aria-label="常用入口">
        <button type="button" onClick={() => openPanel('rules')}>
          规则
        </button>
        <button type="button" onClick={() => openPanel('bag')}>
          背包
        </button>
        <button type="button" onClick={() => openPanel('relations')}>
          关系
        </button>
        <button type="button" onClick={() => openPanel('diary')}>
          日记
        </button>
        <button type="button" onClick={() => openPanel('save')}>
          存档
        </button>
      </nav>
    </div>
  );
}
