"""把 tools/vf_done.json 列的保單標為已核對（vf=1）。"""
import json,os
H=os.path.dirname(os.path.abspath(__file__)); L=json.load(open(os.path.join(H,'vf_done.json')))
by={}
for i in L: by.setdefault(int(i)//200,[]).append(str(i))
n=0
for s,ids in by.items():
  f=os.path.join(H,'..','d',f'{s}.json'); d=json.load(open(f))
  for i in ids:
    if i in d and d[i].get('vf')!=1: d[i]['vf']=1; n+=1
  json.dump(d,open(f,'w'),ensure_ascii=False,separators=(',',':'))
print('vf',n)
