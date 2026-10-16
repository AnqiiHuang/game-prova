// 可保存、可复现的随机数：mulberry32。
// 随机状态就是一个 32 位整数，保存在游戏状态里。

export interface RngHolder {
  rng: number;
}

export function nextFloat(h: RngHolder): number {
  h.rng = (h.rng + 0x6d2b79f5) >>> 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(h: RngHolder, min: number, max: number): number {
  return min + Math.floor(nextFloat(h) * (max - min + 1));
}

export function pick<T>(h: RngHolder, arr: readonly T[]): T {
  return arr[Math.floor(nextFloat(h) * arr.length)];
}

export function pickMany<T>(h: RngHolder, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(nextFloat(h) * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** 新种子：优先使用浏览器的安全随机数。 */
export function freshSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return (Math.floor(Math.random() * 4294967296) ^ Date.now()) >>> 0;
  }
}
