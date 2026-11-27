const fs=require('fs'); global.localStorage={getItem(){return null},setItem(){}};
const E=new Function(fs.readFileSync('/tmp/claude-0/saveng.js','utf8')+'\nreturn {savCalc,savGross};')();
const R=JSON.parse(fs.readFileSync('new_recs.json','utf8')); const out={};
for(const p of Object.values(R)){ for(const term of Object.keys(p.t)){ const age=30; const G=E.savGross(p,term,age,'m'); if(!G){console.log(p.n.slice(0,22),term,'noG');continue;}
  const SA=10000, prem=G*SA; const r=E.savCalc(p,term,age,'m',prem,null,{irrAt:[]}); if(!r){console.log('nocalc');continue;}
  const at=y=>{const x=r.rows[y-1]; return x?(x.csv/x.cum).toFixed(2):'-';};
  console.log(p.n.slice(0,24).padEnd(24),term.padStart(3),'G/SA',G.toFixed(3),'cum',Math.round(r.rows[Math.min(r.rows.length,20)-1].cum),'csv/cum y5',at(5),'y10',at(10),'y20',at(20),'y30',at(30),'n',r.rows.length);
}}
