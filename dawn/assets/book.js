(() => {
  'use strict';
  const G=window.DawnGame;
  document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=G.icon(el.dataset.icon);});
  const count=document.getElementById('player-count');
  count.addEventListener('change',()=>{const n=Number(count.value);document.querySelectorAll('.setup-n').forEach(el=>el.textContent=n);document.getElementById('setup-output').textContent=`每区 ${n} 张货物 · 共玩 ${n} 轮`;});
  const cases=[
    {leader:1,entries:[{seat:1,command:'board'},{seat:3,command:'smoke'}],text:'钩索克制俯冲，1 号得手：可以取本区一张，或改抢 3 号已有的一张货物。3 号没有货时，不能夺宝。'},
    {leader:1,entries:[{seat:1,command:'board'},{seat:2,command:'cannon'},{seat:3,command:'smoke'}],text:'三种指令齐全，本区无人得手。没有任何人拿货或夺宝，三张指令都照常进入整备。'},
    {leader:3,entries:[{seat:1,command:'board'},{seat:4,command:'board'},{seat:2,command:'smoke'}],text:'两位钩索都克制俯冲。领航顺序为 3 → 4 → 1 → 2，因此只有 4 号得手；他可取本区一张，或抢 2 号已有的一张。1 号与他同类，不能成为夺宝目标。'},
    {leader:3,entries:[{seat:2,command:'cannon'}],text:'2 号独自抵达，直接取本区两张货物。库存只剩一张就取一张；没有货就不取。指令仍要整备。'}
  ];
  function demo(index){const c=cases[index],r=G.resolveZone(c.entries,c.leader,4);document.getElementById('demo-leader').textContent=`四人局 · ${c.leader} 号持领航标记 · 所有展示的船都在同一个空域`;document.getElementById('demo-cards').innerHTML=c.entries.map(e=>{const a=G.commands.find(x=>x.id===e.command);return `<div class="demo-card ${a.color} ${r.winner===e.seat?'winner':''}"><span class="seat">${e.seat} 号船长</span>${G.icon(a.id)}<b>${a.name}</b><div class="outcome">${r.winner===e.seat?'本区胜者':r.reason==='stalemate'?'三方牵制':'本轮未得手'}</div></div>`;}).join('');document.getElementById('demo-result').textContent=c.text;document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.case)===index?'true':'false'));}
  document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>demo(Number(b.dataset.case))));demo(0);
  const contractSelect=document.getElementById('contract-select');contractSelect.innerHTML=G.contracts.map(c=>`<option value="${c.id}" ${c.id==='M04'?'selected':''}>${c.title}</option>`).join('');
  const inputs=G.cargo.map(c=>document.getElementById('goods-'+c.id));
  const requirement=c=>c.need.map((v,i)=>v?`${G.cargo[i].name} × ${v}`:'').filter(Boolean).join(' ＋ ');
  function updateScore(){const c=G.contracts.find(c=>c.id===contractSelect.value);const goods=inputs.map(i=>Math.min(8,Math.max(0,Math.trunc(Number(i.value)||0))));const s=G.score(goods,c.need);document.getElementById('score-total').innerHTML=s.total+'<span>分</span>';document.getElementById('score-breakdown').textContent=`货物 ${s.base} 分 ＋ 委托 ${s.bonus} 分`;document.getElementById('need-status').textContent=`需要 ${requirement(c)}。${s.complete?'已完整满足。':'尚未完整满足。'}`;}
  [...inputs,contractSelect].forEach(el=>el.addEventListener('input',updateScore));inputs.forEach(i=>i.addEventListener('change',()=>{i.value=Math.min(8,Math.max(0,Math.trunc(Number(i.value)||0)));updateScore();}));updateScore();
  document.getElementById('contract-catalog').innerHTML=G.contracts.map(c=>`<article class="catalog-item"><h3>${c.title}</h3><div class="requirement">${requirement(c)}</div><p>${c.flavor}</p></article>`).join('');
  document.getElementById('print-book').addEventListener('click',()=>window.print());
  let closed=[];window.addEventListener('beforeprint',()=>{closed=[...document.querySelectorAll('details:not([open])')];closed.forEach(d=>d.open=true);});window.addEventListener('afterprint',()=>{closed.forEach(d=>d.open=false);});
  if('IntersectionObserver' in window){const links=[...document.querySelectorAll('.side nav a')];const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id));}}},{rootMargin:'-8% 0px -66% 0px',threshold:0});document.querySelectorAll('main section[id]').forEach(s=>observer.observe(s));}
})();
