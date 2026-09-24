/* M0.5: isolated dice experiment; ordinary memories correct dice, gods remain as open memories. */
(function(root){
'use strict';
const GODS=typeof module!=='undefined'?require('./gods-v05.js'):root.DiceGods;
const E=['骨','风','潮','炎','星','任选'];
function rng(g){g.rng=(Math.imul(g.rng,1664525)+1013904223)>>>0;return g.rng/4294967296;}
function shuffle(g,a){for(let i=a.length-1;i>0;i--){let j=Math.floor(rng(g)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function log(g,text,type='action'){g.events.push({turn:g.turn,round:g.round,who:g.actor,type,text});}
function draw(g,p,n){let got=0;while(n-->0){if(!p.deck.length&&p.discard.length)p.deck=shuffle(g,p.discard.splice(0));if(!p.deck.length)break;p.hand.push(p.deck.pop());got++;}return got;}
function create(seed=1){const g={version:'M0.5',seed:seed>>>0,rng:seed>>>0,round:1,turn:0,actor:0,step:0,phase:'play',usedPower:false,dice:[],seats:[],queue:[],saved:[],ruined:[],events:[],players:[]};
 for(let i=0;i<3;i++){let p={name:['你','听冬','守火'][i],score:0,hand:[],deck:[],discard:[],forgotten:[],gifts:[]};for(let e=0;e<5;e++)for(let k=0;k<2;k++)p.deck.push({id:i+'-'+e+'-'+k,e});shuffle(g,p.deck);draw(g,p,3);g.players.push(p);}
 g.queue=shuffle(g,GODS.map((_,i)=>i));for(let i=0;i<4;i++)g.seats.push(nextSeat(g));start(g);return g;}
function nextSeat(g){return g.queue.length?{god:g.queue.shift(),weather:0,slots:[null,null,null]}:null;}
function start(g){g.turn++;g.usedPower=false;g.placed=false;draw(g,g.players[g.actor],1);g.dice=[0,1].map(()=>({face:Math.floor(rng(g)*6),used:false}));log(g,g.players[g.actor].name+'掷出'+g.dice.map(d=>E[d.face]).join('、')+'。','roll');}
const match=(face,e)=>face===5||face===e;
function occupied(s){return s.slots.filter(x=>x!==null).length;}
function awaken(g,seat){let s=g.seats[seat];if(!s||occupied(s)!==3)return;let counts=g.players.map((_,p)=>s.slots.filter(x=>x===p).length),winner=counts.findIndex(x=>x>=2);
 if(winner<0){g.players.forEach(p=>p.score++);winner=g.actor;log(g,GODS[s.god].name+'被众人唤醒：各得1分，'+g.players[winner].name+'收下神明记忆。','awake');}
 else{g.players.forEach((p,i)=>p.score+=i===winner?5:counts[i]);log(g,g.players[winner].name+'记住了'+GODS[s.god].name+'，得5分；其他人按供奉各得分。','awake');}
 g.players[winner].gifts.push(s.god);g.saved.push(s.god);g.seats[seat]=nextSeat(g);
}
function ruin(g,seat){const s=g.seats[seat];if(!s)return;log(g,GODS[s.god].name+'的神座毁去，供奉没有得分。','ruin');g.ruined.push(s.god);g.seats[seat]=nextSeat(g);}
function finish(g){g.phase='ended';g.failed=g.saved.length<4;log(g,g.failed?'只留下'+g.saved.length+'个名字，未达到四个；这一夜共同失败。':'留下了'+g.saved.length+'个名字。天明，按个人得分结算。','end');}
function endTurn(g){if(g.phase==='ended')return;if(!g.seats.some(Boolean)){finish(g);return;}g.step++;
 if(g.step===3){g.step=0;const doomed=[];g.seats.forEach((s,i)=>{if(s&&++s.weather>=3)doomed.push(i);});log(g,'第'+g.round+'更结束，在场神座各添1点侵蚀。','storm');for(const i of doomed)ruin(g,i);
 if(g.round===6||!g.seats.some(Boolean)){finish(g);return;}g.round++;}
 g.actor=((g.round-1)%3+g.step)%3;start(g);
}
function legal(g){if(g.phase!=='play')return [];const out=[{type:'end'}],p=g.players[g.actor],dice=g.dice.map((d,i)=>!d.used?i:null).filter(i=>i!==null),seats=g.seats.map((s,i)=>s?i:null).filter(i=>i!==null);
 for(const d of dice){const face=g.dice[d].face;
  if(p.deck.length||p.discard.length)out.push({type:'recall',d});
  for(const c of p.hand)if(c.e!==face)out.push({type:'correct',d,card:c.id});
  for(const s of seats){const seat=g.seats[s];for(let k=0;k<3;k++)if(!g.placed&&match(face,GODS[seat.god].elements[k])){
    if(seat.slots[k]===null)out.push({type:'offer',d,s,k});
    else if(seat.slots[k]!==g.actor&&dice.length===2)out.push({type:'contest',d,s,k});}
   if(seat.weather>0)for(const c of p.hand)out.push({type:'protect',d,s,card:c.id});
  }
  if(!g.usedPower)for(const god of p.gifts){const power=GODS[god].power,base={type:'power',d,god};
   if(power==='draw'&&(p.deck.length||p.discard.length))out.push(base);
   if(power==='recover')for(const c of p.discard)out.push({...base,card:c.id});
   if(power==='cool')for(const s of seats)if(g.seats[s].weather>0)out.push({...base,s});
   if(power==='hunt')for(const other of dice)if(other!==d)out.push({...base,other});
   if(power==='contest'&&!g.placed)for(const s of seats)for(let k=0;k<3;k++)if(g.seats[s].slots[k]!==null&&g.seats[s].slots[k]!==g.actor&&match(face,GODS[g.seats[s].god].elements[k]))out.push({...base,s,k});
   if(power==='rain')for(const s of seats)if(g.seats[s].weather>0)for(const target of seats)if(target!==s)out.push({...base,s,target});
   if(power==='move'&&!g.placed)for(const s of seats)for(let k=0;k<3;k++)if(g.seats[s].slots[k]===g.actor)for(const target of seats)if(target!==s)for(let slot=0;slot<3;slot++)if(g.seats[target].slots[slot]===null&&GODS[g.seats[s].god].elements[k]===GODS[g.seats[target].god].elements[slot])out.push({...base,s,k,target,slot});
   if(power==='swap'&&!g.placed)for(const s of seats)for(let k=0;k<3;k++)if(g.seats[s].slots[k]===g.actor)for(const target of seats)if(target!==s)for(let slot=0;slot<3;slot++)if(g.seats[target].slots[slot]!==null&&g.seats[target].slots[slot]!==g.actor)out.push({...base,s,k,target,slot});
  }
 }
 return out;
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function take(a,id){let i=a.findIndex(c=>c.id===id);if(i<0)throw Error('没有这张记忆');return a.splice(i,1)[0];}
function act(g,request){const a=legal(g).find(x=>equal(x,request));if(!a)throw Error('此刻不能这样行动');let p=g.players[g.actor];
 if(a.type==='end'){endTurn(g);return g;}
 if(a.type==='correct'){const c=take(p.hand,a.card);p.discard.push(c);g.dice[a.d].face=c.e;log(g,p.name+'暂忘'+E[c.e]+'，将骰子改为'+E[c.e]+'。');return g;}
 g.dice[a.d].used=true;
 if(a.type==='recall'){draw(g,p,1);log(g,p.name+'用一颗骰子寻回一张记忆。');}
 if(a.type==='offer'||a.type==='contest'){g.placed=true;const s=g.seats[a.s];if(a.type==='contest'){g.dice.forEach(d=>d.used=true);log(g,p.name+'用两颗骰子改写了'+g.players[s.slots[a.k]].name+'在'+GODS[s.god].name+'处的供奉。','contest');}else log(g,p.name+'向'+GODS[s.god].name+'献上'+E[GODS[s.god].elements[a.k]]+'。','offer');s.slots[a.k]=g.actor;awaken(g,a.s);}
 if(a.type==='protect'){const c=take(p.hand,a.card);p.forgotten.push(c);g.seats[a.s].weather=Math.max(0,g.seats[a.s].weather-2);log(g,p.name+'永远失去'+E[c.e]+'，为'+GODS[g.seats[a.s].god].name+'除去至多2点侵蚀。','burn');}
 if(a.type==='power'){g.usedPower=true;let power=GODS[a.god].power;log(g,p.name+'用骰子回想'+GODS[a.god].name+'。','power');
  if(power==='draw')draw(g,p,2);
  if(power==='recover')p.hand.push(take(p.discard,a.card));
  if(power==='cool')g.seats[a.s].weather--;
  if(power==='hunt'){g.dice[a.other].face=Math.floor(rng(g)*6);draw(g,p,1);log(g,'重掷结果：'+E[g.dice[a.other].face]+'。','roll');}
  if(power==='contest'){g.placed=true;g.seats[a.s].slots[a.k]=g.actor;awaken(g,a.s);}
  if(power==='rain'){g.seats[a.s].weather--;if(++g.seats[a.target].weather>=3)ruin(g,a.target);}
  if(power==='move'){g.placed=true;g.seats[a.s].slots[a.k]=null;g.seats[a.target].slots[a.slot]=g.actor;awaken(g,a.target);}
  if(power==='swap'){g.placed=true;[g.seats[a.s].slots[a.k],g.seats[a.target].slots[a.slot]]=[g.seats[a.target].slots[a.slot],g.seats[a.s].slots[a.k]];}
 }
 if(!g.seats.some(Boolean))finish(g);return g;
}
function check(g){const bad=[];if(g.version!=='M0.5'||g.players.length!==3||g.seats.length!==4)bad.push('版本或人数');
 for(let i=0;i<3;i++){let p=g.players[i],all=[...p.hand,...p.deck,...p.discard,...p.forgotten];if(all.length!==10||new Set(all.map(c=>c.id)).size!==10||all.some(c=>!c.id.startsWith(i+'-')))bad.push('记忆守恒');if(p.score<0)bad.push('分数');}
 const gods=[...g.queue,...g.seats.filter(Boolean).map(s=>s.god),...g.saved,...g.ruined];if(gods.length!==8||new Set(gods).size!==8)bad.push('神牌守恒');
 if(g.players.flatMap(p=>p.gifts).sort().join()!=[...g.saved].sort().join())bad.push('记忆归属');
 if(g.seats.some(s=>s&&(s.weather<0||s.weather>2||occupied(s)>2||s.slots.some(x=>x!==null&&![0,1,2].includes(x)))))bad.push('神座状态');
 if(g.dice.length!==2||g.dice.some(d=>d.face<0||d.face>5)||g.round<1||g.round>6||g.turn>18)bad.push('时序');return bad;
}
// Policy uses only public seats/dice/gifts and the acting player's hand/discard, never deck order or another hand.
function choose(g){const all=legal(g),p=g.players[g.actor],own=s=>g.seats[s].slots.filter(x=>x===g.actor).length;
 function value(a){if(a.type==='end')return -50;if(a.type==='correct'){const c=p.hand.find(c=>c.id===a.card);let now=all.some(x=>x.type==='offer'&&x.d===a.d);let useful=g.seats.some(s=>s&&s.slots.some((v,k)=>v===null&&GODS[s.god].elements[k]===c.e));return useful&&!now?8:-60;}
 if(a.type==='offer'){let s=g.seats[a.s],counts=g.players.map((_,i)=>s.slots.filter(x=>x===i).length);counts[g.actor]++;let winner=counts.findIndex(n=>n>=2);return 12+own(a.s)*5+(occupied(s)===2?(winner===g.actor?30:winner<0?18:4):0)+(s.weather===2?5:0);}
 if(a.type==='contest')return own(a.s)===1&&g.seats[a.s].weather<2?26:2;
 if(a.type==='protect')return g.seats[a.s].weather===2?14+own(a.s)*4:0;
 if(a.type==='recall')return p.hand.length<2?6:0;
 if(a.type==='power'){let power=GODS[a.god].power;if(power==='cool')return g.seats[a.s].weather===2?22:3;if(power==='contest')return 20+own(a.s)*5;if(power==='move')return 15+own(a.target)*4;if(power==='swap')return 8+own(a.target)*4;if(power==='rain')return (g.seats[a.s].weather===2?18:4)-own(a.target)*9;if(power==='draw')return p.hand.length<3?10:2;if(power==='recover')return p.hand.length<3?8:1;if(power==='hunt')return 5;}
 return 0;}
 const offset=(g.seed+g.round)%4;return all.sort((a,b)=>value(b)-value(a)||((a.s??4)+offset)%5-((b.s??4)+offset)%5)[0];
}
const api={GODS,E,create,legal,act,choose,check};if(typeof module!=='undefined')module.exports=api;else root.DiceGame=api;
})(typeof globalThis!=='undefined'?globalThis:this);
