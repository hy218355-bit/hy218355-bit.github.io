'use strict';
/* 共通の小道具：決定的な乱数、補間、音名 */

const A4 = 442;   // 日本の吹奏楽はA=442Hzで合わせることが多い

function hash(...args){
  const s = args.join('|');
  let h = 2166136261 >>> 0;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function gauss(...args){
  const u = Math.max(1e-9, hash(...args, 'u')), v = hash(...args, 'v');
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp01 = x => clamp(x, 0, 1);
const clampG = g => clamp(g, -2.5, 2.5);
const lerp = (a, b, t) => a + (b - a) * t;
const mtof = m => A4 * Math.pow(2, (m - 69) / 12);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function interp(pts, x){
  if(x <= pts[0][0]) return pts[0][1];
  for(let i = 1; i < pts.length; i++){
    if(x <= pts[i][0]){
      const [x0, y0] = pts[i-1], [x1, y1] = pts[i];
      return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

// 吹奏楽部ではドイツ音名で呼ぶ（B♭が「ベー」）
const NAME_DE = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'];

// 重複なしで決定的に選ぶ
function pickN(list, n, ...seed){
  const idx = list.map((x, i) => [hash(...seed, i), i]).sort((a, b) => a[0] - b[0]);
  return idx.slice(0, n).map(([, i]) => list[i]);
}
