import { endingView, lockedNote } from '../game/story/endings';
import { RULES } from '../game/story/data';
import { LUCK_LABEL } from '../game/types';
import { Changes, StatArea, TopBar } from './GameScreen';
import { useGame } from './ctx';

export function EndingScreen() {
  const { state: s, session, openPanel, restart, goHome } = useGame();
  const view = endingView(s);
  const failRestorable = session.canRestore();
  const failCount = session.meta?.failCount ?? 0;
  const isFail = view.tone === 'fail';
  const confirmed = Object.values(s.clues).filter((l) => l === 'confirmed').length;
  const note = s.ending ? lockedNote(s.ending.id) : null;

  return (
    <div className="game">
      <TopBar s={s} />
      <main className="page" id="main">
        <StatArea s={s} />
        <Changes s={s} />
        <article className="paper reading ending" aria-labelledby="end-title">
          <p className="eyebrow">{view.tone === 'hidden' ? '隐藏结局' : view.tone === 'good' ? '结局' : failRestorable ? '这次失败了' : '本局结束'}</p>
          <h1 id="end-title" className="title small">
            {view.title}
          </h1>
          <div className="story">
            {view.paragraphs.map((p, i) => (
              <p key={i} className={p.startsWith('提示：') ? 'prompt' : undefined}>
                {p.startsWith('提示：') ? `*${p}` : p}
              </p>
            ))}
          </div>
          <p className="closure">“{view.closure}”</p>
        </article>

        <section className="card" aria-label="本局小结">
          <h2>本局小结</h2>
          <ul className="plain-list">
            <li>主角：{s.player.name}（{s.player.traits.join('、')}；幸运 {s.stats.luck}，{LUCK_LABEL[s.player.luckTier]}）</li>
            <li>
              走到了第 {Math.min(7, s.day)} 天，健康 {s.stats.health}，恐惧 {s.stats.fear}，体力 {s.stats.stamina}，零花钱 {s.stats.money} 元
            </li>
            <li>日记里已证实的线索：{confirmed} 条</li>
            <li>本局失败次数：{failCount}</li>
          </ul>
          <h3>已证实的家规</h3>
          <ul className="plain-list">
            {RULES.map((r) => (
              <li key={r.n}>
                第 {r.n} 条：
                {s.rules[r.n] === 'true' ? '已证实为真' : s.rules[r.n] === 'false' ? '已证实为假' : '没有证实'}
              </li>
            ))}
          </ul>
          {note ? <p className="hint">{note}</p> : null}
        </section>

        {isFail && failRestorable ? (
          <section className="card" aria-label="读档">
            <h2>读取存档</h2>
            <p>
              本局已失败 {failCount} 次。还可以读档 {session.failuresLeft()} 次；再失败 {session.failuresLeft() + 1} 次，本局就会结束。
            </p>
            <RestoreButton />
          </section>
        ) : null}

        <div className="stack">
          <button type="button" className="btn big" onClick={() => openPanel('share')}>
            生成分享图
          </button>
          <button type="button" className="btn big" onClick={goHome}>
            回到首页
          </button>
          <button type="button" className="btn big primary" onClick={restart}>
            重新开始
          </button>
        </div>
      </main>
    </div>
  );
}

function RestoreButton() {
  const { session, restore } = useGame();
  const hasSleep = session.sleepSaveDay() !== null;
  return (
    <>
      <button type="button" className="btn primary big" onClick={restore}>
        {hasSleep ? '读取最近一次睡觉存档' : '回到开局重新来'}
      </button>
      <p className="hint">失败次数不会因读档而减少。</p>
    </>
  );
}
