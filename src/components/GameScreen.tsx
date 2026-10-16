import { useEffect, useRef, useState, type ReactNode } from 'react';
import { hubView, nodeView, SLOT_NAME, askBlock, askHow, buyBlock, type ActionView } from '../game/engine';
import { ITEMS, NPCS, RULES, RULE_NOTE, SHOP_ORDER } from '../game/story/data';
import { fmtTime } from '../game/text';
import { FAMILY_IDS, LUCK_LABEL, type GameState, type MealSlot, type NpcId } from '../game/types';
import { Modal } from './Modal';
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

/** 刚刚发生的变化。只对“上一个行动”有效，下一个行动开始时会整体清掉；也可以手动收起。 */
export function Feedback({ s }: { s: GameState }) {
  const [hiddenAt, setHiddenAt] = useState(-1);
  // 日记类提示收成一行：重要的内容在日记里查看，不挂在正文上方
  const isDiary = (n: string) => /日记新增|日记里多了|你认识了/.test(n);
  const diaryNotes = s.notices.filter(isDiary);
  const otherNotes = s.notices.filter((n) => !isDiary(n));
  const has = s.deltas.length > 0 || s.notices.length > 0 || !!s.lastResult;
  if (!has || hiddenAt === s.counters.steps) return null;
  return (
    <section className="changes" aria-live="polite" aria-label="刚刚发生的变化">
      {s.lastResult ? (
        <div className="result-box">
          {s.lastResult.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
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
      {otherNotes.map((n, i) => (
        <p className="prompt" key={i}>
          {n}
        </p>
      ))}
      {diaryNotes.length ? (
        <p className="prompt diary-note">日记更新了 {diaryNotes.length} 条记录，在“日记”里查看。</p>
      ) : null}
      <div className="changes-foot">
        <span className="hint">重要的发现都记在日记里。</span>
        <button type="button" className="btn ghost small" onClick={() => setHiddenAt(s.counters.steps)}>
          收起
        </button>
      </div>
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
        {v.details.length ? (
          <details className="more">
            <summary>展开细节</summary>
            <Paragraphs list={v.details} />
          </details>
        ) : null}
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

/** 等待到睡觉时间之前，晚餐还没吃：先问清楚。选项只是界面步骤，选定后才会执行一次命令。 */
function DinnerAsk({ onClose }: { onClose: () => void }) {
  const { state: s, act } = useGame();
  const [step, setStep] = useState<'ask' | 'gate'>('ask');
  const home = s.place === 'home';
  const run = (dinner: 'home' | 'bento' | 'skip') => {
    onClose();
    act({ kind: 'waitSleep', dinner });
  };
  if (step === 'gate') {
    return (
      <Modal
        title="先吃晚餐"
        onClose={onClose}
        footer={
          <div className="stack">
            <button type="button" className="btn primary" onClick={() => { onClose(); act({ kind: 'go', to: 'home' }); }}>
              先回家（约 10 分钟）
            </button>
            {s.inventory.bento > 0 ? (
              <button type="button" className="btn" onClick={() => run('bento')}>
                吃背包里的便当（现有 {s.inventory.bento} 份）
              </button>
            ) : null}
            <button type="button" className="btn ghost" onClick={() => setStep('ask')}>
              返回
            </button>
          </div>
        }
      >
        <p className="prompt">*提示：你还在小区门口，家里的饭要回家才能吃。可以先回家，回去之后再选择等待。</p>
      </Modal>
    );
  }
  return (
    <Modal
      title="晚餐"
      onClose={onClose}
      footer={
        <div className="stack">
          <button type="button" className="btn primary" onClick={() => (home ? run('home') : setStep('gate'))}>
            先吃晚餐
          </button>
          <button type="button" className="btn" onClick={() => run('skip')}>
            直接等待
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            取消
          </button>
        </div>
      }
    >
      <p className="prompt">你还没吃晚餐，要先吃饭再休息吗？</p>
      <p className="hint">晚餐 17:00 开饭、21:00 结束。“直接等待”只会等到 19:00，晚餐仍然算没吃。</p>
    </Modal>
  );
}

function ActionBtn({ a, kind }: { a: ActionView; kind?: 'main' | 'plain' }) {
  const { act } = useGame();
  const [ask, setAsk] = useState(false);
  return (
    <div className="opt">
      {ask ? <DinnerAsk onClose={() => setAsk(false)} /> : null}
      <button
        type="button"
        className={`choice ${kind === 'main' ? 'main' : ''} ${a.disabled ? 'locked' : ''}`}
        disabled={!!a.disabled}
        onClick={() => (a.needDinner ? setAsk(true) : act(a.cmd))}
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

/** 展开/收起只是界面状态：不是游戏命令，不消耗时间，不改变任何属性。每走一步自动收起。 */
function Fold({ title, hint, count, children }: { title: string; hint?: string; count?: number; children: ReactNode }) {
  const { state: s } = useGame();
  return (
    <details className="fold" key={s.counters.steps}>
      <summary>
        <span className="fold-title">{title}</span>
        {count !== undefined ? <span className="fold-count">{count}</span> : null}
        {hint ? <span className="fold-hint">{hint}</span> : null}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

function HubBody() {
  const { state: s, act, openPanel } = useGame();
  const v = hubView(s);
  const isMain = (a: ActionView) => a.id === 'main' || a.id === 'go_home';
  return (
    <>
      <article className="paper">
        <p className="eyebrow">日程</p>
        <h1 className="title small">第 {s.day} 天的安排</h1>
        {v.alerts.map((a, i) => (
          <p className="alert" key={i} role="status">
            {a}
          </p>
        ))}
        <p className="reminder">{v.reminder}</p>
        <MealStatus s={s} />
      </article>

      <section className="group" aria-labelledby="g-now">
        <h2 id="g-now">
          现在可以做 <small>主线 {Math.min(s.mainIdx, v.mainTotal)} / {v.mainTotal}</small>
        </h2>
        {v.primary.map((a) => (
          <ActionBtn key={a.id} a={a} kind={isMain(a) ? 'main' : 'plain'} />
        ))}
      </section>

      {v.more.length ? (
        <Fold title="更多探索" count={v.more.length} hint={s.place === 'gate' ? '在门口还能做的事' : '其他调查与对话'}>
          {v.more.map((a) => (
            <ActionBtn key={a.id} a={a} />
          ))}
        </Fold>
      ) : null}

      <Fold title="日常行动" hint="吃饭、休息、购物、要零花钱">
        {v.routine.map((a) => (
          <ActionBtn key={a.id} a={a} />
        ))}
        <div className="opt">
          <p className="label">
            向家人要零花钱（每人每天一次，用时 5 分钟）
            {s.place === 'gate' ? '。你不在家，只能给爸爸妈妈发消息。' : ''}
          </p>
          <div className="ask-grid">
            {FAMILY_IDS.map((id) => {
              const block = askBlock(s, id);
              const how = askHow(s, id);
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
                  {block ? (s.asked[`${s.day}:${id}`] ? '（已问）' : '（不在）') : how === 'message' ? '（发消息）' : ''}
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
      </Fold>
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
  // 标记家规这类“不耗时”的操作不会回到页面顶部；真正的行动（steps 增加）才会
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [s.counters.steps, s.mode]);

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
        <Feedback s={s} />
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
          设置
        </button>
      </nav>
    </div>
  );
}
