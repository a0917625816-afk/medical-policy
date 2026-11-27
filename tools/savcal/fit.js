const fs=require('fs'); global.localStorage={getItem(){return null},setItem(){}};
const src=fs.readFileSync('/tmp/claude-0/saveng.js','utf8');
const E=new Function(src+'\nreturn {savCalc,savGross,savPlan};')();
const crypto=null;
function hb(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))%256; return h; }
const BC={}; function prod(id){ const k=hb(id); if(!BC[k]) BC[k]=JSON.parse(fs.readFileSync('/home/claude/medical-policy/v/b/'+k+'.json','utf8')); return BC[k][id]; }
module.exports={E,prod};
if(require.main===module){
 const p=prod(process.argv[2]); const term=process.argv[3], age=+process.argv[4], sex=process.argv[5];
 console.log(p.n, Object.keys(p.t||{}), p.u, 'cal', JSON.stringify(p.cal||null).slice(0,200));
 const G=E.savGross(p,term,age,sex); console.log('G',G);
 const r=E.savCalc(p,term,age,sex,G*10000,null,{});
 console.log(r&&r.rows.slice(0,10).map(x=>[x.t,Math.round(x.V),Math.round(x.csv)]));
}
