const fs=require('fs'); global.localStorage={getItem(){return null},setItem(){}};
const E=new Function(fs.readFileSync('/tmp/claude-0/saveng.js','utf8')+'\nreturn {savCalc,savGross};')();
function hb(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))%256; return h; }
const ids=process.argv.slice(2);
for(const id of ids){ const p=JSON.parse(fs.readFileSync('/home/claude/medical-policy/v/b/'+hb(id)+'.json'))[id];
 for(const term of Object.keys(p.t)){ const r=E.savCalc(p,term,40,'m',100000,null,{irrAt:[]}); if(!r){console.log(p.n,term,'null');continue;}
  const g=y=>{const x=r.rows[y-1]; return x?`y${y} 領${Math.round(x.cumPay/1000)}k 解${Math.round(x.csv/1000)}k 總/繳${(x.tot/x.cum).toFixed(2)}`:''};
  console.log(p.n.slice(2,14).padEnd(12),term.padStart(2),g(5),'|',g(10),'|',g(20),'|',g(30)); } }
