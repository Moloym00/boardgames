/* 火塘声场：音乐与行动反馈分轨。音频失败不介入规则、存档或行动时序。 */
(function(root){
 'use strict';
 const KEY='truefire-audio-v1', clamp=v=>Math.min(1,Math.max(0,Number(v)||0));
 const priorities={awake:9,communal:9,ruin:8,restStopped:7,burn:7,rest:6,legacy:6,restAttempt:5,contest:5,defend:4,power:4,offer:3};
 function selectEvent(events,lastSeq=0){return events.filter(e=>e.seq>lastSeq&&priorities[e.type]).sort((a,b)=>priorities[b.type]-priorities[a.type]||b.seq-a.seq)[0]||null;}
 if(typeof module==='object'&&module.exports){module.exports={selectEvent,clamp};return;}
 const doc=root.document,$=id=>doc.getElementById(id);
 let settings={music:true,effects:true,volume:.35};
 try{const saved=JSON.parse(root.localStorage.getItem(KEY)||'null');if(saved){settings={music:saved.music!==false,effects:saved.effects!==false,volume:clamp(saved.volume??.35)};}}catch{}
 let ctx,master,musicBus,fxBus,windGain,windSource,noiseBuffer,analyser,meter;
 const materials={};
 let enabled=false,loading=false,loadFailed=false,musicBuffer,loadPromise,ticker;
 let nextMusic=0,nextCrackle=0,lastSeq=0,lastEffect=-10,lastPick=-10,lastPreview=-10,duckUntil=0,round=1,ended=false;
 const voices=new Set(),musicVoices=new Set();
 const src=new URL('audio/long-road-ahead-b.mp3',doc.currentScript.src).href;
 function save(){try{root.localStorage.setItem(KEY,JSON.stringify(settings));}catch{}}
 function smooth(param,value,seconds=.1){if(!ctx)return;param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,seconds);}
 function status(){
  const running=enabled&&ctx?.state==='running'&&!doc.hidden;
  $('soundToggle').textContent=enabled?(running?'声音：开':'继续声音'):'开启声音';
  $('soundToggle').setAttribute('aria-pressed',String(enabled));
  $('musicToggle').textContent=settings.music?'配乐：开':'配乐：关';$('musicToggle').setAttribute('aria-pressed',String(settings.music));
  $('sfxToggle').textContent=settings.effects?'音效：开':'音效：关';$('sfxToggle').setAttribute('aria-pressed',String(settings.effects));
  $('soundVolume').value=Math.round(settings.volume*100);$('soundLevel').textContent=Math.round(settings.volume*100)+'%';
  const message=!enabled?'点「开启声音」，让火塘有声音。':doc.hidden?'离开页面，声场暂歇。':loading&&settings.music?'配乐载入中，行动音效已就绪。':loadFailed&&settings.music?'配乐未载入；可关闭再开启配乐重试。':!running?'声音暂歇，点「继续声音」恢复。':!settings.music&&!settings.effects?'声场已静音。':ended?'天明以后 · 余音仍在':`第${round}更 · 火塘与远行`;
  if($('soundStatus').textContent!==message)$('soundStatus').textContent=message;
  $('soundStatus').dataset.context=ctx?.state||'uninitialized';
  $('soundStatus').dataset.music=musicBuffer?'ready':loadFailed?'error':loading?'loading':'idle';
  $('soundStatus').dataset.duration=musicBuffer?musicBuffer.duration.toFixed(2):'0';
  if(!running)$('soundStatus').dataset.level='0.0000';
  $('soundStatus').dataset.phase=ended?'ended':'night';$('soundStatus').dataset.round=String(round);
  if($('previewSound'))$('previewSound').disabled=!running||!settings.effects;
 }
 function connect(){
  if(ctx)return;
  const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw Error('此浏览器暂不支持声音');
  ctx=new Context();master=ctx.createGain();musicBus=ctx.createGain();fxBus=ctx.createGain();
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.005;limiter.release.value=.2;
  analyser=ctx.createAnalyser();analyser.fftSize=256;meter=new Float32Array(256);
  musicBus.connect(master);fxBus.connect(master);master.connect(limiter);limiter.connect(analyser);analyser.connect(ctx.destination);
  master.gain.value=0;musicBus.gain.value=.1;fxBus.gain.value=.65;
  noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*12,ctx.sampleRate);const data=noiseBuffer.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){brown=(brown+.035*(Math.random()*2-1))/1.035;data[i]=brown*5;}
  // 将循环接缝缓慢接回起点，避免风底每轮出现断口。
  const seam=Math.floor(ctx.sampleRate*.2);
  for(let i=0;i<seam;i++){const k=data.length-seam+i,w=i/(seam-1);data[k]=data[k]*(1-w)+data[0]*w;}
  // 不同材质用不同的频谱与颗粒，避免每个动作只是同一阵风的长短变化。
  for(const name of ['air','cloth','ember']){
   const buffer=ctx.createBuffer(1,ctx.sampleRate*12,ctx.sampleRate),samples=buffer.getChannelData(0);
   let soft=0,rough=0;
   for(let i=0;i<samples.length;i++){
    const white=Math.random()*2-1;soft=.97*soft+.03*white;rough=.75*rough+.25*white;
    samples[i]=name==='air'?soft*2.4:name==='cloth'?(white-rough)*.35:(rough*.6+soft)*(.55+.25*Math.sin(i/ctx.sampleRate*7.3)+.2*Math.sin(i/ctx.sampleRate*12.7));
   }
   materials[name]=buffer;
  }
  ctx.onstatechange=status;
 }
 function track(source,gain,set=voices,tail=[]){
  source.fadeGain=gain;set.add(source);source.onended=()=>{source.disconnect();gain.disconnect();for(const n of tail)n.disconnect();set.delete(source);};
 }
 function stopVoices(set,fade=false){for(const source of set){try{if(fade&&source.fadeGain)smooth(source.fadeGain.gain,0,.15);source.stop(ctx.currentTime+(fade?.65:0));}catch{}}set.clear();}
 // 无振荡器、钟声或音阶。滤波噪声是程序材质声，不冒充实录。
 function rustle(at,duration=.2,level=.06,frequency=900,attack=.025,material='wood',pan=0,endFrequency=frequency){
  if(voices.size>=14)return;
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=materials[material]||noiseBuffer;
  filter.type='bandpass';filter.frequency.setValueAtTime(frequency,at);filter.frequency.exponentialRampToValueAtTime(endFrequency,at+duration);filter.Q.value=.45;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+Math.min(attack,duration*.45));
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(gain);
  const tails=[filter];
  if(ctx.createStereoPanner){const space=ctx.createStereoPanner();space.pan.value=pan;gain.connect(space);space.connect(fxBus);tails.push(space);}else gain.connect(fxBus);
  track(source,gain,voices,tails);
  source.start(at,Math.random()*Math.max(.1,11-duration));source.stop(at+duration+.03);
 }
 function effect(kind,god){
  const now=ctx.currentTime+.01,vary=.88+Math.random()*.24;
  // 正常连续行动保留尾音；密集叠加时才让旧层缓慢退下。
  if(voices.size>9)stopVoices(voices,true);
  if(['awake','communal'].includes(kind)){
   rustle(now+.08,4.8,.13,310*vary,.9,'air',-.2,740);
   rustle(now+.85,3.6,.055,1300,.85,'air',.25,600);
   rustle(now+.3,.55,.045,680,.08,'cloth',0,410);
  }else if(kind==='ruin'){
   rustle(now,1.5,.14,170,.08,'wood',0,100);
   rustle(now+.35,3.3,.085,1800,.35,'cloth',-.25,460);
   rustle(now+1.2,2.5,.055,700,.4,'air',.25,260);
  }else if(['burn','restStopped'].includes(kind)){
   rustle(now,2.6,.19,750*vary,.24,'ember',-.12,430);
   rustle(now+.45,2.2,.065,1600,.32,'air',.18,900);
   for(let i=0;i<5;i++)rustle(now+.25+i*.34+Math.random()*.15,.06+Math.random()*.10,.04,1300+Math.random()*1100,.009,'ember',(Math.random()-.5)*.5);
  }else if(['rest','legacy'].includes(kind)){
   rustle(now,3.7,.105,620*vary,.6,'air',.18,190);
   rustle(now+.6,2.8,.045,270,.75,'wood',-.2,120);
   rustle(now+.12,.7,.03,1450,.15,'cloth',0,850);
  }else if(['contest','restAttempt','defend'].includes(kind)){
   rustle(now,.65,.07,920,.05,'cloth',-.15,510);rustle(now+.23,.35,.07,240,.03);
  }else if(kind==='power'){
   const texture=['cloth','air','ember','air'][god]||'air';
   rustle(now,1.8,.085,([650,420,260,1500][god]||650)*vary,.25,texture,-.15,420);
   rustle(now+.45,1.4,.035,800,.3,texture,.2,330);
  }else if(kind==='offer'){
   rustle(now,.45,.07,1500*vary,.035,'cloth',-.1,850);
   rustle(now+.16,.32,.09,180,.018);
   rustle(now+.28,.4,.025,650,.09,'cloth',.1,360);
  }
  if((priorities[kind]||0)>=6&&settings.music){duckUntil=now+4.8;updateMix();}
 }
 function startWind(){
  if(windSource||!enabled||!settings.effects||ctx.state!=='running')return;
  windSource=ctx.createBufferSource();const filter=ctx.createBiquadFilter(),gain=ctx.createGain();windGain=gain;windSource.buffer=noiseBuffer;windSource.loop=true;filter.type='lowpass';filter.frequency.value=430;gain.gain.value=0;
  windSource.connect(filter);filter.connect(gain);gain.connect(fxBus);windSource.onended=()=>{filter.disconnect();gain.disconnect();};windSource.start();updateMix();
 }
 function stopWind(){if(windSource){const old=windSource;windSource=null;old.stop(ctx.currentTime);}}
 function updateMix(){if(!ctx)return;const base=ended?.055:.1;smooth(master.gain,enabled?settings.volume:0,.05);smooth(fxBus.gain,settings.effects?.65:0,.04);smooth(musicBus.gain,settings.music?base*(ctx.currentTime<duckUntil?.22:1):0,.12);if(settings.music&&duckUntil>ctx.currentTime)musicBus.gain.setTargetAtTime(base,duckUntil,.5);if(windGain)smooth(windGain.gain,ended?.003:.006+round*.001,.8);}
 async function loadMusic(){
  if(musicBuffer)return musicBuffer;if(loadPromise)return loadPromise;
  loading=true;loadFailed=false;status();
  loadPromise=(async()=>{const response=await root.fetch(src);if(!response.ok)throw Error('music unavailable');const buffer=await response.arrayBuffer();musicBuffer=await ctx.decodeAudioData(buffer);return musicBuffer;})();
  try{return await loadPromise;}catch{loadFailed=true;return null;}finally{loading=false;loadPromise=null;status();}
 }
 function musicCycle(at){
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=musicBuffer;const duration=musicBuffer.duration,overlap=Math.min(3,duration/8);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(1,at+overlap);gain.gain.setValueAtTime(1,at+duration-overlap);gain.gain.linearRampToValueAtTime(0,at+duration);
  source.connect(gain);gain.connect(musicBus);track(source,gain,musicVoices);source.start(at);source.stop(at+duration+.01);nextMusic=at+duration-overlap;
 }
 function tick(){
  if(!enabled||!ctx||ctx.state!=='running'||doc.hidden)return;
  const now=ctx.currentTime;
  analyser.getFloatTimeDomainData(meter);$('soundStatus').dataset.level=Math.max(...meter.map(Math.abs)).toFixed(4);
  if(settings.music&&musicBuffer&&nextMusic<now+.7){musicCycle(Math.max(now+.02,nextMusic));}
  if(settings.effects&&!ended&&now>nextCrackle){rustle(now+.01,.05+Math.random()*.08,.022,700+Math.random()*700);nextCrackle=now+12+Math.random()*14;}
 }
 function schedule(){clearInterval(ticker);ticker=root.setInterval(tick,250);tick();}
 async function activate(){
  try{connect();enabled=true;await ctx.resume();if(!enabled){await ctx.suspend();return;}updateMix();startWind();schedule();status();if(settings.music){await loadMusic();tick();}}
  catch{enabled=false;status();$('soundStatus').textContent='声音暂时无法启动，仍可正常守夜。';}
 }
 function silence(){enabled=false;duckUntil=0;clearInterval(ticker);if(ctx){updateMix();stopVoices(voices);stopVoices(musicVoices);nextMusic=0;stopWind();ctx.suspend().catch(()=>{});}status();}
 function events(batch,state){
  const chosen=selectEvent(batch,lastSeq);lastSeq=Math.max(lastSeq,...batch.map(e=>e.seq));round=state.round;ended=state.phase==='ended';updateMix();status();
  if(!chosen||!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden)return;
  if(ctx.currentTime-lastEffect<.8&&(priorities[chosen.type]||0)<6)return;
  lastEffect=ctx.currentTime;effect(chosen.type,chosen.god);$('soundStatus').dataset.lastEffect=chosen.type;
 }
 function reset(){lastSeq=0;lastEffect=-10;lastPick=-10;duckUntil=0;round=1;ended=false;if(ctx){stopVoices(voices);stopVoices(musicVoices);nextMusic=ctx.currentTime+.12;updateMix();tick();}status();}
 function sync(state){round=state.round;ended=state.phase==='ended';updateMix();status();}
 function pick(){if(!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden||ctx.currentTime-lastPick<.7)return;lastPick=ctx.currentTime;rustle(ctx.currentTime+.01,.10,.018,1200);}
 function preview(){const kind=$('previewEffect').value;if(!['offer','burn','awake','rest','ruin'].includes(kind)||!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden||ctx.currentTime-lastPreview<.4)return;lastPreview=ctx.currentTime;stopVoices(voices,true);effect(kind);$('soundStatus').dataset.preview=kind;}
 $('soundToggle').onclick=()=>{if(enabled&&ctx?.state==='running')silence();else activate();};
 $('musicToggle').onclick=async()=>{settings.music=!settings.music;save();updateMix();if(!settings.music&&ctx){stopVoices(musicVoices,true);nextMusic=0;}status();if(settings.music&&enabled){await loadMusic();tick();}};
 $('sfxToggle').onclick=()=>{settings.effects=!settings.effects;save();updateMix();if(ctx){if(settings.effects)startWind();else{stopWind();stopVoices(voices);}}status();};
 $('soundVolume').oninput=e=>{settings.volume=clamp(e.target.value/100);save();updateMix();status();};
  if($('previewSound'))$('previewSound').onclick=preview;
 doc.addEventListener('visibilitychange',()=>{if(!ctx||!enabled)return;if(doc.hidden){clearInterval(ticker);stopVoices(voices);ctx.suspend().catch(()=>{});}else{ctx.resume().then(()=>{schedule();status();}).catch(status);}status();});
 root.addEventListener('pagehide',silence);
 root.HearthAudio={events,reset,pick,sync};status();
})(typeof window==='object'?window:globalThis);
