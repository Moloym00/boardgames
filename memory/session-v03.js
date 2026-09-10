/* 单人实验：保存种子和合法行动，恢复时重新演算，不接受任意状态对象。 */
const MemorySession=(()=>{
 const key='truefire-memory-m03-tab-v1';let journal={version:1,seed:1,actions:[]},message='本标签页自动保存，刷新可继续；不跨设备同步。';
 function restore(M){try{const raw=sessionStorage.getItem(key);if(!raw)return {seed:1,game:M.create(1)};if(raw.length>100000)throw Error('oversize');const data=JSON.parse(raw);if(data.version!==1||!Number.isInteger(data.seed)||data.seed<0||data.seed>4294967295||!Array.isArray(data.actions)||data.actions.length>512)throw Error('format');let game=M.create(data.seed);for(const a of data.actions){if(!Array.isArray(a)||a.length!==2||!Number.isInteger(a[0])||typeof a[1]!=='string'||!/^\d{1,5}$/.test(a[1]))throw Error('action');game=M.act(game,a[0],a[1]);}M.check(game);journal=data;return {seed:data.seed,game};}catch{message='未能恢复本标签页进度，已开始新一局。';return {seed:1,game:M.create(1)};}}
 function save(){try{sessionStorage.setItem(key,JSON.stringify(journal));message='本标签页自动保存，刷新可继续；不跨设备同步。';}catch{message='浏览器未能保存进度，请暂时不要刷新此页。';}}
 function record(seed,who,id){if(journal.seed!==seed)journal={version:1,seed,actions:[]};journal.actions.push([who,String(id)]);save();}
 function reset(seed){journal={version:1,seed,actions:[]};save();}
 return {restore,record,reset,status:()=>message};
})();
