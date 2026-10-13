import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {curriculum,nodes} from '../src/lib/engine';
const U1='11111111-1111-4111-8111-111111111111',U2='22222222-2222-4222-8222-222222222222';
test('Database enforces identity, canonical grading, locks, random milestones, and replay protection',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('${U1}'),('${U2}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
 await db.exec(readFileSync('supabase/migrations/202610120001_core.sql','utf8'));await db.exec(readFileSync('supabase/migrations/202610120002_speech_quota.sql','utf8'));
 const questions=[...new Map(curriculum.lessons.flatMap(l=>l.questions).map(q=>[q.id,q])).values()];const bundle={questions,nodes:nodes.map(n=>({id:n.id,order:n.order,title:n.title,level:n.level,kind:n.kind,question_ids:n.lesson?.questions.map(q=>q.id)??[],word_ids:n.lesson?.vocab??[]}))};
 await db.exec("set request.jwt.claim.role='service_role'");await db.query('select public.admin_seed_bundle($1::jsonb)',[JSON.stringify(bundle)]);
 async function role(role:string,user:string=''){await db.exec(`reset role;set role ${role};set request.jwt.claim.role='${role}';set request.jwt.claim.sub='${user}';`);}
 async function submit(id:string,answers:Record<string,string>,session:string|null=null,speaking=false){const r=await db.query<{result:any}>('select public.submit_attempt($1,$2::jsonb,$3::uuid,$4::boolean) as result',[id,JSON.stringify(answers),session,speaking]);return r.rows[0].result;}
 const answers=(id:string)=>Object.fromEntries(curriculum.lessons.find(l=>l.id===id)!.questions.map(q=>[q.id,q.answer]));
 await role('anon');await assert.rejects(submit('a0-1',answers('a0-1')));await role('authenticated',U1);
 await assert.rejects(submit('a0-2',answers('a0-2')),/chưa được mở/);
 await assert.rejects(submit('a0-1',{...answers('a0-1'),score:'100'}),/đủ các câu/);
 const bad=Object.fromEntries(Object.keys(answers('a0-1')).map(k=>[k,'wrong']));assert.equal((await submit('a0-1',bad)).score,0);await assert.rejects(submit('a0-2',answers('a0-2')));
 const first=await submit('a0-1',answers('a0-1'));assert.equal(first.score,100);assert.equal((await db.query('select * from public.reviews')).rows.length,3);
 await assert.rejects(db.query("insert into public.attempts(user_id,node_id,score,answers) values ($1,'a0-1',100,'{}')",[U1]),/permission denied/);
 await assert.rejects(db.query('select * from private.answer_keys'),/permission denied/);
 await role('authenticated',U2);assert.equal((await db.query('select * from public.attempts')).rows.length,0);await assert.rejects(submit('a0-2',answers('a0-2')));
 await assert.rejects(db.query("insert into public.reviews(user_id,word_id,due) values ($1,'apple',now())",[U1]),/row-level security/);
 await role('authenticated',U1);for(const l of curriculum.lessons.slice(1,6)){assert.equal((await submit(l.id,answers(l.id))).score,100);}
 await assert.rejects(submit('a1-1',answers('a1-1')));
 const res=await db.query<{result:any}>("select public.start_milestone('milestone-a0') as result");const session=res.rows[0].result;assert.equal(session.question_ids.length,9);
 for(const s of ['grammar','listening','reading'])assert.equal(session.question_ids.filter((id:string)=>questions.find(q=>q.id===id)?.skill===s).length,3);
 const milestoneAnswers=Object.fromEntries(session.question_ids.map((id:string)=>[id,questions.find(q=>q.id===id)!.answer]));await assert.rejects(submit('milestone-a0',milestoneAnswers,session.session_id,false),/luyện nói/);
 await role('authenticated',U2);await assert.rejects(submit('milestone-a0',milestoneAnswers,session.session_id,true));await role('authenticated',U1);
 const done=await submit('milestone-a0',milestoneAnswers,session.session_id,true);assert.equal(done.score,100);const replay=await submit('milestone-a0',milestoneAnswers,session.session_id,true);assert.equal(replay.attempt_id,done.attempt_id);assert.equal((await submit('a1-1',answers('a1-1'))).score,100);
 await role('authenticated',U1);for(let i=0;i<20;i++)assert.equal((await db.query<{allowed:boolean}>('select public.reserve_speech_quota() as allowed')).rows[0].allowed,true);assert.equal((await db.query<{allowed:boolean}>('select public.reserve_speech_quota() as allowed')).rows[0].allowed,false);await role('authenticated',U2);assert.equal((await db.query<{allowed:boolean}>('select public.reserve_speech_quota() as allowed')).rows[0].allowed,true);
 await db.close();
});
