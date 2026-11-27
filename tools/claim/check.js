// node check.js（需先在 repo 根目錄開 python3 -m http.server 8765）
const {execFileSync}=require('child_process'); const C=require('./cases.json');
const out=JSON.parse(execFileSync('node',[__dirname+'/run.js',JSON.stringify(C)]).toString());
let bad=0; for(const c of C){ const r=out.find(x=>x.c===c.id); const ok=r&&r.total===c.exp; if(!ok) bad++; console.log(ok?'OK ':'NG ',c.id,c.note,'→',r&&r.total,'預期',c.exp); }
process.exit(bad?1:0);
