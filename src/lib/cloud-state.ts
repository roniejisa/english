import type {Progress} from './types';
export type Cursor={nodeId:string;step:number};
export type CloudReply={profile:{display_name:string;daily_goal:number;last_node_id:string|null;last_step:number};studySeconds:Record<string,number>;deviceSeconds:Record<string,number>;attempts:any[];reviews:any[];syncedAt:string};
export type DeviceState={seconds:Record<string,number>;dirtyProfile:{name:string;dailyGoal:number}|null;dirtyCursor:Cursor|null};
export const emptyDevice=():DeviceState=>({seconds:{},dirtyProfile:null,dirtyCursor:null});
export function mergeCloudProgress(previous:Progress,remote:CloudReply,device:DeviceState,sent:DeviceState):Progress{
 const studySeconds={...remote.studySeconds};
 // Include time accrued while the request was in flight without double-counting a replay.
 for(const [day,total] of Object.entries(device.seconds))studySeconds[day]=Math.min(86400,(studySeconds[day]??0)+Math.max(0,total-(remote.deviceSeconds[day]??0)));
 const editingProfile=!!device.dirtyProfile;
 return {...previous,attempts:remote.attempts.map(row=>({id:row.id,nodeId:row.node_id,score:row.score,date:row.created_at,answers:row.answers,source:'cloud' as const,speakingPractised:row.speaking_practised})),reviews:remote.reviews.map(row=>({wordId:row.word_id,due:row.due,interval:row.interval,ease:Number(row.ease),repetitions:row.repetitions})),studySeconds,name:editingProfile?device.dirtyProfile!.name:remote.profile.display_name,dailyGoal:editingProfile?device.dirtyProfile!.dailyGoal:remote.profile.daily_goal};
}
export function friendlyCloudError(error:{message?:string;code?:string}|unknown){const e=error as {message?:string;code?:string};if(['PGRST202','PGRST205','42P01','42883'].includes(e?.code??''))return 'Database chưa được thiết lập. Chạy file LingoStep-Supabase-Setup.sql trong SQL Editor.';return e?.message||'Chưa kết nối được Supabase. Dữ liệu trên thiết bị vẫn được giữ; ứng dụng sẽ thử lại khi có mạng.';}
