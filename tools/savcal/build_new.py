import json,re,subprocess,sys
sys.path.insert(0,'/home/claude/savcal'); from parse_rate import parse,to_t,cn2i
D='/tmp/claude-0/tn/'
N=json.load(open('new_final.json'))
ia=json.load(open('/mnt/user-data/uploads/Downloads/ia_pdtlist.json'))['rows']
code={}
for r in ia:
    for p in r[11].split(','):
        if p: code[p]=r[1]
def txt(p):
    return subprocess.run(['pdftotext',p,'-'],capture_output=True,text=True).stdout.replace('\n','').replace(' ','')
CO={'201':'臺銀人壽','202':'台灣人壽','203':'保誠人壽','204':'國泰人壽','205':'凱基人壽','206':'南山人壽','208':'新光人壽','209':'富邦人壽','211':'三商美邦人壽','216':'遠雄人壽','217':'宏泰人壽','220':'中華郵政','221':'第一金人壽','222':'合作金庫人壽','256':'安達人壽','257':'友邦人壽','261':'元大人壽','264':'全球人壽','267':'法國巴黎人壽'}
def kind(n):
    lv='利率變動' in n
    if '養老' in n: return '生死合險／養老'
    if lv and '還本' in n: return '利變還本終身'
    if lv and '增額' in n: return '利變增額終身'
    if lv: return '利變終身壽險'
    if '還本' in n: return '還本終身'
    if '增額' in n: return '增額終身'
    return '終身壽險'
def pct(s):
    s=s.replace('點','.')
    if re.match(r'^[\d.]+$',s): return float(s)
    m=re.match(r'^([一二三四五六七八九十]+)(?:\.([一二三四五六七八九零〇]+))?$',s)
    if not m: return None
    a=cn2i(m.group(1)); d=m.group(2) or ''
    dm={'零':'0','〇':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'}
    return float(f"{a}.{''.join(dm[c] for c in d) or 0}")
out={}; rep=[]
for pid,n,s,e in N:
    u,res,_=parse(D+pid+'-C.pdf'); t=to_t(res)
    A=txt(D+pid+'-A.pdf')
    if not t: rep.append((pid,n,'no rates')); continue
    if u is None: u=10000
    cur='美元' if ('美元' in n or '美元' in A[:4000]) else ('澳幣' if '澳幣' in A[:4000] else ('人民幣' if '人民幣' in A[:4000] else '台幣'))
    i=None
    m=re.findall(r'預定利率[（(]?(?:年利率)?(?:為)?(?:百分之)?([一二三四五六七八九十點零〇\d.]+)[%）)]?',A)
    vals=[pct(x) for x in m]; vals=[v for v in vals if v and 0<v<8]
    if vals: i={'*':vals[0]}
    mat=None
    mm=re.search(r'保險期間[」」]?[：:]?本契約之保險期間為(\d+|[一二三四五六七八九十]+)年',A) or re.search(r'保險期間為(\d+|[一二三四五六七八九十]+)年',A)
    if mm: mat=cn2i(mm.group(1))
    k=kind(n)
    rec={'id':pid,'n':n.replace('（','(').replace('）',')'),'co':CO.get(pid[:3],''),'cur':cur,'k':k,'s':'%d-%s-%s'%(int(s[:3])+1911,s[4:6],s[7:9]),'e':'未停售','u':u,'ug':False,'r2':0,'rn':'','va':None,'code':code.get(pid,''),'t':t,'dbm':1.0,'pm':1.0,'div':1 if '分紅' in n else 0}
    if i: rec['i']=i
    if mat: rec['mat']=mat
    if k=='生死合險／養老' and not mat: rep.append((pid,n,'養老 no mat')); 
    if '還本' in k: rec['svn']='還本金額尚未自動解析，表中未列還本'
    out[pid]=rec; rep.append((pid,n,u,cur,k,list(t),i,mat))
json.dump(out,open('new_recs.json','w'),ensure_ascii=False)
for r in rep: print(r)
