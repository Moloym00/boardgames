(() => {
  'use strict';
  const G = window.DawnGame;
  const $ = id => document.getElementById(id);
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = G.icon(el.dataset.icon); });
  const theme = $('themeBtn');
  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    theme.textContent = dark ? '日间阅读' : '夜间阅读';
    theme.setAttribute('aria-pressed', String(dark));
  }
  try { applyTheme(localStorage.getItem('dawn_manual_theme') === 'dark'); } catch { applyTheme(false); }
  theme.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    applyTheme(dark);
    try { localStorage.setItem('dawn_manual_theme', dark ? 'dark' : 'light'); } catch {}
  });
  $('player-count').addEventListener('change', e => {
    const n = Number(e.target.value);
    document.querySelectorAll('.setup-n').forEach(el => { el.textContent = n; });
    document.querySelectorAll('[data-total]').forEach(el => { el.textContent = n * 3; });
    $('setup-output').textContent = `每区 ${n} 张货物 · 共玩 ${n} 轮`;
  });
  const cases = [
    { leader: 1, entries: [{seat:1,command:'board'},{seat:3,command:'smoke'}], text: '钩索克制俯冲，1 号胜出。他可以取本区 1 张公共货物，或夺走 3 号已有的 1 张货物；3 号没货时不能夺宝。' },
    { leader: 1, entries: [{seat:1,command:'board'},{seat:2,command:'cannon'},{seat:3,command:'smoke'}], text: '三种指令齐全，全区无人得手。领航者也不能拿货，所有使用过的牌照常整备。' },
    { leader: 3, entries: [{seat:1,command:'board'},{seat:4,command:'board'},{seat:2,command:'smoke'}], text: '钩索克制俯冲。顺位为 3 → 4 → 1 → 2，因此 4 号先于 1 号胜出，只有 4 号执行一次指令。' },
    { leader: 3, entries: [{seat:2,command:'cannon'}], text: '2 号独自抵达，直接胜出。炮击取本区 2 张；只剩 1 张取 1 张，空仓不取。指令仍须整备。' }
  ];
  function demo(index) {
    const c = cases[index], result = G.resolveZone(c.entries, c.leader, 4);
    $('demo-leader').textContent = `4 人局 · ${c.leader} 号领航 · 同一空域`;
    $('demo-cards').innerHTML = c.entries.map(e => {
      const command = G.commands.find(x => x.id === e.command);
      return `<div class="demo-card ${result.winner === e.seat ? 'winner' : ''}"><small>${e.seat} 号船长</small>${G.icon(command.id)}<b>${command.name}</b><small>${result.winner === e.seat ? '★ 本区胜者' : result.reason === 'stalemate' ? '三方牵制' : '本轮未得手'}</small></div>`;
    }).join('');
    $('demo-result').textContent = c.text;
    document.querySelectorAll('[data-case]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.case) === index)));
  }
  document.querySelectorAll('[data-case]').forEach(el => el.addEventListener('click', () => demo(Number(el.dataset.case))));
  demo(0);
  const inputs = G.cargo.map(c => $('goods-' + c.id));
  const normalize = value => Math.min(8, Math.max(0, Math.trunc(Number(value) || 0)));
  function score() {
    const c = G.contracts.find(x => x.id === $('contract-select').value);
    const result = G.score(inputs.map(el => normalize(el.value)), c.need);
    $('score-total').innerHTML = `${result.total}<span>分</span>`;
    $('score-breakdown').textContent = `货物 ${result.base} 分 ＋ 委托 ${result.bonus} 分`;
    $('need-status').textContent = `需要 ${c.need.map((n, i) => n ? `${G.cargo[i].name} × ${n}` : '').filter(Boolean).join(' ＋ ')}。${result.complete ? '已完整满足。' : '尚未完整满足。'}`;
  }
  [...inputs, $('contract-select')].forEach(el => el.addEventListener('input', score));
  inputs.forEach(el => el.addEventListener('change', () => { el.value = normalize(el.value); score(); }));
  score();
  const questions = [...document.querySelectorAll('#faq details')];
  function updateFaqToggle() {
    const visible = questions.filter(el => !el.hidden);
    $('faq-toggle').textContent = visible.length && visible.every(el => el.open) ? '全部收起' : '全部展开';
  }
  $('faq-search').addEventListener('input', e => {
    const query = e.target.value.trim();
    questions.forEach(el => { el.hidden = !el.textContent.includes(query); if (query && !el.hidden) el.open = true; });
    $('faq-empty').hidden = questions.some(el => !el.hidden);
    updateFaqToggle();
  });
  $('faq-toggle').addEventListener('click', () => {
    const visible = questions.filter(el => !el.hidden), open = !visible.every(el => el.open);
    visible.forEach(el => { el.open = open; });
    updateFaqToggle();
  });
  questions.forEach(el => el.addEventListener('toggle', updateFaqToggle));
  let beforePrint = null;
  window.addEventListener('beforeprint', () => {
    if (!beforePrint) beforePrint = questions.map(el => ({ open: el.open, hidden: el.hidden }));
    questions.forEach(el => { el.open = true; el.hidden = false; });
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-memo');
    if (beforePrint) questions.forEach((el, i) => { el.open = beforePrint[i].open; el.hidden = beforePrint[i].hidden; });
    beforePrint = null;
    updateFaqToggle();
  });
  $('print-memo').addEventListener('click', () => { document.body.classList.add('print-memo'); window.print(); });
  $('print-book').addEventListener('click', () => { document.body.classList.remove('print-memo'); window.print(); });
  if ('IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.chapterbar nav a')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) links.forEach(a => { const active = a.hash === '#' + e.target.id; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('.book>.chapter').forEach(el => observer.observe(el));
  }
})();
