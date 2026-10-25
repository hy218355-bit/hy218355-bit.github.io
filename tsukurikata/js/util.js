'use strict';
/* 共通の小道具：決定的な乱数、補間、音名 */

const A4 = 442;   // 日本の吹奏楽はA=442Hzで合わせることが多い

function fnv(h, s){
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h;
}
function fnvOut(h){
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash(...args){ return fnvOut(fnv(2166136261 >>> 0, args.join('|'))); }
const boxMuller = (u, v) => Math.sqrt(-2 * Math.log(Math.max(1e-9, u))) * Math.cos(2 * Math.PI * v);
function gauss(...args){ return boxMuller(hash(...args, 'u'), hash(...args, 'v')); }
// 同じ前置きで何度も引くとき用（1音ごとの乱数など）。前置きまで先に計算しておく。値は hash(...pre, ...rest) と同じ
function hasher(...pre){
  const h0 = fnv(2166136261 >>> 0, pre.join('|') + '|');
  const h = (...rest) => fnvOut(fnv(h0, rest.join('|')));
  h.gauss = (...rest) => boxMuller(h(...rest, 'u'), h(...rest, 'v'));
  return h;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp01 = x => clamp(x, 0, 1);
const clampG = g => clamp(g, -2.5, 2.5);
const lerp = (a, b, t) => a + (b - a) * t;
const mtof = m => A4 * Math.pow(2, (m - 69) / 12);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
// iOSアプリの中で動いているときだけ、アプリ側へ知らせる（ブラウザでは何もしない）
const nativePost = m => { try{ window.webkit.messageHandlers.native.postMessage(m); }catch(e){} };
// 手ごたえ（振動）：tap＝軽く、success＝うれしい結果、warning＝残念な結果
const haptic = kind => nativePost({type: 'haptic', kind});

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
