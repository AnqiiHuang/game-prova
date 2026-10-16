import { useState } from 'react';
import { useBlockUse } from './useBlock';
import { mentionedDocs } from '../game/story/helpers';
import { CLUES, DOC_INFO, ITEMS, NOTE_LABEL, NPCS, RULES, RULE_NOTE } from '../game/story/data';
import { RULE_MARK_LABEL, type ItemId, type NpcId, type RuleMark } from '../game/types';
import { useGame } from './ctx';
import { ConfirmDialog, Modal } from './Modal';
import { SettingsBox } from './SettingsBox';

export function RulesPanel({ onClose }: { onClose: () => void }) {
  const { state: s, act } = useGame();
  const marks: RuleMark[] = ['none', 'trust', 'doubt'];
  return (
    <Modal title="家规" onClose={onClose}>
      <ol className="rules-list">
        {RULES.map((r) => {
          const st = s.rules[r.n];
          const mark = s.marks[r.n] ?? 'none';
          return (
            <li key={r.n}>
              {r.text}
              {st === 'unknown' ? (
                <div className="mark-row" role="radiogroup" aria-label={`第 ${r.n} 条的判断`}>
                  <span className="hint">我的判断</span>
                  <div className="seg">
                    {marks.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mark === m}
                        className={`seg-btn ${mark === m ? 'on' : ''} ${m === 'doubt' ? 'doubt' : ''}`}
                        onClick={() => act({ kind: 'markRule', rule: r.n, mark: m })}
                      >
                        {RULE_MARK_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <span className={`badge ${st === 'true' ? 'ok' : 'bad'}`}>{st === 'true' ? '已证实：真' : '已证实：假'}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="rule-note">{RULE_NOTE}</p>
      <p className="hint">
        “我的判断”只是你自己的记号，不代表游戏公布了答案，也不影响剧情。只有你亲眼见证、亲耳证实的结论，才会标成“已证实”。
        查看和标记都不耗时间。
      </p>
    </Modal>
  );
}

const BAG_ORDER: ItemId[] = ['pen', 'diary', 'meds', 'bento', 'drink', 'car'];

export function BagPanel({ onClose }: { onClose: () => void }) {
  const { state: s, act } = useGame();
  const useBlock = useBlockUse(s);
  const list = BAG_ORDER.filter((id) => s.inventory[id] > 0);
  return (
    <Modal title="背包" onClose={onClose}>
      <p className="hint">查看背包不耗时间。使用药品或饮料会耗 5 分钟。零花钱：{s.stats.money} 元。</p>
      <ul className="plain-list">
        {list.map((id) => (
          <li key={id} className="card">
            <div className="row between">
              <b>
                {ITEMS[id].name} × {s.inventory[id]}
              </b>
              {ITEMS[id].quest ? <span className="badge">任务物品</span> : null}
            </div>
            <p className="hint">{ITEMS[id].desc}</p>
            {id === 'meds' || id === 'drink' ? (
              <>
                <button
                  type="button"
                  className="btn small primary"
                  disabled={!!useBlock(id)}
                  onClick={() => act({ kind: 'use', item: id })}
                >
                  使用
                </button>
                {useBlock(id) ? <p className="lock">{useBlock(id)}</p> : null}
              </>
            ) : null}
            {id === 'bento' ? <p className="hint">需要在用餐时间，从日程页的“吃便当”使用。</p> : null}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function RelationsPanel({ onClose }: { onClose: () => void }) {
  const { state: s } = useGame();
  const ids = (Object.keys(NPCS) as NpcId[]).filter((id) => s.npcs[id].known);
  return (
    <Modal title="关系" onClose={onClose}>
      <p className="hint">只显示你已经认识的人。好感度范围 0–100。</p>
      <ul className="plain-list">
        {ids.map((id) => {
          const n = s.npcs[id];
          return (
            <li key={id} className="card">
              <div className="row between">
                <b>{NPCS[id].name}</b>
                <span className="hint">{NPCS[id].identity}</span>
              </div>
              <div className="bar" role="progressbar" aria-label={`${NPCS[id].name}好感`} aria-valuenow={n.favor} aria-valuemin={0} aria-valuemax={100}>
                <i className="good" style={{ width: `${n.favor}%` }} />
              </div>
              <p className="hint">
                好感 {n.favor}
                {n.delta ? `　最近变化：${n.delta > 0 ? '+' : '−'}${Math.abs(n.delta)}（第 ${n.day} 天，${n.reason}）` : n.reason ? `　${n.reason}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function DiaryPanel({ onClose }: { onClose: () => void }) {
  const { state: s } = useGame();
  const confirmed = CLUES.filter((c) => s.clues[c.id] === 'confirmed');
  const suspect = CLUES.filter((c) => s.clues[c.id] === 'suspect' && c.suspect);
  const notes = Object.keys(NOTE_LABEL).filter((k) => s.notes[k]);
  // 材料只有在剧情里明确提到之后才会出现在日记里
  const shownDocs = mentionedDocs(s);
  const myMarks = RULES.filter((r) => s.rules[r.n] === 'unknown' && (s.marks[r.n] ?? 'none') !== 'none');
  return (
    <Modal title="日记" onClose={onClose}>
      <p className="hint">日记只记录你已经发现的内容，重要的事都在这里。查看日记不耗时间。</p>

      {shownDocs.length ? (
        <>
          <h3>办理材料</h3>
          <ul className="plain-list">
            {shownDocs.map((k) => (
              <li key={k} className="doc">
                <span className={`badge ${s.docs[k] ? 'ok' : ''}`}>{s.docs[k] ? '已有' : '还没有'}</span>
                <b>{DOC_INFO[k].name}</b>
                <span className="hint">{DOC_INFO[k].hint}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>已证实</h3>
      {confirmed.length ? (
        <ul className="plain-list">
          {confirmed.map((c) => (
            <li key={c.id} className="entry">
              <b>{c.title}</b>
              <p>{c.confirmed}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">暂时还没有。</p>
      )}

      <h3>怀疑</h3>
      {suspect.length ? (
        <ul className="plain-list">
          {suspect.map((c) => (
            <li key={c.id} className="entry">
              <b>{c.title}</b>
              <p>{c.suspect}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">暂时没有。</p>
      )}

      {myMarks.length ? (
        <>
          <h3>我对家规的判断</h3>
          <ul className="plain-list">
            {myMarks.map((r) => (
              <li key={r.n} className="entry">
                <b>
                  第 {r.n} 条：{RULE_MARK_LABEL[s.marks[r.n]]}
                </b>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
          <p className="hint">这是你自己的判断，不是游戏公布的答案。</p>
        </>
      ) : null}

      {notes.length ? (
        <>
          <h3>观察与谈话</h3>
          <ul className="plain-list">
            {notes.map((k) => (
              <li key={k} className="entry">
                <b>{NOTE_LABEL[k]}</b>
                <p>{s.notes[k]}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Modal>
  );
}

export function SavePanel({ onClose }: { onClose: () => void }) {
  const { session, state: s, settings, setSettings, goHome, restart, openPanel } = useGame();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const sleepDay = session.sleepSaveDay();
  return (
    <Modal title="存档与设置" onClose={onClose}>
      <p>每次有效的行动之后，游戏都会自动保存进度。</p>
      <ul className="plain-list">
        <li>当前进度：第 {s.day} 天 {Math.floor(s.time / 60)}:{String(s.time % 60).padStart(2, '0')}</li>
        <li>睡觉存档：{sleepDay ? `第 ${sleepDay} 天清晨` : '还没有（睡觉之后才会生成；在此之前失败会回到开局）'}</li>
        <li>本局失败次数：{session.meta?.failCount ?? 0}（最多可读档 3 次，第 4 次失败本局结束）</li>
      </ul>
      {!session.persistent ? (
        <p className="prompt">*提示：当前是“临时游玩模式”，关闭页面后进度不会保留。</p>
      ) : null}

      <h3>阅读设置</h3>
      <SettingsBox settings={settings} setSettings={setSettings} />

      <h3>其他</h3>
      <div className="stack">
        <button type="button" className="btn" onClick={() => openPanel('share')}>
          生成分享图
        </button>
        <button type="button" className="btn" onClick={goHome}>
          回到首页（进度已保存）
        </button>
        <button type="button" className="btn danger" onClick={() => setConfirmWipe(true)}>
          放弃本局并重新开始
        </button>
      </div>
      {confirmWipe ? (
        <ConfirmDialog
          title="放弃本局？"
          text="当前进度、睡觉存档和失败记录都会被清除，且不能找回。"
          okText="清除并重新开始"
          danger
          onOk={() => {
            setConfirmWipe(false);
            restart();
          }}
          onCancel={() => setConfirmWipe(false)}
        />
      ) : null}
    </Modal>
  );
}
