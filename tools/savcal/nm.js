function nm(f,x0,step,it){ // Nelder-Mead
  const n=x0.length; let S=[x0.slice()]; for(let i=0;i<n;i++){ const x=x0.slice(); x[i]+=step[i]; S.push(x);} let F=S.map(f);
  for(let k=0;k<it;k++){ const o=[...F.keys()].sort((a,b)=>F[a]-F[b]); S=o.map(i=>S[i]); F=o.map(i=>F[i]);
    const c=Array(n).fill(0); for(let i=0;i<n;i++) for(let j=0;j<n;j++) c[j]+=S[i][j]/n;
    const xr=c.map((v,j)=>v+(v-S[n][j])); const fr=f(xr);
    if(fr<F[0]){ const xe=c.map((v,j)=>v+2*(v-S[n][j])); const fe=f(xe); if(fe<fr){S[n]=xe;F[n]=fe;}else{S[n]=xr;F[n]=fr;} }
    else if(fr<F[n-1]){S[n]=xr;F[n]=fr;}
    else { const xc=c.map((v,j)=>v+0.5*(S[n][j]-v)); const fc=f(xc); if(fc<F[n]){S[n]=xc;F[n]=fc;} else { for(let i=1;i<=n;i++){ S[i]=S[i].map((v,j)=>S[0][j]+0.5*(v-S[0][j])); F[i]=f(S[i]); } } } }
  const b=F.indexOf(Math.min(...F)); return {x:S[b],f:F[b]}; }

module.exports={nm};
