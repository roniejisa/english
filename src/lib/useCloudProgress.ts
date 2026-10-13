'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {supabase} from './supabase';
import {readQueue,acknowledge,sendJob} from './submissions';
import type {Progress} from './types';
import {emptyDevice,mergeCloudProgress,friendlyCloudError,type DeviceState,type CloudReply,type Cursor} from './cloud-state';
function deviceId(){let id=localStorage.getItem('lingostep-device-id');if(!id){id=crypto.randomUUID();localStorage.setItem('lingostep-device-id',id);}return id;}
function loadDevice(key:string):DeviceState{try{const d=JSON.parse(localStorage.getItem(key)??'null');if(d&&d.seconds&&typeof d.seconds==='object'&&Object.values(d.seconds).every(n=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=86400))return {...emptyDevice(),...d};}catch{}return emptyDevice();}
export function useCloudProgress({user,ready,setProgress}:{user:User|null;ready:boolean;setProgress:React.Dispatch<React.SetStateAction<Progress>>}){
 const [status,setStatus]=useState(''),[cursor,setCursor]=useState<Cursor|null>(null),[syncing,setSyncing]=useState(false),[available,setAvailable]=useState(false),[pendingCount,setPendingCount]=useState(0),[v2Ready,setV2Ready]=useState(false);
 const uid=useRef<string|null>(null),device=useRef(emptyDevice()),deviceKey=useRef(''),deviceUuid=useRef(''),inFlight=useRef(false),again=useRef(false),generation=useRef(0),debounce=useRef<ReturnType<typeof setTimeout>|null>(null);
 const persist=useCallback(()=>{if(deviceKey.current)try{localStorage.setItem(deviceKey.current,JSON.stringify(device.current));}catch{}},[]);
 const syncNow=useCallback(async()=>{
  if(!uid.current||!supabase)return;
  if(!navigator.onLine){setPendingCount(readQueue(uid.current).length);setAvailable(false);setStatus('Offline · tiến độ trên thiết bị sẽ đồng bộ khi có mạng');return;}
  if(inFlight.current){again.current=true;return;}
  inFlight.current=true;setSyncing(true);setStatus('Đang đồng bộ…');const version=generation.current;const userId=uid.current;const snapshot=structuredClone(device.current);
  try{
   let queueProblem='';const done=new Set<string>();
   for(const job of readQueue(userId)){try{await sendJob(job);if(version!==generation.current)return;acknowledge(userId,job.id);done.add(job.id);}catch(e){queueProblem='Còn lượt chờ gửi: '+friendlyCloudError(e);break;}}
   if(done.size)setProgress(prev=>({...prev,attempts:prev.attempts.filter(a=>!done.has(a.requestId??a.id)),practice:prev.practice.filter(a=>!done.has(a.id))}));
   setPendingCount(readQueue(userId).length);
   const {data,error}=await supabase.rpc('sync_learning_state',{p_device_id:deviceUuid.current,p_study_seconds:snapshot.seconds,p_name:snapshot.dirtyProfile?.name??null,p_daily_goal:snapshot.dirtyProfile?.dailyGoal??null,p_cursor:snapshot.dirtyCursor});
   if(version!==generation.current||userId!==uid.current)return;
   if(error)throw error;const reply=data as CloudReply;const history=await supabase.rpc('get_practice_history');if(version!==generation.current||userId!==uid.current)return;setV2Ready(!history.error);if(!history.error)reply.practice=history.data;else if(history.error.code==='PGRST202')reply.practice=[];else throw history.error;
   if(!reply?.profile||!Array.isArray(reply.attempts)||!Array.isArray(reply.reviews))throw new Error('Database trả dữ liệu chưa đúng cấu trúc ứng dụng.');
   for(const [day,n]of Object.entries(reply.deviceSeconds))device.current.seconds[day]=Math.max(device.current.seconds[day]??0,n);
   if(JSON.stringify(device.current.dirtyProfile)===JSON.stringify(snapshot.dirtyProfile))device.current.dirtyProfile=null;
   if(JSON.stringify(device.current.dirtyCursor)===JSON.stringify(snapshot.dirtyCursor))device.current.dirtyCursor=null;
   persist();setProgress(prev=>mergeCloudProgress(prev,reply,device.current,snapshot));setCursor(device.current.dirtyCursor??(reply.profile.last_node_id?{nodeId:reply.profile.last_node_id,step:reply.profile.last_step}:null));setAvailable(!queueProblem);setStatus(queueProblem||'Đã lưu trên Supabase · '+new Date(reply.syncedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){if(version===generation.current){setAvailable(false);setStatus(friendlyCloudError(e));}}
  finally{inFlight.current=false;if(version===generation.current)setSyncing(false);if(again.current){again.current=false;void syncNow();}}
 },[persist,setProgress]);
 const schedule=useCallback(()=>{if(debounce.current)clearTimeout(debounce.current);debounce.current=setTimeout(()=>void syncNow(),800);},[syncNow]);
 useEffect(()=>{generation.current++;if(!ready){uid.current=null;setAvailable(false);return;}uid.current=user?.id??null;deviceKey.current=user?`lingostep-device-state:${user.id}`:'';deviceUuid.current=deviceId();device.current=user?loadDevice(deviceKey.current):emptyDevice();setCursor(null);setPendingCount(user?readQueue(user.id).length:0);setAvailable(false);setStatus(user?'Đang kết nối Supabase…':'Đăng nhập để lưu và học trên nhiều thiết bị');if(user){if(inFlight.current)again.current=true;else void syncNow();}return()=>{if(debounce.current)clearTimeout(debounce.current);};},[user?.id,ready,syncNow]);
 useEffect(()=>{if(!user||!ready)return;const on=()=>void syncNow();const visible=()=>void syncNow();window.addEventListener('online',on);window.addEventListener('focus',on);document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>{if(document.visibilityState==='visible')void syncNow();},45000);return()=>{window.removeEventListener('online',on);window.removeEventListener('focus',on);document.removeEventListener('visibilitychange',visible);clearInterval(timer);};},[user?.id,ready,syncNow]);
 const addTime=useCallback((day:string,seconds:number)=>{if(!uid.current)return;device.current.seconds[day]=Math.min(86400,(device.current.seconds[day]??0)+seconds);persist();},[persist]);
 const saveProfile=useCallback((name:string,dailyGoal:number)=>{if(!uid.current)return;if(!name.trim())return;device.current.dirtyProfile={name:name.trim(),dailyGoal};persist();schedule();},[persist,schedule]);
 const saveCursor=useCallback((value:Cursor)=>{if(!uid.current)return;device.current.dirtyCursor=value;setCursor(value);persist();schedule();},[persist,schedule]);
 return {status,cursor,syncing,available,pendingCount,v2Ready,syncNow,addTime,saveProfile,saveCursor};
}
