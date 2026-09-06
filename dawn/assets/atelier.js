(() => {
  'use strict';
  const G = window.DawnGame,
        players = document.getElementById('print-players'),
        scope = document.getElementById('print-scope'),
        pages = document.getElementById('print-pages');

  const artKey = key => ['cannon','board','smoke','harbor','chart'].includes(key) ? key + '-sky' : key;
  const art = (key, alt, cls='card-art') => `<img class="${cls}" src="assets/card-art/${artKey(key)}.png" alt="${alt}" loading="eager">`;
  const needText = c => c.need.map((v, i) => v ? `${G.cargo[i].name} × ${v}` : '').filter(Boolean).join(' ＋ ');

  // 1. 指令牌（战术决胜公文）
  function command(c, seat) {
    const prey = G.commands.find(x => x.id === c.beats),
          pred = G.commands.find(x => x.beats === c.id);
    const detailText = c.id === 'board' 
      ? '夺宝：改由你指定同区一名俯冲对手，夺取其 1 张已有货物。' 
      : c.detail;
    const subCodes = {
      cannon: 'TACTICAL CANNONADE',
      board: 'HARPOON & CABLE',
      smoke: 'DIVE & DESCENT'
    };

    return `<article class="playing-card command-card ${c.color}" data-kind="command" data-seat="${seat}" data-command="${c.id}">
      <div class="card-head">
        <span class="ship-tag">不落号 · 战术指令公文</span>
        <span class="flight-sub tag-pill">${c.sub}</span>
      </div>
      <div class="card-title brass-plate">
        <div class="title-text-group">
          <h2>${c.name}</h2>
          <span class="micro-sub">[ ${subCodes[c.id]} ]</span>
        </div>
        <span class="seat-label">№ <b>${seat}</b> 船长</span>
      </div>
      ${art(c.id, c.sub)}
      <div class="card-rule">${c.reward}</div>
      <p class="card-detail">${detailText}</p>
      <p class="flight-flavor">${c.flavor}</p>
      <div class="card-foot">
        <b>克制${prey.name}</b> · 被${pred.name}克制<br>
        仅胜者执行；打出后，<b>下一轮横置整备</b>。
      </div>
    </article>`;
  }

  // 2. 货物牌（货舱工坊挂签）
  function cargo(c, i) {
    const flavor = {
      engine: '让停工的机器重新转起来。',
      chart: '山峰、风层与高度，都在图上。',
      supply: '高塔上的人，还在等这一批货。'
    };
    const codes = {
      engine: 'SPEC. STEAM CORE TYPE-B',
      chart: 'SPEC. AERO-CHART 1904',
      supply: 'SPEC. HIGHLAND CARGO'
    };

    return `<article class="playing-card cargo-card ${c.color}" data-kind="cargo" data-cargo="${c.id}">
      <div class="card-head">
        <span class="cargo-corner-tag ${c.color}">【${c.name}】1分</span>
        <span class="zone-badge">${c.zone} · ${String(i).padStart(2, '0')}</span>
      </div>
      <div class="card-title brass-plate">
        <div class="title-text-group">
          <h2>${c.name}</h2>
          <span class="micro-sub">[ ${codes[c.id]} ]</span>
        </div>
        <span class="cargo-title-score">持有 1 分</span>
      </div>
      ${art(c.id, c.name + '插画')}
      <div class="card-rule">
        <span>持有计分</span>
        <span class="score-medal">1分</span>
      </div>
      <p class="card-flavor">${flavor[c.id]}</p>
      <div class="card-foot">
        正面公开摆放；每张在终局得 1 分。<br>
        可同时用于完成私人委托，不消耗本卡。
      </div>
    </article>`;
  }

  // 3. 私人委托（极密封函：单行标题绝不重叠折行，三层独立底栏）
  function mission(c) {
    const items = c.need.flatMap((v, i) => Array.from({ length: v }, () => G.cargo[i]));
    const isMono = c.need.some(v => v === 3);
    const isTri = c.need.every(v => v === 1);
    const strategy = isMono ? '【专注目标 · 善用炮击连续取货】' : isTri ? '【灵活航线 · 善用俯冲全域补给】' : '【复合目标 · 兼顾主区与机动】';

    return `<article class="playing-card mission-card brass" data-kind="mission" data-mission="${c.id}">
      <div class="card-head">
        <span class="ship-tag">私人委托 · 终局前保密</span>
        <span class="mission-badge">极密 · ${c.id}</span>
      </div>
      <div class="card-title brass-plate">
        <div class="title-text-group">
          <h2>${c.title}</h2>
          <span class="micro-sub">[ CONFIDENTIAL CONTRACT ]</span>
        </div>
      </div>
      ${art(c.id.toLowerCase() + '-unique', c.title + '的独立场景插画')}
      <div class="goal-icons">
        ${items.map(x => `<span class="goal-item ${x.color}">${G.icon(x.id)}<b>${x.name}</b></span>`).join('')}
      </div>
      <p class="card-detail">${c.flavor}</p>
      <div class="card-foot">
        <div class="need-line">目标需求：<b>${needText(c)}</b></div>
        <div class="reward-line">
          <span class="reward-pill">达成计分</span>
          <b class="reward-pts">终局额外 ＋3 分</b>
        </div>
        <div class="strategy-line">${strategy}</div>
      </div>
    </article>`;
  }

  // 4. 领航标记
  function leader() {
    return `<article class="playing-card leader-card" data-kind="leader">
      <div class="card-head">
        <span class="ship-tag">飞航议定 · 唯一标记</span>
        <span class="serial">LEAD-01</span>
      </div>
      <div class="card-title brass-plate">
        <div class="title-text-group">
          <h2>领航标记</h2>
          <span class="micro-sub">[ FLAGSHIP NAVIGATION SYSTEM ]</span>
        </div>
        <span class="leader-badge">全局唯一</span>
      </div>
      ${art('leader-unique', '领航艇在黎明中引导飞艇编队')}
      <div class="card-rule">同类指令打平时，你最先。</div>
      <p class="card-detail">
        再顺时针向左决定先后。<br>
        领航不改变克制，也不打破三方牵制。
      </p>
      <p class="leader-first">首位领航者：<b>　　　　　号船长</b></p>
      <div class="card-foot">
        每轮结束交给左手边。<br>
        <b>标记回到首位领航者时，游戏立即结束。</b>
      </div>
    </article>`;
  }

  // 5. 速查备忘卡
  function reference(i) {
    return `<article class="playing-card quick-card" data-kind="reference">
      <div class="card-head">
        <span class="ship-tag">船长备忘 · 不入卡组</span>
        <span class="serial">REF-${String(i).padStart(2, '0')}</span>
      </div>
      <div class="card-title brass-plate">
        <div class="title-text-group">
          <h2>天亮之前·备忘</h2>
          <span class="micro-sub">[ COMBAT FLIGHT MEMORANDUM ]</span>
        </div>
        <span class="quick-badge">速查备忘</span>
      </div>
      <div class="quick-lines">
        <p><b>出航</b>　指令＋空域手势，同时亮出。</p>
        <p><b>克制</b>　炮击→钩索→俯冲→炮击。</p>
        <p><b>三种齐全</b>　本区牵制，全员空手。</p>
        <p><b>同类打平</b>　本轮领航者最先，再向左。</p>
        <p><b>炮击</b>　本区取 2 张（不足取剩余）。</p>
        <p><b>钩索</b>　本区取 1，或抢同区俯冲对手已有 1 张。</p>
        <p><b>俯冲</b>　任一公共空域取 1 张。</p>
        <p><b>整备</b>　打出的牌正面横置，下轮不可出。</p>
        <p><b>计分</b>　每货 1 分，完整委托额外＋3。</p>
      </div>
      <div class="card-foot">
        结算顺序：1 动力口 → 2 领航台 → 3 货运架。<br>
        胜者依当时公共库存取货，货物公开。
      </div>
    </article>`;
  }

  // 统一卡背（完全中心对称，倒转打印 100% 吻合）
  function back() {
    const title = '<div class="back-caption">劫走黎明<small>THE DAWN RAID</small></div>';
    return `<article class="playing-card back-card" data-kind="back">
      ${title}
      ${art('back', '铜版飞航罗盘与飞艇徽章', 'back-art')}
      <div class="back-reverse">${title}</div>
    </article>`;
  }

  // A4 单页打印（绝对几何中心对称）
  function sheet(cards, title, index, total, type) {
    return `<section class="sheet cards-sheet" data-sheet="${type}">
      <div class="sheet-header">
        <strong>${title}</strong>
        <span>第 ${index} / ${total} 页 · A4 绝对中心对齐</span>
      </div>
      <div class="card-grid">${cards.join('')}</div>
      <div class="sheet-footer">
        <span>【单面打印机翻面对位】：打完正面后，把纸头倒过来原纸送入打印反面</span>
        <span>50 mm 尺标<i class="ruler"></i></span>
      </div>
    </section>`;
  }

  // 空域图
  function board(n) {
    return `<section class="sheet board-sheet" data-sheet="board">
      <div class="sheet-header">
        <strong>劫走黎明 · 不落号空域图</strong>
        <span>A4 纵向 · 本页不裁切</span>
      </div>
      <div class="board-title">
        <h2>不落号</h2>
        <p>${n} 人出航 / 共 ${n} 轮<br>每区开局 ${n} 张货物</p>
      </div>
      <div class="board-zones">
        ${G.cargo.map((c, i) => `<div class="board-zone">
          <span class="zone-num">${i + 1}</span>
          <h3>${c.zone}</h3>
          <p class="zone-position">${['腹侧 · 动力吊口外', '上层 · 驾驶台外', '尾部 · 货运吊架外'][i]}</p>
          ${art(c.id, c.name, 'zone-art')}
          <p>${c.name} × ${n}</p>
          <div class="cargo-space">
            <b>本区公共货物</b>
            <span>货物叠放在本区旁</span>
            <span>指令放在本区前方桌面</span>
          </div>
        </div>`).join('')}
      </div>
      <div class="board-counter">炮击 → 钩索 → 俯冲 → 炮击</div>
      <div class="board-reference">
        <div><strong>一位船长：</strong>直接胜出，执行指令取货。</div>
        <div><strong>一种指令多人：</strong>领航者最先，顺时针向左选出胜者。</div>
        <div><strong>恰好两种指令：</strong>克制方胜出。同类多人再看领航。</div>
        <div><strong>三种指令齐全：</strong>本区牵制无人得手，不拿货不夺宝。</div>
        <div><strong>炮击 / 俯冲：</strong>炮击取本区 2；俯冲任一公共区 1。</div>
        <div><strong>钩索：</strong>取本区 1；或由胜者指定夺取同区俯冲对手已有 1 张。</div>
      </div>
      <p class="board-end">
        <b>结算顺序：</b>1 动力口 → 2 领航台 → 3 货运架，按当时库存取货。<br>
        <b>每轮整备：</b>打出的牌正面横置在面前整备，上轮旧牌回手；领航标记向左传。<br>
        <b>终局决胜：</b>回到首位领航者时终局。货物每张 1 分，完整委托额外 3 分。最高分胜。
      </p>
      <div class="board-footer">
        每区最多一位胜者。货物公开摆放，委托秘密保管；总分最高者个人获胜，同分并列。
      </div>
    </section>`;
  }

  // 试印样张（正反 2 页，专门用于测试翻面对印）
  function sample() {
    const sampleFront = [
      command(G.commands[0], 1),
      command(G.commands[1], 2),
      command(G.commands[2], 3),
      cargo(G.cargo[0], 1),
      cargo(G.cargo[1], 1),
      cargo(G.cargo[2], 1),
      mission(G.contracts[3]), // M04: 再造一艘远航飞艇（测试 8 字最长委托标题）
      leader(),
      reference(1)
    ];
    return sheet(sampleFront, '劫走黎明 · 试印样张【正面】（先打此页）', 1, 2, 'sample-front') +
           sheet(Array.from({ length: 9 }, back), '劫走黎明 · 试印样张【反面】（把纸头倒过来翻面送入打此页）', 2, 2, 'sample-back');
  }

  // 渲染函数
  function render() {
    const n = Number(players.value),
          mode = scope.value,
          front = [];

    for (let seat = 1; seat <= n; seat++) {
      G.commands.forEach(c => front.push(command(c, seat)));
    }
    G.cargo.forEach(c => {
      for (let i = 1; i <= n; i++) front.push(cargo(c, i));
    });
    G.contracts.forEach(c => front.push(mission(c)));
    front.push(leader());

    const actual = front.length,
          sheets = Math.ceil(actual / 9),
          extras = sheets * 9 - actual;

    for (let i = 0; i < extras; i++) front.push(reference(i + 1));

    let output = '';
    if (mode === 'sample') {
      output = sample();
    } else if (mode === 'duplex') {
      // 适合单张进纸：正面1 -> 卡背1 -> 正面2 -> 卡背2...
      for (let i = 0; i < sheets; i++) {
        output += sheet(front.slice(i * 9, i * 9 + 9), `劫走黎明 · ${n} 人正面（第 ${i + 1} / ${sheets} 组）`, 2 * i + 1, 2 * sheets, 'front');
        output += sheet(Array.from({ length: 9 }, back), `劫走黎明 · 统一卡背（第 ${i + 1} / ${sheets} 组对应反面）`, 2 * i + 2, 2 * sheets, 'back');
      }
    } else if (mode === 'cards') {
      // 批量正面
      for (let i = 0; i < sheets; i++) {
        output += sheet(front.slice(i * 9, i * 9 + 9), `劫走黎明 · ${n} 人全部正面（第 ${i + 1} / ${sheets} 页）`, i + 1, sheets, 'front');
      }
    } else if (mode === 'backs') {
      // 批量卡背
      for (let i = 0; i < sheets; i++) {
        output += sheet(Array.from({ length: 9 }, back), `劫走黎明 · 全部统一卡背（第 ${i + 1} / ${sheets} 页）`, i + 1, sheets, 'back');
      }
    } else if (mode === 'board') {
      output = board(n);
    } else { // 'all'
      for (let i = 0; i < sheets; i++) {
        output += sheet(front.slice(i * 9, i * 9 + 9), `劫走黎明 · ${n} 人正面`, i + 1, sheets, 'front');
      }
      for (let i = 0; i < sheets; i++) {
        output += sheet(Array.from({ length: 9 }, back), '劫走黎明 · 统一卡背', i + 1, sheets, 'back');
      }
      output += board(n);
    }

    pages.innerHTML = output;

    const summary = mode === 'sample' 
      ? '【对位测试样张】：共 2 页（1 正 1 反）。拿 1 张纸先打第 1 页，打完后把纸头倒过来翻面送入打印机打第 2 页，对光检查正反是否 100% 严丝合缝！'
      : mode === 'duplex'
        ? `【手动双面逐页对印】：共 ${2 * sheets} 页（正反交替）。打印机每次打出正面，将该纸“纸头倒过来翻面”送入即可打印背面，一刀切开即得成品，无需胶水贴合！`
        : mode === 'cards'
          ? `【批量模式·全部正面】：共 ${sheets} 张 A4。整叠正面全部打完后，整叠纸头倒过来送回纸槽，再切换到“全部卡背”打印。`
          : mode === 'backs'
            ? `【批量模式·全部卡背】：共 ${sheets} 张 A4。用于整叠正面打完后的翻面批量套印。`
            : mode === 'board'
              ? `${n} 人空域图，共 1 张 A4，桌面中央使用不裁切。`
              : `${n} 人完整套装：正面 ${sheets} 页 ＋ 卡背 ${sheets} 页 ＋ 空域图 1 页。`;

    document.getElementById('print-summary').textContent = summary;
    document.title = `劫走黎明 · ${n} 人卡牌工坊`;
  }

  function updateScopeUi() {
    const n = Number(players.value),
          mode = scope.value,
          count = 6 * n + 11,
          sheets = Math.ceil(count / 9),
          extras = sheets * 9 - count;

    document.getElementById('print-inventory').innerHTML = `
      <strong>${n} 人全套清单 · ${count} 张游戏卡（沉浸式工坊印刷版）</strong>
      <div class="inventory-grid">
        <span><b>${3 * n}</b> 指令牌<small>四角微铆钉，№座号微标，微缩航空军械局工规副标</small></span>
        <span><b>${3 * n}</b> 货物牌<small>工坊货签吊牌，无缝密排，错位叠放一眼数清</small></span>
        <span><b>10</b> 私人委托<small>极密朱红小钢印，独立油画与战术提示，额外+3分</small></span>
        <span><b>1</b> 领航标记<small>全局唯一议定标，附 ${extras} 张速查备忘卡</small></span>
      </div>
    `;

    const labels = {
      duplex: `打印正反对印 · ${2 * sheets} 页（单张翻面进纸）`,
      cards: `打印全部正面 · ${sheets} 页（批量模式）`,
      backs: `打印全部卡背 · ${sheets} 页（批量模式）`,
      all: `打印全部卡片 · ${2 * sheets + 1} 页`,
      board: '打印空域图 · 1 页',
      sample: '打印对位测试样张 · 2 页（1正1反）'
    };
    document.getElementById('print-cards').textContent = labels[mode];
    document.getElementById('print-summary').classList.toggle('sample-warning', mode === 'sample');
    document.getElementById('view-all').setAttribute('aria-pressed', String(mode === 'duplex' || mode === 'all'));
    document.getElementById('view-sample').setAttribute('aria-pressed', String(mode === 'sample'));

    const links = [];
    for (const [kind, label] of [['front', `正面 ${sheets} 页`], ['back', `卡背 ${sheets} 页`], ['board', '空域图 1 页']]) {
      const first = pages.querySelector(`[data-sheet=${kind}]`);
      if (first) {
        first.id = 'print-' + kind;
        links.push(`<a href="#print-${kind}">${label} ↓</a>`);
      }
    }
    document.getElementById('print-page-links').innerHTML = links.join('　·　');
  }

  const originalRender = render;
  render = function() {
    originalRender();
    updateScopeUi();
  };

  document.getElementById('view-all').addEventListener('click', () => { scope.value = 'duplex'; render(); });
  document.getElementById('view-sample').addEventListener('click', () => { scope.value = 'sample'; render(); });
  players.addEventListener('change', render);
  scope.addEventListener('change', render);
  document.getElementById('print-cards').addEventListener('click', () => window.print());

  const p = new URLSearchParams(location.search);
  if (p.has('mode') && ['duplex', 'sample', 'all', 'cards', 'backs', 'board'].includes(p.get('mode'))) scope.value = p.get('mode');
  if (p.has('n') && Number(p.get('n')) >= 4 && Number(p.get('n')) <= 8) players.value = p.get('n');

  render();
})();

