"""Build-time, original bilingual content + CMUdict US IPA + local vector assets.
Requires: pip install cmudict piper-tts numpy; ffmpeg. No network needed at runtime.
Usage: python scripts/build-vocabulary.py /absolute/model.onnx [--audio]
"""
from pathlib import Path
import json,re,sys,html,hashlib,shutil,concurrent.futures,subprocess,tempfile,wave
import cmudict
root=Path(__file__).resolve().parents[1]
cmu=cmudict.dict()
phones={'AA':'ɑ','AE':'æ','AH':'ʌ','AO':'ɔ','AW':'aʊ','AY':'aɪ','B':'b','CH':'tʃ','D':'d','DH':'ð','EH':'ɛ','ER':'ɝ','EY':'eɪ','F':'f','G':'ɡ','HH':'h','IH':'ɪ','IY':'iː','JH':'dʒ','K':'k','L':'l','M':'m','N':'n','NG':'ŋ','OW':'oʊ','OY':'ɔɪ','P':'p','R':'r','S':'s','SH':'ʃ','T':'t','TH':'θ','UH':'ʊ','UW':'uː','V':'v','W':'w','Y':'j','Z':'z','ZH':'ʒ'}
onsets={tuple(x.split()) for x in ['P R','T R','K R','B R','D R','G R','F R','TH R','SH R','P L','K L','B L','G L','F L','S L','S P','S T','S K','S M','S N','S W','T W','K W','D W','S K R','S P R','S T R','S K W','S P L']}
overrides={'wound':'W UW1 N D','bow':'B OW1','read':'R IY1 D','wind':'W IH1 N D','graduate':'G R AE1 JH AH0 W EY2 T','project':'P R AA1 JH EH0 K T','subject':'S AH1 B JH IH0 K T','refund':'R IY1 F AH2 N D','discount':'D IH1 S K AW0 N T','transfer':'T R AE0 N S F ER1','live':'L IH1 V','lead':'L IY1 D','close':'K L OW1 Z','use':'Y UW1 Z','record':'R EH1 K ER0 D','present':'P R EH1 Z AH0 N T','minute':'M IH1 N AH0 T','address':'AH0 D R EH1 S','object':'AA1 B JH EH0 K T','content':'K AA1 N T EH0 N T','conduct':'K AH0 N D AH1 K T','permit':'P ER0 M IH1 T','refuse':'R IH0 F Y UW1 Z','contract':'K AA1 N T R AE2 K T','progress':'P R AA1 G R EH2 S','update':'AH1 P D EY2 T','increase':'IH2 N K R IY1 S','restart':'R IY0 S T AA1 R T'}
# Rare everyday compounds absent from this CMUdict release.
manual={'hoodie':'ˈhʊdi','cashback':'ˈkæʃbæk'}
def ipa(word):
 if word in manual:return '/'+manual[word]+'/'
 ps=overrides.get(word,'').split() or cmu.get(word,[[]])[0]
 if not ps:raise ValueError('Missing pronunciation: '+word)
 vowels=[i for i,p in enumerate(ps) if p[-1:].isdigit()]
 stresses={}
 if len(vowels)>1:
  for k,i in enumerate(vowels):
   stress=ps[i][-1]
   if stress not in '12':continue
   start=0 if k==0 else vowels[k-1]+1
   if k:
    consonants=ps[start:i]
    start=i-1 if consonants else i
    for n in range(min(3,len(consonants)),1,-1):
     if tuple(consonants[-n:]) in onsets:start=i-n;break
   stresses[start]='ˈ' if stress=='1' else 'ˌ'
 out=''
 for i,p in enumerate(ps):
  out+=stresses.get(i,'');base=re.sub(r'\d','',p)
  symbol=phones[base]
  if p=='AH0':symbol='ə'
  elif p=='ER0':symbol='ɚ'
  elif p=='IY0':symbol='i'
  elif p=='UW0':symbol='u'
  out+=symbol
 return '/'+out+'/'

