import { useEffect, useMemo, useState } from 'react';
import { canvasToBlob, renderShareCanvas, shareFileName, type ShareTemplate } from '../utils/shareImage';
import type { GameState } from '../game/types';
import { Modal } from './Modal';

interface Props {
  state: GameState | null;
  onClose: () => void;
  /** 是否允许选择“结局卡” */
  canEnding: boolean;
}

export function ShareDialog({ state, onClose, canEnding }: Props) {
  const [tpl, setTpl] = useState<ShareTemplate>(canEnding ? 'ending' : 'cover');
  const [showName, setShowName] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const url = useMemo(() => {
    try {
      const c = renderShareCanvas({ template: tpl, state, showName });
      setErr(null);
      return c.toDataURL('image/png');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '生成失败');
      return null;
    }
  }, [tpl, state, showName]);

  // 下载用的 Blob 地址，换图或关闭时释放
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    try {
      const c = renderShareCanvas({ template: tpl, state, showName });
      canvasToBlob(c)
        .then((b) => {
          if (!alive) return;
          made = URL.createObjectURL(b);
          setBlobUrl(made);
        })
        .catch(() => setBlobUrl(null));
    } catch {
      setBlobUrl(null);
    }
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [tpl, state, showName]);

  const tabs: [ShareTemplate, string][] = [
    ['cover', '封面'],
    ['story', '剧情卡'],
  ];
  if (canEnding) tabs.push(['ending', '结局卡']);

  return (
    <Modal title="生成分享图" onClose={onClose}>
      <p className="hint">图片在你的浏览器里本地生成，1080×1440，不会上传到任何地方。不含二维码和外链。</p>
      <div className="seg" role="tablist" aria-label="模板">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tpl === k}
            className={`seg-btn ${tpl === k ? 'on' : ''}`}
            onClick={() => setTpl(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
        <span>在图上显示我的名字（默认隐藏）</span>
      </label>
      <p className="hint">默认也不会显示尚未揭晓的信息和没有证实的家规答案。</p>
      {err ? <p className="prompt warn-text">*提示：{err}</p> : null}
      {url ? <img className="share-preview" src={url} alt="分享图预览" width={1080} height={1440} /> : null}
      <p className="hint">手机上可以长按图片保存。</p>
      <div className="stack">
        {blobUrl ? (
          <a className="btn primary big" href={blobUrl} download={shareFileName(tpl)}>
            下载 PNG
          </a>
        ) : (
          <button type="button" className="btn primary big" disabled>
            正在生成……
          </button>
        )}
      </div>
    </Modal>
  );
}
