const {chromium}=require('playwright');
const CASES=JSON.parse(process.argv[2]);
(async()=>{const b=await chromium.launch();const p=await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html',{waitUntil:'load'});await p.waitForFunction(()=>typeof P!=='undefined'&&P.length>1000,null,{timeout:60000});
const out=await p.evaluate(async(CASES)=>{ const res=[];
 for(const c of CASES){ const pol=P.find(x=>x.name===c.name); if(!pol){res.push({c:c.id,err:'no pol'});continue;}
  const n=Math.floor(pol.i/200); const X=pol.hd?(await loadShard(n)||{})[pol.i]:null; const R=pol.hr?((await loadRate(n))||{})[pol.i]:null;
  if(!X){res.push({c:c.id,err:'no X'});continue;}
  if(X._surg===undefined){X._surg=null; if(needSurgX(X)){const sj=await loadSurg(n); X._surg=sj&&sj[pol.i]||null;}}
  const {st,plans}=mineSt(pol,X,R,Object.assign({s:'男',age:35},c.cfg||{}));
  if(c.info){ res.push({c:c.id,plans,st:{plan:st.plan,amt:st.amt,pi:st.pi,unit:st.unit},ben:X.ben.map(b=>b.n+' | '+(b.r||[]).join(';')).slice(0,40)}); continue; }
  const r=simRun(X,st,Object.assign({},SIM_DEF,c.S),pol);
  res.push({c:c.id,total:r.total,rows:r.rows.filter(z=>z.pay).map(z=>[z.b&&z.b.n,z.pay,z.calc]),unk:r.unknown.length});
 } return res; },CASES);
console.log(JSON.stringify(out,null,1)); await b.close();})();
