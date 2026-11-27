"""把 ben_patches.json 的人工核對修正套進 d/ 分片（可重複執行）。"""
import json,os,sys,glob
D=sys.argv[1] if len(sys.argv)>1 else 'd'
P=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'ben_patches.json'),encoding='utf-8'))
by={}
for i,v in P.items(): by.setdefault(int(i)//200,{})[i]=v
n=0
for s,items in by.items():
    f=f'{D}/{s}.json'; d=json.load(open(f,encoding='utf-8'))
    for i,pv in items.items():
        x=d.get(i)
        if not x: continue
        if pv.get('_del'):
            def _hit(b,d):
                nm,_,fc=d.partition('@')
                if fc: return b.get('n')==nm and b.get('fc')==fc
                return b.get('n')==d or b.get('_pn')==d
            x['ben']=[b for b in x['ben'] if b.get('_padd') or not any(_hit(b,d) for d in pv['_del'])]
        for a in pv.get('_add',[]):
            ex=[b for b in x['ben'] if b.get('n')==a['n']]
            if not ex: x['ben'].append({'r':[],'d':'','s':[],**a,'_padd':1}); n+=1
            elif ex[0].get('_auto') or ex[0].get('_padd'): ex[0].update(a); n+=1
        if '_x' in pv: x.update(pv['_x']); n+=1
        for b in x['ben']:
            for name,ch in pv.items():
                if name.startswith('_'): continue
                nm,_,fc=name.partition('@')
                if fc and b.get('fc')!=fc: continue
                if b.get('_pn')==name or b['n']==nm or b.get('_pn')==nm and not fc:
                    b['_pn']=name; b.update(ch); n+=1
    json.dump(d,open(f,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('patched',n)

# 投保保額範圍（build_lim.py 產生）
LP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'lim.json')
if os.path.exists(LP):
    LIM=json.load(open(LP,encoding='utf-8')); k=0
    CMP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'clause_map.json')
    CM=json.load(open(CMP,encoding='utf-8')) if os.path.exists(CMP) else {}
    kc=0
    for f in glob.glob(os.path.join(D,'*.json')):
        DD=json.load(open(f,encoding='utf-8')); ch=False
        for i,x in DD.items():
            m=CM.get(i,{})
            want={}
            for j,b in enumerate(x.get('ben',[])):
                if b.get('fc'):
                    z=m.get(b['n']+'@'+b.get('fc',''))
                    if z: want[j]=dict(z)
            # 同一張保單有多個項目對到同一個條款保險金時，補上是哪一部分，避免畫面出現重複名稱
            grp={}
            for j,z in want.items(): grp.setdefault(z['cn'],[]).append(j)
            for cn0,js in grp.items():
                labs={j:re.sub(r'\s+','',re.sub(r'\((最高|每月|每年|每次|每側)\)|／每日|／日額|保險金$','',x['ben'][j]['n'])) for j in js}
                if len(js)>1 and len(set(labs.values()))>1:
                    for j in js: want[j]['cn']=cn0+'（'+labs[j]+'）'
            for j,b in enumerate(x.get('ben',[])):
                if not b.get('fc'): continue
                z=want.get(j)
                if z:
                    if b.get('cn')!=z['cn'] or b.get('fd')!=z['fd'] or not b.get('fdc'): b['cn']=z['cn']; b['fd']=z['fd']; b['fdc']=1; ch=True; kc+=1
                elif b.get('fdc'):
                    for kk in ('cn','fd','fdc'): b.pop(kk,None)
                    ch=True; kc+=1
                elif b.get('fd'): del b['fd']; ch=True; kc+=1
        if ch: json.dump(DD,open(f,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    print('clause names',kc)
    MP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'lim_manual.json')
    if os.path.exists(MP): LIM.update(json.load(open(MP,encoding='utf-8')))
    for f in os.listdir(D):
        if not f.endswith('.json'): continue
        fp=os.path.join(D,f); d=json.load(open(fp,encoding='utf-8')); ch=False
        for i,x in d.items():
            v=LIM.get(i)
            if v and x.get('lim')!=v: x['lim']=v; ch=True; k+=1
            elif not v and 'lim' in x: del x['lim']; ch=True
        if ch: json.dump(d,open(fp,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    print('lim',k)

IP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'age_issue.json')
if os.path.exists(IP):
    IA=json.load(open(IP,encoding='utf-8')); k=0
    for f in os.listdir(D):
        if not f.endswith('.json'): continue
        fp=os.path.join(D,f); d=json.load(open(fp,encoding='utf-8')); ch=False
        for i,x in d.items():
            v=IA.get(i)
            if v and x.get('ia')!=v: x['ia']=v; ch=True; k+=1
            elif not v and 'ia' in x: del x['ia']; ch=True
        if ch: json.dump(d,open(fp,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    print('ia',k)
