import json,sys
o=json.load(open(sys.argv[1]))
def hb(s):
  h=0
  for c in s: h=(h*31+ord(c))%256
  return h
files={}; n=0
for v in o.values():
  if v['had'] or v['e1']>=0.08: continue
  f='/home/claude/medical-policy/v/b/%d.json'%hb(v['id'])
  if f not in files: files[f]=json.load(open(f))
  p=files[f][v['id']]
  if not p.get('cal'): p['cal']={}
  if v['term'] in p['cal']: continue
  p['cal'][v['term']]=v['cal']; n+=1
for f,d in files.items(): json.dump(d,open(f,'w'),ensure_ascii=False,separators=(',',':'))
print('applied',n)
