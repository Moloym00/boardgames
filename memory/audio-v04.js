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
 let ctx,master,musicBus,fxBus,windGain,windSource,analyser,meter;
 
 let enabled=false,loading=false,loadFailed=false,musicBuffer,loadPromise,ticker;
 let nextMusic=0,nextCrackle=0,lastSeq=0,lastEffect=-10,lastPick=-10,lastPreview=-10,duckUntil=0,round=1,ended=false;
 const voices=new Set(),musicVoices=new Set();
 const audioRevision=new URL(doc.currentScript.src).search;
 const src=new URL('audio/ritual/ritual-kevin-macleod.mp3'+audioRevision,doc.currentScript.src).href;
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
  master.gain.value=0;musicBus.gain.value=.6;fxBus.gain.value=.45;
  ctx.onstatechange=status;
 }
 function track(source,gain,set=voices,tail=[]){
  source.fadeGain=gain;set.add(source);source.onended=()=>{source.disconnect();gain.disconnect();for(const n of tail)n.disconnect();set.delete(source);};
 }
 function stopVoices(set,fade=false){for(const source of set){try{if(fade&&source.fadeGain)smooth(source.fadeGain.gain,0,.15);source.stop(ctx.currentTime+(fade?.65:0));}catch{}}set.clear();}
 const recordings=new Map(),pendingRecordings=new Map();let playbackEpoch=0;
 const assetUrl=name=>new URL(name+'.mp3'+audioRevision,src).href;
 async function recording(name){
  if(recordings.has(name))return recordings.get(name);if(pendingRecordings.has(name))return pendingRecordings.get(name);
  const task=(async()=>{try{const r=await root.fetch(assetUrl(name));if(!r.ok)throw Error('sample unavailable');const b=await ctx.decodeAudioData(await r.arrayBuffer());recordings.set(name,b);return b;}catch{return null;}finally{pendingRecordings.delete(name);}})();pendingRecordings.set(name,task);return task;
 }
 function sample(name,level=1){
  if(!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden)return;
  const epoch=playbackEpoch,requested=ctx.currentTime;
  recording(name).then(buffer=>{
   // 网络迟到的声音不能在下一回合或恢复页面时突然响起。
   if(!buffer||epoch!==playbackEpoch||!enabled||!settings.effects||ctx.state!=='running'||doc.hidden||ctx.currentTime-requested>1.2)return;
   if(voices.size>=6)stopVoices(voices,true);
   const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=level;source.connect(gain);gain.connect(fxBus);track(source,gain);source.start();source.stop(ctx.currentTime+buffer.duration+.05);
   $('soundStatus').dataset.sample=name;
  });
 }
 function effect(kind,god){
  const name=['awake','communal'].includes(kind)?'awake':['burn','restStopped'].includes(kind)?'burn':['rest','legacy'].includes(kind)?'rest':['contest','restAttempt','defend'].includes(kind)?'contest':kind==='power'?'power-'+(god??0):kind;
  sample(name,['offer','contest'].includes(name)?.6:.85);
  if((priorities[kind]||0)>=6&&settings.music){duckUntil=ctx.currentTime+3;updateMix();}
 }
 function startWind(){
  if(windSource||!enabled||!settings.effects||ctx.state!=='running')return;
  const epoch=playbackEpoch;
  recording('hearth-bed').then(buffer=>{
   if(!buffer||windSource||epoch!==playbackEpoch||!enabled||!settings.effects||ctx.state!=='running'||doc.hidden)return;
   windSource=ctx.createBufferSource();windGain=ctx.createGain();windSource.buffer=buffer;windSource.loop=true;windSource.connect(windGain);windGain.connect(fxBus);windSource.onended=()=>{};windSource.start();updateMix();
  });
 }
 function stopWind(){if(windSource){windSource.stop();windSource.disconnect();windGain.disconnect();windSource=null;windGain=null;}}
 function updateMix(){if(!ctx)return;const base=ended?.4:.6;smooth(master.gain,enabled?settings.volume:0,.05);smooth(fxBus.gain,settings.effects?.45:0,.04);smooth(musicBus.gain,settings.music?base*(ctx.currentTime<duckUntil?.6:1):0,.12);if(settings.music&&duckUntil>ctx.currentTime)musicBus.gain.setTargetAtTime(base,duckUntil,.5);if(windGain)smooth(windGain.gain,ended?.006:.01,.8);}
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
 }
 function schedule(){clearInterval(ticker);ticker=root.setInterval(tick,250);tick();}
 async function activate(){
  try{connect();enabled=true;for(const name of ['offer','burn','awake','rest','ruin','contest','pick','power-0','power-1','power-2','power-3'])recording(name);await ctx.resume();if(!enabled){await ctx.suspend();return;}updateMix();startWind();schedule();status();if(settings.music){await loadMusic();tick();}}
  catch{enabled=false;status();$('soundStatus').textContent='声音暂时无法启动，仍可正常守夜。';}
 }
 function silence(){playbackEpoch++;enabled=false;duckUntil=0;clearInterval(ticker);if(ctx){updateMix();stopVoices(voices);stopVoices(musicVoices);nextMusic=0;stopWind();ctx.suspend().catch(()=>{});}status();}
 function events(batch,state){
  const chosen=selectEvent(batch,lastSeq);lastSeq=Math.max(lastSeq,...batch.map(e=>e.seq));round=state.round;ended=state.phase==='ended';updateMix();status();
  if(!chosen||!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden)return;
  if(ctx.currentTime-lastEffect<.8&&(priorities[chosen.type]||0)<6)return;
  lastEffect=ctx.currentTime;effect(chosen.type,chosen.god);$('soundStatus').dataset.lastEffect=chosen.type;
 }
 function reset(){playbackEpoch++;lastSeq=0;lastEffect=-10;lastPick=-10;duckUntil=0;round=1;ended=false;if(ctx){stopVoices(voices);stopVoices(musicVoices);nextMusic=ctx.currentTime+.12;updateMix();startWind();tick();}status();}
 function sync(state){round=state.round;ended=state.phase==='ended';updateMix();status();}
 function pick(){if(!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden||ctx.currentTime-lastPick<.7)return;lastPick=ctx.currentTime;sample('pick',.35);}
 function preview(){const kind=$('previewEffect').value;if(!['offer','burn','awake','rest','ruin'].includes(kind)||!enabled||!settings.effects||ctx?.state!=='running'||doc.hidden||ctx.currentTime-lastPreview<.4)return;lastPreview=ctx.currentTime;stopVoices(voices,true);effect(kind);$('soundStatus').dataset.preview=kind;}
 $('soundToggle').onclick=()=>{if(enabled&&ctx?.state==='running')silence();else activate();};
 $('musicToggle').onclick=async()=>{settings.music=!settings.music;save();updateMix();if(!settings.music&&ctx){stopVoices(musicVoices,true);nextMusic=0;}status();if(settings.music&&enabled){await loadMusic();tick();}};
 $('sfxToggle').onclick=()=>{settings.effects=!settings.effects;save();updateMix();if(ctx){if(settings.effects)startWind();else{playbackEpoch++;stopWind();stopVoices(voices);}}status();};
 $('soundVolume').oninput=e=>{settings.volume=clamp(e.target.value/100);save();updateMix();status();};
  if($('previewSound'))$('previewSound').onclick=preview;
 doc.addEventListener('visibilitychange',()=>{if(!ctx||!enabled)return;if(doc.hidden){playbackEpoch++;clearInterval(ticker);stopVoices(voices);ctx.suspend().catch(()=>{});}else{ctx.resume().then(()=>{if(!enabled||doc.hidden){return ctx.suspend();}startWind();schedule();status();}).catch(status);}status();});
 root.addEventListener('pagehide',silence);
 root.HearthAudio={events,reset,pick,sync};status();
})(typeof window==='object'?window:globalThis);
