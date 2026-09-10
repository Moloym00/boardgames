/* 火塘声场：音乐与行动反馈分轨。音频失败不介入规则、存档或行动时序。 */
(function(root){
 'use strict';
 const KEY='truefire-audio-v1', clamp=v=>Math.min(1,Math.max(0,Number(v)||0));
 const priorities={awake:9,communal:9,ruin:8,restStopped:7,burn:7,rest:6,legacy:6,restAttempt:5,contest:5,defend:4,power:4,offer:3,weather:2,recall:1,trim:1};
 function selectEvent(events,lastSeq=0){return events.filter(e=>e.seq>lastSeq&&priorities[e.type]).sort((a,b)=>priorities[b.type]-priorities[a.type]||b.seq-a.seq)[0]||null;}
 if(typeof module==='object'&&module.exports){module.exports={selectEvent,clamp};return;}
 const doc=root.document,$=id=>doc.getElementById(id);
 let settings={music:true,effects:true,volume:.5};
 try{const saved=JSON.parse(root.localStorage.getItem(KEY)||'null');if(saved){settings={music:saved.music!==false,effects:saved.effects!==false,volume:clamp(saved.volume??.5)};}}catch{}
 let ctx,master,musicBus,fxBus,windGain,windSource,noiseBuffer,analyser,meter;
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
  master.gain.value=0;musicBus.gain.value=.32;fxBus.gain.value=.8;
  noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);const data=noiseBuffer.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){brown=(brown+.035*(Math.random()*2-1))/1.035;data[i]=brown*5;}
  ctx.onstatechange=status;
 }
 function track(source,gain,set=voices,tail=[]){
  source.fadeGain=gain;set.add(source);source.onended=()=>{source.disconnect();gain.disconnect();for(const n of tail)n.disconnect();set.delete(source);};
 }
 function stopVoices(set,fade=false){for(const source of set){try{if(fade&&source.fadeGain)smooth(source.fadeGain.gain,0,.015);source.stop(ctx.currentTime+(fade?.08:0));}catch{}}set.clear();}
 function tone(freq,at,duration,level=.1,type='sine',endFreq=freq){
  if(voices.size>36)return;
  const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(freq,at);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),at+duration);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  oscillator.connect(gain);gain.connect(fxBus);track(oscillator,gain);oscillator.start(at);oscillator.stop(at+duration+.02);
 }
 function rustle(at,duration=.2,level=.15,frequency=1200){
  if(voices.size>36)return;
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.65;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.018);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(gain);gain.connect(fxBus);track(source,gain,voices,[filter]);source.start(at,Math.random()*2);source.stop(at+duration+.02);
 }
 function bell(freq,at,level=.14){for(const [ratio,weight,decay] of [[1,1,2.5],[2.01,.27,1.5],[3.96,.08,.7]])tone(freq*ratio,at,decay,level*weight);}
 function effect(kind,god){
  const now=ctx.currentTime+.01,rootNote=[196,220,174.61,146.83][god]||196;
  if(['awake','communal'].includes(kind)){[1,1.5,2,2.25].forEach((ratio,i)=>bell(rootNote*ratio,now+i*.16,.13));}
  else if(kind==='ruin'){rustle(now,1.65,.35,410);tone(96,now,2.2,.24,'sine',34);bell(146.83,now+.18,.055);}
  else if(['burn','restStopped'].includes(kind)){rustle(now,.72,.4,950);rustle(now+.14,.55,.23,1900);tone(160,now,.8,.09,'sine',64);if(kind==='restStopped')bell(293.66,now+.4,.07);}
  else if(['rest','legacy'].includes(kind)){[2,1.5,1].forEach((ratio,i)=>bell(rootNote*ratio,now+i*.25,.085));rustle(now,.8,.09,620);}
  else if(['contest','restAttempt'].includes(kind)){tone(146.83,now,.36,.15,'triangle');tone(155.56,now+.12,.45,.09);}
  else if(kind==='power'){
   bell(rootNote*1.5,now,.1);bell(rootNote*2.25,now+.14,.06);
   if(god===0)rustle(now,.45,.12,900);
   if(god===1)bell(rootNote*4,now+.25,.035);
   if(god===2){rustle(now,.12,.13,700);tone(rootNote,now,.5,.07);}
   if(god===3){bell(rootNote*4,now+.3,.04);rustle(now+.2,.1,.1,2200);}
  }
  else if(kind==='defend'){tone(196,now,.3,.17,'triangle');bell(392,now+.08,.05);}
  else if(kind==='weather'){rustle(now,1.8,.19,480);}
  else if(kind==='offer'){rustle(now,.16,.2,1000);tone(164.81,now,.25,.13,'triangle',110);}
  else rustle(now,.16,.13,1600);
  // 重要回应时轻压背景，留出听见细节的空间。
  if((priorities[kind]||0)>=6&&settings.music){duckUntil=now+1.5;updateMix();}
 }
 function startWind(){
  if(windSource||!enabled||!settings.effects||ctx.state!=='running')return;
  windSource=ctx.createBufferSource();const filter=ctx.createBiquadFilter(),gain=ctx.createGain();windGain=gain;windSource.buffer=noiseBuffer;windSource.loop=true;filter.type='lowpass';filter.frequency.value=430;gain.gain.value=0;
  windSource.connect(filter);filter.connect(gain);gain.connect(fxBus);windSource.onended=()=>{filter.disconnect();gain.disconnect();};windSource.start();updateMix();
 }
 function stopWind(){if(windSource){const old=windSource;windSource=null;old.stop(ctx.currentTime);}}
 function updateMix(){if(!ctx)return;const base=ended?.17:.32;smooth(master.gain,enabled?settings.volume:0,.05);smooth(fxBus.gain,settings.effects?.8:0,.04);smooth(musicBus.gain,settings.music?base*(ctx.currentTime<duckUntil?.47:1):0,.12);if(settings.music&&duckUntil>ctx.currentTime)musicBus.gain.setTargetAtTime(base,duckUntil,.5);if(windGain)smooth(windGain.gain,ended?.01:.018+round*.006,.8);}
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
  if(settings.effects&&now>nextCrackle){rustle(now+.01,.05+Math.random()*.08,.055,700+Math.random()*900);nextCrackle=now+2.5+Math.random()*4;}
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
  if(ctx.currentTime-lastEffect<.15&&(priorities[chosen.type]||0)<6)return;
  lastEffect=ctx.currentTime;effect(chosen.type,chosen.god);$('soundStatus').dataset.lastEffect=chosen.type;
 }
 function reset(){lastSeq=0;lastEffect=-10;lastPick=-10;duckUntil=0;round=1;ended=false;if(ctx){stopVoices(voices);stopVoices(musicVoices);nextMusic=ctx.currentTime+.12;updateMix();tick();}status();}
 function sync(state){round=state.round;ended=state.phase==='ended';updateMix();status();}
 function pick(){if(!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden||ctx.currentTime-lastPick<.1)return;lastPick=ctx.currentTime;rustle(ctx.currentTime+.01,.09,.085,1650);}
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
