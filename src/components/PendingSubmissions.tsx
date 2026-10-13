'use client';
import {useEffect,useState} from 'react';
import {CloudUpload,RotateCcw,Trash2} from 'lucide-react';
import {readQueue,acknowledge,type PendingJob} from '@/lib/submissions';
import {nodes} from '@/lib/engine';
export default function PendingSubmissions({uid,count,onRetry,onDiscard}:{uid:string;count:number;onRetry:()=>void;onDiscard:(id:string)=>void}){const [jobs,setJobs]=useState<PendingJob[]>([]);useEffect(()=>setJobs(readQueue(uid)),[uid,count]);if(!jobs.length)return null;
 return <div className="pending-box"><div className="offline-summary"><CloudUpload size={23}/><div><strong>{jobs.length} lượt đang chờ gửi</strong><p>Được giữ trên thiết bị, chưa phải điểm đã xác nhận.</p></div></div>{jobs.map(j=><div className="pending-row" key={j.id}><div><strong>{j.kind==='practice'?'Lượt luyện tập':nodes.find(n=>n.id===j.nodeId)?.title??'Bài học'}</strong><small>{new Date(j.createdAt).toLocaleString('vi-VN')}</small></div><button className="icon-btn" aria-label="Bỏ lượt đang chờ" onClick={()=>{if(!confirm('Bỏ lượt chờ gửi này? Điểm này chưa được xác nhận trên Supabase.'))return;acknowledge(uid,j.id);setJobs(readQueue(uid));onDiscard(j.id);}}><Trash2 size={15}/></button></div>)}<button className="text-btn" onClick={onRetry}><RotateCcw size={15}/>Thử gửi và đồng bộ ngay</button><p className="small muted">Nếu phiên kiểm tra đã hết hạn, mở lại bài và làm một lượt mới. Có thể bỏ riêng lượt hết hạn tại đây.</p></div>;
}
