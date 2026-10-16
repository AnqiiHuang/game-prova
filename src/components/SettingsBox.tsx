import { FONT_SIZES, type Settings } from '../settings';

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
  compact?: boolean;
}

export function SettingsBox({ settings, setSettings, compact }: Props) {
  const idx = Math.max(0, FONT_SIZES.indexOf(settings.fontSize));
  return (
    <div className={`settings ${compact ? 'compact' : ''}`}>
      <div className="row between">
        <span className="label">字号</span>
        <div className="row">
          <button
            type="button"
            className="btn small"
            aria-label="减小字号"
            disabled={idx <= 0}
            onClick={() => setSettings({ ...settings, fontSize: FONT_SIZES[idx - 1] })}
          >
            A−
          </button>
          <span className="value" aria-live="polite">
            {settings.fontSize}px
          </span>
          <button
            type="button"
            className="btn small"
            aria-label="增大字号"
            disabled={idx >= FONT_SIZES.length - 1}
            onClick={() => setSettings({ ...settings, fontSize: FONT_SIZES[idx + 1] })}
          >
            A+
          </button>
        </div>
      </div>
      <div className="row between">
        <span className="label">主题</span>
        <div className="seg">
          <button
            type="button"
            className={`seg-btn ${settings.theme === 'dark' ? 'on' : ''}`}
            aria-pressed={settings.theme === 'dark'}
            onClick={() => setSettings({ ...settings, theme: 'dark' })}
          >
            深色
          </button>
          <button
            type="button"
            className={`seg-btn ${settings.theme === 'light' ? 'on' : ''}`}
            aria-pressed={settings.theme === 'light'}
            onClick={() => setSettings({ ...settings, theme: 'light' })}
          >
            浅色
          </button>
        </div>
      </div>
    </div>
  );
}
