const fs=require('fs'); const {E,prod}=require('./fit.js');
const T=JSON.parse(fs.readFileSync(process.argv[2]||'lb_ok.json','utf8'));
const K=[1,2,3,5,7,10,14,20];
function nm(f,x0,step,it){ // Nelder-Mead
  const n=x0.length; let S=[x0.slice()]; for(let i=0;i<n;i++){ const x=x0.slice(); x[i]+=step[i]; S.push(x);} let F=S.map(f);
  for(let k=0;k<it;k++){ const o=[...F.keys()].sort((a,b)=>F[a]-F[b]); S=o.map(i=>S[i]); F=o.map(i=>F[i]);
    const c=Array(n).fill(0); for(let i=0;i<n;i++) for(let j=0;j<n;j++) c[j]+=S[i][j]/n;
    const xr=c.map((v,j)=>v+(v-S[n][j])); const fr=f(xr);
    if(fr<F[0]){ const xe=c.map((v,j)=>v+2*(v-S[n][j])); const fe=f(xe); if(fe<fr){S[n]=xe;F[n]=fe;}else{S[n]=xr;F[n]=fr;} }
    else if(fr<F[n-1]){S[n]=xr;F[n]=fr;}
    else { const xc=c.map((v,j)=>v+0.5*(S[n][j]-v)); const fc=f(xc); if(fc<F[n]){S[n]=xc;F[n]=fc;} else { for(let i=1;i<=n;i++){ S[i]=S[i].map((v,j)=>S[0][j]+0.5*(v-S[0][j])); F[i]=f(S[i]); } } } }
  const b=F.indexOf(Math.min(...F)); return {x:S[b],f:F[b]}; }
const sexK=s=>s==='女'?'f':'m';
// group tables by id+term
const G={};
for(const r of T){ for(const id of r.ids){ const p=prod(id); if(!p||!p.t||!p.t[r.term]) continue; const k=id+'|'+r.term; (G[k]=G[k]||{id,term:r.term,tabs:[]}).tabs.push(r); } }
const out={}; const rep=[];
for(const k in G){ const {id,term,tabs}=G[k]; const p=prod(id); const m=term==='躉繳'?1:+term;
  // dedupe tables: same sex/age keep first
  const seen=new Set(); const tb=tabs.filter(t=>{ const q=t.sex+t.age; if(seen.has(q)) return false; seen.add(q); return true; });
  const cases=[]; for(const t of tb){ const sx=sexK(t.sex); const Gr=E.savGross(p,term,t.age,sx); if(!Gr) continue; const rows=t.rows.filter(z=>z[1]>0&&z[2]!=null); if(rows.length<3) continue; let prem=Gr*10000; { const q=Object.assign({},p,{cal:null}); const r0=E.savCalc(q,term,t.age,sx,prem,null,{irrAt:[]}); const rs=[]; if(r0) for(const z of rows){ const x=r0.rows[z[0]-1]; if(x&&x.V>0) rs.push(z[1]/x.V); } rs.sort((a,b)=>a-b); const md=rs.length?rs[rs.length>>1]:1; const lg=Math.log10(md); if(Math.abs(lg)>0.5) prem*=Math.pow(10,Math.round(lg)); }
    cases.push({age:t.age,sx,prem,rows}); }
  if(!cases.length){ rep.push([k,p.n,'no-gross']); continue; }
  const run=C=>{ const q=Object.assign({},p,{cal:{[term]:C}}); return cases.map(c=>E.savCalc(q,term,c.age,c.sx,c.prem,null,{irrAt:[]})); };
  const err=(C,useCsv)=>{ let e=0,nn=0; const R=run(C); R.forEach((r,i)=>{ if(!r) return; for(const [t,pv,cv] of cases[i].rows){ const x=r.rows[t-1]; if(!x) continue; const tgt=useCsv?cv:pv, v=useCsv?x.csv:x.V; const den=Math.max(1000,Math.abs(tgt)); e+=((v-tgt)/den)**2; nn++; } }); return nn?Math.sqrt(e/nn):9; };
  // step1: V fit (a,b,e)
  const base={a:0.3,b:0.05,s:K.map(()=>0),sm:null,sn:null,e:[0,0,0,0,0,0]};
  const mk=x=>Object.assign({},base,{a:Math.min(.95,Math.max(0,x[0])),b:Math.min(.5,Math.max(0,x[1])),e:x.slice(2,8)});
  const f1=x=>err(mk(x),false);
  let r1=nm(f1,[0.3,0.05,0,0,0,0,0,0],[0.15,0.03,0.3,0.3,0.3,0.3,0.3,0.3],400); r1=nm(f1,r1.x,[0.05,0.01,0.1,0.1,0.1,0.1,0.1,0.1],300);
  const C=mk(r1.x);
  // step2: surrender charge from table ratio
  const ratio=t=>{ const vals=[]; for(const c of cases){ const rr=c.rows; let lo=null,hi=null; for(const z of rr){ if(z[0]<=t) lo=z; if(z[0]>=t&&!hi) hi=z; } const g=z=>z[1]>0?1-z[2]/z[1]:null; let v=null; if(lo&&hi){ if(lo[0]===hi[0]) v=g(lo); else { const u=(t-lo[0])/(hi[0]-lo[0]); const a=g(lo),b=g(hi); if(a!=null&&b!=null) v=a+(b-a)*u; } } else if(lo) v=g(lo); if(v!=null) vals.push(v);} return vals.length?vals.reduce((a,b)=>a+b)/vals.length:0; };
  C.s=K.map(t=>Math.round(Math.max(0,ratio(t))*1000)/1000);
  const has=t=>cases.some(c=>c.rows.some(z=>z[0]===t));
  C.sm=has(m)?Math.round(Math.max(0,ratio(m))*1000)/1000:null; C.sn=has(m+1)?Math.round(Math.max(0,ratio(m+1))*1000)/1000:null;
  C.a=Math.round(C.a*1e4)/1e4; C.b=Math.round(C.b*1e4)/1e4; C.e=C.e.map(v=>Math.round(v*1000)/1000);
  if(C.sm==null) delete C.sm; if(C.sn==null) delete C.sn;
  const e0=err(null,true), e1=err(C,true);
  out[k]={id,term,cal:C,e0,e1,n:p.n,had:!!(p.cal&&p.cal[term]),src:'例表'};
  rep.push([k,p.n,term,'err',e0.toFixed(3),'->',e1.toFixed(3),p.cal&&p.cal[term]?'HAD':'']);
}
fs.writeFileSync(process.argv[3]||'fit_out.json',JSON.stringify(out));
for(const r of rep) console.log(r.join(' '));
