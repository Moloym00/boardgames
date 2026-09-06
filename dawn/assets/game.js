(function(root){
  'use strict';
  const paths={
    cannon:'<path d="M15 44h66v9H15zM26 43l8-17 44 3v11l-43 4M78 28h9v13h-9M20 54l-6 15m59-16 10 16M44 55v13"/><circle cx="31" cy="65" r="10"/><circle cx="66" cy="65" r="10"/><path d="m10 27-6-4m9 13H5m83-15 7-4m-7 30 7 3"/>',
    board:'<path d="M50 12v42c0 15-14 26-27 17-10-7-9-21 0-26M23 45v15m0-15-13 5M50 54c0 15 14 26 27 17 10-7 9-21 0-26M77 45v15m0-15 13 5M38 29h24"/><circle cx="50" cy="17" r="8"/><path d="M50 3V0M42 89l8-13 8 13"/>',
    smoke:'<path d="M12 18c14 0 20 5 26 15M8 28c12 0 18 5 22 12M36 34l40 26-8 17-41-27 9-16ZM43 39l12-13m6 27 15-9M32 47l-11 4m48 16 13 1M63 78l12 10m-13-3 13 3-2-13"/><ellipse cx="60" cy="23" rx="21" ry="5" transform="rotate(33 60 23)"/><ellipse cx="80" cy="43" rx="15" ry="4" transform="rotate(33 80 43)"/>',
    engine:'<rect x="26" y="27" width="48" height="49" rx="10"/><path d="M35 27V16h30v11M42 16V7h16v9M18 42h8m48 0h9M18 62h8m48 0h9M34 76v10m32-10v10M28 87h44"/><circle cx="50" cy="45" r="10"/><path d="m50 45 5-5M38 63h24"/>',
    chart:'<path d="m15 23 23-10 25 10 22-10v61L63 86 38 74 15 86V23ZM38 13v61m25-51v63"/><path d="m21 55 9-13 16 13 10-16 19 4" stroke-dasharray="3 5"/><path d="m64 30 11-11m-11 0 11 11M24 67l5 4-6 5"/>',
    supply:'<path d="m13 31 36-17 38 17v44L50 90 13 74V31Zm0 0 37 16 37-16M50 47v43M29 23l38 16v14M14 42l35 15m-35-1 35 16m11-18 19-8m-19 23 19-8"/>',
    helm:'<circle cx="50" cy="50" r="25"/><circle cx="50" cy="50" r="9"/><path d="M50 7v34m0 18v34M7 50h34m18 0h34M20 20l24 24m12 12 24 24M20 80l24-24m12-12 24-24"/>',
    ship:'<path d="M9 55h82L77 75H26L9 55ZM29 55V34h43v21M39 34V22h11v12M61 34V14h8v20M21 84h58M17 44h12m43 0h15"/><circle cx="43" cy="45" r="3"/><circle cx="58" cy="45" r="3"/>'
  };
  function icon(name,cls=''){return '<svg class="symbol '+cls+'" viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.ship)+'</svg>';}
  const commands=[
    {id:'cannon',name:'炮击',beats:'board',color:'rust',sub:'稳住射界',reward:'取本区 2 张货物',detail:'不足两张，取剩余的。',flavor:'稳住高度开炮，清场后连续吊走两箱。'},
    {id:'board',name:'钩索',beats:'smoke',color:'brass',sub:'绞索锁住吊架',reward:'取本区 1 张，或夺宝',detail:'夺宝：改抢同区一名俯冲对手已有的 1 张货物。',flavor:'钩住吊架；对手急降，也甩不掉绞索。'},
    {id:'smoke',name:'俯冲',beats:'cannon',color:'teal',sub:'急降避开炮线',reward:'取任一区 1 张货物',detail:'只取公共货物，不碰其他玩家的货物。',flavor:'急降到炮线下，掠过船腹吊走一箱。'}
  ];
  const cargo=[{id:'engine',name:'炉机',zone:'动力口',color:'rust'},{id:'chart',name:'航图',zone:'领航台',color:'teal'},{id:'supply',name:'物资',zone:'货运架',color:'brass'}];
  const contracts=[
    {id:'M01',title:'让旧城亮灯',need:[3,0,0],flavor:'旧城的电缆还在。带三台炉机回去，今晚的灯就不必再灭。'},
    {id:'M02',title:'把天路画回来',need:[0,3,0],flavor:'带回标有山峰、风层与高度的航图，让失联的天路重新通航。'},
    {id:'M03',title:'重建悬桥街',need:[0,0,3],flavor:'街坊守住了崖壁上的旧悬桥。你答应带回修复街区的物资。'},
    {id:'M04',title:'再造一艘远航飞艇',need:[2,1,0],flavor:'船壳仍悬在检修架上。补齐炉机与航图，就能试飞。'},
    {id:'M05',title:'让空坞重新开工',need:[2,0,1],flavor:'崖边空坞的吊臂已经擦亮，只等炉机与修缮材料。'},
    {id:'M06',title:'重开风暴外的航路',need:[1,2,0],flavor:'有了两套航图和新的炉机，你就能带船队穿过旧航线的尽头。'},
    {id:'M07',title:'接回失联的港口',need:[0,2,1],flavor:'找到云层上许久没亮过的泊塔，把第一批补给吊上平台。'},
    {id:'M08',title:'让夜班列车再开',need:[1,0,2],flavor:'站钟还准时。带回动力与材料，末班列车就不必永远是末班。'},
    {id:'M09',title:'把补给送到高塔',need:[0,1,2],flavor:'云层另一侧的高塔还在等。按风层航图，把补给送上去。'},
    {id:'M10',title:'建起一座自由空港',need:[1,1,1],flavor:'一台炉机、一份航图、一批物资。让山巅成为新的停泊点。'}
  ];
  function resolveZone(entries,leader,n){
    if(!Number.isInteger(n)||n<4||n>8||!Number.isInteger(leader)||leader<1||leader>n)throw Error('人数或领航座号无效');
    const seen=new Set();
    for(const e of entries){if(!Number.isInteger(e.seat)||e.seat<1||e.seat>n||seen.has(e.seat)||!commands.some(c=>c.id===e.command))throw Error('指令或座号无效');seen.add(e.seat);}
    const kinds=[...new Set(entries.map(e=>e.command))];
    if(!kinds.length)return {winner:null,reason:'empty',defeated:[]};
    if(kinds.length===3)return {winner:null,reason:'stalemate',defeated:[]};
    const kind=kinds.length===1?kinds[0]:kinds.find(k=>kinds.includes(commands.find(c=>c.id===k).beats));
    const eligible=entries.filter(e=>e.command===kind).sort((a,b)=>(a.seat-leader+n)%n-(b.seat-leader+n)%n);
    return {winner:eligible[0].seat,command:kind,reason:kinds.length===1?'priority':'counter',defeated:entries.filter(e=>e.command!==kind).map(e=>e.seat)};
  }
  function score(goods,need){
    if(goods.length!==3||need.length!==3||goods.some(v=>!Number.isInteger(v)||v<0)||need.some(v=>!Number.isInteger(v)||v<0))throw Error('货物数无效');
    const base=goods.reduce((a,b)=>a+b,0),complete=need.every((v,i)=>goods[i]>=v),bonus=complete?3:0;
    return {base,complete,bonus,total:base+bonus};
  }
  const api={commands,cargo,contracts,icon,resolveZone,score};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.DawnGame=api;
})(typeof window==='undefined'?globalThis:window);
