/* 燈塔：上線當天放進「舊網址（GitHub Pages）」的 index.html 最前面。
   舊網址一打開，就把這台裝置存的本站資料（mpe- 開頭，不含同網域其他專案）打包帶到新網址；資料只放在網址 # 後面，不經過伺服器。
   舊網址加 ?stay=1 可留在舊站（例如要先匯出備份）。__NEW__ 換成新網址（結尾要有 /）。 */
(function(){var OLD="a0917625816-afk.github.io",NEW="__NEW__";if(location.hostname!==OLD||/[?&]stay=1/.test(location.search))return;
var h=location.hash||"";try{document.documentElement.style.visibility="hidden";window.stop()}catch(e){}
var go=function(u){location.replace(u)},ls={},n=0;
try{if(localStorage.getItem("mpe-migDone")){go(NEW+h);return}for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^mpe-/.test(k)&&k!=="mpe-migDone"){ls[k]=localStorage.getItem(k);n++}}}catch(e){}
if(!n){go(NEW+h);return}
var s=JSON.stringify({v:1,ls:ls});
var b64=function(u){var t="";for(var i=0;i<u.length;i+=32768)t+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(t).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};
var fin=function(p){if(p.length>1500000){document.documentElement.innerHTML='<body style="font:16px/1.7 sans-serif;padding:24px;visibility:visible"><h2>燈塔搬到新網址了</h2><p>你這台裝置的資料太多，無法自動搬家。請先<a href="?stay=1">回舊網址</a>用「匯出備份」，再到 <a href="'+NEW+'">'+NEW+'</a> 用「匯入備份檔」。</p></body>';return}
try{localStorage.setItem("mpe-migDone",String(Date.now()))}catch(e){}go(NEW+"#mig="+p+"&then="+encodeURIComponent(h))};
try{if(window.CompressionStream){new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer().then(function(a){fin("z"+b64(new Uint8Array(a)))},function(){fin("j"+b64(new TextEncoder().encode(s)))})}else fin("j"+b64(new TextEncoder().encode(s)))}catch(e){go(NEW+h)}})();
