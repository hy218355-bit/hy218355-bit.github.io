'use strict';
/* 名前や性別を使わず、idだけで決まるSVGパーツの試作。セーブには接続しない。 */
window.FaceStudy=(()=>{
 const cache=new Map();let serial=0;
 const FACE_SEED='after-school-face-v3-40';
 const HAIR=[['#353945','#222d3d','#8d7864'],['#55433e','#33333b','#ba9163'],['#353d42','#23313a','#92957d'],['#6b5141','#423a3b','#c6a16e'],['#4b404b','#2e303f','#ad8c75'],['#403b38','#26313b','#a68e65']];
 const SKIN=[['#f4d5bb','#d6aa90','#fff0cf'],['#eac4a0','#bf937d','#ffe7bc'],['#dab18e','#ae7d66','#f6d8aa'],['#f3d3c3','#cf9e93','#ffe9d1']];
 const EYES=['#665544','#4d665e','#536273','#7b5b4e','#6a6261'];
 const BACK=[
  'M29 57C21 38 28 19 45 15 61 6 82 9 95 23 107 34 105 58 97 75L88 88 34 86Z',
  'M26 56C22 28 40 12 63 12 89 10 105 29 102 59L96 85 84 96 36 94 27 80Z',
  'M24 57C20 29 35 12 61 12 90 10 107 29 104 58L106 100C95 106 81 106 70 101 54 109 38 106 22 101Z',
  'M24 53C17 34 29 23 42 20 49 7 71 9 82 19 103 17 110 36 104 51 115 69 106 92 103 103L83 106 62 102 39 108 21 99C19 84 13 67 24 53Z',
  'M28 59C19 24 42 12 63 13 87 10 105 26 102 58L94 84 35 90ZM94 37C119 27 127 45 119 67 114 84 119 97 125 103 107 106 101 87 106 71 111 54 99 54 92 52Z',
  'M27 58C19 27 42 13 65 12 93 10 108 30 102 62L92 86 33 87ZM36 20C22 21 18 9 28 4 40-2 50 9 45 19Z',
  'M26 61C19 33 35 15 60 12 86 6 104 26 104 53L97 83 88 90 33 87Z',
  'M25 58C21 27 37 12 62 12 88 10 105 26 104 58L111 128 83 128 72 103 53 105 42 128 18 128Z',
  'M29 58C20 43 26 23 42 18 56 8 82 10 94 24 105 32 103 51 97 66L90 84 35 88Z',
  'M25 57C17 47 19 31 31 29 28 15 44 10 54 15 64 4 80 11 84 20 100 16 110 30 105 42 119 52 110 67 106 78 108 92 99 103 85 101 75 113 58 107 48 107 32 107 24 96 25 86 14 77 15 65 25 57Z',
  'M27 58C19 30 39 12 64 12 91 9 107 29 103 58L96 83 88 93 34 89Z',
  'M25 60C19 36 30 21 46 17 58 7 82 9 96 25 105 34 106 54 101 68L107 91 93 91 98 103 79 102 62 110 42 106 25 112 29 92 20 96Z'
 ];
 const FRONT=[
  'M27 55C23 36 36 21 53 19 45 27 43 35 39 43 47 38 52 28 62 23 58 34 56 39 53 46 63 41 70 29 76 24 80 34 87 39 92 45L96 66 102 52C106 28 87 13 66 15 47 9 23 26 27 55Z',
  'M27 62C21 30 43 15 65 15 90 11 105 30 101 61L93 74 88 39C80 41 74 31 67 23 64 38 51 49 38 52L34 75Z',
  'M25 66C18 33 36 15 63 15 90 12 107 31 103 64L95 83 89 40C85 39 81 37 77 34L74 47 68 39 61 47 56 37 46 46 40 40 34 85 27 91Z',
  'M25 66C15 48 22 33 39 28 43 16 61 14 71 22 87 16 104 29 102 47L99 73 91 82 86 44C77 47 69 36 63 29 59 45 47 49 39 47L34 78 29 91Z',
  'M27 65C19 32 40 14 66 16 91 10 105 31 101 64L95 77 89 40C77 45 67 49 53 51L61 38C48 47 42 48 36 47L32 83Z',
  'M26 63C20 29 43 15 65 16 91 11 106 31 101 62L94 80 89 40C77 44 74 33 65 24 61 40 51 47 38 50L34 75 30 88Z',
  'M25 64C18 34 39 15 64 15 91 9 108 28 103 61L96 78 91 39C80 40 68 47 51 53L57 40C47 49 39 54 33 58L30 80Z',
  'M25 67C18 33 36 15 63 15 91 11 108 32 103 65L96 84 90 40 81 42 75 37 68 45 61 37 51 47 45 40 37 49 31 89 25 96Z',
  'M28 58C21 38 30 23 46 19 60 12 80 13 92 25 101 33 103 47 98 63L92 72 87 35 81 39 75 31 68 39 61 30 51 38 45 32 37 43 33 74Z',
  'M25 67C15 52 24 35 36 30 34 20 48 17 56 23 62 12 77 19 80 27 93 22 105 35 101 47L100 72 92 84 86 45C77 48 72 38 67 31 60 44 49 50 40 46L34 79 28 90Z',
  'M27 61C22 31 43 14 65 15 92 12 107 30 102 62L95 80 90 38C80 36 70 41 58 48 47 55 37 56 32 65L30 81Z',
  'M25 64C19 36 32 20 50 19 67 9 91 18 99 34 105 45 101 61 98 73L92 82 87 40 80 48 75 37 65 49 59 36 47 50 41 43 33 64 30 85Z'
 ];
 const STRANDS=[
  'M36 38C41 26 50 19 59 18M47 37C53 25 61 20 69 19M71 22C81 27 88 34 91 44',
  'M34 48C34 31 47 20 63 19M61 23C55 39 46 46 38 49M69 23C77 31 83 36 89 36',
  'M29 56C26 34 39 21 57 19M36 52C33 33 42 25 53 22M74 21C88 24 97 37 97 57M31 67L29 86',
  'M28 46C26 35 36 29 45 30M49 25C54 20 61 22 65 28M74 26C86 25 95 32 96 43M29 69C23 77 27 87 30 92',
  'M33 53C29 33 42 21 58 20M42 45C49 29 61 22 72 21M74 29C82 33 88 34 93 40M108 44C118 49 113 62 112 71',
  'M33 49C30 31 46 21 62 19M66 23C71 32 79 37 87 38M28 11C32 7 40 10 41 15M38 54C35 67 32 73 33 85',
  'M33 49C31 31 46 21 62 20M43 47C54 28 72 22 84 28M60 42C73 35 83 33 91 37',
  'M29 55C26 33 39 22 55 20M37 48C36 31 45 25 55 22M75 21C88 26 95 38 97 58M29 72L27 111M99 76L103 114',
  'M35 35C45 24 57 20 68 21M40 37C44 29 49 27 54 25M76 23C86 27 92 35 94 45',
  'M29 47C23 34 34 31 41 35M45 28C41 19 54 20 57 28M64 25C67 17 80 23 77 31M86 33C98 29 103 41 96 48M28 70C21 78 28 89 34 87',
  'M33 49C31 31 48 20 63 20M41 46C54 30 70 22 82 24M55 46C70 39 83 33 92 37',
  'M30 49C29 32 42 23 58 20M45 44C49 31 56 24 63 22M73 24C84 29 92 38 95 47M95 75L100 88M31 83L27 100'
 ];
 function features(id){const p=(part,n)=>Math.floor(hash(id,FACE_SEED,part)*n);return {hair:p('hair',12),hairColor:p('hair-color',6),skin:p('skin',4),eyes:p('eyes',5),eyeColor:p('eye-color',5),brows:p('brows',4),mouth:p('mouth',4),shape:p('shape',4),accessory:p('accessory',18),shirt:p('shirt',3)};}
 function template(id,mood='normal',older=false){const key=id+'|'+mood+'|'+older;if(cache.has(key))return cache.get(key);const f=features(id),h=HAIR[f.hairColor],s=SKIN[f.skin];
  const colorVars=`--face-hair:${h[0]};--face-hair-dark:${h[1]};--face-hair-light:${h[2]};--face-skin:${s[0]};--face-skin-shadow:${s[1]};--face-skin-light:${s[2]};--face-iris:${EYES[f.eyeColor]};--face-ink:#34353d;--face-lip:#906565;--face-blush:#d89b8d;--face-shirt:${['#334655','#3b4a54','#3f4658'][f.shirt]};--face-collar:#f4eddd;`;
  const jaw=['M32 48C31 28 45 20 64 21 83 20 97 30 96 49L93 74C91 88 80 99 64 104 48 99 36 88 34 74Z','M32 47C31 28 45 20 64 21 85 21 98 32 96 50L93 74C89 89 78 100 64 105 50 101 38 89 34 75Z','M32 47C31 29 46 20 65 21 84 21 98 32 96 50L93 74C89 89 77 98 64 101 51 99 38 89 34 75Z','M32 47C31 29 45 21 64 21 84 21 97 32 96 50L93 76C89 90 78 101 64 103 50 100 38 89 34 74Z'][f.shape];
  const eye=(x,right)=>{const y=(f.eyes===1?64:63)+(older?0:0),tilt=f.eyes===2?(right?-1:1):f.eyes===3?(right?1:-1):0,ry=f.eyes===0?4.4:f.eyes===4?3.6:4;let a=`<path d="M${x-8} ${y+tilt}Q${x-1} ${y-5.5} ${x+8} ${y}Q${x+4} ${y+7} ${x-4} ${y+6}Z" fill="var(--face-collar)"/><ellipse cx="${x+1}" cy="${y+2}" rx="3.6" ry="${ry}" fill="var(--face-iris)"/><ellipse cx="${x+1}" cy="${y+1.5}" rx="1.6" ry="${ry-.7}" fill="var(--face-ink)"/><circle cx="${x}" cy="${y}" r="1.2" fill="#fff9e8"/><path d="M${x-8} ${y+tilt}Q${x-1} ${y-5} ${x+8} ${y}" fill="none" stroke="var(--face-ink)" stroke-width="1.7" stroke-linecap="round"/><path d="M${x-5} ${y+6}q5 1 10-1" fill="none" stroke="var(--face-skin-shadow)" stroke-width=".7"/>`;
   if(mood==='tired')a=`<path d="M${x-7} ${y+2}q7-2 14 0m-10 3q3 2 6 0" fill="none" stroke="var(--face-ink)" stroke-width="1.5" stroke-linecap="round"/>`;
   if(mood==='zone')a=`<path d="M${x-7} ${y+3}q7-8 14 0" fill="none" stroke="var(--face-ink)" stroke-width="1.8" stroke-linecap="round"/>`;
   if(mood==='freeze')a=`<path d="M${x-8} ${y}q8-8 16 0-3 8-8 8t-8-8Z" fill="var(--face-collar)"/><ellipse cx="${x}" cy="${y+2}" rx="2.8" ry="4" fill="var(--face-iris)"/><path d="M${x-8} ${y}q8-7 16 0" fill="none" stroke="var(--face-ink)" stroke-width="1.8"/>`;return a;};
  const brow=['M39 54q6-3 13-1m23 0q7-2 13 1','M39 52l13 1m23 0 13-1','M40 55q6-4 12-1m23 0q6-3 12 1','M39 54l13-2m23 0 13 2'][f.brows];
  const mouth=mood==='freeze'?'M59 88h10':mood==='tired'?'M59 89q5-2 11 0':mood==='zone'?'M57 86q7 8 15 0Z':['M58 87q6 3 13-1','M59 88q5-1 10 0','M58 87q7 5 14 0','M60 87q5 2 10-1'][f.mouth];
  const accessory=f.accessory===0?'<g fill="none" stroke="var(--face-hair-dark)" stroke-width="1.4"><path d="M36 59h20v13q-10 5-20-1Zm36 0h20v12q-10 6-20 0ZM56 63h16M32 60l4 2m56 0 4-2"/></g>':f.accessory===1?'<path d="m87 40 9 5m-10-1 9 5" stroke="var(--face-hair-light)" stroke-width="2.3" stroke-linecap="round"/>':'';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" style="${colorVars}" aria-hidden="true"><defs><linearGradient id="__ID__-hair" x1=".05" y1=".8" x2="1" y2=".1"><stop stop-color="var(--face-hair-dark)"/><stop offset=".57" stop-color="var(--face-hair)"/><stop offset="1" stop-color="var(--face-hair-light)"/></linearGradient><linearGradient id="__ID__-skin" x1="0" y1=".6" x2="1" y2=".3"><stop stop-color="var(--face-skin-shadow)"/><stop offset=".3" stop-color="var(--face-skin)"/><stop offset="1" stop-color="var(--face-skin-light)"/></linearGradient></defs><path d="M8 129q3-15 26-18l20-11h20l20 11q22 3 26 18Z" fill="var(--face-shirt)"/><path d="${BACK[f.hair]}" fill="url(#__ID__-hair)"/><path d="M54 92v16l10 12 11-12V92" fill="url(#__ID__-skin)"/><path d="M54 98q10 8 21-1v6q-9 9-21 1Z" fill="var(--face-skin-shadow)" opacity=".55"/><path d="M34 62q-9-4-7 7t10 12m57-19q9-4 8 6t-10 13" fill="var(--face-skin)" stroke="var(--face-skin-shadow)" stroke-width="1"/><path d="${jaw}" fill="url(#__ID__-skin)"/><path d="M34 67q2 23 30 36C47 101 36 89 34 75Z" fill="var(--face-skin-shadow)" opacity=".2"/><ellipse cx="40" cy="77" rx="7" ry="2.3" fill="var(--face-blush)" opacity=".22"/><ellipse cx="88" cy="77" rx="7" ry="2.3" fill="var(--face-blush)" opacity=".2"/><path d="${brow}" fill="none" stroke="var(--face-hair)" stroke-width="${older?1.4:1.2}" stroke-linecap="round"/>${eye(46,false)}${eye(81,true)}<path d="m65 72-2 8 4 1" fill="none" stroke="var(--face-skin-shadow)" stroke-width="1.1" stroke-linecap="round"/><path d="M69 78v2" stroke="var(--face-skin-light)" stroke-width="1.4" stroke-linecap="round"/><path d="${mouth}" fill="${mood==='zone'?'var(--face-lip)':'none'}" stroke="var(--face-lip)" stroke-width="1.25" stroke-linecap="round"/><path d="M61 91h7" stroke="var(--face-skin-light)" opacity=".6" stroke-width="1.2" stroke-linecap="round"/><path d="${FRONT[f.hair]}" fill="url(#__ID__-hair)"/><path d="${STRANDS[f.hair]}" fill="none" stroke="var(--face-hair-light)" stroke-width="1" stroke-linecap="round" opacity=".65"/><path d="${STRANDS[f.hair]}" transform="translate(2 1)" fill="none" stroke="var(--face-hair-dark)" stroke-width=".6" stroke-linecap="round" opacity=".3"/>${accessory}<path d="m51 104 13 16-8 8-14-18m35-6-13 16 8 8 15-18" fill="var(--face-collar)"/><path d="m41 110-8 7 9 12m46-19 8 7-9 12" fill="none" stroke="var(--face-hair-dark)" stroke-width="1" opacity=".55"/><path d="M64 120v8" stroke="var(--face-skin-shadow)" stroke-width=".7"/></svg>`;
  cache.set(key,svg);return svg;
 }
 return {features,signature:id=>JSON.stringify(features(id)),svg:(id,mood='normal',older=false)=>template(id,mood,older).replaceAll('__ID__','as-face-'+(++serial)),cacheSize:()=>cache.size};
})();
