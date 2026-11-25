/* 燈塔：上線（Cloudflare）時由建置程式插入網頁最前面。內容：網域鎖、舊網址搬家接收端、隱藏記號過濾、頁尾聲明。
   __OKHOSTS__ 與 __HOME__ 會在建置時換成正式網址。 */
(function(){
  /* 1) 網域鎖：網站被整包複製到別的網址時，只顯示官方網址，不執行任何功能 */
  var ok=__OKHOSTS__, home="__HOME__", suf="__OKSUFFIX__", h=location.hostname;
  if(ok.indexOf(h)<0&&!(suf&&h.slice(-suf.length-1)==="."+suf)){ window.__LOCKED=1; try{window.stop()}catch(e){}
    document.documentElement.innerHTML='<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>燈塔 Pharos</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;font:16px/1.7 sans-serif;background:#f6f3ec;color:#222;text-align:center;padding:24px"><div><h1 style="font-size:22px">此工具僅限官方網站使用</h1><p>請到官方網址使用：<br><a href="'+home+'">'+home+'</a></p><p style="font-size:13px;color:#777">© 2026 燈塔 Pharos 版權所有，未經授權不得重製。</p></div></body>';
    throw new Error("unlicensed host"); }

  /* 2) 舊網址搬家（接收端）：收到 #mig= 時，把舊網址這台裝置的資料（只限本站 mpe- 開頭）存進來；新網址已有的不覆蓋 */
  var m=location.hash.match(/^#mig=([^&]+)&then=(.*)$/);
  if(m){ try{document.documentElement.style.visibility="hidden";window.stop()}catch(e){}
    var then=""; try{then=decodeURIComponent(m[2]||"")}catch(e){}
    var done=function(n){ try{sessionStorage.setItem("migN",String(n))}catch(e){} try{history.replaceState(null,"",location.pathname+location.search+then)}catch(e){} location.reload(); };
    var apply=function(txt){ var n=0; try{ var o=JSON.parse(txt).ls||{}; for(var k in o){ if(!/^mpe-/.test(k)) continue; if(localStorage.getItem(k)===null){ localStorage.setItem(k,o[k]); n++; } } }catch(e){ n=-1 } done(n); };
    try{ var p=m[1], t=p.slice(1).replace(/-/g,"+").replace(/_/g,"/"); while(t.length%4) t+="="; var bin=atob(t), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      if(p.charAt(0)==="z") new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text().then(apply,function(){done(-1)}); else apply(new TextDecoder().decode(u)); }catch(e){ done(-1) }
    return; }
  try{ var mn=sessionStorage.getItem("migN"); if(mn!==null){ sessionStorage.removeItem("migN"); addEventListener("load",function(){ var d=document.createElement("div"); d.textContent=+mn>0?"已把舊網址的資料搬過來（"+mn+" 項），之後請用這個新網址":"網站已搬到這個新網址，之後請用這裡"; d.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2b3a33;color:#fff;padding:12px 18px;border-radius:12px;z-index:99999;font:15px/1.5 sans-serif;max-width:90vw"; document.body.appendChild(d); setTimeout(function(){d.remove()},6000); }); } }catch(e){}

  /* 3) 隱藏記號：資料檔裡藏了幾筆假保單（名稱帶不可見記號），只給「直接抓資料檔」的人看到；網站畫面自動濾掉 */
  var SIG="​‌​‍", of=window.fetch;
  if(of) window.fetch=function(u){ var s=typeof u==="string"?u:(u&&u.url)||""; var r=of.apply(this,arguments);
    if(!/(^|\/)policies\.json(\?|$)/.test(s)) return r;
    return r.then(function(res){ if(!res.ok) return res; return res.text().then(function(t){ try{ var rows=JSON.parse(t); if(Array.isArray(rows)){ rows=rows.filter(function(x){ return !(x&&typeof x[1]==="string"&&x[1].indexOf(SIG)>-1) }); t=JSON.stringify(rows); } }catch(e){} return new Response(t,{status:200,headers:{"content-type":"application/json"}}); }); }); };

  /* 4) 頁尾聲明 */
  addEventListener("DOMContentLoaded",function(){ var f=document.createElement("p"); f.style.cssText="text-align:center;font-size:12px;color:#888;margin:24px 12px 32px";
    f.textContent="© 2026 燈塔 Pharos 版權所有。本站資料經整理編輯，禁止以程式、爬蟲或 AI 自動抓取；資料含識別記號，未經授權重製將依法追究。"; document.body.appendChild(f); });
})();
