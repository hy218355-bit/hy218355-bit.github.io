'use strict';
/* 描き方だけを比べる独立見本。既存のモックもゲーム本体も変えない。 */
const people=[];
for(let i=0;people.length<4;i++){
  const id='face-study-'+i,h=Math.floor(hash(id,'hair')*4);
  if(!people.some(p=>p.h===h))people.push({id,h});
}
people.sort((a,b)=>a.h-b.h);
function person(p){
  const pick=(part,n)=>Math.floor(hash(p.id,'face-v2',part)*n);
  return {...p,skin:['#ffe7d6','#f3d5bd','#d9b08c'][pick('skin',3)],hair:['#373644','#51413d','#66513f','#343e4b'][pick('hair-color',4)],eye:['#647b68','#8d6d50','#687c8d','#8c6465'][pick('eye-color',4)],eyeShape:pick('eyes',3),mouth:pick('mouth',3)};
}
function manga(p){
 const {h,skin,hair,eye,eyeShape,mouth}=person(p),line='#413d46';
 const back=[
  'M32 70Q19 42 39 23L36 17 48 20 60 11 65 18Q100 9 105 47L99 77 90 75 34 78Z',
  'M27 72Q19 20 61 18Q105 14 103 72L108 102 90 101 82 88 37 101 21 100Z',
  'M28 75Q14 56 26 39Q22 20 43 19Q58 9 77 20Q99 15 104 35Q117 50 104 73L107 97 87 101 32 99 20 89Z',
  'M28 72Q20 21 62 17Q96 14 103 45L96 83 30 83ZM96 39Q127 31 122 64L118 103 102 89Q117 72 96 62Z'
 ][h];
 const fringe=[
  'M29 54Q24 31 45 26L41 20 54 24 64 15 67 23Q96 16 100 49L93 64 87 39 77 46 73 32 57 47 55 35 40 51 37 42Z',
  'M28 68Q21 22 61 20Q103 15 101 65L94 82 87 44 81 40 74 47 67 40 60 47 53 40 43 46 36 79 29 84Z',
  'M27 61Q18 46 31 35Q25 20 47 22Q59 10 76 23Q96 17 102 40L98 69 90 61 88 39Q75 43 68 31Q58 44 48 39L38 51 34 71Z',
  'M28 65Q20 29 45 22Q62 12 84 23Q101 28 100 62L92 74 88 37Q75 47 62 49L66 36Q49 49 40 48L34 75Z'
 ][h];
 const eyebrow=eyeShape===0?'M43 55q6-3 12-1m18 0q6-2 12 1':eyeShape===1?'M43 54l12 1m18 0 12-1':'M43 57q6-5 12-2m18 0q6-3 12 2';
 const eyeY=eyeShape===1?66:65;
 const eyeOne=(x)=>`<path d="M${x-7} ${eyeY}q7-7 14 0q-2 9-7 9t-7-9Z" fill="#fffaf7"/><ellipse cx="${x}" cy="${eyeY+2}" rx="4.6" ry="6.3" fill="${eye}"/><ellipse cx="${x}" cy="${eyeY+1}" rx="2" ry="4.6" fill="${line}"/><circle cx="${x-1.3}" cy="${eyeY-1.5}" r="1.6" fill="#fff"/><path d="M${x-7.5} ${eyeY}q7-7 15 0" fill="none" stroke="${line}" stroke-width="2.2" stroke-linecap="round"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M14 128q2-19 25-23l16-6h18l16 6q23 4 25 23" fill="#46536b"/><path d="${back}" fill="${hair}" stroke="${line}" stroke-width="1.8" stroke-linejoin="round"/><path d="M54 91v14l10 10 10-10V91" fill="${skin}" stroke="${line}" stroke-width="1.4"/><path d="M53 98q11 6 22-1v5q-9 9-21 0" fill="#b57f6e" opacity=".25"/><ellipse cx="33" cy="70" rx="5.5" ry="8" fill="${skin}" stroke="${line}" stroke-width="1.4"/><ellipse cx="95" cy="70" rx="5.5" ry="8" fill="${skin}" stroke="${line}" stroke-width="1.4"/><path d="M34 51q1-26 30-26t30 26l-2 24q-3 19-28 28Q39 94 36 75Z" fill="${skin}" stroke="${line}" stroke-width="1.5"/><path d="M37 74q5 18 27 26 21-8 27-25-2 22-27 29Q40 95 37 74" fill="#c28d7a" opacity=".14"/><path d="${eyebrow}" fill="none" stroke="${hair}" stroke-width="1.6" stroke-linecap="round"/>${eyeOne(49)}${eyeOne(79)}<path d="m65 75-2 5h3" fill="none" stroke="#bd8b7b" stroke-width="1.1" stroke-linecap="round"/><path d="${mouth===0?'M59 87q5 3 10-1':mouth===1?'M60 87h8':'M60 85q4 7 9 0Z'}" fill="${mouth===2?'#bd817c':'none'}" stroke="#8c5f61" stroke-width="1.3" stroke-linecap="round"/><path d="M40 80h6m37 0h6" stroke="#e6a39d" stroke-width="3" stroke-linecap="round" opacity=".55"/><path d="${fringe}" fill="${hair}" stroke="${line}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="${h===0?'M45 31 38 41m31-14 17 5':h===1?'M33 52q0-18 15-25m42 29q0-18-10-26':h===2?'M37 32q9-7 16-4m23 1q13-1 16 12':'M39 32q12-9 23-9m16 5 10 6'}" fill="none" stroke="#c6b7a8" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/><path d="m50 104 14 11-9 7-11-15m34-3-14 11 9 7 11-15" fill="#fffaf0" stroke="${line}" stroke-width="1.2"/><path d="M64 116v12" stroke="#b3b6be" stroke-width="1.2"/><circle cx="67" cy="125" r="1.2" fill="#e4c58e"/></svg>`;
}
function sketch(p){
 const {h}=p,line='#4e4a45',hair=['#666367','#6e6053','#6a6560','#5d6265'][h];
 const back=['M30 64Q21 21 62 19Q100 14 101 59L94 79 31 81Z','M29 65Q23 21 62 20Q103 18 100 69L104 99 88 96 77 89 35 100 25 94Z','M27 72Q17 56 29 38Q27 21 46 23Q62 10 80 24Q105 22 101 45Q114 61 100 78L102 99 28 98Z','M30 70Q21 21 65 18Q105 22 98 71L90 85 34 84ZM97 39q28-3 23 32l-9 24-6-25-11-14Z'][h];
 const front=['M30 62Q25 28 48 25L45 17 59 23 68 16 72 24Q97 25 98 58L91 67 86 41 71 46 66 34 52 49 48 38 37 57Z','M29 66Q22 23 62 21Q102 18 99 68L91 79 87 43 76 46 68 40 60 47 51 40 40 47 34 83Z','M28 65Q20 42 38 33Q34 21 54 24Q67 16 80 28Q101 26 100 58L92 74 86 44 73 42 65 34 51 46 42 42 35 76Z','M30 63Q21 22 62 21Q101 18 99 62L91 74 87 39Q71 49 58 48L61 38Q45 48 38 48L34 78Z'][h];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><g stroke="${line}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 128q2-17 24-22l15-7h21l15 7q21 3 24 22" fill="#e4e1d8"/><path d="${back}" fill="${hair}"/><path d="M55 92v14l9 9 10-10V92" fill="#fbeddc"/><path d="M34 64q-9-5-6 9t10 7m55-16q9-4 8 7t-9 10" fill="#fbeddc"/><path d="M35 49q0-24 29-25t29 25v26q-4 20-29 28-25-8-29-28Z" fill="#fbeddc"/><path d="M43 57q5-2 11 0m19 0q6-3 12 0" fill="none"/><path d="M43 67q6-4 12 0m18 0q6-4 12 0" fill="none"/><path d="M49 66v5m30-5v5" stroke-width="3"/><path d="m64 76-1 3m-3 9q4 2 9-1" fill="none"/><path d="${front}" fill="${hair}"/><path d="m48 105 16 10-9 6-12-13m36-3-15 10 9 6 12-13M64 116v12" fill="#fffaf1"/></g><g stroke="#c1a38f" stroke-width=".9" opacity=".8"><path d="m39 77-2 4m6-3-2 4m45-4-2 4m6-4-2 4"/></g><path d="${h===0?'m42 33-7 12m18-15-8 10':h===1?'M32 57q0-24 17-30m45 29q-1-20-11-27':h===2?'m35 42 6-7m45-2 7 12':'M37 39q9-12 24-14m20 5 9 10'}" fill="none" stroke="#c4b5a4" stroke-width="1.2" opacity=".6"/></svg>`;
}
function pixel(p){
 const {h,skin,hair}=person(p),ink='#343344';
 let rects='';const r=(x,y,w,ht,c)=>{rects+=`<path d="M${x} ${y}h${w}v${ht}h-${w}Z" fill="${c}"/>`;};
 r(6,28,20,4,'#43566a');r(9,26,14,3,'#43566a');
 if(h===1){r(6,9,20,17,hair);r(5,20,4,7,hair);r(23,20,4,7,hair);}
 if(h===2){r(5,9,22,4,hair);r(4,13,24,10,hair);r(6,22,20,4,hair);}
 if(h===3){r(24,10,5,12,hair);r(26,16,4,10,hair);}
 r(13,23,6,5,skin);r(8,11,16,10,skin);r(7,15,18,5,skin);r(9,20,14,3,skin);r(11,23,10,1,skin);
 r(13,24,6,1,'#c9997e');r(12,27,2,1,'#f5efdf');r(14,28,2,1,'#f5efdf');r(18,27,2,1,'#f5efdf');r(16,28,2,1,'#f5efdf');
 r(8,7,16,5,hair);r(6,10,20,4,hair);
 if(h===0){r(9,5,4,3,hair);r(15,4,3,4,hair);r(19,6,3,2,hair);r(7,13,2,4,hair);r(23,12,2,5,hair);r(12,12,3,2,hair);r(18,12,2,1,hair);}
 if(h===1){r(8,6,16,3,hair);r(7,12,2,11,hair);r(23,12,2,11,hair);r(10,12,3,2,hair);r(15,12,3,2,hair);r(20,12,2,2,hair);}
 if(h===2){r(9,6,14,3,hair);r(7,8,19,4,hair);r(6,12,3,7,hair);r(23,12,3,8,hair);r(10,12,3,2,hair);r(17,12,4,2,hair);}
 if(h===3){r(9,6,14,3,hair);r(7,12,2,7,hair);r(23,12,2,8,hair);r(10,12,8,2,hair);r(10,14,4,1,hair);}
 r(10,16,4,1,ink);r(18,16,4,1,ink);r(11,17,2,3,ink);r(19,17,2,3,ink);r(11,17,1,1,'#fff7e9');r(19,17,1,1,'#fff7e9');r(15,22,3,1,'#9d6967');r(9,20,2,1,'#dfaba0');r(21,20,2,1,'#dfaba0');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>`;
}
function sample(renderer,p){const svg=renderer(p);return `<div class="sample"><span class="face">${svg}</span><div class="smallrow"><span class="face">${svg}</span><span class="face">${svg}</span></div></div>`;}
document.querySelector('#options').innerHTML=[
 ['01','やわらかい漫画調','目と髪に描き込み。高校生らしさを出す。',manga],
 ['02','日誌の手描き調','線と少ない色で、気取らない表情に。',sketch],
 ['03','育成ゲームのドット絵','小さくても、髪と目がはっきり残る。',pixel]
].map(([n,title,desc,renderer])=>`<article><span class="num">${n}</span><h2>${title}</h2><p>${desc}</p><div class="portraits">${people.map(p=>sample(renderer,p)).join('')}</div></article>`).join('');
