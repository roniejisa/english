'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {friendlyCloudError} from './cloud-state';
import {emptyVocabulary,restoreVocabulary,materializeVocabulary,applyVocabularyEvent,wordById} from './vocabulary';
import type {VocabularyState,VocabularyEvent,VocabularyCard} from './vocabulary';
import type {ReviewCard} from './types';
const fromRow=(r:any):VocabularyCard=>({wordId:r.word_id,saved:r.saved,due:r.due,interval:r.interval,ease:Number(r.ease),repetitions:r.repetitions,correct:r.correct,wrong:r.wrong,lastReviewed:r.last_reviewed});
export function useVocabulary(uid:string|undefined,legacy:ReviewCard[]){
 const key=`lingostep-vocabulary-v22:${uid??'guest'}`;const [state,setState]=useState<VocabularyState>(emptyVocabulary),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[available,setAvailable]=useState(false);
 const ref=useRef(state),alive=useRef(true),running=useRef(false);
 const write=useCallback((fn:(s:VocabularyState)=>VocabularyState)=>{if(!alive.current)return false;const next=fn(ref.current);try{localStorage.setItem(key,JSON.stringify(next));}catch{setStatus('Chưa lưu được: bộ nhớ thiết bị đã đầy. Hãy xuất bản sao tiến độ.');return false;}ref.current=next;setState(next);return true;},[key]);
 useEffect(()=>{alive.current=true;let saved=emptyVocabulary();try{saved=restoreVocabulary(JSON.parse(localStorage.getItem(key)??'null'));}catch{}const known=new Set(saved.cards.map(c=>c.wordId));for(const c of legacy)if(wordById.has(c.wordId)&&!known.has(c.wordId))saved.cards.push({...c,saved:false,correct:0,wrong:0,lastReviewed:null});ref.current=saved;setState(saved);setReady(true);return()=>{alive.current=false;};},[key]);
 const sync=useCallback(async()=>{if(!uid||!supabase||running.current||!alive.current)return;if(!navigator.onLine){setStatus('Offline · từ và lịch ôn được giữ trên thiết bị.');return;}running.current=true;setBusy(true);try{
  for(const job of [...ref.current.pending]){const {data,error}=await supabase.rpc('submit_vocabulary_event',{p_request_id:job.id,p_word_id:job.wordId,p_kind:job.kind,p_payload:job.payload});if(!alive.current)return;if(error)throw error;const card=fromRow(data.card);if(!write(s=>({...s,cards:[...s.cards.filter(c=>c.wordId!==card.wordId),card],pending:s.pending.filter(j=>j.id!==job.id)})))return;}
  const {data,error}=await supabase.rpc('get_vocabulary_state');if(!alive.current)return;if(error)throw error;if(!Array.isArray(data))throw new Error('Database trả lịch từ chưa đúng cấu trúc.');write(s=>({...s,cards:restoreVocabulary({cards:data.map(fromRow),pending:[]}).cards}));setAvailable(true);setStatus('Đã đồng bộ từ đã lưu, lượt luyện và lịch ôn trên Supabase.');
 }catch(e){if(alive.current){setAvailable(false);setStatus(friendlyCloudError(e));}}finally{running.current=false;if(alive.current)setBusy(false);}},[uid,write]);
 useEffect(()=>{if(!ready)return;void sync();const on=()=>void sync();window.addEventListener('online',on);window.addEventListener('focus',on);const timer=setInterval(()=>{if(document.visibilityState==='visible')void sync();},45000);return()=>{clearInterval(timer);window.removeEventListener('online',on);window.removeEventListener('focus',on);};},[ready,sync]);
 function act(wordId:string,kind:VocabularyEvent['kind'],payload:VocabularyEvent['payload']){if(!ready)return false;const event={id:crypto.randomUUID(),wordId,kind,payload,date:new Date().toISOString()};const ok=write(s=>uid?{...s,pending:[...s.pending,event]}:{...s,cards:applyVocabularyEvent(s.cards,event)});if(ok){setStatus(uid?'Đã giữ thay đổi trên thiết bị; đang chờ xác nhận.':'Đã lưu trên thiết bị. Đăng nhập để học ở nhiều nơi.');void sync();}return ok;}
 function discard(id:string){write(s=>({...s,pending:s.pending.filter(j=>j.id!==id)}));}
 return {cards:materializeVocabulary(state),pending:state.pending,ready,busy,status,available,act,sync,discard};
}
