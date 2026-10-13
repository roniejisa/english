begin;
create table public.writing_exercises(id text primary key,node_id text not null references public.course_nodes(id),prompt text not null);
create table private.writing_keys(exercise_id text primary key references public.writing_exercises(id),accepted text[] not null);
create table public.writing_attempts(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,exercise_id text not null references public.writing_exercises(id),answer text not null,correct boolean not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
create table public.writing_drafts(user_id uuid not null references auth.users(id) on delete cascade,exercise_id text not null references public.writing_exercises(id),body text not null,revision integer not null default 1,updated_at timestamptz not null default now(),primary key(user_id,exercise_id));
alter table public.writing_exercises enable row level security;
alter table public.writing_attempts enable row level security;
alter table public.writing_drafts enable row level security;
create policy reading_writing_exercises on public.writing_exercises for select to anon,authenticated using(true);
create policy own_writing_attempts on public.writing_attempts for select to authenticated using(user_id=(select auth.uid()));
create policy own_writing_drafts on public.writing_drafts for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.writing_exercises,public.writing_attempts,public.writing_drafts from anon,authenticated;
grant select on public.writing_exercises to anon,authenticated;
grant select on public.writing_attempts,public.writing_drafts to authenticated;
create function private.normalized_writing(s text) returns text language sql immutable set search_path='' as $$
select trim(regexp_replace(regexp_replace(lower(normalize(translate(s,'’‘',$apos$''$apos$),NFKC)),'[.,!?;:“”"]',' ','g'),'\s+',' ','g'));
$$;
create function public.submit_writing(p_request_id uuid,p_exercise_id text,p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old public.writing_attempts;node text;correct_answer boolean;
begin
 if u is null or p_request_id is null then raise exception 'Cần đăng nhập.';end if;
 if p_answer is null or char_length(trim(p_answer))=0 or char_length(p_answer)>1000 then raise exception 'Viết từ 1 đến 1000 ký tự.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into old from public.writing_attempts where user_id=u and request_id=p_request_id;
 if old.request_id is not null then
  if old.exercise_id<>p_exercise_id or old.answer<>p_answer then raise exception 'Mã lượt viết đã dùng cho dữ liệu khác.';end if;
  return to_jsonb(old);
 end if;
 select node_id into node from public.writing_exercises where id=p_exercise_id;
 if node is null or not private.unlocked(u,node) then raise exception 'Bài viết chưa mở khóa.';end if;
 if (select count(*) from public.writing_attempts where user_id=u and created_at>now()-interval '1 hour')>=120 then raise exception 'Quá nhiều lượt viết trong một giờ.';end if;
 select exists(select 1 from private.writing_keys k,unnest(k.accepted) a where k.exercise_id=p_exercise_id and private.normalized_writing(a)=private.normalized_writing(p_answer)) into correct_answer;
 insert into public.writing_attempts(user_id,request_id,exercise_id,answer,correct) values(u,p_request_id,p_exercise_id,p_answer,correct_answer) returning * into old;
 return to_jsonb(old);
end;$$;
create function public.save_writing_draft(p_exercise_id text,p_body text,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old public.writing_drafts;node text;
begin
 if u is null then raise exception 'Cần đăng nhập.';end if;
 if p_body is null or char_length(p_body)>1000 or p_revision is null or p_revision<0 then raise exception 'Bản nháp không hợp lệ.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select node_id into node from public.writing_exercises where id=p_exercise_id;
 if node is null or not private.unlocked(u,node) then raise exception 'Bài viết chưa mở khóa.';end if;
 select * into old from public.writing_drafts where user_id=u and exercise_id=p_exercise_id;
 if coalesce(old.revision,0)<>p_revision then raise exception 'Bản nháp tài khoản đã thay đổi trên thiết bị khác.' using errcode='40001';end if;
 insert into public.writing_drafts(user_id,exercise_id,body,revision) values(u,p_exercise_id,p_body,1) on conflict(user_id,exercise_id) do update set body=excluded.body,revision=public.writing_drafts.revision+1,updated_at=now() returning * into old;
 return to_jsonb(old);
end;$$;
revoke all on function public.submit_writing(uuid,text,text),public.save_writing_draft(text,text,integer) from public,anon;
grant execute on function public.submit_writing(uuid,text,text),public.save_writing_draft(text,text,integer) to authenticated;
create function public.admin_seed_writing(p_bundle jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Chỉ quản trị viên được nạp nội dung.';end if;
 insert into public.writing_exercises(id,node_id,prompt) select x->>'id',x->>'nodeId',x->>'prompt' from jsonb_array_elements(p_bundle) x on conflict(id) do update set prompt=excluded.prompt,node_id=excluded.node_id;
 insert into private.writing_keys(exercise_id,accepted) select x->>'id',array(select jsonb_array_elements_text(x->'accepted')) from jsonb_array_elements(p_bundle) x on conflict(exercise_id) do update set accepted=excluded.accepted;
end;$$;
revoke all on function public.admin_seed_writing(jsonb) from public,anon,authenticated;
grant execute on function public.admin_seed_writing(jsonb) to service_role;
create or replace function public.app_capabilities() returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('version',2,'offline_attempts',true,'practice',true,'writing',true,'content_version','2.1.0');$$;
notify pgrst,'reload schema';
commit;
