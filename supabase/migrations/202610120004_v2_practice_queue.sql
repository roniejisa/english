begin;
alter table public.course_nodes add column if not exists legacy_question_ids text[] not null default '{}';
update public.course_nodes set legacy_question_ids=question_ids where kind='lesson' and cardinality(legacy_question_ids)=0;

create table if not exists private.attempt_requests(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,node_id text not null references public.course_nodes(id),payload jsonb not null,attempt_id uuid not null references public.attempts(id),primary key(user_id,request_id));
create table if not exists public.practice_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,question_ids text[] not null,answers jsonb not null,score integer not null check(score between 0 and 100),created_at timestamptz not null default now(),unique(user_id,request_id));
alter table public.practice_attempts enable row level security;
drop policy if exists own_practice_attempts on public.practice_attempts;
create policy own_practice_attempts on public.practice_attempts for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.practice_attempts from anon,authenticated;
grant select on public.practice_attempts to authenticated;
create or replace function public.app_capabilities() returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('version',2,'offline_attempts',true,'practice',true,'content_version','2.0.0');$$;
grant execute on function public.app_capabilities() to anon,authenticated;
create or replace function public.submit_attempt_v2(p_request_id uuid,p_node_id text,p_answers jsonb,p_session_id uuid default null,p_speaking_practised boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();existing private.attempt_requests;result jsonb;payload jsonb:=jsonb_build_object('answers',p_answers,'session',p_session_id,'speaking',p_speaking_practised);
begin
 if u is null or p_request_id is null then raise exception 'Cần đăng nhập và mã lượt nộp.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into existing from private.attempt_requests where user_id=u and request_id=p_request_id;
 if existing.attempt_id is not null then
  if existing.node_id<>p_node_id or existing.payload<>payload then raise exception 'Mã lượt nộp đã được sử dụng cho dữ liệu khác.';end if;
  return(select jsonb_build_object('score',a.score,'attempt_id',a.id,'created_at',a.created_at) from public.attempts a where a.id=existing.attempt_id);
 end if;
 result:=public.submit_attempt(p_node_id,p_answers,p_session_id,p_speaking_practised);
 insert into private.attempt_requests(user_id,request_id,node_id,payload,attempt_id) values(u,p_request_id,p_node_id,payload,(result->>'attempt_id')::uuid);
 return result;
end;$$;
create or replace function public.submit_practice(p_request_id uuid,p_question_ids text[],p_answers jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old public.practice_attempts;total integer;correct_count integer;score integer;aid uuid;
begin
 if u is null or p_request_id is null then raise exception 'Cần đăng nhập.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into old from public.practice_attempts where user_id=u and request_id=p_request_id;
 if old.id is not null then
  if old.question_ids<>p_question_ids or old.answers<>p_answers then raise exception 'Mã lượt luyện đã được sử dụng cho dữ liệu khác.';end if;
  return jsonb_build_object('score',old.score,'attempt_id',old.id,'created_at',old.created_at);
 end if;
 total:=cardinality(p_question_ids);
 if total is null or total not between 1 and 50 or total<>(select count(distinct x) from unnest(p_question_ids) x) or jsonb_typeof(p_answers)<>'object' or (select count(*) from jsonb_object_keys(p_answers))<>total then raise exception 'Đề luyện hoặc đáp án không hợp lệ.';end if;
 if exists(select 1 from unnest(p_question_ids) q where not p_answers?q or jsonb_typeof(p_answers->q)<>'string' or char_length(p_answers->>q)>500) then raise exception 'Cần trả lời đủ các câu.';end if;
 if exists(select 1 from unnest(p_question_ids) q where not exists(select 1 from public.course_nodes n where n.kind='lesson' and q=any(n.question_ids) and private.unlocked(u,n.id))) then raise exception 'Chỉ luyện câu hỏi trong bài đã mở.';end if;
 if (select count(*) from public.practice_attempts where user_id=u and created_at>now()-interval '1 hour')>=60 then raise exception 'Quá nhiều lượt luyện trong một giờ.';end if;
 select count(*) filter(where private.normalized(p_answers->>k.question_id)=private.normalized(k.answer)) into correct_count from private.answer_keys k where k.question_id=any(p_question_ids);
 if (select count(*) from private.answer_keys where question_id=any(p_question_ids))<>total then raise exception 'Thiếu nội dung chuẩn. Hãy cập nhật SQL v2.0.';end if;
 score:=round(correct_count::numeric/total*100);
 insert into public.practice_attempts(user_id,request_id,question_ids,answers,score) values(u,p_request_id,p_question_ids,p_answers,score) returning id into aid;
 return jsonb_build_object('score',score,'attempt_id',aid,'created_at',now());
end;$$;
create or replace function public.get_practice_history() returns jsonb language sql security definer set search_path='' as $$select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at),'[]') from public.practice_attempts p where p.user_id=auth.uid();$$;
revoke all on function public.submit_attempt_v2(uuid,text,jsonb,uuid,boolean),public.submit_practice(uuid,text[],jsonb),public.get_practice_history() from public,anon;
grant execute on function public.submit_attempt_v2(uuid,text,jsonb,uuid,boolean),public.submit_practice(uuid,text[],jsonb),public.get_practice_history() to authenticated;
create or replace function public.submit_attempt(p_node_id text,p_answers jsonb,p_session_id uuid default null,p_speaking_practised boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
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
 else expected:=n.question_ids;
  if cardinality(n.legacy_question_ids)>0 and (select count(*) from jsonb_object_keys(p_answers))=cardinality(n.legacy_question_ids) and not exists(select 1 from unnest(n.legacy_question_ids) q where not p_answers?q) then expected:=n.legacy_question_ids;end if;
 end if;
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

notify pgrst,'reload schema';
commit;
