# 儲蓄險例表校準
1. 把網站 index.html 裡「儲蓄險粗估引擎」到「儲蓄險分頁」之間的程式存成 /tmp/claude-0/saveng.js
2. python3 parse_lb.py <例表PDF...>   → lb_tables.json
3. python3 match.py → lb_matched.json，再篩成 list.json 有的商品 → lb_ok.json
4. node run_fit.js lb_ok.json fit_out.json（擬合 a,b,e 對保價金；s/sm/sn 取例表解約金比例）
5. python3 apply.py fit_out.json（只補沒有校準的年期、誤差<0.08）

# 新商品補進儲蓄險清單
1. 在保發中心 insprod.tii.org.tw 過一次驗證碼後，於該分頁 fetch DetailList.aspx?productId=<id> 取 -A(條款)、-C(費率表) PDF。
2. new_final.json（[id,名稱,開賣,狀態]）→ python3 build_new.py → new_recs.json（費率表用 parse_rate.py 解析）
3. node qa_new.js 檢查；養老險沒有保險期間的先不收。
