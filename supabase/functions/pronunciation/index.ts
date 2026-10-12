// Deploy: supabase functions deploy pronunciation (JWT verification stays ON).
import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const auth=req.headers.get('Authorization');if(!auth)return reply({error:'Cần đăng nhập.'},401);
 const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return reply({error:'Phiên đăng nhập không hợp lệ.'},401);
 const key=Deno.env.get('AZURE_SPEECH_KEY'),region=Deno.env.get('AZURE_SPEECH_REGION');
 if(!key||!region||!/^[a-z0-9]+$/.test(region))return reply({error:'Chưa cấu hình dịch vụ chấm phát âm Azure Speech.'},503);
 if(Number(req.headers.get('content-length')??0)>1100000)return reply({error:'File quá lớn.'},413);
 try{
  const form=await req.formData();const file=form.get('audio');const reference=String(form.get('reference')??'').trim();
  if(!(file instanceof File)||file.size>1000000||file.size<800||reference.length<2||reference.length>300)return reply({error:'Bản thu hoặc câu mẫu không hợp lệ.'},400);
  const bytes=await file.arrayBuffer();const view=new DataView(bytes);const magic=new TextDecoder().decode(bytes.slice(0,4));
  if(bytes.byteLength<44||magic!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WAVE'||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||view.getUint32(24,true)!==16000||view.getUint16(34,true)!==16)return reply({error:'Cần file WAV PCM 16kHz, mono, 16 bit.'},400);
  const {data:allowed,error:quotaError}=await supabase.rpc('reserve_speech_quota');
  if(quotaError)return reply({error:'Chưa kiểm tra được hạn mức chấm.'},503);
  if(!allowed)return reply({error:'Bạn đã dùng hết 20 lượt chấm hôm nay. Hãy tiếp tục luyện offline.'},429);
  const config=btoa(unescape(encodeURIComponent(JSON.stringify({ReferenceText:reference,GradingSystem:'HundredMark',Granularity:'Phoneme',Dimension:'Comprehensive',EnableMiscue:true}))));
  const response=await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'audio/wav; codecs=audio/pcm; samplerate=16000','Pronunciation-Assessment':config},body:bytes,signal:AbortSignal.timeout(25000)});
  if(!response.ok)return reply({error:'Dịch vụ chấm chưa phản hồi thành công. Kiểm tra cấu hình hoặc hạn mức.'},502);
  const result=await response.json();const best=result.NBest?.[0];if(!best||result.RecognitionStatus!=='Success')return reply({error:'Không nhận diện được câu. Hãy nói rõ hơn và thử lại.'},422);
  const score=best.PronunciationAssessment;return reply({accuracy:score.AccuracyScore,fluency:score.FluencyScore,completeness:score.CompletenessScore,words:(best.Words??[]).map((w: any)=>({word:w.Word,score:w.PronunciationAssessment?.AccuracyScore??0,error:w.PronunciationAssessment?.ErrorType,phonemes:w.Phonemes}))});
 }catch{return reply({error:'Chưa xử lý được bản thu. Hãy thử lại sau.'},500);}
});
