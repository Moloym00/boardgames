const captions=[
 '你和老周都预言国王醉倒；阿岚要王冠失踪；小许等着钟声响起。',
 '你独自劝酒，老周独自敲钟。阿岚和小许都去偷王冠，结果撞车暴露。',
 '你和老周共同说中，各得 1 分。阿岚没说中，0 分。小许独家说中钟声，得 2 分。'
];
let currentStep=0;
function showStep(step){
 currentStep=step;
 document.querySelectorAll('.example-step').forEach(button=>{
  const selected=Number(button.dataset.step)===step;
  button.classList.toggle('selected',selected);
  button.setAttribute('aria-pressed',String(selected));
 });
 document.querySelectorAll('.reveal-back').forEach(el=>el.hidden=step>0);
 document.querySelectorAll('.revealed').forEach(el=>el.hidden=step===0);
 document.querySelectorAll('.player-score').forEach(el=>el.hidden=step<2);
 document.getElementById('example-outcomes').hidden=step===0;
 document.getElementById('example-caption').textContent=captions[step];
 document.getElementById('next-example').textContent=step===2?'从头看 ↩':'下一步 →';
}
document.querySelectorAll('.example-step').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.step))));
document.getElementById('next-example').addEventListener('click',()=>showStep((currentStep+1)%3));