scenes={
'people-family':'<circle cx="114" cy="107" r="25" fill="#f2b693"/><path d="M76 180Q74 139 114 139Q154 139 152 180Z" fill="#668a80"/><circle cx="188" cy="112" r="21" fill="#efc4a6"/><path d="M157 180Q157 145 188 145Q219 145 221 180Z" fill="#dc8062"/><path d="M138 96q16-25 32-2" fill="none" stroke="#b5c5ac" stroke-width="4"/>',
'home':'<path d="M80 108l78-58 78 58v86H80Z" fill="#dcab8e"/><path d="M72 107l86-65 86 65" fill="none" stroke="#577e72" stroke-width="12" stroke-linecap="round"/><rect x="138" y="132" width="40" height="62" rx="5" fill="#fff6e1"/><rect x="99" y="118" width="24" height="29" rx="4" fill="#fff6e1"/><rect x="192" y="118" width="24" height="29" rx="4" fill="#fff6e1"/>',
'food-drink':'<ellipse cx="150" cy="149" rx="66" ry="41" fill="#fffdf5" stroke="#6f9985" stroke-width="6"/><ellipse cx="150" cy="148" rx="46" ry="27" fill="#eabb78"/><path d="M106 118q15-37 36-9q-16 27-36 9" fill="#789565"/><path d="M193 91v87m-9-87v24h18V91" stroke="#d67f5c" stroke-width="7" stroke-linecap="round"/><rect x="231" y="119" width="27" height="52" rx="6" fill="#e9bb97"/>',
'health-body':'<rect x="87" y="89" width="138" height="100" rx="20" fill="#fff9ec" stroke="#749789" stroke-width="5"/><path d="M140 80v-15h31v15" stroke="#749789" stroke-width="6" fill="none"/><path d="M156 113v49m-25-25h50" stroke="#dc7e61" stroke-width="15" stroke-linecap="round"/>',
'clothing':'<path d="M124 71l-42 28 25 35 17-10v72h77v-72l17 10 24-35-42-28q-37 35-76 0" fill="#739787" stroke="#557769" stroke-width="4"/><path d="M148 81q17 9 29 0" stroke="#fff8e8" stroke-width="5" fill="none"/>',
'shopping-money':'<path d="M93 110h126l12 88H81Z" fill="#e5ae82" stroke="#b48262" stroke-width="4"/><path d="M122 109V87a35 35 0 0170 0v22" stroke="#658878" stroke-width="8" fill="none"/><circle cx="155" cy="155" r="23" fill="#fff4d5"/><path d="M156 141v30m7-26q-15-8-17 2t14 9q8 14-11 11" stroke="#a67850" stroke-width="3" fill="none"/>',
'school':'<path d="M155 82q-48-26-86-4v105q46-21 86 5q40-26 86-5V78q-39-22-86 4" fill="#fff7e5" stroke="#6c9281" stroke-width="5"/><path d="M155 85v102m-67-84h46m-46 21h46m46-21h44m-44 21h44" stroke="#bdc6a8" stroke-width="4" stroke-linecap="round"/>',
'nature-animals':'<path d="M161 198v-92" stroke="#648563" stroke-width="9"/><path d="M161 137q-79 0-69-57q68-9 69 57M161 116q1-57 64-48q9 55-64 48" fill="#8da277"/><circle cx="97" cy="184" r="21" fill="#d5a37d"/><path d="M78 167l-5-22 24 16 19-16 1 29" fill="#d5a37d"/><circle cx="91" cy="181" r="2.5" fill="#544d3e"/><circle cx="104" cy="181" r="2.5" fill="#544d3e"/>',
 'travel-city':'<rect x="87" y="67" width="141" height="114" rx="22" fill="#6e9486"/><rect x="101" y="83" width="111" height="44" rx="8" fill="#fff4da"/><path d="M154 83v44" stroke="#6e9486" stroke-width="5"/><circle cx="111" cy="158" r="9" fill="#ebae78"/><circle cx="205" cy="158" r="9" fill="#ebae78"/><path d="M101 185l-16 24m126-24l16 24m-141-8h140" stroke="#ae9a7c" stroke-width="5"/>',
'work-technology':'<rect x="82" y="74" width="150" height="102" rx="9" fill="#6c9183"/><rect x="93" y="85" width="128" height="78" rx="4" fill="#e7eee1"/><path d="M69 179h176l-12 18H83Z" fill="#c39671"/><path d="M110 118l17-13m-17 13l17 13m43-26l17 13-17 13m-17-30l-13 37" stroke="#739084" stroke-width="5" fill="none"/>',
'time-weather':'<circle cx="135" cy="134" r="60" fill="#fff8e7" stroke="#749488" stroke-width="7"/><path d="M135 95v39l27 18" stroke="#d27f61" stroke-width="7" stroke-linecap="round"/><circle cx="228" cy="79" r="22" fill="#e5b267"/><path d="M228 45v-9m25 18l7-7m6 32h10" stroke="#e5b267" stroke-width="5" stroke-linecap="round"/>',
'actions-routines':'<circle cx="156" cy="78" r="21" fill="#d3a180"/><path d="M136 110l-15 57 43 10 14-45 26 6" fill="none" stroke="#6b9280" stroke-width="20" stroke-linecap="round"/><path d="M160 177l23 30m-62-43l-30 36m39-82l-25 20" stroke="#b47e63" stroke-width="13" stroke-linecap="round"/>',
'feelings-character':'<circle cx="153" cy="130" r="62" fill="#e6b881"/><circle cx="132" cy="119" r="5" fill="#556a5a"/><circle cx="173" cy="119" r="5" fill="#556a5a"/><path d="M131 143q23 29 47 0" stroke="#627e6b" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M224 69q-16-24-28-7q-13 18 28 39q40-27 24-43q-11-11-24 11" fill="#d88469"/>',
'communication':'<path d="M75 79h133q15 0 15 15v58q0 15-15 15h-65l-34 24v-24H75q-15 0-15-15V94q0-15 15-15" fill="#759787"/><path d="M191 130h52q18 0 18 17v30q0 14-15 14h-13v19l-26-19h-16" fill="#dfaa84"/><path d="M89 105h106m-106 20h77m-77 20h50" stroke="#fff8e8" stroke-width="6" stroke-linecap="round"/>',
'quantities-relations':'<rect x="73" y="101" width="47" height="92" rx="8" fill="#759787"/><rect x="135" y=" seventy" width="47" height="123" rx="8" fill="#dc9f74"/><rect x="197" y="134" width="47" height="59" rx="8" fill="#bec3a0"/><path d="M67 202h187" stroke="#79917e" stroke-width="5"/><circle cx="221" cy="79" r="21" fill="#fff6df"/><path d="M213 79h16m-8-8v16" stroke="#b48863" stroke-width="4"/>',
'society-culture':'<path d="M72 108l87-47 87 47Z" fill="#759787"/><path d="M83 115v78m50-78v78m50-78v78m50-78v78" stroke="#d7ac82" stroke-width="16"/><path d="M63 201h192" stroke="#759787" stroke-width="11" stroke-linecap="round"/>'}
scenes['quantities-relations']=scenes['quantities-relations'].replace(' seventy','70')
def image(word,topic,path):
 seed=int(hashlib.sha256(word.encode()).hexdigest()[:8],16);accent=['#efb98a','#abc5ad','#e9d397'][seed%3]
 label=html.escape(word);size=23 if len(word)<12 else 18
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="260" viewBox="0 0 320 260" role="img"><title>{label}: {topic}</title><rect width="320" height="260" rx="24" fill="#f7f3e9"/><circle cx="170" cy="125" r="99" fill="{accent}" opacity=".18"/>{scenes[topic]}<circle cx="47" cy="60" r="5" fill="{accent}"/><path d="M270 181v13m-6-7h12" stroke="{accent}" stroke-width="3"/><text x="160" y="243" text-anchor="middle" fill="#526c5b" font-family="Arial,sans-serif" font-size="{size}" font-weight="700">{label}</text></svg>'
 (root/'public'/path.lstrip('/')).write_text(svg)

