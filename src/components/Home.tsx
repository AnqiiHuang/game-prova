import { useState } from 'react';
import type { Session } from '../game/session';
import type { FamilyId, Gender, LuckTier } from '../game/types';
import type { Settings } from '../settings';
import coverUrl from '../assets/cover-gate.jpg';
import { Modal } from './Modal';
import { SettingsBox } from './SettingsBox';

interface HomeProps {
  session: Session;
  settings: Settings;
  setSettings: (s: Settings) => void;
  onNew: () => void;
  onContinue: () => void;
}

export function Home({ session, settings, setSettings, onNew, onContinue }: HomeProps) {
  const [help, setHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const cont = session.canContinue();
  return (
    <main className="page home" id="main">
      <div className="home-top">
        <span className="home-tag">纯属虚构的互动文字游戏</span>
        <button type="button" className="btn small" onClick={() => setShowSettings(true)} aria-haspopup="dialog">
          设置
        </button>
      </div>

      <div className="paper home-card">
        <img
          className="cover-photo"
          src={coverUrl}
          width={1280}
          height={720}
          alt="阴天傍晚，一个老式居民小区的入口：一栋旧住宅楼，几扇窗透出灯光，深绿色的铁门半掩，左边是公告栏，右边是门卫亭和闸机，没有人。"
          decoding="async"
        />
        <div className="home-head">
          <h1 className="title">逃离幸福小区</h1>
          <p className="slogan">七天内，找出那条假的家规。</p>
        </div>
        <div className="prose">
          <p>假期回家的第一天，你刚走进小区大门，耳边就响起一个只有你能听见的声音：</p>
          <p className="quote">“欢迎来到幸福小区。你需要在七天内找到离开的办法。超过期限，本局游戏结束。”</p>
          <p>家里留给你五条家规，其中一条是假的。你要靠观察、对话和一点耐心，弄明白这个家和这个小区到底卡在了哪里。</p>
        </div>

        {session.notice ? <p className="prompt warn-text">*提示：{session.notice}</p> : null}
        {!session.persistent ? (
          <p className="prompt">
            *提示：当前浏览器不允许保存进度，这次是“临时游玩模式”。关闭或刷新页面后，进度不会保留。
          </p>
        ) : null}

        <div className="stack">
          <button type="button" className="btn primary big" onClick={onNew}>
            开始游戏
          </button>
          <button
            type="button"
            className="btn big"
            onClick={onContinue}
            disabled={!cont.ok}
            aria-describedby={!cont.ok ? 'cont-reason' : undefined}
          >
            继续游戏
          </button>
          {!cont.ok ? (
            <p id="cont-reason" className="hint">
              {cont.reason}
            </p>
          ) : null}
          <button type="button" className="btn ghost big" onClick={() => setHelp((v) => !v)} aria-expanded={help}>
            {help ? '收起玩法说明' : '玩法说明'}
          </button>
        </div>

        {help ? (
          <div className="card help">
            <h2>怎么玩</h2>
            <ul>
              <li>游戏共 7 天。每天有 3 个主线事件，另有可选的支线和日常行动。</li>
              <li>你在哪里，就只能和在场的人当面说话。不在家时，只能给爸爸妈妈发消息。</li>
              <li>时间只会在你行动之后流逝。阅读、查看规则、背包、关系和日记都不耗时间。</li>
              <li>每天中午 12 点，需要主动选择“等到中午并陪爷爷去阳台”。</li>
              <li>每天要吃三顿饭。体力、健康、恐惧、零花钱都会影响你能做什么。</li>
              <li>家规可以自己标记“暂时相信”或“怀疑有假”。这只是你的判断，答案要靠剧情慢慢证实。</li>
              <li>睡觉会保存进度。若中途失败，可以读取最近一次睡觉存档，但失败次数不会清零，累计 4 次失败本局结束。</li>
              <li>第 7 天结束前没有找到离开的办法，本局结束，旧存档作废。</li>
            </ul>
          </div>
        ) : null}

        <p className="disclaimer">纯属虚构的互动文字游戏。人物、小区、物业与情节均为虚构，没有血腥与暴力画面。</p>
        {import.meta.env.DEV ? <p className="hint">开发模式：可在“开始游戏”页使用固定种子与调试选项。</p> : null}
      </div>

      {showSettings ? (
        <Modal title="设置" onClose={() => setShowSettings(false)}>
          <p className="hint">调整字号和主题，立刻生效，并保存在你的浏览器里。</p>
          <SettingsBox settings={settings} setSettings={setSettings} />
        </Modal>
      ) : null}
    </main>
  );
}

interface CreateProps {
  onStart: (o: {
    name: string;
    gender: Gender;
    call: string;
    seed?: number;
    force?: { helper?: FamilyId; luckTier?: LuckTier };
  }) => void;
  onBack: () => void;
}

export function CharacterCreate({ onStart, onBack }: CreateProps) {
  const [name, setName] = useState('林夏');
  const [gender, setGender] = useState<Gender>('female');
  const [call, setCall] = useState('');
  const [seed, setSeed] = useState('');
  const [helper, setHelper] = useState<'' | FamilyId>('');
  const [luck, setLuck] = useState<'' | LuckTier>('');
  const cleanName = name.trim().slice(0, 8);
  const err = gender === 'custom' && !call.trim() ? '请填写别人（尤其是弟弟）对你的称呼。' : null;

  return (
    <main className="page" id="main">
      <div className="paper">
        <button type="button" className="btn ghost small" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="title small">创建角色</h1>
        <p className="hint">特质、幸运和初始数值会在开始时随机抽取，之后保存，刷新页面也不会改变。</p>

        <label className="field">
          <span>名字（最多 8 个字）</span>
          <input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="林夏" />
        </label>

        <fieldset className="field">
          <legend>性别</legend>
          <div className="seg" role="radiogroup">
            {(
              [
                ['female', '女'],
                ['male', '男'],
                ['custom', '自定义称呼'],
              ] as [Gender, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={gender === v}
                className={`seg-btn ${gender === v ? 'on' : ''}`}
                onClick={() => setGender(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {gender === 'custom' ? (
          <label className="field">
            <span>弟弟对你的称呼</span>
            <input value={call} maxLength={6} onChange={(e) => setCall(e.target.value)} placeholder="例如：阿夏" />
          </label>
        ) : null}
        {err ? <p className="prompt warn-text">*提示：{err}</p> : null}

        {import.meta.env.DEV ? (
          <details className="card dev">
            <summary>开发调试（仅开发环境可见）</summary>
            <label className="field">
              <span>固定种子（留空则随机）</span>
              <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </label>
            <label className="field">
              <span>指定帮助者</span>
              <select value={helper} onChange={(e) => setHelper(e.target.value as '' | FamilyId)}>
                <option value="">随机</option>
                <option value="mom">妈妈</option>
                <option value="dad">爸爸</option>
                <option value="bro">弟弟</option>
                <option value="grandma">奶奶</option>
                <option value="grandpa">爷爷</option>
              </select>
            </label>
            <label className="field">
              <span>指定幸运档</span>
              <select value={luck} onChange={(e) => setLuck(e.target.value as '' | LuckTier)}>
                <option value="">随机</option>
                <option value="high">100</option>
                <option value="mid">50</option>
                <option value="low">-10</option>
              </select>
            </label>
          </details>
        ) : null}

        <div className="stack">
          <button
            type="button"
            className="btn primary big"
            disabled={!!err}
            onClick={() =>
              onStart({
                name: cleanName || '林夏',
                gender,
                call: call.trim(),
                seed: import.meta.env.DEV && seed ? Number(seed) : undefined,
                force: import.meta.env.DEV
                  ? { helper: helper || undefined, luckTier: luck || undefined }
                  : undefined,
              })
            }
          >
            走进小区
          </button>
        </div>
      </div>
    </main>
  );
}
