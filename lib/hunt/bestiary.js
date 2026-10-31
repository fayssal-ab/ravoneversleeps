/* eslint-disable */
// "The Reaping · Hunt" bestiary, ported as-is from Ravo's prototype: tiers,
// monsters (looks, slot, ability, line), Endbosses, the secret Seraph,
// abilities and curses, plus the SVG portrait generator (pure strings, no DOM).
// Shared by the server rules (lib/hunt/engine.ts) and the browser views.
// Ability `f` functions are the prototype's; the server applies its own
// copies with crypto randomness (engine.ts), the browser only reads names.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (v) => (v === Infinity ? "$∞" : "$" + (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const C={green:'#8cff4a',gold:'#f5c95a',orange:'#ff8a3d',violet:'#b36bff',red:'#ff5a5a'};
const HUNT=[
  {id:'Minion',w:45,c:C.green,roman:'I',prices:[20,40,50,80,100],eff:0,pool:[],head:'A Minion Crawls Out',roster:[
    {n:'Nibbles the Grave Rat',t:'Gnaws on loose coins',l:'Squeak. Gimme your balance.',s:'Big Bass Bonanza',
      head:'round',w:22,h:22,skin:'#8d8389',top:'rat',eyes:'beady',eye:'#ff4d4d',es:8,ey:56,mouth:'buck',my:68,robe:'#2a2228',x:['whiskers','coins']},
    {n:'Candle Acolyte',t:'Lowest rank of the Cult',l:'I was told to scare you. Is it working?',s:'Book of Dead',
      head:'hood',hood:'#4a3322',eyes:'glow',eye:'#ffcf5a',k:.7,es:7,ey:58,mouth:'none',x:['candle']},
    {n:'Lantern Imp',t:'Giggles at every dead spin',l:'Hehe. Another 0.2x? Hehe.',s:'Fire Joker',
      head:'round',w:22,h:21,ey:57,skin:'#d9483a',top:'horns',horn:'#3a1a10',eyes:'slits',eye:'#ffe14a',es:9,mouth:'grin',my:69,robe:'#3a1210',x:['lantern']},
    {n:'Crypt Moth',t:'Drawn to bonus lights',l:'Ooh, shiny bonus. Mine.',s:'Starburst',
      head:'round',w:20,h:22,skin:'#cdbf9e',top:'antenna',eyes:'compound',eye:'#ffcf5a',es:9,ey:56,mouth:'none',robe:'#5a4a33',wing:'#7d6a4a',x:['wings','fuzz']},
    {n:'Bone Pup',t:'The Cult’s loyal fetcher',l:'Woof. Fetch the multiplier.',s:'The Dog House',
      head:'skull',skin:'#e6dccb',top:'dog',ear:'#6b5a48',eyes:'hollow',eye:'#8cff4a',mouth:'tongue',my:77,robe:'#2a2a24',x:['dogcollar']},
    {n:'Pumpkin Grub',t:'Hatched on Halloween night',l:'Smash me if you can.',s:'Sweet Bonanza',
      head:'pumpkin',eyes:'triangle',eye:'#ffe14a',ey:56,es:11,mouth:'jagged',my:70,robe:'#2b3a1a'},
    {n:'Rusty Coin Ghoul',t:'Collects your lost bets',l:'I keep every coin you lose.',s:'Gems Bonanza',
      head:'ghost',skin:'#a9b8a2',eyes:'hollow',eye:'#8cff4a',mouth:'o',my:70,nobody:true,x:['coins']},
    {n:'Choirboy of Ash',t:'Sings while you lose',l:'La la la, the reels are cursed.',s:'Sugar Rush',
      head:'round',skin:'#b9b3ad',top:'halo',haloC:'#8f8983',crack:true,eyes:'closed',mouth:'o',my:69,robe:'#7a2a2a',x:['collar','ash']}
  ]},
  {id:'Brute',w:30,c:C.gold,roman:'II',prices:[100,150,200,250,300],eff:0,pool:[],head:'A Brute Breaks In',roster:[
    {n:'Mother Rot',t:'Keeper of the spoiled stash',l:'Everything you win goes sour.',s:'Fruit Party',
      head:'round',w:26,h:27,skin:'#7f9a52',top:'shawl',eyes:'three',eye:'#d4ff3a',mouth:'stitched',robe:'#3a2e1e',x:['drips','flies']},
    {n:'The Grave Banker',t:'Hands out loans in bones',l:'Your credit is dead. Like you, soon.',s:'Gates of Olympus',
      head:'skull',skin:'#e9e0cf',top:'tophat',eyes:'hollow',eye:'#f5c95a',mouth:'skulljaw',robe:'#16121a',x:['shirt','bowtie','monocle','coins']},
    {n:'Iron Deacon',t:'Chains every winner',l:'Kneel and spin.',s:'Wild West Gold',
      head:'helmet',eye:'#ff4d4d',robe:'#2a2d33',x:['chains','cross']},
    {n:'The Stitched Twins',t:'Two bodies, one bankroll',l:'We split your soul fifty-fifty.',s:'Reactoonz',
      head:'twins',skin:'#c9a48e',skin2:'#9db0a0',eye:'#ff8a3d',robe:'#3a2a3a'},
    {n:'Sister Hex',t:'Curses scatter symbols',l:'Three scatters? Not tonight.',s:'Madame Destiny Megaways',
      head:'round',w:23,h:25,skin:'#b8a3c9',top:'witch',eyes:'slits',eye:'#8cff4a',mouth:'smirk',robe:'#2a1438',x:['hair','stars']},
    {n:'Butcher of Reels',t:'Chops bonuses in half',l:'Bring the meat to my table.',s:'Razor Shark',
      head:'round',w:28,h:26,skin:'#d9907a',eyes:'angry',eye:'#ff4d4d',es:11,mouth:'fangs',robe:'#4a2420',x:['scar','apron','cleaver']}
  ]},
  {id:'Warlord',w:18,c:C.orange,roman:'III',prices:[300,400,500,600,800],eff:.5,pool:['x2','x2','curse'],head:'A Warlord Has Risen',roster:[
    {n:'The Hollow Priest',t:'Speaks for the Cult',l:'The Cult demands a sacrifice.',s:'Wanted Dead or a Wild',
      head:'hood',hood:'#2a1a12',top:'mitre',eyes:'hollow',k:.75,es:8,ey:58,eye:'#ff8a3d',mouth:'none',x:['cross']},
    {n:'The Pale Croupier',t:'Deals only losing hands',l:'Place your bets. All of them.',s:'Chaos Crew',
      head:'round',w:22,h:27,skin:'#e8e4dc',top:'slick',eyes:'slits',eye:'#ff5a5a',mouth:'widegrin',robe:'#141014',x:['shirt','bowtie','cards']},
    {n:'Bonecaller',t:'Raises the dead spins',l:'Every dead spin rises for me.',s:'Tombstone R.I.P.',
      head:'skull',skin:'#d8ccb4',top:'horns',horn:'#1e1410',eyes:'hollow',eye:'#8cff4a',mouth:'skulljaw',robe:'#1f2a1a',x:['staff','bones']},
    {n:'Widow of Reels',t:'Married to the house edge',l:'I buried three champions this year.',s:'Dead Canary',
      head:'round',w:22,h:27,skin:'#d8d2d8',top:'veil',eyes:'glow',eye:'#ff3a5a',k:.8,mouth:'none',robe:'#120c14',x:['lace']},
    {n:'Father Ash',t:'Burns your bonus buys',l:'Ashes to ashes, bonus to dust.',s:'Fire in the Hole',
      head:'flame',eyes:'hollow',eye:'#fff4d6',ey:60,es:8,mouth:'grin',my:74,robe:'#2a1a14',x:['embers']}
  ]},
  {id:'Overlord',w:7,c:C.violet,roman:'IV',prices:[800,1000,1200,1500],eff:.75,pool:['x2','x3','x3','leech','curse'],head:'The Overlord Wakes',roster:[
    {n:'Saint Nothing',t:'The empty god of 0x',l:'Kneel before nothing.',s:'Mental',
      head:'void',top:'halo',haloC:'#b36bff',eyes:'none',mouth:'none',robe:'#0e0a14',x:['rays']},
    {n:'The Ninth Hand',t:'Pulls every lever at once',l:'I have spun since before you were born.',s:'San Quentin',
      head:'hood',hood:'#1a1024',eyes:'many',eye:'#b36bff',k:.75,mouth:'none',x:['hands']},
    {n:'The Last Spin',t:'Arrives when the balance hits zero',l:'This is your final spin.',s:'Deadwood',
      head:'hood',inner:'skull',hood:'#141018',eye:'#b36bff',x:['scythe','hourglass']},
    {n:'The Drowned Captain',t:'Sank with the whole bankroll',l:'Your bonus sleeps with the fishes.',s:'Das xBoot',
      head:'round',w:24,h:26,skin:'#5f8f8a',skin2:'#3f6f6a',top:'captain',eyes:'hollow',eye:'#4af0ff',mouth:'tentacles',robe:'#1a2430',x:['bubbles']}
  ]}
];
const BOSS=[
  {id:'Doom',min:150,max:250,w:35,c:C.gold},
  {id:'Ruin',min:251,max:400,w:35,c:C.orange},
  {id:'Apocalypse',min:401,max:700,w:22,c:C.red},
  {id:'Oblivion',min:701,max:1000,w:8,c:C.violet}
];
const ENDBOSSES=[
  {n:'The Cult Mother',t:'Head of the CULT itself',l:'You fought so well, child. Now come home.',s:'Tombstone Slaughter: El Gordo\'s Revenge',
    head:'tall',skin:'#d9c9e0',top:'crown',eyes:'many',eye:'#b36bff',mouth:'none',robe:'#2a0f3a',x:['veilback','rays']},
  {n:'The Reaper King',t:'Collects every champion',l:'Your crown is borrowed. I came to take it back.',s:'San Quentin 2: Death Row',
    head:'hood',inner:'skull',top:'crown',hood:'#0e0b10',eye:'#ff5a5a',x:['scythe']},
  {n:'The Hundred-Eyed Dealer',t:'Saw every spin you ever made',l:'I know how this ends. Deal.',s:'Mental 2',
    head:'round',w:27,h:28,skin:'#3a2a44',top:'tophat',eyes:'many',eye:'#ff5a5a',mouth:'widegrin',robe:'#120c16',x:['hands','shirt','bowtie','cards']}
];
function prep(tiers){const tot=tiers.reduce((a,t)=>a+t.w,0);let a=0;tiers.forEach(t=>{t.start=a;t.deg=t.w/tot*360;a+=t.deg;});}
prep(HUNT);prep(BOSS);