parts=[]
for n in ['a','b']:parts+=json.loads((root/f'src/data/vocabulary-part-{n}.json').read_text())
byword={}
for w in parts:byword.setdefault(w['word'].lower(),w)
old=json.loads((root/'src/data/curriculum.json').read_text())['vocabulary']
seen=set();out=[]
fallback={'study':'school','book':'school','coffee':'food-drink','food':'food-drink','tea':'food-drink','milk':'food-drink','apple':'food-drink','cat':'nature-animals','garden':'nature-animals','museum':'society-culture','people':'people-family','rain':'time-weather','calendar':'time-weather','clock':'time-weather','travel':'travel-city','walk':'actions-routines','swim':'actions-routines','report':'work-technology','science':'school'}
(root/'public/images/vocabulary').mkdir(exist_ok=True)
for w in old:
 w=dict(w);raw=byword.get(w['word'].lower());w['topic']=raw['topic'] if raw else fallback.get(Path(w['image']).stem,'communication');w['pos']=raw['pos'] if raw else 'other';w['contextAudio']=f"/audio/context-{w['id']}.mp3";w['ipa']=ipa(w['word'].lower());w['ipaSource']='CMUdict US; reviewed homograph sense';
 if not re.search(r'\b'+re.escape(w['word'])+r'\b',w['context'],re.I):
  if raw:w['context']=raw['context'];w['contextVi']=raw['contextVi']
  else:
   fixes={'tall':('My brother is tall.','Anh trai tôi cao.'),'wash':('I wash the cups after breakfast.','Tôi rửa những chiếc cốc sau bữa sáng.'),'draw':('I draw pictures in my free time.','Tôi vẽ tranh lúc rảnh.'),'small':('This room is small.','Căn phòng này nhỏ.'),'publish':('We publish a report every month.','Chúng tôi xuất bản một báo cáo mỗi tháng.'),'option':('This option saves time.','Lựa chọn này tiết kiệm thời gian.')}
   w['context'],w['contextVi']=fixes[w['word']]
 out.append(w);seen.add(w['word'].lower())
