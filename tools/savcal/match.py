import json,glob,re
P={}
for f in glob.glob('/home/claude/medical-policy/v/b/*.json'):
    for k,v in json.load(open(f)).items(): v['_f']=f; P[k]=v
L=json.load(open('/home/claude/medical-policy/v/list.json'))
print('list rows',len(L['rows']),L['rows'][0][:12])
def norm(s): 
    s=re.sub(r'[（(][^)）]*[)）]','',s); s=s.replace('臺','台'); return re.sub(r'[\s　]','',s)
idx={}
for k,v in P.items(): idx.setdefault(norm(v['n']),[]).append(k)
T=json.load(open('lb_tables.json')); hit=miss=0; ms=set(); out=[]
for f,rs in T.items():
    for r in rs:
        n=norm(r['name']); ids=idx.get(n,[])
        if not ids:
            # try startswith
            ids=[k for nn,ks in idx.items() if nn.startswith(n) or n.startswith(nn) for k in ks]
        if ids: hit+=1; r['ids']=ids; out.append(r)
        else: miss+=1; ms.add(r['name'])
print(hit,miss); print(sorted(ms)[:80])
json.dump(out,open('lb_matched.json','w'),ensure_ascii=False)
