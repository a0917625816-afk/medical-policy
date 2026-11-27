"""把 GPT 回覆中的 FIX/NEW/DEL 指令轉成 ben_patches.json，並把有回覆的保單列入 vf_done.json。
用法：python3 tools/gpt_patch.py 回覆檔.txt"""
import json,re,sys,os
H=os.path.dirname(os.path.abspath(__file__))
FC={'住院・每日','住院・每次','門診・每次','罹癌保險金・一次性','癌症住院・每日','癌症醫療・每次','重大疾病','特定傷病','重大傷病','長期照護','失能','意外醫療','意外失能','意外身故','一般身故','癌症身故','重大燒燙傷'}
TAG=re.compile(r'^(給付保額|保額 × [\d.]+ 倍|保額的 [\d.]+%|日額 × [\d.]+ 倍|按住院天數計|最多 \d+ 日|限領一次|含門診|依條款附表|實支實付（限額內）|分期給付|已繳保費 × [\d.]+ 倍)$')
P=json.load(open(os.path.join(H,'ben_patches.json')))
V=set(json.load(open(os.path.join(H,'vf_done.json'))))
txt=open(sys.argv[1]).read()
cur=None; stat={'fix':0,'new':0,'del':0,'ids':0,'bad':0}
def parse_kv(parts):
  r=None; fc=None
  for p in parts:
    p=p.strip()
    if p.startswith('r='): r=[t.strip().replace('x','×').replace('*','×') for t in re.split(r'[;；]',p[2:]) if t.strip()]
    elif p.startswith('fc='): fc=p[3:].strip()
  return r,fc
for ln in txt.split('\n'):
  ln=ln.strip()
  m=re.match(r'^ID\|(\d+)',ln)
  if m: cur=m.group(1); stat['ids']+=1; V.add(int(cur)); continue
  if not cur: continue
  parts=ln.split('|')
  if parts[0] in('FIX','NEW') and len(parts)>=3:
    r,fc=parse_kv(parts[2:4])
    if r is not None:
      r2=[t for t in r if TAG.match(t)]
      if len(r2)!=len(r): stat['bad']+=1
      r=r2
    if fc and fc not in FC: stat['bad']+=1; fc=None
    e=P.setdefault(cur,{})
    if parts[0]=='FIX':
      ch={}
      if r is not None: ch['r']=r
      if fc: ch['fc']=fc
      if ch: e[parts[1].strip()]=ch; stat['fix']+=1
    else:
      nm=parts[1].strip().replace('NEW:','')
      a={'n':nm,'r':r or [],'d':parts[4].strip() if len(parts)>4 else ''}
      if fc: a['fc']=fc
      L=e.setdefault('_add',[]); L[:]=[x for x in L if x['n']!=nm]+[a]; stat['new']+=1
  elif parts[0]=='DEL' and len(parts)>=2:
    e=P.setdefault(cur,{}); L=e.setdefault('_del',[]); nm=parts[1].strip()
    if nm not in L: L.append(nm); stat['del']+=1
# 同名「先 DEL 再 NEW」＝只改標籤：轉成 FIX，保留原條款文字
for k,e in P.items():
  if not isinstance(e,dict) or not e.get('_del') or not e.get('_add'): continue
  keep=[]
  for x in e['_add']:
    if x['n'] in e['_del'] and not x.get('d'):
      e['_del'].remove(x['n']); ch={'r':x['r']}
      if x.get('fc'): ch['fc']=x['fc']
      e[x['n']]=ch
    else: keep.append(x)
  e['_add']=keep
json.dump(P,open(os.path.join(H,'ben_patches.json'),'w'),ensure_ascii=False,indent=0)
json.dump(sorted(V),open(os.path.join(H,'vf_done.json'),'w'))
print(stat)
