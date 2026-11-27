import re,sys,json,subprocess,os
ROW=re.compile(r'^\s*(\d{1,3})(?:\s*[~～-]\s*\d+)?\s*(?:[(（]\s*達?\s*\d+\s*歲\s*[)）])?\s+(-|[\d,]+(?:\.\d+)?)\s+(-|[\d,]+(?:\.\d+)?)\s*$')
NAME=re.compile(r'((?:富邦|凱基|南山|保誠|台灣|臺灣|國泰|新光|全球|三商美邦|遠雄|元大|友邦|第一金|合作金庫|台銀|臺銀|安達|法國巴黎|宏泰|中國|安聯|保德信|康健|國際康健|中華郵政|旺旺|新壽)人壽[^\s：:，,。]{2,60}?(?:保險|壽險)(?:[(（][^)）]{1,20}[)）])*)')
def cols(page):
    L=page.split('\n'); out=[]
    # find split position: lines with two '保單年度'
    pos=None
    for l in L:
        idx=[m.start() for m in re.finditer('保單年度',l)]
        if len(idx)>=2: pos=idx[1]; break
    if pos is None: return [L]
    # visual width ~ char index ok since layout uses spaces; adjust back to whitespace boundary
    a=[];b=[]
    for l in L:
        if len(l)<=pos: a.append(l); b.append(''); continue
        k=pos
        while k>0 and l[k-1]!=' ': k-=1
        a.append(l[:k]); b.append(l[k:])
    return [a,b]
def parse(path,co_hint=''):
    txt=subprocess.run(['pdftotext','-layout',path,'-'],capture_output=True,text=True).stdout
    res=[]
    streams=[]
    for pg in txt.split('\f'):
        streams+=cols(pg)
    # concatenate streams in order (col a then col b per page)
    cur={'name':None,'term':None,'sex':None,'age':None}
    tbl=None
    def flush():
        nonlocal tbl
        if tbl and len(tbl['rows'])>=3: res.append(tbl)
        tbl=None
    for L in streams:
        for l in L:
            s=l.strip()
            if not s: continue
            m=ROW.match(l)
            if m and cur['name']:
                t=int(m.group(1)); pv=m.group(2); cv=m.group(3)
                f=lambda x: None if x=='-' else float(x.replace(',',''))
                key=(cur['name'],cur['term'],cur['sex'],cur['age'])
                if tbl is None or tbl['key']!=key or (tbl['rows'] and t<=tbl['rows'][-1][0]):
                    flush(); tbl={'key':key,'name':cur['name'],'term':cur['term'],'sex':cur['sex'],'age':cur['age'],'rows':[]}
                tbl['rows'].append([t,f(pv),f(cv)]); continue
            n=NAME.search(s)
            if n and not re.search(r'例表|資訊公開|關係式',s):
                nm=n.group(1)
                if nm!=cur['name']: flush(); cur={'name':nm,'term':None,'sex':None,'age':None}
            g=re.search(r'年期\s*[：:]\s*(躉繳|\d+)',s) or re.search(r'(\d+)\s*年期',s) or re.search(r'(躉繳)',s)
            if g and (re.search(r'年期|躉繳|繳',s)): cur['term']=g.group(1) if g.group(1)=='躉繳' else str(int(g.group(1)))
            g=re.search(r'性別\s*[：:]\s*(男|女)',s) or re.search(r'(男|女)性',s)
            if g: cur['sex']=g.group(1)
            g=re.search(r'投保年齡\s*[：:]\s*(\d+)',s) or re.search(r'(\d+)\s*歲(?:男|女)',s) or re.search(r'以\s*(\d+)\s*歲',s)
            if g: cur['age']=int(g.group(1))
    flush()
    for r in res: r.pop('key')
    return res
if __name__=='__main__':
    out={}
    for p in sys.argv[1:]:
        r=parse(p); out[os.path.basename(p)]=r
        print(p,len(r),sum(1 for x in r if x['term'] and x['sex'] and x['age']))
    json.dump(out,open('lb_tables.json','w'),ensure_ascii=False)
