import {createClient} from '@supabase/supabase-js';
import {curriculum,nodes} from '../src/lib/engine';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong môi trường chạy seed. Không dùng service-role key ở trình duyệt.');
const questions=[...new Map(curriculum.lessons.flatMap(l=>l.questions).map(q=>[q.id,q])).values()];
const client=createClient(url,key,{auth:{persistSession:false}});
const {error}=await client.rpc('admin_seed_bundle',{p_bundle:{questions,nodes:nodes.map(n=>({id:n.id,order:n.order,title:n.title,level:n.level,kind:n.kind,question_ids:n.lesson?.questions.map(q=>q.id)??[],word_ids:n.lesson?.vocab??[]}))}});
if(error)throw new Error(error.message);
console.log(`Seeded ${nodes.length} nodes and ${questions.length} canonical questions.`);