for raw in parts:
 key=raw['word'].lower()
 if key in seen:continue
 seen.add(key);id='vocab-'+key;path=f'/images/vocabulary/{key}.svg';image(key,raw['topic'],path)
 out.append(dict(id=id,**raw,ipa=ipa(key),level='CORE',image=path,imageKind='topic',audio=f'/audio/word-{id}.mp3',contextAudio=f'/audio/context-{id}.mp3',audioType='tts',ipaSource='CMUdict US; reviewed homograph sense'))
assert len(out)>=1000 and len({w['word'].lower() for w in out})==len(out)
for topic in scenes:image('',topic,f'/images/vocabulary/topic-{topic}.svg')
(root/'src/data/vocabulary-bank.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(root/'docs/CMUDICT-LICENSE.txt').write_text(cmudict.license_string())
print(f'Built {len(out)} distinct words and contextual SVG assets.',flush=True)

audio_phones={'wound':'wˈuːnd','bow':'bˈoʊ','read':'ɹˈiːd','wind':'wˈɪnd','graduate':'ɡɹˈædʒuːˌeɪt','project':'pɹˈɑːdʒɛkt','subject':'sˈʌbdʒɪkt','refund':'ɹˈiːfˌʌnd','discount':'dˈɪskaʊnt','transfer':'tɹænsfˈɜːɹ','live':'lˈɪv','close':'klˈoʊz','use':'jˈuːz','minute':'mˈɪnɪt','address':'ədɹˈɛs','refuse':'ɹɪfjˈuːz','contract':'kˈɑːntɹˌækt','progress':'pɹˈɑːɡɹɛs','update':'ˈʌpdˌeɪt','increase':'ɪnkɹˈiːs','restart':'ɹiːstˈɑːɹt'}
_voice=None
_overrides_phonemes={}
def init(model):
 global _voice
 import onnxruntime
 from piper import PiperVoice,PiperConfig
 cfg=PiperConfig.from_dict(json.loads(Path(model+'.json').read_text()));cfg.espeak_voice='en-us'
 opts=onnxruntime.SessionOptions();opts.intra_op_num_threads=1;opts.inter_op_num_threads=1
 class ReviewedVoice(PiperVoice):
  def phonemize(self,text):
   if text.lower() in audio_phones:
    phonemes=list(audio_phones[text.lower()])
    assert all(x in self.config.phoneme_id_map for x in phonemes),text
    return [phonemes]
   return super().phonemize(text)
 _voice=ReviewedVoice(config=cfg,session=onnxruntime.InferenceSession(model,sess_options=opts,providers=['CPUExecutionProvider']))
def synth(job):
 text,path=job
 dest=root/'public'/path.lstrip('/');dest.parent.mkdir(parents=True,exist_ok=True)
 chunks=list(_voice.synthesize(text))
 with tempfile.NamedTemporaryFile(suffix='.wav') as f:
  with wave.open(f.name,'wb') as wav:
   wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(chunks[0].sample_rate);wav.writeframes(b''.join(c.audio_int16_bytes for c in chunks))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f.name,'-codec:a','libmp3lame','-b:a','48k',str(dest)],check=True)
 return path
if '--audio' in sys.argv:
 manifest_path=root/'docs/vocabulary-audio-manifest.json';manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {};jobs=[]
 for w in out:
  for field,text in [('audio',w['word']),('contextAudio',w['context'])]:
   path=w[field];dest=root/'public'/path.lstrip('/');digest=hashlib.sha256((text+'|'+audio_phones.get(text.lower(),'')).encode()).hexdigest()
   if field=='audio' and w['id'] in {x['id'] for x in old} and dest.exists() and w['word'].lower() not in audio_phones:continue
   if dest.exists() and manifest.get(path)==digest:continue
   jobs.append((text,path))
 print(f'Synthesizing {len(jobs)} local MP3s with 4 workers.',flush=True)
 with concurrent.futures.ProcessPoolExecutor(max_workers=4,initializer=init,initargs=(sys.argv[1],)) as pool:
  # Processes fork from a clean parent with no espeak engine initialized.
  for i,(job,path) in enumerate(zip(jobs,pool.map(synth,jobs)),1):
   manifest[path]=hashlib.sha256((job[0]+'|'+audio_phones.get(job[0].lower(),'')).encode()).hexdigest()
   if i%50==0:manifest_path.write_text(json.dumps(manifest,indent=2)+'\n');print(f'Audio {i}/{len(jobs)}',flush=True)
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n');print('All local audio complete.',flush=True)
