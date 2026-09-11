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
  ctx.onstatechange=status;
 }
 function track(source,gain,set=voices,tail=[]){
  source.fadeGain=gain;set.add(source);source.onended=()=>{source.disconnect();gain.disconnect();for(const n of tail)n.disconnect();set.delete(source);};
 }
 function stopVoices(set,fade=false){for(const source of set){try{if(fade&&source.fadeGain)smooth(source.fadeGain.gain,0,.015);source.stop(ctx.currentTime+(fade?.08:0));}catch{}}set.clear();}
 // 无振荡器、钟声或音阶。滤波噪声是程序材质声，不冒充实录。
 function rustle(at,duration=.2,level=.06,frequency=900,attack=.025){
  if(voices.size>=14)return;
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noiseBuffer;
  filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.45;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+Math.min(attack,duration*.45));
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(gain);gain.connect(fxBus);track(source,gain,voices,[filter]);
  source.start(at,Math.random()*8);source.stop(at+duration+.03);
 }
 function effect(kind,god){
  const now=ctx.currentTime+.01;
  // 一次事件只留下少量细节。重要事件先让正在响的细节退下。
  if((priorities[kind]||0)>=6)stopVoices(voices,true);
  if(['awake','communal'].includes(kind)){
   rustle(now+.12,2.4,.075,350,.6);rustle(now+.38,1.3,.025,1050,.28);
  }else if(kind==='ruin'){
   rustle(now,.9,.11,190,.045);rustle(now+.23,1.8,.05,740,.28);
  }else if(['burn','restStopped'].includes(kind)){
   rustle(now,.65,.13,780,.09);
   for(let i=0;i<3;i++)rustle(now+.12+i*.11+Math.random()*.06,.025+Math.random()*.04,.03,1100+Math.random()*600,.006);
  }else if(['rest','legacy'].includes(kind)){
   rustle(now,1.9,.065,430,.28);
  }else if(['contest','restAttempt','defend'].includes(kind)){
   rustle(now,.19,.05,620,.03);
  }else if(kind==='power'){
   rustle(now,.55,.045,[650,420,260,1000][god]||650,.12);
  }else if(kind==='offer'){
   rustle(now,.13,.055,1050,.018);rustle(now+.08,.10,.065,180,.012);
  }
  if((priorities[kind]||0)>=6&&settings.music){duckUntil=now+2.8;updateMix();}
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