function eyesSvg(c){
  const e=c.eye||'#ff4d4d',ey=c.ey||54,es=c.es||10,k=c.k||1,L=60-es,R=60+es;
  const pair=f=>f(L,-1)+f(R,1);
  switch(c.eyes){
    case 'glow':return pair(x=>`<circle cx="${x}" cy="${ey}" r="${7*k}" fill="${e}" opacity=".25"/><circle cx="${x}" cy="${ey}" r="${4*k}" fill="${e}"/><circle cx="${x-1}" cy="${ey-1}" r="${1.4*k}" fill="#fff"/>`);
    case 'hollow':return pair(x=>`<ellipse cx="${x}" cy="${ey}" rx="${7*k}" ry="${8*k}" fill="#0a0606"/><circle cx="${x}" cy="${ey}" r="${5*k}" fill="${e}" opacity=".25"/><circle cx="${x}" cy="${ey}" r="${2.3*k}" fill="${e}"/>`);
    case 'beady':return pair(x=>`<circle cx="${x}" cy="${ey}" r="${4.5*k}" fill="${e}" opacity=".25"/><circle cx="${x}" cy="${ey}" r="${3*k}" fill="${e}"/><circle cx="${x-1}" cy="${ey-1}" r="1" fill="#fff"/>`);
    case 'slits':return pair(x=>`<ellipse cx="${x}" cy="${ey}" rx="${6.5*k}" ry="${3.8*k}" fill="${e}"/><ellipse cx="${x}" cy="${ey}" rx="${1.3*k}" ry="${3.6*k}" fill="#000"/>`);
    case 'compound':return pair(x=>`<ellipse cx="${x}" cy="${ey}" rx="8" ry="9.5" fill="#1a1012"/><ellipse cx="${x}" cy="${ey}" rx="8" ry="9.5" fill="none" stroke="${e}" stroke-opacity=".45" stroke-width="1.2"/><ellipse cx="${x-2}" cy="${ey-3}" rx="2.4" ry="3" fill="#fff" opacity=".55"/>`);
    case 'closed':return pair(x=>`<path d="M${x-6} ${ey} Q${x} ${ey+5} ${x+6} ${ey}" stroke="#2a1a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    case 'triangle':return pair(x=>`<path d="M${x-9} ${ey+6} L${x} ${ey-8} L${x+9} ${ey+6} Z" fill="${e}" opacity=".3" transform="scale(1.15) translate(${-x*0.13} ${-ey*0.13})"/><path d="M${x-8} ${ey+5} L${x} ${ey-7} L${x+8} ${ey+5} Z" fill="${e}"/>`);
    case 'three':return pair(x=>`<circle cx="${x}" cy="${ey+2}" r="6" fill="${e}" opacity=".25"/><circle cx="${x}" cy="${ey+2}" r="3.5" fill="${e}"/>`)+`<circle cx="60" cy="${ey-9}" r="5" fill="${e}" opacity=".25"/><circle cx="60" cy="${ey-9}" r="3" fill="${e}"/><circle cx="60" cy="${ey-9}" r="1" fill="#000"/>`;
    case 'angry':return pair((x,d)=>`<circle cx="${x}" cy="${ey}" r="6" fill="${e}" opacity=".25"/><circle cx="${x}" cy="${ey}" r="3.4" fill="${e}"/><path d="M${x-7*d} ${ey-10} L${x+6*d} ${ey-5}" stroke="#2a0e0a" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'many':{const P=[[48,48,4.2],[72,48,4.2],[60,40,3.6],[42,60,3.2],[78,60,3.2],[54,60,3.4],[66,60,3.4],[60,30,2.8],[48,36,2.6],[72,36,2.6],[60,70,2.6]];
      return P.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r*k+1.6}" fill="${e}" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r*k}" fill="#f6eefa"/><circle cx="${x}" cy="${y}" r="${r*k*.55}" fill="${e}"/>`).join('');}
    default:return '';
  }
}
function mouthSvg(c){
  const my=c.my||71,D='#140808';
  switch(c.mouth){
    case 'grin':return `<path d="M47 ${my-2} Q60 ${my+9} 73 ${my-2} Q60 ${my+3} 47 ${my-2}Z" fill="${D}"/><path d="M50 ${my} L52 ${my+3} L55 ${my+1} L57 ${my+4} L60 ${my+2} L63 ${my+4} L65 ${my+1} L68 ${my+3} L70 ${my}" stroke="#fff" stroke-width="1.1" fill="none"/>`;
    case 'widegrin':return `<path d="M40 ${my-4} Q60 ${my+16} 80 ${my-4} Q60 ${my+5} 40 ${my-4}Z" fill="${D}"/><path d="M43 ${my-2} L46 ${my+3} L49 ${my} L52 ${my+5} L56 ${my+2} L60 ${my+6} L64 ${my+2} L68 ${my+5} L71 ${my} L74 ${my+3} L77 ${my-2}" stroke="#fff" stroke-width="1.2" fill="none"/>`;
    case 'fangs':return `<path d="M48 ${my} Q60 ${my+6} 72 ${my}" stroke="${D}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M52 ${my+1.5} l2.2 7 l2.2 -6Z M63.6 ${my+2.5} l2.2 6 l2.2 -7Z" fill="#fff"/>`;
    case 'stitched':return `<path d="M47 ${my} H73" stroke="${D}" stroke-width="2.2"/><path d="M50 ${my-3} V${my+3} M55 ${my-3} V${my+3} M60 ${my-3} V${my+3} M65 ${my-3} V${my+3} M70 ${my-3} V${my+3}" stroke="${D}" stroke-width="1.5"/>`;
    case 'jagged':return `<path d="M40 ${my} L47 ${my+6} L53 ${my} L60 ${my+7} L67 ${my} L73 ${my+6} L80 ${my} Q60 ${my+20} 40 ${my}Z" fill="${c.eye}"/>`;
    case 'o':return `<ellipse cx="60" cy="${my}" rx="5" ry="6.5" fill="${D}"/>`;
    case 'buck':return `<ellipse cx="60" cy="${my-6}" rx="4" ry="3" fill="#d98a9a"/><path d="M53 ${my} Q60 ${my+3} 67 ${my}" stroke="${D}" stroke-width="2" fill="none"/><rect x="56.5" y="${my+1}" width="3.2" height="5" rx=".6" fill="#fff"/><rect x="60.3" y="${my+1}" width="3.2" height="5" rx=".6" fill="#fff"/>`;
    case 'tongue':return `<path d="M50 ${my} Q60 ${my+5} 70 ${my}" stroke="${D}" stroke-width="2.4" fill="none"/><path d="M56 ${my+2} Q60 ${my+14} 64 ${my+2}Z" fill="#e85a7a"/>`;
    case 'smirk':return `<path d="M50 ${my+1} Q62 ${my+5} 71 ${my-4}" stroke="${D}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case 'tentacles':return `<g stroke="${c.skin2}" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M47 ${my-2} Q44 ${my+14} 38 ${my+20}"/><path d="M53 ${my} Q53 ${my+16} 48 ${my+24}"/><path d="M60 ${my} Q60 ${my+18} 60 ${my+27}"/><path d="M67 ${my} Q67 ${my+16} 72 ${my+24}"/><path d="M73 ${my-2} Q76 ${my+14} 82 ${my+20}"/></g>`;
    case 'skulljaw':return `<path d="M47 77 V84 M52.5 77 V84 M58 77 V84 M63.5 77 V84 M69 77 V84 M74 77 V83" stroke="#140c0c" stroke-width="1.6"/><path d="M45 77 H75" stroke="#140c0c" stroke-width="1.6"/>`;
    default:return '';
  }
}
function portrait(c,tc,size){
  if(c.head==='angel')return angelSvg(size,c);
  const s=c.skin||'#cfc6b8',e=c.eye||'#ff4d4d',robe=c.hood||c.robe||'#1d1620';
  const has=x=>(c.x||[]).includes(x);
  let o=`<svg class="pt" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${esc(c.n)}" data-anim="${c.anim||'bob'}">`;
  o+=`<rect width="120" height="120" fill="#0b0d0b"/><circle cx="60" cy="56" r="54" fill="${tc}" opacity=".08"/><circle cx="60" cy="56" r="40" fill="${tc}" opacity=".12"/>`;
  /* back layer */
  o+='<g class="g-back">';
  if(has('legs'))o+=`<g stroke="#4a3a32" stroke-width="3" fill="none" stroke-linecap="round"><path d="M48 58 Q30 42 18 50"/><path d="M46 62 Q26 56 12 64"/><path d="M46 66 Q26 72 14 82"/><path d="M48 70 Q34 86 24 96"/><path d="M72 58 Q90 42 102 50"/><path d="M74 62 Q94 56 108 64"/><path d="M74 66 Q94 72 106 82"/><path d="M72 70 Q86 86 96 96"/></g>`;
  if(has('rays'))o+=`<g stroke="${tc}" stroke-opacity=".35" stroke-width="2">${[...Array(12)].map((_,i)=>{const a=i*30*Math.PI/180;return `<path d="M${60+Math.cos(a)*30} ${52+Math.sin(a)*30} L${60+Math.cos(a)*58} ${52+Math.sin(a)*58}"/>`;}).join('')}</g>`;
  if(has('veilback'))o+=`<path d="M28 40 Q26 96 10 120 H110 Q94 96 92 40 Z" fill="#3a1450"/>`;
  if(has('wings'))o+=`<path d="M54 64 Q22 16 6 38 Q2 72 50 76 Z" fill="${c.wing}"/><path d="M66 64 Q98 16 114 38 Q118 72 70 76 Z" fill="${c.wing}"/><circle cx="25" cy="46" r="7" fill="${e}" opacity=".8"/><circle cx="95" cy="46" r="7" fill="${e}" opacity=".8"/><circle cx="25" cy="46" r="3" fill="#1a1012"/><circle cx="95" cy="46" r="3" fill="#1a1012"/>`;
  if(has('scythe'))o+=`<path d="M100 120 L93 18" stroke="#4a3020" stroke-width="4" stroke-linecap="round"/><path d="M93 18 Q58 2 24 30 Q58 16 91 34 Z" fill="#c9ced4"/><path d="M93 18 Q58 2 24 30" stroke="#fff" stroke-opacity=".5" stroke-width="1" fill="none"/>`;
  if(has('staff'))o+=`<path d="M102 120 L97 30" stroke="#4a3020" stroke-width="4" stroke-linecap="round"/><circle cx="97" cy="25" r="9" fill="${e}" opacity=".3"/><circle cx="97" cy="25" r="5" fill="${e}"/>`;
  if(has('hands'))o+=`<g fill="${c.head==='hood'?'#cdb8e6':s}" stroke="#0b0d0b" stroke-width="1">${[[16,30,-30],[104,30,30],[10,70,-60],[110,70,60]].map(([x,y,r])=>`<g transform="rotate(${r} ${x} ${y})"><rect x="${x-2.5}" y="${y+6}" width="5" height="34" rx="2.5" opacity=".85"/><ellipse cx="${x}" cy="${y+4}" rx="6" ry="7"/><rect x="${x-6}" y="${y-8}" width="2.6" height="9" rx="1.3"/><rect x="${x-2.6}" y="${y-10}" width="2.6" height="10" rx="1.3"/><rect x="${x+.8}" y="${y-9}" width="2.6" height="9" rx="1.3"/><rect x="${x+4}" y="${y-6}" width="2.6" height="8" rx="1.3"/></g>`).join('')}</g>`;
  if(has('hair'))o+=`<path d="M34 48 Q28 96 20 108 H100 Q92 96 86 48 Q60 26 34 48Z" fill="#1a0f22"/>`;
  if(c.top==='shawl')o+=`<path d="M28 62 Q26 22 60 20 Q94 22 92 62 L98 104 Q60 92 22 104 Z" fill="#3a2e1e"/><path d="M28 62 Q26 22 60 20 Q94 22 92 62" stroke="#5a4a30" stroke-width="2" fill="none"/>`;
  if(c.top==='rat')o+=`<circle cx="38" cy="36" r="11" fill="${s}"/><circle cx="38" cy="36" r="6" fill="#d98a9a"/><circle cx="82" cy="36" r="11" fill="${s}"/><circle cx="82" cy="36" r="6" fill="#d98a9a"/>`;
  if(c.top==='horns')o+=`<path d="M42 40 Q28 28 32 8 Q40 26 52 33 Z" fill="${c.horn}"/><path d="M78 40 Q92 28 88 8 Q80 26 68 33 Z" fill="${c.horn}"/>`;
  if(c.top==='antenna')o+=`<path d="M53 37 Q46 20 34 14 M67 37 Q74 20 86 14" stroke="${s}" stroke-width="2.5" fill="none"/><circle cx="34" cy="14" r="4" fill="${e}"/><circle cx="86" cy="14" r="4" fill="${e}"/>`;
  o+='</g><g class="g-body">';
  /* body */
  if(!c.nobody)o+=`<path d="M12 120 Q16 90 60 85 Q104 90 108 120 Z" fill="${robe}"/><path d="M12 120 Q16 90 60 85 Q104 90 108 120" stroke="#000" stroke-opacity=".35" stroke-width="2" fill="none"/>`;
  if(has('apron'))o+=`<path d="M40 92 Q60 88 80 92 V120 H40 Z" fill="#e3d9c6"/><circle cx="52" cy="104" r="4" fill="#a0302a" opacity=".8"/><circle cx="67" cy="112" r="2.5" fill="#a0302a" opacity=".7"/>`;
  if(has('shirt'))o+=`<path d="M47 88 L60 108 L73 88 Z" fill="#ece6da"/>`;
  if(has('collar'))o+=`<path d="M40 89 Q60 104 80 89 Q60 97 40 89Z" fill="#ece6da"/>`;
  if(has('fuzz'))o+=[38,46,54,62,70,78,82].map((x,i)=>`<circle cx="${x}" cy="${88+(i%2)*2}" r="6" fill="#e3d6b6"/>`).join('');
  if(has('lace'))o+=`<path d="M44 88 Q60 100 76 88" stroke="#4a3a50" stroke-width="2" fill="none" stroke-dasharray="2 2"/>`;
  o+='</g><g class="g-head">';
  /* head */
  switch(c.head){
    case 'round':o+=`<ellipse cx="60" cy="57" rx="${c.w||25}" ry="${c.h||27}" fill="${s}"/><path d="M${60-(c.w||25)+4} 64 Q60 ${57+(c.h||27)+8} ${60+(c.w||25)-4} 64 Q60 ${57+(c.h||27)-6} ${60-(c.w||25)+4} 64Z" fill="#000" opacity=".14"/>`;break;
    case 'skull':o+=`<path d="M34 56 A26 26 0 1 1 86 56 V64 Q86 72 78 74 V85 H42 V74 Q34 72 34 64 Z" fill="${s}"/><path d="M60 63 L55.5 70.5 H64.5 Z" fill="#140c0c"/><path d="M38 64 Q36 50 44 40" stroke="#000" stroke-opacity=".15" stroke-width="3" fill="none"/>`;break;
    case 'hood':o+=`<path d="M60 14 Q97 18 98 72 L101 106 Q60 94 19 106 L22 72 Q23 18 60 14 Z" fill="${robe}"/><path d="M60 14 Q97 18 98 72 L101 106" stroke="#fff" stroke-opacity=".08" stroke-width="2" fill="none"/><path d="M60 30 Q81 32 81 62 Q81 86 60 88 Q39 86 39 62 Q39 32 60 30 Z" fill="#050405"/>`;
      if(c.inner==='skull')o+=`<path d="M46 58 A14 14 0 1 1 74 58 V64 Q74 68 69 69 V76 H51 V69 Q46 68 46 64 Z" fill="#e3d9c6"/><ellipse cx="54" cy="58" rx="3.8" ry="4.4" fill="#0a0606"/><ellipse cx="66" cy="58" rx="3.8" ry="4.4" fill="#0a0606"/><circle cx="54" cy="58" r="1.6" fill="${e}"/><circle cx="66" cy="58" r="1.6" fill="${e}"/><circle cx="54" cy="58" r="3.4" fill="${e}" opacity=".3"/><circle cx="66" cy="58" r="3.4" fill="${e}" opacity=".3"/><path d="M60 62 L58 66 H62Z" fill="#0a0606"/><path d="M54 70 V75 M58 70 V75 M62 70 V75 M66 70 V75" stroke="#0a0606" stroke-width="1.2"/>`;
      break;
    case 'pumpkin':o+=`<ellipse cx="43" cy="60" rx="17" ry="25" fill="#c85f17"/><ellipse cx="77" cy="60" rx="17" ry="25" fill="#c85f17"/><ellipse cx="60" cy="60" rx="20" ry="27" fill="#ef862a"/><path d="M52 36 Q50 60 52 86 M68 36 Q70 60 68 86" stroke="#b2520f" stroke-width="2" fill="none"/><path d="M57 35 Q56 26 62 21 L66 24 Q61 28 63 35 Z" fill="#4a7a2a"/><path d="M63 26 Q74 20 78 28" stroke="#4a7a2a" stroke-width="2" fill="none"/>`;break;
    case 'ghost':o+=`<path d="M33 96 V54 A27 27 0 0 1 87 54 V96 L80.25 90 L73.5 96 L66.75 90 L60 96 L53.25 90 L46.5 96 L39.75 90 Z" fill="${s}" opacity=".93"/><path d="M33 96 V54 A27 27 0 0 1 60 27" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none"/>`;break;
    case 'tall':o+=`<rect x="36" y="22" width="48" height="68" rx="22" fill="${s}"/><path d="M38 70 Q60 96 82 70 V76 Q60 98 38 76Z" fill="#000" opacity=".12"/>`;break;
    case 'helmet':o+=`<path d="M35 42 Q35 20 60 18 Q85 20 85 42 V80 Q60 92 35 80 Z" fill="#666d76"/><path d="M60 18 V46" stroke="#8a929c" stroke-width="4"/><rect x="39" y="47" width="42" height="9" rx="2" fill="#0b0b0b"/><circle cx="51" cy="51.5" r="5" fill="${e}" opacity=".3"/><circle cx="69" cy="51.5" r="5" fill="${e}" opacity=".3"/><circle cx="51" cy="51.5" r="2.4" fill="${e}"/><circle cx="69" cy="51.5" r="2.4" fill="${e}"/><g fill="#3a3f46">${[64,70,76].map(y=>`<rect x="44" y="${y}" width="32" height="2.4" rx="1.2"/>`).join('')}</g><circle cx="38" cy="42" r="2" fill="#8a929c"/><circle cx="82" cy="42" r="2" fill="#8a929c"/>`;break;
    case 'flame':o+=`<path d="M60 10 C72 28 92 36 87 64 C84 84 72 94 60 94 C48 94 36 84 33 64 C30 44 46 38 49 22 C54 32 58 32 60 10 Z" fill="#ff6a1a"/><path d="M60 30 C68 44 79 50 77 68 C75 82 68 88 60 88 C52 88 44 82 43 68 C42 54 54 50 60 30 Z" fill="#ffb03a"/><path d="M60 52 C64 60 69 64 68 72 C67 80 64 82 60 82 C56 82 53 80 52 72 C51 64 57 60 60 52Z" fill="#ffe27a"/>`;break;
    case 'void':o+=`<circle cx="60" cy="56" r="29" fill="#050307"/><circle cx="60" cy="56" r="29" fill="none" stroke="${tc}" stroke-width="2.5"/><circle cx="60" cy="56" r="13" fill="none" stroke="${tc}" stroke-width="4" opacity=".85"/><circle cx="60" cy="56" r="20" fill="none" stroke="${tc}" stroke-width="1" opacity=".4" stroke-dasharray="3 4"/>`;break;
    case 'twins':{const s2=c.skin2;o+=`<ellipse cx="43" cy="60" rx="19" ry="22" fill="${s}"/><ellipse cx="77" cy="60" rx="19" ry="22" fill="${s2}"/><path d="M60 42 V80" stroke="#2a1a1a" stroke-width="1.6"/><path d="M57 46 L63 50 M57 54 L63 58 M57 62 L63 66 M57 70 L63 74" stroke="#2a1a1a" stroke-width="1.4"/><circle cx="37" cy="57" r="4.5" fill="${e}" opacity=".3"/><circle cx="37" cy="57" r="2.6" fill="${e}"/><circle cx="49" cy="57" r="2.6" fill="${e}"/><ellipse cx="71" cy="57" rx="4" ry="4.4" fill="#0a0606"/><circle cx="71" cy="57" r="1.6" fill="${e}"/><circle cx="83" cy="57" r="3.4" fill="${e}"/><path d="M36 69 Q43 74 50 69" stroke="#140808" stroke-width="2.2" fill="none"/><path d="M70 71 H84" stroke="#140808" stroke-width="2"/><path d="M73 68 V74 M77 68 V74 M81 68 V74" stroke="#140808" stroke-width="1.3"/><path d="M30 46 L36 50 M90 48 L84 52" stroke="#2a1a1a" stroke-width="1.3"/>`;}break;
  }
  if(has('scar'))o+=`<path d="M70 36 L80 56 M72 42 L77 40 M74 48 L79 46" stroke="#7a3a30" stroke-width="2" fill="none"/>`;
  /* top items after head */
  if(c.top==='dog')o+=`<path d="M37 38 Q20 40 22 68 Q33 68 40 52 Z" fill="${c.ear}"/><path d="M83 38 Q100 40 98 68 Q87 68 80 52 Z" fill="${c.ear}"/>`;
  if(c.top==='slick')o+=`<path d="M37 50 Q36 28 60 29 Q84 28 83 50 Q74 37 58 39 Q46 40 37 50Z" fill="#141014"/><path d="M50 33 Q62 31 76 38" stroke="#3a3440" stroke-width="1.4" fill="none"/>`;
  if(c.top==='tophat'){const y=c.head==='skull'?4:3;o+=`<rect x="42" y="${y}" width="36" height="26" rx="2" fill="#141014"/><rect x="42" y="${y+18}" width="36" height="5" fill="${tc}"/><rect x="31" y="${y+26}" width="58" height="6" rx="3" fill="#141014"/>`;}
  if(c.top==='witch')o+=`<path d="M38 38 Q50 24 56 2 Q62 14 84 38 Z" fill="#1c1024"/><path d="M22 40 Q60 30 98 40 L94 45 Q60 36 26 45 Z" fill="#1c1024"/><path d="M40 35 Q60 31 80 35 L79 39 Q60 35 41 39Z" fill="${tc}"/>`;
  if(c.top==='mitre')o+=`<path d="M45 34 V20 Q52 8 60 2 Q68 8 75 20 V34 Q60 30 45 34 Z" fill="#e9dfc8"/><path d="M60 8 V30 M53 16 H67" stroke="${tc}" stroke-width="3"/>`;
  if(c.top==='captain')o+=`<path d="M33 36 Q60 12 87 36 Z" fill="#1a2430"/><rect x="31" y="34" width="58" height="6" rx="3" fill="#0e151d"/><circle cx="60" cy="28" r="4" fill="#f5c95a"/><path d="M45 34 Q60 30 75 34" stroke="#f5c95a" stroke-width="1.2" fill="none"/>`;
  if(c.top==='crown'){const y=c.head==='hood'?-2:0;o+=`<path d="M40 ${34+y} L42 ${14+y} L51 ${25+y} L60 ${8+y} L69 ${25+y} L78 ${14+y} L80 ${34+y} Z" fill="#f5c95a" stroke="#7a5a12" stroke-width="1.5"/><circle cx="60" cy="${27+y}" r="3" fill="${e}"/><circle cx="48" cy="${29+y}" r="2" fill="${e}"/><circle cx="72" cy="${29+y}" r="2" fill="${e}"/>`;}
  if(c.top==='halo')o+=`<ellipse cx="60" cy="${c.head==='void'?18:24}" rx="24" ry="6" fill="none" stroke="${c.haloC}" stroke-width="3" ${c.crack?'stroke-dasharray="20 5 30 4"':''}/>`;
  /* face */
  if(c.head!=='twins'&&c.eyes&&c.eyes!=='none'&&!(c.head==='hood'&&c.inner))o+='<g class="g-eyes">'+eyesSvg(c)+'</g>';
  o+=mouthSvg(c);
  if(c.top==='veil')o+=`<path d="M28 42 Q60 12 92 42 L95 98 Q60 86 25 98 Z" fill="#000" opacity=".5"/><path d="M28 42 Q60 12 92 42" stroke="#2a1a2e" stroke-width="2" fill="none"/><ellipse cx="60" cy="33" rx="30" ry="6" fill="#0a070b"/><path d="M44 33 Q46 18 60 18 Q74 18 76 33Z" fill="#0a070b"/><circle cx="74" cy="26" r="4" fill="#5a1a2a"/>`+eyesSvg({...c,k:.55});
  o+='</g><g class="g-front">';
  /* front extras */
  if(has('whiskers'))o+=`<path d="M48 63 H28 M48 66 L30 72 M72 63 H92 M72 66 L90 72" stroke="#ddd" stroke-width="1" opacity=".8"/>`;
  if(has('coins'))o+=[104,98,92].map(y=>`<ellipse cx="22" cy="${y}" rx="11" ry="4.2" fill="#f5c95a" stroke="#8a6a1a" stroke-width="1.2"/>`).join('');
  if(has('candle'))o+=`<circle cx="91" cy="74" r="12" fill="#ffcf5a" opacity=".2"/><rect x="86" y="82" width="10" height="24" rx="2" fill="#e9dfc8"/><path d="M91 69 Q98 77 91 81 Q84 77 91 69Z" fill="#ffcf5a"/>`;
  if(has('lantern'))o+=`<path d="M93 70 V74" stroke="#8a6a3a" stroke-width="2"/><circle cx="93" cy="88" r="14" fill="#ffcf5a" opacity=".18"/><rect x="85" y="76" width="16" height="22" rx="3" fill="#ffcf5a" stroke="#5a3a1a" stroke-width="2.5"/><path d="M85 84 H101 M85 90 H101" stroke="#5a3a1a" stroke-width="1.5"/>`;
  if(has('dogcollar'))o+=`<path d="M38 87 Q60 96 82 87 L82 92 Q60 101 38 92Z" fill="#c43a3a"/><circle cx="60" cy="100" r="4.5" fill="#f5c95a"/>`;
  if(has('ash'))o+=[[30,40],[88,34],[24,70],[96,64],[40,24],[82,80]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.6" fill="#9a948e"/>`).join('');
  if(has('drips'))o+=`<path d="M46 80 q2.5 9 0 13 q-2.5 -4 0 -13Z M58 83 q2.5 11 0 15 q-2.5 -4 0 -15Z M71 80 q2 7 0 10 q-2 -3 0 -10Z" fill="#a8e33a"/>`;
  if(has('flies'))o+=[[24,30],[94,40],[30,52]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.8" fill="#222"/><path d="M${x-3} ${y-2} L${x} ${y} L${x+3} ${y-2}" stroke="#666" stroke-width=".8" fill="none"/>`).join('');
  if(has('bowtie'))o+=`<path d="M50 90 L60 95 L50 100 Z M70 90 L60 95 L70 100 Z" fill="${tc}"/><circle cx="60" cy="95" r="2.6" fill="${tc}"/>`;
  if(has('monocle'))o+=`<circle cx="70" cy="54" r="9" fill="none" stroke="#f5c95a" stroke-width="2"/><path d="M79 56 Q86 72 80 88" stroke="#f5c95a" fill="none" stroke-width="1"/>`;
  if(has('chains'))o+=`<g fill="none" stroke="#9aa0a8" stroke-width="3">${[0,1,2,3,4,5,6].map(i=>`<ellipse cx="${26+i*11}" cy="${96+i*3.4}" rx="6" ry="3.6" transform="rotate(${i%2?70:18} ${26+i*11} ${96+i*3.4})"/>`).join('')}</g>`;
  if(has('cross'))o+=`<path d="M60 93 V116 M51 100 H69" stroke="${tc}" stroke-width="4" stroke-linecap="round"/>`;
  if(has('stars'))o+=[[22,30,1],[98,52,.8],[26,78,.7],[94,20,.6]].map(([x,y,sc])=>`<path transform="translate(${x} ${y}) scale(${sc})" d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2Z" fill="${tc}"/>`).join('');
  if(has('cleaver'))o+=`<rect x="94" y="80" width="6" height="26" rx="2" fill="#5a3a22"/><path d="M86 56 H112 V78 Q102 84 86 80 Z" fill="#c9ced4"/><circle cx="106" cy="62" r="2" fill="#0b0d0b"/><path d="M88 78 Q100 82 110 78" stroke="#a0302a" stroke-width="2" fill="none"/>`;
  if(has('cards'))o+=`<g transform="rotate(-10 80 100)"><rect x="72" y="88" width="18" height="26" rx="2.5" fill="#f3eaff" stroke="#222" stroke-width=".8"/><path d="M81 96 l3.5 5 l-3.5 5 l-3.5 -5Z" fill="#ff5a5a"/></g><g transform="rotate(12 96 98)"><rect x="88" y="86" width="18" height="26" rx="2.5" fill="#f3eaff" stroke="#222" stroke-width=".8"/><path d="M97 93 q4 5 0 9 q-4 -4 0 -9Z M97 99 v6" stroke="#111" fill="#111"/></g>`;
  if(has('bones'))o+=`<g stroke="#e3d9c6" stroke-width="4" stroke-linecap="round"><path d="M44 116 L76 100"/><path d="M44 100 L76 116"/></g>`;
  if(has('embers'))o+=[[24,40],[96,30],[30,20],[90,70],[20,80]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" fill="#ffb03a"/>`).join('');
  if(has('hourglass'))o+=`<path d="M50 92 H70 L62 103 L70 114 H50 L58 103 Z" fill="${tc}" opacity=".85" stroke="#e9dfc8" stroke-width="2" stroke-linejoin="round"/>`;
  if(has('bubbles'))o+=[[26,40,4],[20,28,2.6],[96,46,3.4],[100,32,2]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#4af0ff" stroke-width="1.2" opacity=".8"/>`).join('');
  return o+'</g></svg>';
}


/* ---------- tiers, slots, abilities ---------- */
Object.assign(HUNT[0],{prices:[20,40,50,80,100,150,200,250],abChance:.25});
Object.assign(HUNT[1],{prices:[300,350,400,450,500],abChance:.35});
Object.assign(HUNT[2],{prices:[500,600,700,800,1000],abChance:.45});
Object.assign(HUNT[3],{prices:[1000,1200,1500,2000],abChance:.6});
const END={id:'Endboss',c:C.red,prices:[3000],abChance:1};
const CURSE_CHANCE=.1;
const PATCH={
  'Nibbles the Grave Rat':['xWays Hoarder xSplit','gnaw','Squeak. Every coin you win, I take a bite.'],
  'Candle Acolyte':['Book of Dead','snuff','If your light is weak, I blow it out.'],
  'Lantern Imp':['Evil Goblins xBomb','prank','Hehe. Wanna see a magic trick?'],
  'Crypt Moth':['The Crypt','flutter','Too close. Too bright. Again!'],
  'Bone Pup':['The Dog House','fetch','Woof. I fetch two. I keep the good one.'],
  'Pumpkin Grub':['Sweet Bonanza','trick','Trick or treat? I decide.'],
  'Rusty Coin Ghoul':['Tombstone','haunt','When it gets close… boo.'],
  'Choirboy of Ash':['Gates of Olympus','hymn','Shhh. Close your eyes and listen.'],
  'Mother Rot':['Infectious 5 xWays','infection','Everything you win goes sour.'],
  'The Grave Banker':['Money Train 3','interest','Your loan comes with interest.'],
  'Iron Deacon':['Folsom Prison','shackles','No one breaks these chains.'],
  'The Stitched Twins':['East Coast vs West Coast','stitched','Two of us. Two bonuses. One of you.'],
  'Sister Hex':['Book of Shadows','hex','No buying, darling. Earn your scatters.'],
  'Butcher of Reels':['Razor Shark','cleave','Hold still. This won’t hurt me.'],
  'The Hollow Priest':['Hand of Anubis','sacrifice','The Cult demands a sacrifice.'],
  'The Pale Croupier':['Le Bandit','house','Close call? The house always wins.'],
  'Bonecaller':['Tombstone R.I.P.','raise','Kill me once. I dare you.'],
  'Widow of Reels':['Immortal Romance','veil','You won’t even see what killed you.'],
  'Father Ash':['Fire in the Hole xBomb','scorch','Small wins burn first.'],
  'Saint Nothing':['Mental','zero','One of us leaves with nothing.'],
  'The Ninth Hand':['San Quentin','ninefold','Nine hands. Three times the grip.'],
  'The Last Spin':['Deadwood','doom','Tick. Tock. Ties are mine.'],
  'The Drowned Captain':['Das xBoot','pull','Your bonus sleeps with the fishes.'],
  'The Cult Mother':['Tombstone Slaughter: El Gordo\'s Revenge','embrace','You fought so well, child. Now come home.'],
  'The Reaper King':['San Quentin 2: Death Row','harvest','Your crown is borrowed. I came to take it back.'],
  'The Hundred-Eyed Dealer':['Mental 2','stacked','I know how this ends. Deal.']
};
[...HUNT.flatMap(t=>t.roster),...ENDBOSSES].forEach(r=>{const p=PATCH[r.n];if(p){r.s=p[0];r.ab=p[1];r.l=p[2];}});
const ANIM={'Nibbles the Grave Rat':'nibble','Candle Acolyte':'flicker','Lantern Imp':'imp','Crypt Moth':'flap','Bone Pup':'wag','Pumpkin Grub':'glow','Rusty Coin Ghoul':'float','Choirboy of Ash':'sing',
  'Mother Rot':'ooze','The Grave Banker':'tip','Iron Deacon':'rattle','The Stitched Twins':'twins','Sister Hex':'sparkle','Butcher of Reels':'chop',
  'The Hollow Priest':'pray','The Pale Croupier':'deal','Bonecaller':'summon','Widow of Reels':'veil','Father Ash':'burn',
  'Saint Nothing':'void','The Ninth Hand':'grab','The Last Spin':'reap','The Drowned Captain':'sway',
  'The Cult Mother':'gaze','The Reaper King':'reap','The Hundred-Eyed Dealer':'deal'};
[...HUNT.flatMap(t=>t.roster),...ENDBOSSES].forEach(r=>{r.anim=ANIM[r.n]||'bob';});
/* bounty = prize multiplier a player earns for slaying it (the highest one counts) */
HUNT[0].bounty=1;HUNT[1].bounty=2;HUNT[2].bounty=3;HUNT[3].bounty=5;
const EB_BOUNTY={'The Cult Mother':10,'The Hundred-Eyed Dealer':10,'The Reaper King':10};
ENDBOSSES.forEach(r=>r.bounty=EB_BOUNTY[r.n]);
/* Fodder: the weakest tier, cheap buys, and every one of them hands the player a boon */
HUNT[0].prices=[50,80,100,150,200,250];
HUNT.unshift({id:'Fodder',w:30,c:'#7fd6c2',roman:'0',head:'Something Small Wobbles In',prices:[10,15,20,30,40,50],abChance:1,bounty:1,roster:[
  {n:'Wobbly Skeleton',t:'Held together by hope',l:'Please don’t hit me too hard.',s:'Wanted Dead or a Wild',ab:'fallsapart',anim:'wag',
    head:'skull',skin:'#ece4d4',eyes:'hollow',eye:'#8cff4a',k:.8,mouth:'skulljaw',robe:'#2a2a2a',x:['bones']},
  {n:'Tiny Slime',t:'Mostly water, a bit of greed',l:'Blorp.',s:'Jammin’ Jars',ab:'squishy',anim:'glow',
    head:'round',w:27,h:20,ey:60,skin:'#6fe08a',eyes:'glow',eye:'#ffffff',k:.8,es:9,mouth:'o',my:70,nobody:true,x:['drips']},
  {n:'Sleepy Zombie',t:'Rose from the grave too early',l:'Mmmh… five more minutes…',s:'Chaos Crew',ab:'halfasleep',anim:'sing',
    head:'round',skin:'#8fb08a',eyes:'closed',mouth:'stitched',robe:'#3a4a3a',x:['scar']},
  {n:'Little Bat',t:'Can’t see a thing',l:'Eek! Where are you?',s:'Starburst',ab:'blindbat',anim:'flap',
    head:'round',w:20,h:19,ey:58,skin:'#4a3a50',top:'rat',eyes:'glow',eye:'#ff4d4d',k:.7,es:8,mouth:'fangs',my:69,robe:'#2a1f30',wing:'#3a2a44',x:['wings']},
  {n:'Lost Soul',t:'Just wants to go home',l:'Have you seen the light?',s:'Madame Destiny Megaways',ab:'luckycoin',anim:'float',
    head:'ghost',skin:'#cfe3ff',eyes:'hollow',eye:'#9ad0ff',mouth:'o',my:70,nobody:true},
  {n:'Cave Spider',t:'Eight legs, zero teeth',l:'I bite! Kind of.',s:'Gems Bonanza',ab:'weakbite',anim:'nibble',
    head:'round',w:21,h:18,ey:56,skin:'#3a2f2a',eyes:'many',eye:'#ff4d4d',k:.55,mouth:'fangs',my:66,robe:'#2a221e',x:['legs']}
]});
HUNT[1].w=32;HUNT[2].w=20;HUNT[3].w=12;HUNT[4].w=6;
const ANGEL_ODDS=0.000001;
const SECRET={id:'Secret',c:'#fff6d6',roman:'∞',head:'A Light Descends',bounty:0};
const ANGEL={n:'The Seraph',t:'The one even the Cult fears',l:'Be at peace. It is already over.',s:'∞',ab:'judgment',anim:'holy',head:'angel'};
function angelSvg(size,c){
  let a=`<svg class="pt" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${esc(c.n||'The Seraph')}" data-anim="holy"><rect width="120" height="120" fill="#100e08"/>`;
  a+='<g class="g-back">';
  a+=`<g stroke="#ffe9a8" stroke-opacity=".35" stroke-width="1.6">${[...Array(16)].map((_,i)=>{const t=i*22.5*Math.PI/180;return `<path d="M${60+Math.cos(t)*22} ${54+Math.sin(t)*22} L${60+Math.cos(t)*70} ${54+Math.sin(t)*70}"/>`;}).join('')}</g>`;
  a+='<circle cx="60" cy="56" r="56" fill="#fff6d6" opacity=".07"/><circle cx="60" cy="56" r="40" fill="#fff6d6" opacity=".12"/><circle cx="60" cy="56" r="26" fill="#fff6d6" opacity=".2"/>';
  [[0,'.95'],[1,'.8'],[2,'.62']].forEach(([L,op])=>{[-1,1].forEach(s=>{
    const tipX=60+s*(56-L*4),tipY=26+L*26,cY=18+L*24,inX=60+s*10,inY=70+L*4;
    a+=`<path d="M${60+s*6} 64 Q${60+s*30} ${cY} ${tipX} ${tipY} Q${60+s*(46-L*6)} ${tipY+14} ${inX} ${inY} Z" fill="#fffaf0" opacity="${op}" stroke="#e8d7a8" stroke-width=".8"/>`;
    for(let k=1;k<=3;k++)a+=`<path d="M${60+s*(10+k*3)} ${66-k} Q${60+s*(24+k*6)} ${tipY+8+k*2} ${60+s*(30+k*7)} ${tipY+6+k*3}" stroke="#e8d7a8" stroke-width=".7" fill="none" opacity="${op}"/>`;
  });});
  a+='</g><g class="g-body"><path d="M30 120 Q34 92 60 87 Q86 92 90 120 Z" fill="#f3ead2"/><path d="M60 88 V120 M44 96 Q60 104 76 96" stroke="#e6c36a" stroke-width="2" fill="none"/></g>';
  a+='<g class="g-head"><ellipse cx="60" cy="33" rx="22" ry="5.5" fill="none" stroke="#ffd96a" stroke-opacity=".35" stroke-width="9"/><ellipse cx="60" cy="33" rx="20" ry="5" fill="none" stroke="#ffe9a8" stroke-width="3.2"/>';
  a+='<circle cx="60" cy="58" r="21" fill="#fff6d6" opacity=".35"/><circle cx="60" cy="58" r="16" fill="#fff8e6"/><circle cx="60" cy="58" r="11" fill="#ffffff"/>';
  a+='<ellipse cx="53.5" cy="58" rx="4" ry="1.2" fill="#e6c36a"/><ellipse cx="66.5" cy="58" rx="4" ry="1.2" fill="#e6c36a"/></g>';
  a+=`<g class="g-front">${[[22,24,1],[98,30,.8],[18,84,.7],[102,88,.9],[60,8,.6]].map(([x,y,sc])=>`<path transform="translate(${x} ${y}) scale(${sc})" d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8Z" fill="#ffe9a8"/>`).join('')}</g>`;
  return a+'</svg>';
}


const AB={
  gnaw:{name:'Gnaw',desc:'Chews 15% off your win.',f:x=>{x.pf*=.85;x.notes.push('Gnaw: your win −15%');}},
  snuff:{name:'Snuff Out',desc:'If you win less than the buy price, you lose no matter what.',f:x=>{if(x.p<x.price){x.force='b';x.notes.push('Snuff Out: you won less than the buy');}}},
  prank:{name:'Prank',desc:'Swaps both wins before they are compared.',f:x=>{[x.pf,x.bf]=[x.bf,x.pf];x.notes.push('Prank: the Imp swapped both wins!');}},
  flutter:{name:'Flutter',desc:'If it gets close (within 15%), the Moth flutters off and both buy again.',clutch:.15,act:'rematch'},
  fetch:{name:'Fetch',rule:true,desc:'The Pup buys two bonuses and keeps the better one.'},
  trick:{name:'Trick or Treat',desc:'Coin flip at the end: Treat gives your win +25%, Trick takes 25%.',f:x=>{const t=Math.random()<.5;x.pf*=t?1.25:.75;x.notes.push(t?'Treat: your win +25%':'Trick: your win −25%');}},
  haunt:{name:'Haunt',desc:'If it gets close (within 20%), the ghost haunts the fight and a coin flip decides.',clutch:.2,act:'coin'},
  hymn:{name:'Hymn of Silence',rule:true,desc:'You play blind: hide your screen from yourself until the bonus is over.'},
  infection:{name:'Infection',desc:'The rot spreads: your win −30%.',f:x=>{x.pf*=.7;x.notes.push('Infection: your win −30%');}},
  interest:{name:'Interest',desc:'Adds the full buy price on top of his own win.',f:x=>{x.bf+=x.price;x.notes.push(`Interest: +${money(x.price)} for the Banker`);}},
  shackles:{name:'Shackles',desc:'Your win is capped at 10x the buy price.',f:x=>{if(x.pf>x.price*10){x.pf=x.price*10;x.notes.push(`Shackles: your win capped at ${money(x.price*10)}`);}}},
  stitched:{name:'Two Bodies',rule:true,desc:'The twins buy two bonuses at half price each and add both wins together.'},
  hex:{name:'Hex of the Scatter',rule:true,desc:'You may not buy. Spin up to 200 times at buy ÷ 100. Only a natural bonus pays.'},
  cleave:{name:'Cleave',desc:'Chops a random 0–50% off your win.',f:x=>{const c=Math.round(Math.random()*50);x.pf*=1-c/100;x.notes.push(`Cleave: your win −${c}%`);}},
  sacrifice:{name:'Sacrifice',desc:'Takes 40% of your win and adds it to his own.',f:x=>{x.bf+=x.pf*.4;x.notes.push(`Sacrifice: ${money(x.pf*.4)} moved to the Priest`);x.pf*=.6;}},
  house:{name:'House Edge',desc:'If it gets close (within 25%), the house wins.',clutch:.25,act:'boss'},
  raise:{name:'Raise the Dead',revive:true,desc:'If he loses, he rises once and buys again.'},
  veil:{name:'Black Veil',rule:true,desc:'You play blind: chat picks your slot instead.'},
  scorch:{name:'Scorched Earth',desc:'If your win is under 2x the buy price, it burns to $0.',f:x=>{if(x.pf<x.price*2){x.pf=0;x.notes.push('Scorched Earth: your win burned to $0');}}},
  zero:{name:'Absolute Zero',desc:'Coin flip: one of the two wins is set to $0.',f:x=>{if(Math.random()<.5){x.pf=0;x.notes.push('Absolute Zero hit YOU: $0');}else{x.bf=0;x.notes.push('Absolute Zero hit the Saint himself: $0');}}},
  ninefold:{name:'Ninefold Grip',desc:'His win counts three times.',f:x=>{x.bf*=3;x.notes.push('Ninefold Grip: his win ×3');}},
  doom:{name:'Doom Clock',desc:'His win counts double and he wins every tie.',f:x=>{x.bf*=2;x.bossTies=true;x.notes.push('Doom Clock: his win ×2');}},
  pull:{name:'Pull Under',desc:'Drags 40% of your win into the deep.',f:x=>{x.pf*=.6;x.notes.push('Pull Under: your win −40%');}},
  embrace:{name:'Embrace',desc:'Her win counts double and she steals 30% of yours.',f:x=>{x.bf=x.bf*2+x.pf*.3;x.notes.push(`Embrace: her win ×2, she stole ${money(x.pf*.3)}`);x.pf*=.7;}},
  harvest:{name:'Harvest',desc:'His win ×1.5, and if it gets close (within 30%) he reaps you.',f:x=>{x.bf*=1.5;x.notes.push('Harvest: his win ×1.5');},clutch:.3,act:'boss'},
  judgment:{name:'Instant Win',desc:'The Seraph wins the moment it appears. Nothing can be played, nothing can stop it. Its bonus buy costs infinity.'},
  fallsapart:{name:'Falls Apart',boon:true,desc:'If you win more than the buy price, you win. Whatever it rolled.',f:x=>{if(x.p>x.price){x.force='p';x.notes.push('Falls Apart: you won more than the buy, the skeleton collapses');}}},
  squishy:{name:'Squishy',boon:true,desc:'Your win counts double.',f:x=>{x.pf*=2;x.notes.push('Squishy: your win ×2');}},
  halfasleep:{name:'Half Asleep',boon:true,playerRebuy:true,desc:'If you lose, it dozes off and you get one free second try.'},
  blindbat:{name:'Blind as a Bat',boon:true,clutch:.1,act:'player',desc:'You win ties and anything within 10%.'},
  luckycoin:{name:'Lucky Coin',boon:true,lucky:true,desc:'If you lose, a coin flip can still save you.'},
  weakbite:{name:'Weak Bite',boon:true,desc:'Its win only counts 50%.',f:x=>{x.bf*=.5;x.notes.push('Weak Bite: its win ×0.5');}},
  stacked:{name:'Stacked Deck',desc:'If your win is higher, a coin flip lets him swap the wins.',f:x=>{if(x.pf>x.bf){if(Math.random()<.5){[x.pf,x.bf]=[x.bf,x.pf];x.notes.push('Stacked Deck: he swapped the wins!');}else x.notes.push('Stacked Deck: he tried to swap and failed');}}}
};
const CURSES={
  spinonly:{name:'Spin Only',desc:'Nobody may buy. Both play 100 spins at buy ÷ 100. The total spin win counts.'},
  double:{name:'Double Down',desc:'Both must buy at double price.',price:2},
  half:{name:'Half Price',desc:'Both buy at half price.',price:.5},
  blind:{name:'Blind Buy',desc:'Chat picks one slot for both instead of the monster’s slot.'},
  sudden:{name:'Sudden Death',desc:'If it ends within 10%, the monster wins.',clutch:.1,act:'boss'}
};

/** Every monster's id is its name; looks up a roster entry (Endbosses and the Seraph included). */
function findMonster(name) {
  if (name === ANGEL.n) return ANGEL;
  for (const t of HUNT) for (const r of t.roster) if (r.n === name) return r;
  return ENDBOSSES.find((r) => r.n === name) ?? null;
}
const tierById = (id) => (id === "Endboss" ? END : id === "Secret" ? SECRET : HUNT.find((t) => t.id === id) ?? null);

export { C, HUNT, ENDBOSSES, END, SECRET, ANGEL, ANGEL_ODDS, CURSE_CHANCE, AB, CURSES, portrait, findMonster, tierById };
