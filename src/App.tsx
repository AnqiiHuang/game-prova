import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Session, type StartOptions } from './game/session';
import { SaveStore, detectStore } from './game/storage';
import type { Command } from './game/types';
import { CharacterCreate, Home } from './components/Home';
import { GameScreen, RulesScreen } from './components/GameScreen';
import { EndingScreen } from './components/EndingScreen';
import { BagPanel, DiaryPanel, RelationsPanel, RulesPanel, SavePanel } from './components/Panels';
import { ShareDialog } from './components/ShareDialog';
import { ConfirmDialog } from './components/Modal';
import { GameContext, type PanelId } from './components/ctx';
import { applySettings, loadSettings, type Settings } from './settings';

function makeSession(): Session {
  const { store, persistent } = detectStore();
  const s = new Session(new SaveStore(store, persistent));
  s.init();
  return s;
}

export default function App() {
  const ref = useRef<Session | null>(null);
  if (!ref.current) ref.current = makeSession();
  const session = ref.current;

  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [screen, setScreen] = useState<'home' | 'create'>('home');
  const [panel, setPanel] = useState<PanelId>(null);
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings(session.store));
  const [confirm, setConfirm] = useState<{ cmd: Command; seq: number; reason: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const setSettings = useCallback(
    (s: Settings) => {
      setSettingsState(s);
      session.store.saveSettings(s);
    },
    [session],
  );

  const act = useCallback(
    (cmd: Command) => {
      const s = session.state;
      if (!s) return;
      const r = session.dispatch(cmd, s.seq, false);
      if (r.ok) {
        bump();
        return;
      }
      if (r.confirm) {
        setConfirm({ cmd, seq: s.seq, reason: r.reason });
        return;
      }
      if (r.reason !== 'stale') setToast(r.reason);
    },
    [session],
  );

  const doConfirm = () => {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    const r = session.dispatch(c.cmd, c.seq, true);
    if (r.ok) bump();
    else if (!r.confirm && r.reason !== 'stale') setToast(r.reason);
  };

  const goHome = useCallback(() => {
    setPanel(null);
    session.leave();
    setScreen('home');
    bump();
  }, [session]);

  const restart = useCallback(() => {
    setPanel(null);
    session.wipe();
    setScreen('create');
    bump();
  }, [session]);

  const restore = useCallback(() => {
    const r = session.restoreAfterFailure();
    if (!r.ok) setToast(r.reason ?? '现在不能读档。');
    bump();
  }, [session]);

  const startNew = (o: StartOptions) => {
    // 固定种子和指定抽取结果只在开发环境生效
    session.startNew(import.meta.env.DEV ? o : { name: o.name, gender: o.gender, call: o.call });
    bump();
  };

  const state = session.state;
  const ctx = useMemo(
    () =>
      state
        ? { session, state, act, openPanel: setPanel, settings, setSettings, goHome, restart, restore }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, state, act, settings, setSettings, goHome, restart, restore],
  );

  let body;
  if (state && ctx) {
    body = (
      <GameContext.Provider value={ctx}>
        {state.mode === 'ended' ? <EndingScreen /> : state.mode === 'rules' ? <RulesScreen /> : <GameScreen />}
        {panel === 'rules' ? <RulesPanel onClose={() => setPanel(null)} /> : null}
        {panel === 'bag' ? <BagPanel onClose={() => setPanel(null)} /> : null}
        {panel === 'relations' ? <RelationsPanel onClose={() => setPanel(null)} /> : null}
        {panel === 'diary' ? <DiaryPanel onClose={() => setPanel(null)} /> : null}
        {panel === 'save' ? <SavePanel onClose={() => setPanel(null)} /> : null}
        {panel === 'share' ? (
          <ShareDialog state={state} canEnding={state.mode === 'ended'} onClose={() => setPanel(null)} />
        ) : null}
      </GameContext.Provider>
    );
  } else if (screen === 'create') {
    body = <CharacterCreate onBack={() => setScreen('home')} onStart={startNew} />;
  } else {
    body = (
      <Home
        session={session}
        settings={settings}
        setSettings={setSettings}
        onNew={() => setScreen('create')}
        onContinue={() => {
          if (session.continueRun()) bump();
        }}
      />
    );
  }

  return (
    <>
      <a className="skip" href="#main">
        跳到正文
      </a>
      {body}
      {confirm ? (
        <ConfirmDialog text={confirm.reason} okText="确定继续" onOk={doConfirm} onCancel={() => setConfirm(null)} />
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          *提示：{toast}
        </div>
      ) : null}
    </>
  );
}
