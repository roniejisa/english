begin;
create table public.vocabulary_catalog(id text primary key,word text unique not null,meaning text not null,topic text not null,metadata jsonb not null);
create table public.vocabulary_cards(user_id uuid not null references auth.users(id) on delete cascade,word_id text not null references public.vocabulary_catalog(id),saved boolean not null default false,due timestamptz not null default now(),interval integer not null default 0 check(interval>=0),ease numeric not null default 2.5 check(ease between 1.3 and 5),repetitions integer not null default 0 check(repetitions>=0),correct integer not null default 0 check(correct>=0),wrong integer not null default 0 check(wrong>=0),last_reviewed timestamptz,updated_at timestamptz not null default now(),primary key(user_id,word_id));
create table private.vocabulary_events(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,word_id text not null references public.vocabulary_catalog(id),kind text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
alter table public.vocabulary_catalog enable row level security;
alter table public.vocabulary_cards enable row level security;
create policy read_vocabulary on public.vocabulary_catalog for select to anon,authenticated using(true);
create policy own_vocabulary_cards on public.vocabulary_cards for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.vocabulary_catalog,public.vocabulary_cards from anon,authenticated;
grant select on public.vocabulary_catalog to anon,authenticated;
grant select on public.vocabulary_cards to authenticated;
create function public.admin_seed_vocabulary(p_bundle jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Chỉ quản trị viên được nạp từ vựng.';end if;
 insert into public.vocabulary_catalog(id,word,meaning,topic,metadata) select x->>'id',x->>'word',x->>'meaning',x->>'topic',x from jsonb_array_elements(p_bundle) x on conflict(id) do update set word=excluded.word,meaning=excluded.meaning,topic=excluded.topic,metadata=excluded.metadata;
end;$$;
create function public.submit_vocabulary_event(p_request_id uuid,p_word_id text,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();e private.vocabulary_events;c public.vocabulary_cards;w public.vocabulary_catalog;q integer;new_interval integer;new_repetitions integer;new_ease numeric;is_correct boolean;result jsonb;
begin
 if u is null or p_request_id is null then raise exception 'Cần đăng nhập.';end if;
 if p_kind is null or p_kind not in ('bookmark','review','answer') or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Lượt từ vựng không hợp lệ.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into e from private.vocabulary_events where user_id=u and request_id=p_request_id;
 if e.request_id is not null then
  if e.word_id<>p_word_id or e.kind<>p_kind or e.payload<>p_payload then raise exception 'Mã lượt từ đã dùng cho dữ liệu khác.';end if;
  return e.result;
 end if;
 select * into w from public.vocabulary_catalog where id=p_word_id;
 if w.id is null then raise exception 'Từ này chưa có trong database. Hãy chạy SQL v2.2.';end if;
 if p_kind='bookmark' and (jsonb_typeof(p_payload->'saved') is distinct from 'boolean' or (select count(*) from jsonb_object_keys(p_payload))<>1) then raise exception 'Trạng thái lưu từ không hợp lệ.';end if;
 if p_kind='review' and (jsonb_typeof(p_payload->'quality') is distinct from 'number' or p_payload->>'quality' not in ('1','3','5') or (select count(*) from jsonb_object_keys(p_payload))<>1) then raise exception 'Mức nhớ không hợp lệ.';end if;
 if p_kind='answer' and (p_payload->>'questionKind' is null or p_payload->>'questionKind' not in ('meaning','listening','context') or jsonb_typeof(p_payload->'answer') is distinct from 'string' or char_length(p_payload->>'answer')>500 or (select count(*) from jsonb_object_keys(p_payload))<>2) then raise exception 'Đáp án từ vựng không hợp lệ.';end if;
 if (select count(*) from private.vocabulary_events where user_id=u and created_at>now()-interval '1 hour')>=1200 then raise exception 'Quá nhiều lượt từ trong một giờ.';end if;
 select * into c from public.vocabulary_cards where user_id=u and word_id=w.id;
 if c.word_id is null then
  insert into public.vocabulary_cards(user_id,word_id,due,interval,ease,repetitions) select u,w.id,r.due,r.interval,r.ease,r.repetitions from public.reviews r where r.user_id=u and r.word_id=w.id on conflict do nothing;
  insert into public.vocabulary_cards(user_id,word_id) values(u,w.id) on conflict do nothing;
  select * into c from public.vocabulary_cards where user_id=u and word_id=w.id;
 end if;
 if p_kind='bookmark' then update public.vocabulary_cards set saved=(p_payload->>'saved')::boolean,updated_at=now() where user_id=u and word_id=w.id returning * into c;
 elsif p_kind='review' then
  q:=(p_payload->>'quality')::integer;new_repetitions:=case when q>=3 then c.repetitions+1 else 0 end;
  new_interval:=case when q<3 then 0 when new_repetitions=1 then 1 when new_repetitions=2 then 3 else round(c.interval*c.ease)::integer end;
  new_ease:=least(5,greatest(1.3,c.ease+(0.1-(5-q)*(0.08+(5-q)*0.02))));
  update public.vocabulary_cards set due=now()+case when new_interval=0 then interval '10 minutes' else new_interval*interval '1 day' end,interval=new_interval,ease=new_ease,repetitions=new_repetitions,last_reviewed=now(),updated_at=now() where user_id=u and word_id=w.id returning * into c;
 else
  is_correct:=private.normalized(p_payload->>'answer')=private.normalized(case when p_payload->>'questionKind'='meaning' then w.meaning else w.word end);
  update public.vocabulary_cards set correct=correct+case when is_correct then 1 else 0 end,wrong=wrong+case when is_correct then 0 else 1 end,due=case when is_correct then due else now() end,updated_at=now() where user_id=u and word_id=w.id returning * into c;
 end if;
 result:=jsonb_build_object('card',to_jsonb(c),'correct',is_correct);
 insert into private.vocabulary_events(user_id,request_id,word_id,kind,payload,result) values(u,p_request_id,w.id,p_kind,p_payload,result);
 return result;
end;$$;
create function public.get_vocabulary_state() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from (
 select to_jsonb(c) x from public.vocabulary_cards c where user_id=auth.uid()
 union all
 select jsonb_build_object('word_id',r.word_id,'saved',false,'due',r.due,'interval',r.interval,'ease',r.ease,'repetitions',r.repetitions,'correct',0,'wrong',0,'last_reviewed',null) from public.reviews r where user_id=auth.uid() and exists(select 1 from public.vocabulary_catalog w where w.id=r.word_id) and not exists(select 1 from public.vocabulary_cards c where c.user_id=r.user_id and c.word_id=r.word_id)
 ) rows;
$$;
revoke all on function public.admin_seed_vocabulary(jsonb) from public,anon,authenticated;
grant execute on function public.admin_seed_vocabulary(jsonb) to service_role;
revoke all on function public.submit_vocabulary_event(uuid,text,text,jsonb),public.get_vocabulary_state() from public,anon;
grant execute on function public.submit_vocabulary_event(uuid,text,text,jsonb),public.get_vocabulary_state() to authenticated;
create or replace function public.app_capabilities() returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('version',2,'offline_attempts',true,'practice',true,'writing',true,'vocabulary',true,'content_version','2.2.0');$$;
notify pgrst,'reload schema';
commit;
