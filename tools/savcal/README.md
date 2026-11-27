# 儲蓄險例表校準
1. 把網站 index.html 裡「儲蓄險粗估引擎」到「儲蓄險分頁」之間的程式存成 /tmp/claude-0/saveng.js
2. python3 parse_lb.py <例表PDF...>   → lb_tables.json
3. python3 match.py → lb_matched.json，再篩成 list.json 有的商品 → lb_ok.json
4. node run_fit.js lb_ok.json fit_out.json（擬合 a,b,e 對保價金；s/sm/sn 取例表解約金比例）
5. python3 apply.py fit_out.json（只補沒有校準的年期、誤差<0.08）
