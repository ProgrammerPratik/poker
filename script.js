const SUITS=['S','H','D','C'], SUIT_SYM={S:'♠',H:'♥',D:'♦',C:'♣'}, RED={H:1,D:1};
const RANK_SYM={11:'J',12:'Q',13:'K',14:'A'};
function rsym(r){return RANK_SYM[r]||r;}
function mkDeck(){const d=[];for(const s of SUITS)for(let r=2;r<=14;r++)d.push({r,s});return d;}
function shuffle(d){for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
function cardHTML(c,mini){
  if(!c) return `<div class="card${mini?' mini':''} back"></div>`;
  return `<div class="card${mini?' mini':''}${RED[c.s]?' red':''}">${rsym(c.r)}${SUIT_SYM[c.s]}</div>`;
}
function kCombos(arr,k){const res=[],combo=[];(function h(s){if(combo.length===k){res.push(combo.slice());return;}for(let i=s;i<arr.length;i++){combo.push(arr[i]);h(i+1);combo.pop();}})(0);return res;}
function evalHand5(cards){
  const ranks=cards.map(c=>c.r).sort((a,b)=>b-a);
  const suits=cards.map(c=>c.s);
  const counts={};ranks.forEach(r=>counts[r]=(counts[r]||0)+1);
  const groups=Object.entries(counts).map(([r,c])=>[+r,c]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const isFlush=suits.every(s=>s===suits[0]);
  const uniq=[...new Set(ranks)];
  let isStraight=false,hi=0;
  if(uniq.length===5){
    if(uniq[0]-uniq[4]===4){isStraight=true;hi=uniq[0];}
    else if(uniq[0]===14&&uniq[1]===5&&uniq[2]===4&&uniq[3]===3&&uniq[4]===2){isStraight=true;hi=5;}
  }
  if(isStraight&&isFlush)return[8,hi];
  if(groups[0][1]===4)return[7,groups[0][0],groups[1][0]];
  if(groups[0][1]===3&&groups[1][1]===2)return[6,groups[0][0],groups[1][0]];
  if(isFlush)return[5,...ranks];
  if(isStraight)return[4,hi];
  if(groups[0][1]===3)return[3,groups[0][0],...groups.slice(1).map(g=>g[0])];
  if(groups[0][1]===2&&groups[1][1]===2)return[2,groups[0][0],groups[1][0],groups[2][0]];
  if(groups[0][1]===2)return[1,groups[0][0],...groups.slice(1).map(g=>g[0])];
  return[0,...ranks];
}
function cmp(a,b){const n=Math.max(a.length,b.length);for(let i=0;i<n;i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x-y;}return 0;}
function bestHand(cards){
  const combos=cards.length<=5?[cards]:kCombos(cards,5);
  let best=null;for(const c of combos){const e=evalHand5(c);if(!best||cmp(e,best)>0)best=e;}return best;
}
const HAND_NAMES=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];

// ---- audio ----
let actx=null,muted=false,musicOn=false,musicTimer=null;
function ac(){if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();return actx;}
function beep(freq,dur,type,vol,delay){
  if(muted)return;const c=ac();const o=c.createOscillator(),g=c.createGain();
  o.type=type||'square';o.frequency.value=freq;g.gain.value=0;
  o.connect(g);g.connect(c.destination);const t=c.currentTime+(delay||0);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol||0.06,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.start(t);o.stop(t+dur+0.02);
}
function sfxChip(){beep(520,0.06,'square',0.05);beep(700,0.05,'square',0.04,0.05);}
function sfxCard(){beep(220,0.04,'triangle',0.05);}
function sfxFold(){beep(160,0.12,'sawtooth',0.04);}
function sfxWin(){[523,659,784,1047].forEach((f,i)=>beep(f,0.18,'square',0.06,i*0.11));}
const SCALE=[261,293,329,392,440,392,329,293];
let scaleIdx=0;
function musicTick(){
  if(!musicOn||muted)return;
  beep(SCALE[scaleIdx%SCALE.length],0.22,'triangle',0.035);
  if(scaleIdx%4===0)beep(SCALE[scaleIdx%SCALE.length]/2,0.3,'square',0.02);
  scaleIdx++;
}
document.getElementById('soundBtn').onclick=()=>{
  ac();if(actx.state==='suspended')actx.resume();
  muted=!muted;document.getElementById('soundBtn').textContent=muted?'🔇':'🔊';
  if(!muted&&!musicOn){musicOn=true;musicTimer=setInterval(musicTick,320);}
};

// ---- game state ----
const BB=20,SB=10,START_CHIPS=1000;
let players=[
  {name:'YOU',isHuman:true,chips:START_CHIPS,hole:[],bet:0,folded:false,allIn:false,acted:false},
  {name:'DOC',isHuman:false,chips:START_CHIPS,hole:[],bet:0,folded:false,allIn:false,acted:false},
  {name:'SLIM',isHuman:false,chips:START_CHIPS,hole:[],bet:0,folded:false,allIn:false,acted:false},
  {name:'BELLE',isHuman:false,chips:START_CHIPS,hole:[],bet:0,folded:false,allIn:false,acted:false},
];
let deck=[],community=[],pot=0,currentBet=0,dealer=0,street='preflop',turnIdx=0,handNum=0;

function log(msg){const l=document.getElementById('log');const d=document.createElement('div');d.textContent=msg;l.appendChild(d);l.scrollTop=l.scrollHeight;while(l.children.length>40)l.removeChild(l.firstChild);}

function startHand(){
  handNum++;
  players.forEach(p=>{if(p.chips<=0){p.chips=START_CHIPS;log(`${p.name} rebuys 1000 chips.`);}});
  players.forEach(p=>{p.hole=[];p.bet=0;p.folded=false;p.allIn=false;p.acted=false;});
  deck=shuffle(mkDeck());community=[];pot=0;currentBet=0;street='preflop';
  dealer=(dealer+1)%4;
  for(let i=0;i<2;i++)players.forEach(p=>p.hole.push(deck.pop()));
  const sbIdx=(dealer+1)%4, bbIdx=(dealer+2)%4;
  postBlind(sbIdx,SB);postBlind(bbIdx,BB);
  currentBet=BB;
  turnIdx=(dealer+3)%4;
  log(`— Hand #${handNum} — ${players[dealer].name} deals. SB ${players[sbIdx].name}, BB ${players[bbIdx].name}.`);
  render();
  promptAction();
}
function postBlind(i,amt){
  const p=players[i];const pay=Math.min(amt,p.chips);p.chips-=pay;p.bet+=pay;pot+=pay;if(p.chips===0)p.allIn=true;
  sfxChip();
}
function activeAlive(){return players.filter(p=>!p.folded);}
function checkStreetEnd(){
  const alive=activeAlive();
  if(alive.length===1){awardPot(alive);return;}
  const contestants=alive.filter(p=>!p.allIn);
  const allMatched=contestants.length===0||contestants.every(p=>p.acted&&p.bet===currentBet);
  if(allMatched)dealNextStreet();else advanceTurn();
}
function advanceTurn(){
  let tries=0;
  do{turnIdx=(turnIdx+1)%4;tries++;}while((players[turnIdx].folded||players[turnIdx].allIn)&&tries<8);
  render();promptAction();
}
function promptAction(){
  const p=players[turnIdx];
  if(p.folded||p.allIn){checkStreetEnd();return;}
  if(p.isHuman){showControls(p);}
  else{setTimeout(()=>botAct(p),750+Math.random()*500);}
}
function applyAction(p,action,amount){
  if(action==='fold'){p.folded=true;sfxFold();}
  else if(action==='check'){}
  else if(action==='call'){
    const need=currentBet-p.bet;const pay=Math.min(need,p.chips);p.chips-=pay;p.bet+=pay;pot+=pay;if(p.chips===0)p.allIn=true;sfxChip();
  } else if(action==='raise'){
    const pay=amount-p.bet;p.chips-=pay;p.bet=amount;pot+=pay;currentBet=amount;if(p.chips===0)p.allIn=true;
    players.forEach(pl=>{if(pl!==p&&!pl.folded&&!pl.allIn)pl.acted=false;});
    sfxChip();
  }
  p.acted=true;
  log(`${p.name} ${action==='raise'?'raises to '+amount:action+(action==='call'?'s '+p.bet:action==='check'?'s':'s')}`);
  render();
  checkStreetEnd();
}
function botAct(p){
  const cards=[...p.hole,...community];
  let strength;
  if(cards.length<5){
    const [a,b]=p.hole,hi=Math.max(a.r,b.r),lo=Math.min(a.r,b.r);
    strength=(hi+lo)/28;
    if(a.r===b.r)strength+=0.28+(a.r/14)*0.14;
    if(a.s===b.s)strength+=0.06;
    if(hi-lo===1)strength+=0.05;
  } else {
    strength=bestHand(cards)[0]/8+0.05;
  }
  strength=Math.min(1,strength)+(Math.random()-0.5)*0.14;
  const toCall=currentBet-p.bet;
  const potOdds=toCall/((pot+toCall)||1);
  let action,amount;
  if(toCall<=0){
    if(strength>0.62&&Math.random()<0.55){action='raise';amount=currentBet+Math.max(BB,Math.round((pot||BB)*0.6));}
    else action='check';
  } else if(strength<0.32&&strength<potOdds*1.3){
    action='fold';
  } else if(strength>0.78&&p.chips>toCall&&Math.random()<0.6){
    action='raise';amount=currentBet+Math.max(BB,Math.round((pot||BB)*0.7));
  } else {
    action='call';
  }
  if(action==='raise'){
    amount=Math.min(amount,p.bet+p.chips);
    if(amount<=currentBet)action='call';
  }
  applyAction(p,action,action==='raise'?amount:undefined);
}
function dealNextStreet(){
  players.forEach(p=>{p.bet=0;p.acted=false;});
  currentBet=0;
  const contestants=activeAlive().filter(p=>!p.allIn);
  if(street==='preflop'){street='flop';community.push(deck.pop(),deck.pop(),deck.pop());sfxCard();}
  else if(street==='flop'){street='turn';community.push(deck.pop());sfxCard();}
  else if(street==='turn'){street='river';community.push(deck.pop());sfxCard();}
  else{showdown();return;}
  render();
  if(contestants.length<=1&&activeAlive().length>1){
    setTimeout(dealNextStreet,900);
  } else {
    turnIdx=dealer;advanceTurn();
  }
}
function awardPot(winners){
  const each=Math.floor(pot/winners.length);
  winners.forEach(w=>{w.chips+=each;});
  log(winners.length===1?`${winners[0].name} wins the pot of ${pot}.`:`${winners.map(w=>w.name).join(' & ')} split the pot of ${pot}.`);
  sfxWin();
  pot=0;
  finishHand();
}
function showdown(){
  const alive=activeAlive();
  const scored=alive.map(p=>({p,ev:bestHand([...p.hole,...community])}));
  scored.sort((a,b)=>cmp(b.ev,a.ev));
  const top=scored[0].ev;
  const winners=scored.filter(s=>cmp(s.ev,top)===0).map(s=>s.p);
  scored.forEach(s=>log(`${s.p.name}: ${HAND_NAMES[s.ev[0]]}`));
  render(true);
  awardPot(winners);
}
function finishHand(){
  render(true);
  document.getElementById('controls').innerHTML=`<button class="big" id="nextHandBtn">NEXT HAND</button>`;
  document.getElementById('nextHandBtn').onclick=startHand;
  const human=players[0];
  if(human.chips<=0){
    document.getElementById('centerMsg').style.display='block';
    document.getElementById('centerMsg').textContent="YOU'RE BUSTED — NEXT HAND RE-STAKES YOU";
  } else document.getElementById('centerMsg').style.display='none';
}
function showControls(p){
  const toCall=currentBet-p.bet;
  const canCheck=toCall<=0;
  const maxTotal=p.bet+p.chips;
  const minRaiseTo=Math.min(maxTotal,currentBet+BB);
  document.getElementById('controls').innerHTML=`
    <button class="act fold" id="bFold">FOLD</button>
    <button class="act ${canCheck?'check':'call'}" id="bCall">${canCheck?'CHECK':'CALL '+Math.min(toCall,p.chips)}</button>
    <div class="raise-wrap">
      <input type="range" id="rRange" min="${minRaiseTo}" max="${maxTotal}" step="${BB}" value="${minRaiseTo}" ${minRaiseTo>=maxTotal?'disabled':''}>
      <button class="act raise" id="bRaise" ${p.chips<=toCall?'disabled':''}>RAISE TO <span id="rVal">${minRaiseTo}</span></button>
    </div>
    <button class="act raise" id="bAllIn">ALL-IN</button>
  `;
  document.getElementById('bFold').onclick=()=>applyAction(p,'fold');
  document.getElementById('bCall').onclick=()=>applyAction(p,canCheck?'check':'call');
  document.getElementById('rRange').oninput=e=>document.getElementById('rVal').textContent=e.target.value;
  document.getElementById('bRaise').onclick=()=>applyAction(p,'raise',+document.getElementById('rRange').value);
  document.getElementById('bAllIn').onclick=()=>applyAction(p,'raise',maxTotal);
}
function strengthLabel(){
  const p=players[0];
  if(p.folded)return'You folded.';
  const cards=[...p.hole,...community];
  if(cards.length<5)return'Two hole cards — watch the flop for your hand to take shape.';
  return'Current best hand: '+HAND_NAMES[bestHand(cards)[0]];
}
function render(reveal){
  document.getElementById('board').innerHTML=community.map(c=>cardHTML(c)).join('')||`<span style="opacity:.5;font-size:16px">— waiting on the flop —</span>`;
  document.getElementById('potLine').textContent=`Pot: ${pot}`;
  document.getElementById('humanChips').textContent=players[0].chips;
  document.getElementById('humanCards').innerHTML=players[0].hole.map(c=>cardHTML(c)).join('');
  document.getElementById('humanSeat').classList.toggle('folded',players[0].folded);
  document.getElementById('strengthLine').textContent=strengthLabel();
  const botsRow=document.getElementById('botsRow');
  botsRow.innerHTML=players.slice(1).map((p,i)=>{
    const idx=i+1;
    const showCards=reveal&&!p.folded;
    return `<div class="seat ${idx===turnIdx?'active':''} ${p.folded?'folded':''}">
      <div class="nm">${p.name}${idx===dealer?' 🔘':''}</div>
      <div class="chips">${p.chips}${p.bet?` (bet ${p.bet})`:''}</div>
      <div class="cards">${p.hole.map(c=>showCards?cardHTML(c,true):cardHTML(null,true)).join('')}</div>
    </div>`;
  }).join('');
}
// ---- hand ranking help ----
const RANKS=[
  {n:'Royal Flush',ex:[[14,'S'],[13,'S'],[12,'S'],[11,'S'],[10,'S']],d:'A, K, Q, J, 10, all one suit — the best hand in the game.'},
  {n:'Straight Flush',ex:[[9,'H'],[8,'H'],[7,'H'],[6,'H'],[5,'H']],d:'Five cards in a row, all the same suit.'},
  {n:'Four of a Kind',ex:[[9,'S'],[9,'H'],[9,'D'],[9,'C'],[4,'S']],d:'All four cards of one rank.'},
  {n:'Full House',ex:[[10,'S'],[10,'H'],[10,'D'],[6,'C'],[6,'S']],d:'Three of a kind plus a pair.'},
  {n:'Flush',ex:[[13,'C'],[9,'C'],[7,'C'],[4,'C'],[2,'C']],d:'Five cards of the same suit, any order.'},
  {n:'Straight',ex:[[10,'S'],[9,'H'],[8,'D'],[7,'C'],[6,'S']],d:'Five cards in a row, mixed suits. Ace can be high or low.'},
  {n:'Three of a Kind',ex:[[8,'S'],[8,'H'],[8,'D'],[12,'C'],[3,'S']],d:'Three cards of the same rank.'},
  {n:'Two Pair',ex:[[11,'S'],[11,'H'],[5,'D'],[5,'C'],[2,'S']],d:'Two separate pairs.'},
  {n:'Pair',ex:[[14,'S'],[14,'H'],[9,'D'],[6,'C'],[3,'S']],d:'Two cards of the same rank.'},
  {n:'High Card',ex:[[13,'S'],[10,'H'],[8,'D'],[5,'C'],[2,'S']],d:'No combination — the highest single card plays.'},
];
document.getElementById('rankList').innerHTML=RANKS.map(r=>`
  <div class="rank-row">
    <div class="mini-hand">${r.ex.map(([rk,s])=>cardHTML({r:rk,s},true)).join('')}</div>
    <div class="txt"><b>${r.n}</b><br>${r.d}</div>
  </div>`).join('');
document.getElementById('helpBtn').onclick=()=>document.getElementById('helpOverlay').classList.add('show');
document.getElementById('closeHelp').onclick=()=>document.getElementById('helpOverlay').classList.remove('show');
document.getElementById('helpOverlay').onclick=e=>{if(e.target.id==='helpOverlay')e.currentTarget.classList.remove('show');};
document.getElementById('startBtn').onclick=()=>{
  ac();if(actx.state==='suspended')actx.resume();
  musicOn=true;musicTimer=setInterval(musicTick,320);
  document.getElementById('startOverlay').classList.remove('show');
  startHand();
};
