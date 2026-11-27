import re,subprocess,sys,json
CN={'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}
def cn2i(s):
    if s.isdigit(): return int(s)
    if s=='十': return 10
    if s.startswith('十'): return 10+CN[s[1]]
    if '十' in s: a,b=s.split('十'); return CN[a]*10+(CN[b] if b else 0)
    return CN.get(s)
TERM=re.compile(r'(躉繳|一次繳(?:清)?|(\d{1,2})\s*年期|([一二三四五六七八九十]{1,3})年期|(?<![\d年])(\d{1,2})\s*年(?![\d期度齡])|(\d{1,2})\s*年繳)')
NUM=re.compile(r'\d[\d,]*(?:\.\d+)?')
def tokens(l):
    return [(m.group(0),(m.start()+m.end())/2) for m in NUM.finditer(l)]
def labels(lines):
    terms=[];sexes=[]
    for l in lines:
        for m in TERM.finditer(l):
            g=m.group(0)
            if '躉' in g or '一次' in g: v='躉繳'
            else:
                n=m.group(2) or m.group(4) or m.group(5)
                v=str(int(n)) if n else (str(cn2i(m.group(3))) if m.group(3) else None)
                if v is None or not (1<=int(v)<=30): continue
            terms.append((v,(m.start()+m.end())/2))
        for m in re.finditer(r'男|女',l): sexes.append(('m' if m.group(0)=='男' else 'f',m.start()))
    return terms,sexes
def unit_of(txt):
    if re.search(r'每\s*[千仟]\s*(?:美|澳|人民幣)?\s*元',txt): return 1000
    if re.search(r'每\s*萬\s*(?:美|澳)?\s*元|每萬|萬元|萬美元',txt): return 10000
    if re.search(r'每\s*百\s*(?:美)?\s*元',txt): return 100
    return None
def parse(path):
    txt=subprocess.run(['pdftotext','-layout',path,'-'],capture_output=True,text=True).stdout
    u=unit_of(txt); res={}
    pT=[];pS=[]
    for pg in txt.split('\f'):
        L=pg.split('\n'); hdr=[]; first=None
        for i,l in enumerate(L):
            t=tokens(l)
            if len(t)>=2 and not re.search(r'[\u4e00-\u9fff]',l) and re.match(r'^\s*\d{1,3}\s',l) and int(t[0][0].replace(',',''))<=110 and '.' not in t[0][0]:
                first=i; break
            hdr.append(l)
        if first is None: continue
        T,S=labels(hdr)
        AG=[(m.start()+m.end())/2 for l in hdr for m in re.finditer(r'年\s*齡',l)]
        if not T: T=pT
        if not S: S=pS
        # whole-page sex if title says 男性費率表 etc
        pT,pS=T,S
        for l in L[first:]:
            t=tokens(l)
            if len(t)<2 or re.search(r'[\u4e00-\u9fff]',l) or not re.match(r'^\s*\d{1,3}(\s|$)',l): continue
            age=int(t[0][0])
            if age>110: continue
            vals=[]; ca=age
            for s,x in t[1:]:
                if s.isdigit() and (int(s)==age or (len(AG)>1 and min(abs(x-a) for a in AG)<=4 and int(s)<=110)):
                    ca=int(s); continue
                vals.append((float(s.replace(',','')),x,ca))
            if not vals: continue
            for v,x,age in vals:
                if not T: tm='躉繳'
                else: tm=min(T,key=lambda a:abs(a[1]-x))[0]
                if S:
                    sx=min(S,key=lambda a:abs(a[1]-x))[0]
                else: sx='m'
                d=res.setdefault(tm,{}).setdefault(sx,{})
                if age not in d: d[age]=v
    return u,res,txt
def to_t(res):
    t={}
    for tm,d in res.items():
        if tm=='?' : continue
        m=d.get('m',{}); f=d.get('f',{}) or m
        ages=sorted(set(m)|set(f))
        if len(ages)<5: continue
        a=ages[0]; b=ages[-1]
        t[tm]={'a':a,'m':[m.get(x) for x in range(a,b+1)],'f':[f.get(x) for x in range(a,b+1)]}
    return t
if __name__=='__main__':
    for p in sys.argv[1:]:
        u,res,_=parse(p); t=to_t(res)
        print(p.split('/')[-1][:27],u,{k:(v['a'],len(v['m']),v['m'][:2],v['f'][:2]) for k,v in t.items()})
