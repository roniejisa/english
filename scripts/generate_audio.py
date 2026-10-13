"""Offline build-time synthesis. pip install 'piper-tts[alignment]' requests numpy; requires ffmpeg.
python scripts/generate_audio.py /absolute/path/en_US-ljspeech-medium.onnx
Native vocabulary assets are optional and are listed in docs/audio-credits.json.
"""
import json,pathlib,sys,re,tempfile,subprocess,wave,numpy as np
from piper import PiperVoice
root=pathlib.Path(__file__).resolve().parents[1];p=root/'src/data/curriculum.json';data=json.loads(p.read_text())
voice=PiperVoice.load(sys.argv[1],include_alignments=True)
IGNORE=set(' ^$ˈˌ.,!?;:—-()“”"')
def core(chars):return [c for group in chars for c in group if c not in IGNORE]
def align_words(text,chunks):
 words=text.split();target=[];owners=[]
 for i,w in enumerate(words):
  ph=core(voice.phonemize(w));target+=ph;owners += [i]*len(ph)
 actual=[];times=[];cursor=0
 for c in chunks:
  for a in c.phoneme_alignments or []:
   start=cursor;cursor+=int(a.num_samples)/c.sample_rate
   for ch in a.phoneme:
    if ch not in IGNORE:actual.append(ch);times.append((start,cursor))
 n,m=len(target),len(actual);dp=np.zeros((n+1,m+1),dtype=np.int32);dp[:,0]=np.arange(n+1);dp[0,:]=np.arange(m+1)
 for i in range(1,n+1):
  for j in range(1,m+1):dp[i,j]=min(dp[i-1,j-1]+(target[i-1]!=actual[j-1]),dp[i-1,j]+1,dp[i,j-1]+1)
 matches={i:[] for i in range(len(words))};i,j=n,m
 while i or j:
  if i and j and dp[i,j]==dp[i-1,j-1]+(target[i-1]!=actual[j-1]):matches[owners[i-1]].append(times[j-1]);i-=1;j-=1
  elif i and dp[i,j]==dp[i-1,j]+1:i-=1
  else:j-=1
 out=[]
 for k,w in enumerate(words):
  pts=matches[k]
  start=min(x[0] for x in pts) if pts else (out[-1]['end'] if out else 0)
  end=max(x[1] for x in pts) if pts else start+.04
  out.append(dict(text=w,start=round(start,3),end=round(end,3)))
 return out

def synth(text,path,container=None):
 chunks=list(voice.synthesize(text,include_alignments=True));pcm=b''.join(c.audio_int16_bytes for c in chunks)
 with tempfile.NamedTemporaryFile(suffix='.wav') as f:
  with wave.open(f.name,'wb') as wav:wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(chunks[0].sample_rate);wav.writeframes(pcm)
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f.name,'-codec:a','libmp3lame','-b:a','64k',str(root/'public'/path.lstrip('/'))],check=True)
 if container is not None:container['timings']=align_words(text,chunks);container['audioTimingMethod']='piper-phoneme-alignment';container['audioType']='tts'
 print('Generated',path,flush=True)
for w in data['vocabulary']:
 if w.get('audioType')!='native' and not (root/'public'/w['audio'].lstrip('/')).exists():synth(w['word'],w['audio']);w['audioType']='tts'
for l in data['lessons']:
 if not (root/'public'/l['audio'].lstrip('/')).exists():synth(l['example'],l['audio'],l)
 for q in l['questions']:
  if q.get('audio') and not (root/'public'/q['audio'].lstrip('/')).exists():synth(q['answer'],q['audio'])
for r in data['readers']:
 if not r.get('timings') or not (root/'public'/r['audio'].lstrip('/')).exists():synth(r['text'],r['audio'],r)
for sound in json.loads((root/'src/data/ipa.json').read_text()):
 if not (root/'public'/f"audio/ipa-{sound['id']}.mp3").exists():synth(sound['words'],f"/audio/ipa-{sound['id']}.mp3")
for role in json.loads((root/'src/data/roleplays.json').read_text()):
 for turn in role['turns']:
  for speaker in ['a','b']:
   if not (root/'public'/turn[speaker+'Audio'].lstrip('/')).exists():synth(turn[speaker],turn[speaker+'Audio'])
p.write_text(json.dumps(data,ensure_ascii=False,indent=2));print('DONE',flush=True)
