'use strict';
/* 楽器の輪郭を24x24のSVGの線で描く。舞台では同じ線を一度だけ読み、使い回す。 */
const INSTRUMENT_LINES={
 flute:'M3 10H21V14H3ZM6 10V14M10 10V14M14 10V14M18 10V14',
 reed:'M11 2H13V6L14 18L17 22H7L10 18ZM10 10H14M10 14H14',
 oboe:'M12 1V5M10 5H14L15 21H9ZM10 10H14M10 14H14M9 18H15',
 bassoon:'M9 22L7 6H11L13 22ZM11 7L15 4H18V2M8 12H11M9 17H12',
 bassclarinet:'M8 3H12V5H10V16Q10 21 16 20L20 16V22H15Q7 23 7 17V7M8 11H11',
 sax:'M6 3H10L13 16Q14 19 17 16L16 11L22 10L21 18Q15 25 10 19L7 6H4M10 10L13 9M11 14L14 13',
 trumpet:'M2 9H15L22 5V19L15 15H6Q2 15 2 12ZM7 9V6M11 9V6M8 15V19H15V9',
 horn:'M10 6C1 6 1 21 10 21C18 21 18 10 10 10C5 10 5 17 10 17C13 17 13 13 10 13M10 6H17L22 2V14L17 10M6 5V2H3',
 trombone:'M2 7H14L21 3V15L14 11H5Q2 11 2 14V17H18Q22 17 22 20H7M8 7V11',
 euph:'M6 3H15L13 7V17Q13 22 7 21Q3 20 4 16V9H8V17H10V8M16 10H19V19H13M6 12H11',
 tuba:'M4 2H18L15 8V17Q15 22 8 22Q2 22 2 16V10H6V17Q6 19 9 18V9M10 10H20V18H15M12 8V15M16 8V15',
 bass:'M12 1V19M10 3H14M9 9Q5 8 5 12Q8 14 4 17Q2 22 12 22Q22 22 20 17Q16 14 19 12Q19 8 15 9M8 16H16M12 22V24',
 timp:'M3 10H21Q20 19 12 19Q4 19 3 10ZM3 10Q12 6 21 10M8 18L6 23M16 18L18 23M4 2L11 7M20 2L13 7',
 snare:'M3 10Q12 6 21 10V19Q12 23 3 19ZM3 10Q12 14 21 10M6 12L9 21L12 13L15 21L18 12M4 2L18 7M20 2L7 7',
 drum:'M10 3C0 3 0 21 10 21C20 21 20 3 10 3ZM10 3H16C24 3 24 21 16 21H10M15 5L15 19M7 21L5 24M17 21L19 24',
 cymbal:'M12 8C0 8 0 15 12 15C24 15 24 8 12 8ZM12 15V23M6 23L12 20L18 23M9 8L10 5H14L15 8M4 3L7 6M20 3L17 6',
};
const INSTRUMENT_SHAPES={picc:'flute',fl:'flute',ob:'oboe',fg:'bassoon',ebcl:'reed',cl:'reed',bcl:'bassclarinet',asax:'sax',tsax:'sax',bsax:'sax',tp:'trumpet',hn:'horn',tb:'trombone',btb:'trombone',euph:'euph',tuba:'tuba',cb:'bass',timp:'timp',sd:'snare',bd:'drum',cym:'cymbal'};
function instrumentIcon(inst){
 const line=INSTRUMENT_LINES[INSTRUMENT_SHAPES[inst]];if(!line)return '';
 return `<svg class="instrument-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${line}"/></svg>`;
}
const instrumentPaths=new Map();
function drawInstrument(g,inst,x,y,size,color){
 const shape=INSTRUMENT_SHAPES[inst];if(!shape)return false;
 if(!instrumentPaths.has(shape))instrumentPaths.set(shape,new Path2D(INSTRUMENT_LINES[shape]));
 g.save();g.translate(x-size/2,y-size/2);g.scale(size/24,size/24);
 g.strokeStyle=color;g.lineWidth=1.9;g.lineCap='round';g.lineJoin='round';g.stroke(instrumentPaths.get(shape));g.restore();return true;
}
