// 以舊校準（未含還本）算出的解約金曲線當目標，加上還本表後重新擬合 cal
const fs=require('fs'); global.localStorage={getItem(){return null},setItem(){}};
const E=new Function(fs.readFileSync('/tmp/claude-0/saveng.js','utf8')+'\nreturn {savCalc,savGross};')();
function hb(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))%256; return h; }
const {nm}=require('./nm.js');
const SV=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); // {id:{term:[sv rows]}}
const out={};
for(const id in SV){ const f='/home/claude/medical-policy/v/b/'+hb(id)+'.json'; const p=JSON.parse(fs.readFileSync(f))[id];
 for(const term in SV[id]){ const C0=p.cal&&p.cal[term]; if(!C0) continue;
  const ages=[30,45]; const prem=1e6/(p.cur==='台幣'?1:30);
  const tgt=ages.map(a=>{ const q=Object.assign({},p,{cal:{[term]:C0},svT:{[term]:[]},sv:null}); const r=E.savCalc(q,term,a,'m',prem,null,{irrAt:[]}); return r.rows.slice(0,40).map(x=>x.csv); });
  const mk=x=>Object.assign({},C0,{a:Math.max(0,Math.min(.95,x[0])),b:Math.max(0,Math.min(.5,x[1])),e:x.slice(2,8)});
  const err=x=>{ const C=mk(x); let e=0,n=0; ages.forEach((a,i)=>{ const q=Object.assign({},p,{cal:{[term]:C},svT:{[term]:SV[id][term]},sv:null}); const r=E.savCalc(q,term,a,'m',prem,null,{irrAt:[]}); if(!r) return; tgt[i].forEach((v,t)=>{ const m=r.rows[t]; if(!m) return; e+=((m.csv-v)/Math.max(prem*0.05,v))**2; n++; }); }); return n?Math.sqrt(e/n):9; };
  const e0=err([C0.a,C0.b,...(C0.e||[0,0,0,0,0,0])]);
  let r=nm(err,[C0.a,C0.b,...(C0.e||[0,0,0,0,0,0])],[0.1,0.03,0.3,0.3,0.3,0.3,0.3,0.3],500); r=nm(err,r.x,[0.03,0.01,0.1,0.1,0.1,0.1,0.1,0.1],400);
  const C=mk(r.x); C.a=+C.a.toFixed(4); C.b=+C.b.toFixed(4); C.e=C.e.map(v=>+v.toFixed(3));
  out[id+'|'+term]={id,term,cal:C,e0,e1:r.f,n:p.n};
  console.log(p.n.slice(0,16),term,'err before',e0.toFixed(3),'after',r.f.toFixed(3));
 } }
fs.writeFileSync('refit_out.json',JSON.stringify(out));
