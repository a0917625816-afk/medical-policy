#!/usr/bin/env bash
# 燈塔：Cloudflare Pages 建置（上線收費時啟用）。只發佈網站需要的檔案，tools／clauses／gx／內部筆記一律不公開。
# Cloudflare Pages 設定：建置指令 bash .github/scripts/build_site.sh、輸出資料夾 _site
# 需要的環境變數：SITE_HOST＝正式網域（例如 pharos.tw，不含 https://）
set -uo pipefail
HOST="${SITE_HOST:-}"
PAGES_HOST=""; [ -n "${CF_PAGES_URL:-}" ] && PAGES_HOST="$(echo "$CF_PAGES_URL" | sed -E 's#https?://##; s#^[^.]+\.##')"   # <hash>.<專案>.pages.dev → <專案>.pages.dev
rm -rf _site && mkdir -p _site
cp index.html policies.json stop.json _site/
for d in appicon c concept d f ppimg r s v account admin; do [ -d "$d" ] && cp -r "$d" _site/; done
touch _site/.nojekyll

# 1) 隱藏記號：在發佈用的 policies.json 尾端加幾筆假保單（畫面會自動濾掉，只有直接抓資料檔的人拿得到）
#    假保單清單放在 Cloudflare 環境變數 CANARY_ROWS（JSON 陣列），不寫進儲存庫，避免被看到後過濾掉
python3 - <<'PY' || exit 1
import json,os
p='_site/policies.json'; rows=json.load(open(p,encoding='utf-8')); S='\u200b\u200c\u200b\u200d'
extra=json.loads(os.environ.get('CANARY_ROWS') or '[]')
for r in extra: r[1]=r[1]+S
rows+=extra
json.dump(rows,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('policies',len(rows),'canary',len(extra))
PY

# 2) 網域鎖＋搬家接收端＋記號過濾＋頁尾聲明：插到網頁最前面
OK='["localhost","127.0.0.1",""'; [ -n "$HOST" ] && OK="$OK,\"$HOST\",\"www.$HOST\""; [ -n "$PAGES_HOST" ] && OK="$OK,\"$PAGES_HOST\""; OK="$OK]"
HOME_URL="https://${HOST:-${PAGES_HOST:-localhost}}/"
python3 - "$OK" "$HOME_URL" "$PAGES_HOST" <<'PY' || exit 1
import sys,re
ok,home,suf=sys.argv[1],sys.argv[2],sys.argv[3]
g=open('launch/guard.js',encoding='utf-8').read().replace('__OKHOSTS__',ok).replace('__HOME__',home).replace('__OKSUFFIX__',suf)
p='_site/index.html'; h=open(p,encoding='utf-8').read()
m=re.search(r'<head[^>]*>',h,re.I)
tag='<script>'+g+'</script>'
h=h[:m.end()]+tag+h[m.end():] if m else tag+h
open(p,'w',encoding='utf-8').write(h); print('guard ok',ok)
PY

# 3) Cloudflare 伺服器設定
cat > _site/_headers <<'H'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: frame-ancestors 'self'
  X-Robots-Tag: noai, noimageai
/*.json
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/c/*
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/d/*
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/f/*
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/r/*
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/s/*
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/v/*
  X-Robots-Tag: noindex, nofollow, noarchive, noai
/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-cache
/account/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-cache
H
echo '{"version":1,"include":["/api/*"],"exclude":[]}' > _site/_routes.json   # 只有 /api/ 走會員程式

# 4) 壓縮網頁程式；失敗就用原檔，不會讓網站壞掉
if npx --yes html-minifier-terser@7.2.0 --collapse-whitespace --conservative-collapse --remove-comments --minify-css true --minify-js '{"compress":{"passes":2},"mangle":true,"format":{"comments":false}}' -o _site/index.min.html _site/index.html \
 && node -e '
    const fs=require("fs"),vm=require("vm");
    const h=fs.readFileSync("_site/index.min.html","utf8"), o=fs.readFileSync("_site/index.html","utf8");
    const cnt=t=>(t.match(/<script/g)||[]).length;
    const re=/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g; let m,n=0;
    while((m=re.exec(h))){ new vm.Script(m[1]); n++; }
    if(n<1||cnt(h)!==cnt(o)||h.length<o.length*0.4) throw new Error("壓縮結果異常");
    console.log("程式段數",n,"大小",h.length);'; then mv _site/index.min.html _site/index.html; else echo "壓縮失敗，改用原檔"; rm -f _site/index.min.html; fi
du -sh _site; find _site -type f | wc -l
