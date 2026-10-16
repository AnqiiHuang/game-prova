import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { KEYS } from './game/storage';
import './styles.css';

interface BoundaryState {
  error: Error | null;
}

/** 兜底：任何运行时错误都不会白屏，并给出清除本地存档的出口。 */
class Boundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page">
        <div className="paper">
          <h1 className="title small">页面出了点问题</h1>
          <p className="prompt">*提示：这通常是本地存档损坏造成的。清除本地存档后重新载入，就能回到首页。</p>
          <p className="hint">{this.state.error.message}</p>
          <button
            type="button"
            className="btn primary big"
            onClick={() => {
              try {
                Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
              } catch {
                /* ignore */
              }
              location.reload();
            }}
          >
            清除本地存档并重新载入
          </button>
        </div>
      </main>
    );
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);
