import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {emptyProgress} from '../src/lib/engine';
import {mergeCloudProgress,emptyDevice,friendlyCloudError,type CloudReply} from '../src/lib/cloud-state';
const U1='11111111-1111-4111-8111-111111111111',U2='22222222-2222-4222-8222-222222222222',D1='33333333-3333-4333-8333-333333333333',D2='44444444-4444-4444-8444-444444444444';
test('One-file setup is repeatable; cloud state isolates users, merges device time and restores learning cursor',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('${U1}'),('${U2}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
 const setup=readFileSync('supabase/LingoStep-Supabase-Setup.sql','utf8');await db.exec(setup);await db.exec(setup);assert.equal((await db.query('select * from public.course_nodes')).rows.length,49);
 async function role(name:string,user=''){await db.exec(`reset role;set role ${name};set request.jwt.claim.role='${name}';set request.jwt.claim.sub='${user}';`);}
 const day=new Date().toISOString().slice(0,10);
 async function sync(device:string,seconds:Record<string,number>={},name:string|null=null,goal:number|null=null,cursor:any=null){const r=await db.query<{state:any}>('select public.sync_learning_state($1::uuid,$2::jsonb,$3::text,$4::integer,$5::jsonb) as state',[device,JSON.stringify(seconds),name,goal,cursor?JSON.stringify(cursor):null]);return r.rows[0].state;}
 await role('anon');await assert.rejects(sync(D1));await role('authenticated',U1);
 let state=await sync(D1,{[day]:60},'Người học',30,{nodeId:'a0-1',step:2});assert.equal(state.studySeconds[day],60);assert.equal(state.profile.last_step,2);assert.equal(state.profile.display_name,'Người học');assert.equal(state.profile.daily_goal,30);
 state=await sync(D1,{[day]:60});assert.equal(state.studySeconds[day],60);state=await sync(D1,{[day]:45});assert.equal(state.studySeconds[day],60);
 state=await sync(D2,{[day]:90});assert.equal(state.studySeconds[day],150);state=await sync(D1,{[day]:75});assert.equal(state.studySeconds[day],165);
 await assert.rejects(sync(D1,{[day]:-1}));await assert.rejects(sync(D1,{},'x',123));await assert.rejects(sync(D1,{},null,null,{nodeId:'a1-1',step:0}));
 await assert.rejects(db.query('update public.learning_devices set study_seconds=\'{}\''));
 await role('authenticated',U2);state=await sync(D1);assert.deepEqual(state.studySeconds,{});assert.equal(state.profile.display_name,'Bạn');assert.equal((await db.query('select * from public.learning_devices')).rows.length,1);assert.equal((await db.query('select * from public.profiles')).rows.length,1);await db.close();
});
test('In-flight edits retain new profile and time without duplicating acknowledged device time',()=>{const remote:CloudReply={profile:{display_name:'Saved',daily_goal:15,last_node_id:null,last_step:0},studySeconds:{'2026-10-12':180},deviceSeconds:{'2026-10-12':60},attempts:[],reviews:[],syncedAt:new Date().toISOString()};const device={...emptyDevice(),seconds:{'2026-10-12':75},dirtyProfile:{name:'Editing',dailyGoal:30}};const p=mergeCloudProgress(emptyProgress(),remote,device,emptyDevice());assert.equal(p.studySeconds['2026-10-12'],195);assert.equal(p.name,'Editing');assert.equal(p.dailyGoal,30);assert.ok(friendlyCloudError({code:'PGRST202'}).includes('SQL Editor'));});
