const M=MemoryGame,$=id=>document.getElementById(id),colors=['#e7b66f','#8fc2ca','#c8a1d1'];
const saved=MemorySession.restore(M);
let seed=saved.seed,g=saved.game,spectate=false,filter='',selected=null,timer;
if(typeof HearthAudio!=='undefined'){try{HearthAudio.sync(g);}catch{}}
const names={awaken:'呼名',skip:'守住记忆',power:'回想神明',legacy:'最后馈赠',burn:'燃忆',recall:'寻忆',watch:'守望',offer:'供奉',contest:'改写',rest:'安魂',trim:'放下',end:'交棒',yield:'让出',defend:'守住',keep:'燃忆留名'};
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function restPreview(seat){const keeper=M.guardian(g,seat,M.actor(g));return (keeper===null?'':` · ${g.players[keeper].name}可回应；被阻止也不退费用`)+(!g.seats.some(s=>s.state==='awake')&&g.seats.filter(s=>s.state==='active').length===1?' · 最后一尊神：安魂成功后将共同失败':'');}
function restHint(who){const q=g.pending,canKeep=M.legal(g,who).some(a=>a.type==='keep');return `${g.players[q.attacker].name}已付两张记忆与主行动。${g.players[who].name}是其他贡献者中供奉最多的一位，由其唯一回应（同数按安魂者之后的顺序）。`+(who===0?'你可永久燃掉一张匹配记忆或神明记忆，留下1伤痕（−1分），阻止安魂并降1侵蚀，供奉不动；也可让祂安息。':'等待其选择留名或送别。')+(who===0&&!canKeep?(M.living(g,who)<=6?'存续记忆已到六张底线，不能再燃。':'手中没有匹配记忆，此刻只能送别。'):'')+(!M.hasTimeToName(g,q.seat)?'剩余主行动已不足以填满并呼名；留名不会增加行动。':'')+'无论回应如何，都回到安魂者整理，不额外获得主行动。';}
function awakeningPreview(seat){const counts=g.players.map((_,i)=>g.seats[seat].offerings.filter(o=>o.player===i).length),winner=counts.findIndex(n=>n>=2);return winner<0?'众声觉醒：每人得1余音与一张记忆':`${g.players[winner].name}得5分与记忆`+counts.map((n,i)=>i!==winner&&n?`；${g.players[i].name}得${n}余音`:'').join('');}
function apply(id){try{const eventStart=g.events.length;const who=M.actor(g);g=M.act(g,who,id);M.check(g);MemorySession.record(seed,who,id);selected=null;render();playRitual(g.events.slice(eventStart));if(typeof HearthAudio!=='undefined'){try{HearthAudio.events(g.events.slice(eventStart),g);}catch{}}}catch(e){$('hint').textContent='火塘暂歇：'+e.message;clearTimeout(timer);}}
function render(){clearTimeout(timer);const ended=g.phase==='ended',who=M.actor(g),p=g.players[0];
 let forecast=$('forecast');if(!forecast){forecast=node('p',undefined,'note');forecast.id='forecast';$('gods').before(forecast);}
 const nextStorm=g.round<6?M.STORMS[g.round].filter(id=>g.seats[id].state==='active'):[];
 forecast.textContent=ended?'这一夜的风停了。':!g.seats.some(s=>s.state==='active')?'神已全部离场，本更结束后结算余火。':g.round===6?'最后一更 · 本更结束即天明；未呼名的供奉不计分。':nextStorm.length?'下一更的风 · '+nextStorm.map(id=>`${M.GODS[id].name} ${g.seats[id].weather}→${g.seats[id].weather+1}${g.seats[id].weather===2?'（若不干预，将毁座）':''}`).join('；')+'。按当前状态预告。':'下一更的风不会吹向仍在场的神。';
 const openedLore=new Set(Array.from($('gods').children||[]).flatMap((c,i)=>c.querySelector?.('details[open]')?[i]:[]));
 const remembered=g.seats.filter(s=>s.state==='awake').length;
 $('mission').textContent=ended?(g.failed?'没有名字传到天明，这一夜共同失败。':`共同守住了${remembered}个名字。`):remembered?`已有${remembered}个名字留下 · 共同目标达成，继续争取余火。`:'共同目标 0/1 · 天明前至少唤醒一尊神；安魂不能替代唤醒。';
 const turning=g.events.filter(e=>['burn','awake','communal','rest','ruin','displace','defend','restStopped','restAllowed'].includes(e.type)).at(-1);
 $('turning').textContent=turning?`第${turning.round}更的转折 · ${turning.text}`:'你们还没有留下第一个名字。';
 $('title').textContent=ended?'天将明，名字留下了什么':`第${g.round}更 · ${g.pending?(g.pending.kind==='rest'?'有人要送别神明':'有人要改写供奉'):who===0?'轮到你守夜':g.players[who].name+'正在守夜'}`;
 $('hint').textContent=ended?'火塘已落定，下面记录着这一夜真正发生的事。':g.pending?.kind==='rest'?restHint(who):g.pending?(who===0?'你的供奉正被争夺。付出一张相应记忆守住它，或带着余音让出。':'等待对方回应。'):'名字凑齐之后，仍待一声呼唤。迟疑之间，风还在吹。';
 $('players').replaceChildren(...g.players.map((p,i)=>{const n=node('div',`${p.name} · ${M.score(p)}分 · 手牌${p.hand.length}`, 'player');n.style.setProperty('--ink',colors[i]);n.title=`唤醒 ${p.awake.length}×5 + 安魂 ${p.rested.length}×2 + 余音 ${p.echo} − 伤痕 ${p.scars}`;return n;}));
 $('gods').replaceChildren(...g.seats.map((s,i)=>{const d=M.GODS[i],n=node('article',undefined,'god '+(s.state==='active'?'':s.state==='awake'?'awake':'retired'));n.style.setProperty('--fade',s.state==='ruin'?1:s.state==='awake'?0:s.weather/3);const img=node('img');img.src='./art/'+d.image;img.alt=d.name;const body=node('div',undefined,'body');body.append(node('h2',s.state==='ruin'?'□□□':d.name),node('p',({active:`侵蚀 ${s.weather}/3${s.offerings.length===3?' · 真名齐备，等待呼名':''}`,awake:'名字重新完整',rest:'已送别',ruin:'已被遗忘'})[s.state]));const slots=node('div',undefined,'slots');for(const e of d.elements){const o=s.offerings.find(o=>o.element===e),slot=node('div',e,'slot');slot.append(node('span',o?g.players[o.player].name:s.state==='active'?'空缺':'已归还'));if(o)slot.style.setProperty('--ink',colors[o.player]);slots.append(slot);}body.append(slots,node('p',d.effect));
 if(typeof HearthLore!=='undefined'){
  const lore=HearthLore.gods[i];
  // 旧闻始终与操作、当前状态分开，不把静态故事当作本局结果。
  if(s.state!=='ruin')body.append(node('p',lore.verse,'lore-verse'));
  const tale=node('details',undefined,'lore-fragment');tale.open=openedLore.has(i);tale.append(node('summary','火塘旧闻'));
  tale.append(node('small','游戏世界中的残章 · 与本局结局无关'));
  for(const line of lore.fragments)tale.append(node('p',line));body.append(tale);
 }n.append(img,body);return n;}));
 if(!p.hand.some(c=>c.id===selected))selected=null;
 $('hand').replaceChildren(...p.hand.map(c=>{const n=node('button',c.god===undefined?c.element:M.GODS[c.god].name+'的记忆','card'+(c.god===undefined?'':' gift')+(selected===c.id?' lifted':''));n.setAttribute('aria-pressed',String(selected===c.id));n.disabled=ended||who!==0||spectate;n.onclick=()=>{selected=selected===c.id?null:c.id;if(typeof HearthAudio!=='undefined'){try{HearthAudio.pick();}catch{}}render();};return n;}));
 $('memory').textContent=`未想起 ${p.deck.length} · 暂时放下 ${p.discard.length} · 真正遗忘 ${p.forgotten.length} ｜ 唤醒 ${p.awake.length}×5 + 安魂 ${p.rested.length}×2 + 余音 ${p.echo} − 伤痕 ${p.scars} = ${M.score(p)}分`;
 $('zones').textContent='暂时放下：'+(p.discard.map(M.cardName).join('、')||'无')+'；真正遗忘：'+(p.forgotten.map(M.cardName).join('、')||'无')+'；遗赠：'+(p.rested.map(r=>M.GODS[r.god].name+(r.used?'（已用尽）':'（尚在）')).join('、')||'无');
 $('actionTitle').textContent=ended?'火已渐息':who!==0?'听火声，等候片刻':g.pending?(g.pending.kind==='rest'?'留名，还是送别':'守住，还是让出'):g.step==='aux'?'辅助行动 · 可跳过':g.step==='main'?'主行动 · 选择一次':p.hand.length>5?`整理记忆 · 还需放下${p.hand.length-5}张`:'本回合完成 · 交棒';
 const jump=$('turnJump');if(jump){jump.hidden=ended||who!==0||spectate;jump.textContent=g.pending?(g.pending.kind==='rest'?'回应安魂 ↓':'回应争夺 ↓'):g.step==='cleanup'?'整理与交棒 ↓':'前往行动 ↓';}
 const actions=ended||who!==0||spectate?[]:M.legal(g),types=[...new Set(actions.map(a=>a.type))];if(!types.includes(filter))filter=types.includes('offer')?'offer':types.includes('skip')?'skip':types[0];
 $('filters').replaceChildren(...(types.length>1?types:[]).map(t=>{const b=node('button',names[t],t===filter?'selected':'');b.setAttribute('aria-pressed',String(t===filter));b.onclick=()=>{filter=t;render();};return b;}));
 $('selection').replaceChildren();if(selected){const b=node('button','放回手中');b.onclick=()=>{selected=null;render();};$('selection').append(b);if(typeof HearthLore!=='undefined'){const card=p.hand.find(c=>c.id===selected);const line=card?.god===undefined?HearthLore.memory[card?.element]:HearthLore.gods[card.god].verse;if(line)$('selection').append(node('p',line,'lore-verse'));}}
 // 先按具体手牌筛选，再合并相同文案；保留该实体牌对应的合法行动ID。
 const matching=actions.filter(a=>a.type===filter&&(!selected||a.card===selected||a.extra===selected||a.cards?.includes(selected)||!['power','burn','offer','contest','rest','trim','defend','keep'].includes(a.type)));
 const seen=new Set(),visible=matching.filter(a=>{if(seen.has(a.label))return false;seen.add(a.label);return true;});
 $('actions').replaceChildren(...visible.map(a=>{const b=node('button',a.label+(a.type==='awaken'?' · '+awakeningPreview(a.seat):a.type==='rest'?restPreview(a.seat):''));b.onclick=()=>{if(['burn','keep'].includes(a.type)&&!confirm('这张记忆将永远离开，你留下1点伤痕（−1分）。仍要燃忆吗？'))return;apply(a.id);};return b;}));
 if(actions.length&&!visible.length)$('actions').append(node('p','这段记忆此刻无法这样使用。可以换一个行动，或把它放回手中。'));
 $('events').replaceChildren(...g.events.slice(-12).reverse().map(e=>node('li',`第${e.round}更 · ${e.text}`)));
 $('ending').replaceChildren();if(ended){
   const best=Math.max(...g.players.map(M.score));
   $('ending').append(node('p',g.failed?'没有神被唤醒；这一夜无人胜出，个人余火只作记录。':g.players.filter(p=>M.score(p)===best).map(p=>p.name).join('、')+'留下最多余火，得分：'+best+'。'));
   for(const chapter of M.story(g)){
     const section=node('section',undefined,'story-chapter');section.append(node('h3',chapter.title));
     section.append(node('p',chapter.narrative));
     if(chapter.moments.length){const details=node('details');details.append(node('summary','回看这一段经历'));for(const moment of chapter.moments)details.append(node('p',`第${moment.round}更 · ${moment.text}`));section.append(details);}
     $('ending').append(section);
   }
   const losses=g.players.flatMap(p=>p.forgotten.map(c=>p.name+'失去了'+M.cardName(c)));
   if(losses.length)$('ending').append(node('p','真正遗忘的记忆：'+losses.join('；')+'。'));
   const keep=node('button','保存这一夜的故事');keep.onclick=()=>{
     const text=['真名之火 · M0.4 · 这一夜',...g.players.map(p=>p.name+'：'+M.score(p)+'分'),g.failed?'共同失败：没有神被唤醒。':'至少一个名字被留下。',...M.story(g).flatMap(c=>[c.title,c.narrative,...c.moments.map(e=>`第${e.round}更 · ${e.text}`)]),...losses].join('\n');
     const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=node('a');a.href=url;a.download='真名之火_这一夜.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   };$('ending').append(keep);
 }
 $('saveStatus').textContent=MemorySession.status();
 $('auto').textContent=spectate?'回到我的席位':'旁观一夜';if(!ended&&(who!==0||spectate))timer=setTimeout(()=>{const a=M.choose(g,M.actor(g));apply(a.id);},spectate?120:650);
}
$('auto').onclick=()=>{spectate=!spectate;render();};$('restart').onclick=()=>{if(!confirm('熄灭当前实验火塘，重新开始？'))return;clearRitual();if(typeof HearthAudio!=='undefined'){try{HearthAudio.reset();}catch{}}g=M.create(++seed);MemorySession.reset(seed);filter='';selected=null;spectate=false;render();};render();

// 仅在新行动结算后播放；刷新恢复和选牌重绘不会重演过去的事件。
let ritualEnabled=true,ritualTimer;
const ritualKinds={offer:['offer','一段记忆，被留下',380],burn:['burn','这段记忆，不会回来了',1100],restStopped:['burn','燃去自己的记忆，留下祂的名字',1200],awake:['awake','祂听见了自己的名字',1500],communal:['awake','众声之中，祂被记住',1500],rest:['rest','最后的馈赠，留给守夜的人',1300],ruin:['ruin','这个名字，被世界遗忘',1500],contest:['contest','有人要改写这段记忆',650],restAttempt:['rest','送别之前，还有一次选择',850],defend:['offer','这段记忆，被守住了',650],power:['offer','祂的记忆，再次回应',650],legacy:['rest','最后一次回应',850]};
function clearRitual(){clearTimeout(ritualTimer);const layer=$('ritualFx');if(layer){layer.replaceChildren();layer.className='ritual-fx';}}
function playRitual(events){
 if(!ritualEnabled)return;
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const marked=events.filter(e=>ritualKinds[e.type]);if(!marked.length)return;
 const rank=e=>['awake','communal','ruin'].includes(e.type)?3:['burn','restStopped','rest'].includes(e.type)?2:1;
 const event=marked.slice().sort((a,b)=>rank(b)-rank(a)||b.seq-a.seq)[0];
 const [kind,title,duration]=ritualKinds[event.type],layer=$('ritualFx');if(!layer)return;
 clearRitual();layer.className='ritual-fx ritual-'+kind+(reduced?' ritual-still':'');
 const caption=node('div',undefined,'ritual-caption');caption.append(node('small',title),node('strong',event.god===null||event.god===undefined?'余火未熄':M.GODS[event.god].name));layer.append(caption);
 if(!reduced){for(let i=0;i<12;i++){const spark=node('i',undefined,'ritual-spark');spark.style.setProperty('--n',i);spark.style.setProperty('--x',((i*37)%100)+'%');layer.append(spark);}}
 // 同次侵蚀毁掉多座时，每座都有局部反馈；字幕只保留最重要的一次。
 for(const e of marked){if(e.god===null||e.god===undefined)continue;const card=$('gods').children[e.god];if(card&&typeof card.animate==='function'&&!reduced){const color=['awake','communal'].includes(e.type)?'#f3ce86':e.type==='ruin'?'#657571':'#b78c64';card.animate([{boxShadow:'0 0 0 transparent'},{boxShadow:'0 0 32px '+color,offset:.35},{boxShadow:'0 0 0 transparent'}],{duration,easing:'ease-out'});}}
 ritualTimer=setTimeout(clearRitual,reduced?700:duration);
 // 重要时刻留一口呼吸；真人可立即继续，特效不拦截点击。
 if(g.phase!=='ended'&&(M.actor(g)!==0||spectate)){
  clearTimeout(timer);timer=setTimeout(()=>{const a=M.choose(g,M.actor(g));apply(a.id);},reduced?650:Math.max(spectate?380:650,duration));
 }
}
const ritualToggle=$('ritualToggle');if(ritualToggle)ritualToggle.onclick=()=>{ritualEnabled=!ritualEnabled;ritualToggle.textContent=ritualEnabled?'特效：开':'特效：关';ritualToggle.setAttribute('aria-pressed',String(ritualEnabled));clearRitual();};
