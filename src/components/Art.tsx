// 首页的小插画：旧居民楼的入口和门牌。纯 SVG，没有外部图片，颜色沿用主题色。

export function Entrance() {
  const windows: [number, number][] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) windows.push([46 + col * 46, 18 + row * 30]);
  const lit = new Set(['2,1']); // 一扇亮着灯的窗，五楼
  return (
    <svg className="entrance" viewBox="0 0 320 170" role="img" aria-label="旧居民楼的入口，门牌写着幸福小区三栋" focusable="false">
      <rect x="0" y="0" width="320" height="170" rx="10" className="art-sky" />
      {/* 楼体 */}
      <rect x="30" y="8" width="200" height="132" className="art-wall" />
      <rect x="30" y="8" width="200" height="8" className="art-roof" />
      {windows.map(([x, y], i) => {
        const key = `${i % 4},${Math.floor(i / 4)}`;
        return <rect key={i} x={x} y={y + 6} width="26" height="20" rx="1.5" className={lit.has(key) ? 'art-win lit' : 'art-win'} />;
      })}
      {/* 单元门和门牌 */}
      <rect x="116" y="96" width="28" height="44" className="art-door" />
      <rect x="120" y="100" width="20" height="36" className="art-door-in" />
      <rect x="92" y="78" width="76" height="14" rx="2" className="art-plate" />
      <text x="130" y="88.5" textAnchor="middle" className="art-plate-text">
        幸福小区 · 三栋
      </text>
      {/* 门口的闸机和围栏 */}
      <rect x="236" y="104" width="52" height="36" rx="2" className="art-gate" />
      <rect x="244" y="112" width="8" height="8" className="art-red" />
      <rect x="258" y="126" width="30" height="4" className="art-bar" />
      <rect x="0" y="140" width="320" height="30" className="art-ground" />
      <path d="M8 156 H312" className="art-line" />
    </svg>
  );
}
