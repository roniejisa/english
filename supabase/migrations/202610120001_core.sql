-- LingoStep: apply with Supabase SQL Editor or supabase db push.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text not null default 'Bạn' check(char_length(display_name) between 1 and 35),daily_goal integer not null default 15 check(daily_goal in (5,10,15,30)));
create table public.course_nodes(id text primary key,ordinal integer unique not null,title text not null,level text not null,kind text not null check(kind in ('lesson','milestone')),question_ids text[] not null default '{}',word_ids text[] not null default '{}');
create table public.question_prompts(id text primary key,skill text not null check(skill in ('grammar','listening','reading')),prompt text not null,options jsonb,audio text);
create table private.answer_keys(question_id text primary key references public.question_prompts(id) on delete cascade,answer text not null,explanation text not null);
create table public.attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,node_id text not null references public.course_nodes(id),score integer not null check(score between 0 and 100),answers jsonb not null,speaking_practised boolean not null default false,created_at timestamptz not null default now());
create index attempts_user_node on public.attempts(user_id,node_id,score);
create table public.reviews(user_id uuid not null references auth.users(id) on delete cascade,word_id text not null,due timestamptz not null,interval integer not null default 0 check(interval>=0),ease numeric not null default 2.5 check(ease>=1.3 and ease<=5),repetitions integer not null default 0 check(repetitions>=0),primary key(user_id,word_id));
create table private.quiz_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,node_id text not null references public.course_nodes(id),question_ids text[] not null,created_at timestamptz not null default now(),attempt_id uuid references public.attempts(id));
alter table public.profiles enable row level security;
alter table public.course_nodes enable row level security;
alter table public.question_prompts enable row level security;
alter table public.attempts enable row level security;
alter table public.reviews enable row level security;
create policy own_profile on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy read_course on public.course_nodes for select to anon,authenticated using(true);
create policy read_questions on public.question_prompts for select to anon,authenticated using(true);
create policy own_attempts on public.attempts for select to authenticated using(user_id=(select auth.uid()));
create policy own_reviews on public.reviews for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.attempts,public.course_nodes,public.question_prompts from anon,authenticated;
grant select on public.course_nodes,public.question_prompts to anon,authenticated;
grant select on public.attempts to authenticated;
grant select,insert,update,delete on public.profiles,public.reviews to authenticated;
create function private.unlocked(p_user uuid,p_node text) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.course_nodes where id=p_node) and not exists(
  select 1 from public.course_nodes n where n.ordinal<(select ordinal from public.course_nodes where id=p_node)
  and not exists(select 1 from public.attempts a where a.user_id=p_user and a.node_id=n.id and a.score>=80 and (n.kind<>'milestone' or a.speaking_practised))
 );
$$;
create function private.normalized(p_text text) returns text language sql immutable set search_path='' as $$
 select lower(trim(regexp_replace(regexp_replace(coalesce(p_text,''),'[.,!?;:“”"'']','','g'),'\s+',' ','g')));
