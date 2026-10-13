'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {friendlyCloudError} from './cloud-state';
import {checkWriting,emptyWriting,mergeWritingHistory,restoreWriting,writingExercises} from './writing';
import type {WritingState,WritingAttempt} from './writing';
function fromRow(row:any):WritingAttempt{return {id:row.request_id,exerciseId:row.exercise_id,answer:row.answer,correct:row.correct,date:row.created_at,source:'cloud'};}
export function useWriting(uid?:string){
 const key=`lingostep-writing-v21:${uid??'guest'}`;const [state,setState]=useState<WritingState>(emptyWriting),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflict,setConflict]=useState<{id:string;text:string;revision:number}|null>(null);
 const ref=useRef(state),alive=useRef(true),running=useRef(false);
 const update=useCallback((fn:(s:WritingState)=>WritingState)=>{if(!alive.current)return;const next=fn(ref.current);try{localStorage.setItem(key,JSON.stringify(next));}catch{setMessage('Bộ nhớ thiết bị đã đầy. Chưa lưu được thay đổi; hãy xuất bản sao tiến độ.');return false;}ref.current=next;setState(next);return true;},[key]);
 useEffect(()=>{alive.current=true;let saved=emptyWriting();try{saved=restoreWriting(JSON.parse(localStorage.getItem(key)??'null'));}catch{}ref.current=saved;setState(saved);setReady(true);return()=>{alive.current=false;};},[key]);
 const sync=useCallback(async()=>{if(!uid||!supabase||!navigator.onLine||running.current)return;running.current=true;setBusy(true);try{
  for(const a of ref.current.attempts.filter(a=>a.source==='pending')){if(!alive.current)return;const {data,error}=await supabase.rpc('submit_writing',{p_request_id:a.id,p_exercise_id:a.exerciseId,p_answer:a.answer});if(!alive.current)return;if(error)throw error;update(s=>({...s,attempts:mergeWritingHistory(s.attempts.filter(x=>x.id!==a.id),[...s.attempts.filter(x=>x.source==='cloud'),fromRow(data)])}));}
  const [history,drafts]=await Promise.all([supabase.from('writing_attempts').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(1000),supabase.from('writing_drafts').select('*').eq('user_id',uid)]);if(!alive.current)return;if(history.error)throw history.error;if(drafts.error)throw drafts.error;
  update(s=>{const next={...s.drafts};for(const row of drafts.data??[])if(!next[row.exercise_id]?.dirty)next[row.exercise_id]={text:row.body,revision:row.revision,dirty:false};return {...s,attempts:mergeWritingHistory(s.attempts,(history.data??[]).map(fromRow)),drafts:next};});setMessage('Kết quả và bản nháp đã đồng bộ với tài khoản.');
 }catch(e){if(alive.current)setMessage(friendlyCloudError(e));}finally{running.current=false;if(alive.current)setBusy(false);}},[uid,update]);
 useEffect(()=>{if(!ready)return;void sync();const online=()=>void sync();window.addEventListener('online',online);window.addEventListener('focus',online);const timer=setInterval(()=>{if(document.visibilityState==='visible')void sync();},45000);return()=>{window.removeEventListener('online',online);window.removeEventListener('focus',online);clearInterval(timer);};},[ready,sync]);
 function setDraft(id:string,text:string){update(s=>({...s,drafts:{...s.drafts,[id]:{text,revision:s.drafts[id]?.revision??0,dirty:true}}}));}
 function submit(id:string,answer:string){const e=writingExercises.find(e=>e.id===id)!;const result=checkWriting(e,answer);const a:WritingAttempt={id:crypto.randomUUID(),exerciseId:id,answer,correct:result.correct,date:new Date().toISOString(),source:uid?'pending':'local'};if(!update(s=>({...s,attempts:[a,...s.attempts]})))return result;setMessage(uid?'Đã giữ lượt viết trên thiết bị; đang chờ máy chủ xác nhận.':'Đã lưu lượt viết trên thiết bị.');void sync();return result;}
 async function saveDraft(id:string){if(!uid||!supabase){setMessage('Đăng nhập để lưu nháp và tiếp tục trên thiết bị khác.');return;}if(!navigator.onLine){setMessage('Nháp đã lưu trên thiết bị. Kết nối mạng rồi bấm Lưu nháp lên tài khoản.');return;}if(running.current)return;running.current=true;setBusy(true);const sent=ref.current.drafts[id]??{text:'',revision:0,dirty:false};try{
  const {data,error}=await supabase.rpc('save_writing_draft',{p_exercise_id:id,p_body:sent.text,p_revision:sent.revision});if(!alive.current)return;
  if(error?.code==='40001'){const remote=await supabase.from('writing_drafts').select('body,revision').eq('user_id',uid).eq('exercise_id',id).single();if(!alive.current)return;if(remote.error)throw remote.error;setConflict({id,text:remote.data.body,revision:remote.data.revision});setMessage('Thiết bị khác đã sửa nháp. Chọn bản bạn muốn giữ.');return;}if(error)throw error;
  update(s=>({...s,drafts:{...s.drafts,[id]:{text:s.drafts[id]?.text??sent.text,revision:data.revision,dirty:(s.drafts[id]?.text??sent.text)!==sent.text}}}));setMessage('Đã lưu nháp lên tài khoản. Mở Luyện viết trên thiết bị khác để tiếp tục.');setConflict(null);
 }catch(e){if(alive.current)setMessage(friendlyCloudError(e));}finally{running.current=false;if(alive.current)setBusy(false);}}
 function resolveConflict(useRemote:boolean){if(!conflict)return;const c=conflict;update(s=>({...s,drafts:{...s.drafts,[c.id]:{text:useRemote?c.text:s.drafts[c.id]?.text??'',revision:c.revision,dirty:!useRemote}}}));setConflict(null);setMessage(useRemote?'Đã dùng nháp tài khoản.':'Đã giữ nháp thiết bị. Bấm Lưu nháp lên tài khoản để thay thế bản cũ.');}
 function discard(id:string){update(s=>({...s,attempts:s.attempts.filter(a=>a.id!==id)}));}
 return {state,ready,busy,message,conflict,setDraft,submit,sync,saveDraft,resolveConflict,discard};
}
