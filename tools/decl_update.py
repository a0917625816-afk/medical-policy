"""每月宣告利率更新（給 AI 排程用）
用法：python3 tools/decl_update.py <公司> <YYYY-MM> <官網網址> <輸入檔>
輸入檔每行：商品名稱|宣告利率(數字)|s(公司標示停售時才加)
會依 v/list.json 的現售利變商品比對名稱，更新 v/decl.json；印出比對不到的商品供人工確認。"""
import json, re, sys, unicodedata, datetime, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
co, ym, src, fin = sys.argv[1:5]
def norm(s):
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'\s|（[^）]*）|\([^)]*\)|【[^】]*】|[-－–]定期給付型', '', s)
    return re.sub(r'(保險|壽險)$', '', s).lower()
def key(s): return re.split(r'外幣|美元|澳幣|人民幣|日圓|利率變動', norm(s))[0]
th = []
for ln in open(fin, encoding='utf-8'):
    p = ln.strip().split('|')
    if len(p) < 2 or not re.match(r'^[\d.]+$', p[1]): continue
    n = re.sub('^' + co, '', p[0].strip())
    th.append({'n': norm(n), 'k': key(n), 'a': '年金' in n, 'r': float(p[1]), 's': len(p) > 2 and p[2] == 's'})
rows = [r for r in json.load(open(f'{R}/v/list.json'))['rows'] if r[0] == co and r[5] == '未停售' and ('利' in r[3] or '利率變動' in r[1])]
D = json.load(open(f'{R}/v/decl.json'))
got, miss = 0, []
for r in rows:
    o = r[1].replace(co, '', 1); n, k, a = norm(o), key(o), '年金' in o
    h = next((t for t in th if t['n'] == n), None) or next((t for t in th if t['k'] == k and t['a'] == a), None)
    if not h: miss.append(r[1]); continue
    if not (0 < h['r'] < 8): miss.append(r[1] + f'（利率 {h["r"]} 不合理）'); continue
    D['r'][r[6]] = [h['r'], ym] + ([1] if h['s'] else []); got += 1
D['co'][co] = {'ym': ym, 'src': src, 'n': len(rows), 'got': got}
D['upd'] = datetime.date.today().isoformat()
json.dump(D, open(f'{R}/v/decl.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(co, ym, f'{got}/{len(rows)}', '比對不到：', miss)