$$;
create function public.start_milestone(p_node_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();n public.course_nodes;sid uuid;qids text[];
begin
 if u is null then raise exception 'Cần đăng nhập.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into n from public.course_nodes where id=p_node_id;
 if n.kind is distinct from 'milestone' or not private.unlocked(u,p_node_id) then raise exception 'Trạm kiểm tra chưa mở.';end if;
 select id,question_ids into sid,qids from private.quiz_sessions where user_id=u and node_id=p_node_id and attempt_id is null and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if sid is null then
  select array_agg(id order by random()) into qids from(
   select id from (
    select p.id,p.skill,row_number() over(partition by p.skill order by random()) as pos from public.question_prompts p
    where p.id in(select unnest(c.question_ids) from public.course_nodes c where c.level=n.level and c.kind='lesson')
   ) x where pos<=3
  ) y;
  if cardinality(qids)<>9 then raise exception 'Nội dung kiểm tra chưa đủ 9 câu.';end if;
  insert into private.quiz_sessions(user_id,node_id,question_ids) values(u,p_node_id,qids) returning id into sid;
 end if;
 return jsonb_build_object('session_id',sid,'question_ids',qids);
end;$$;
create function public.submit_attempt(p_node_id text,p_answers jsonb,p_session_id uuid default null,p_speaking_practised boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();n public.course_nodes;expected text[];qs private.quiz_sessions;num integer;correct_count integer;s integer;aid uuid;feedback jsonb;
begin
 if u is null then raise exception 'Cần đăng nhập.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into n from public.course_nodes where id=p_node_id;
 if n.id is null or not private.unlocked(u,p_node_id) then raise exception 'Bài này chưa được mở khóa.';end if;
 if jsonb_typeof(p_answers)<>'object' then raise exception 'Dữ liệu đáp án không hợp lệ.';end if;
 if n.kind='milestone' then
  select * into qs from private.quiz_sessions where id=p_session_id and user_id=u and node_id=p_node_id for update;
  if qs.id is null or qs.created_at<now()-interval '24 hours' then raise exception 'Phiên kiểm tra không hợp lệ hoặc hết hạn.';end if;
  if qs.attempt_id is not null then
   return(select jsonb_build_object('score',a.score,'attempt_id',a.id) from public.attempts a where a.id=qs.attempt_id);
  end if;
  if not p_speaking_practised then raise exception 'Cần tham gia lượt luyện nói.';end if;
  expected:=qs.question_ids;
 else expected:=n.question_ids;end if;
 num:=cardinality(expected);
 if num=0 or (select count(*) from jsonb_object_keys(p_answers))<>num or exists(select 1 from unnest(expected) q where not p_answers?q) then raise exception 'Cần trả lời đủ các câu trong đề.';end if;
 if exists(select 1 from unnest(expected) q where jsonb_typeof(p_answers->q)<>'string' or char_length(p_answers->>q)>500) then raise exception 'Đáp án phải là chuỗi văn bản ngắn.';end if;
 if (select count(*) from public.attempts where user_id=u and created_at>now()-interval '1 hour')>=60 then raise exception 'Quá nhiều lượt nộp trong một giờ.';end if;
 select count(*) filter(where private.normalized(p_answers->>k.question_id)=private.normalized(k.answer)),jsonb_agg(jsonb_build_object('id',k.question_id,'correct',private.normalized(p_answers->>k.question_id)=private.normalized(k.answer),'answer',k.answer,'explanation',k.explanation)) into correct_count,feedback from private.answer_keys k where k.question_id=any(expected);
 if (select count(*) from private.answer_keys where question_id=any(expected))<>num then raise exception 'Thiếu đáp án chuẩn. Liên hệ quản trị nội dung.';end if;
 s:=round(correct_count::numeric/num*100);
 insert into public.reviews(user_id,word_id,due) select u,w,now() from unnest(n.word_ids) w on conflict(user_id,word_id) do nothing;
 insert into public.attempts(user_id,node_id,score,answers,speaking_practised) values(u,p_node_id,s,p_answers,case when n.kind='milestone' then p_speaking_practised else false end) returning id into aid;
 if n.kind='milestone' then update private.quiz_sessions set attempt_id=aid where id=qs.id;end if;
 return jsonb_build_object('score',s,'attempt_id',aid,'feedback',feedback);
end;$$;
-- Seed RPC only accepts the service role. Never expose the service-role key in Next public variables.
create function public.admin_seed_bundle(p_bundle jsonb) returns void language plpgsql security definer set search_path='' as $$
declare q jsonb;n jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Admin only';end if;
 for q in select value from jsonb_array_elements(p_bundle->'questions') loop
  insert into public.question_prompts(id,skill,prompt,options,audio) values(q->>'id',q->>'skill',q->>'prompt',q->'options',q->>'audio') on conflict(id) do update set skill=excluded.skill,prompt=excluded.prompt,options=excluded.options,audio=excluded.audio;
  insert into private.answer_keys(question_id,answer,explanation) values(q->>'id',q->>'answer',q->>'explanation') on conflict(question_id) do update set answer=excluded.answer,explanation=excluded.explanation;
 end loop;
 for n in select value from jsonb_array_elements(p_bundle->'nodes') loop
  insert into public.course_nodes(id,ordinal,title,level,kind,question_ids,word_ids) values(n->>'id',(n->>'order')::integer,n->>'title',n->>'level',n->>'kind',array(select jsonb_array_elements_text(n->'question_ids')),array(select jsonb_array_elements_text(n->'word_ids'))) on conflict(id) do update set ordinal=excluded.ordinal,title=excluded.title,level=excluded.level,kind=excluded.kind,question_ids=excluded.question_ids,word_ids=excluded.word_ids;
 end loop;
end;$$;
revoke all on function public.start_milestone(text) from public,anon;
revoke all on function public.submit_attempt(text,jsonb,uuid,boolean) from public,anon;
revoke all on function public.admin_seed_bundle(jsonb) from public,anon,authenticated;
grant execute on function public.start_milestone(text),public.submit_attempt(text,jsonb,uuid,boolean) to authenticated;
grant execute on function public.admin_seed_bundle(jsonb) to service_role;
commit;
