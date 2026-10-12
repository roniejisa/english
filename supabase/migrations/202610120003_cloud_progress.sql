begin;
alter table public.profiles add column updated_at timestamptz not null default now();
alter table public.profiles add column last_node_id text references public.course_nodes(id);
alter table public.profiles add column last_step integer not null default 0 check(last_step between 0 and 3);
create table public.learning_devices(user_id uuid not null references auth.users(id) on delete cascade,device_id uuid not null,study_seconds jsonb not null default '{}',updated_at timestamptz not null default now(),primary key(user_id,device_id));
alter table public.learning_devices enable row level security;
create policy own_learning_devices on public.learning_devices for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.learning_devices from anon,authenticated;
grant select on public.learning_devices to authenticated;
create function public.sync_learning_state(p_device_id uuid,p_study_seconds jsonb default '{}',p_name text default null,p_daily_goal integer default null,p_cursor jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old_seconds jsonb;merged jsonb:='{}';time_entry record;total_seconds jsonb;profile public.profiles;cursor_id text;cursor_step integer;
begin
 if u is null then raise exception 'Cần đăng nhập để lưu tiến độ.';end if;
 if p_device_id is null or jsonb_typeof(p_study_seconds)<>'object' or (select count(*) from jsonb_object_keys(p_study_seconds))>3660 then raise exception 'Dữ liệu thời gian học không hợp lệ.';end if;
 if p_name is not null and char_length(trim(p_name)) not between 1 and 35 then raise exception 'Tên hiển thị cần từ 1 đến 35 ký tự.';end if;
 if p_daily_goal is not null and p_daily_goal not in (5,10,15,30) then raise exception 'Mục tiêu học không hợp lệ.';end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor)<>'object' then raise exception 'Vị trí học không hợp lệ.';end if;
  cursor_id:=p_cursor->>'nodeId';cursor_step:=(p_cursor->>'step')::integer;
  if cursor_id is null or cursor_step is null or cursor_step not between 0 and 3 or not private.unlocked(u,cursor_id) then raise exception 'Vị trí học chưa mở hoặc không hợp lệ.';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 insert into public.learning_devices(user_id,device_id) values(u,p_device_id) on conflict do nothing;
 select study_seconds into old_seconds from public.learning_devices where user_id=u and device_id=p_device_id for update;
 merged:=old_seconds;
 for time_entry in select key,value from jsonb_each(p_study_seconds) loop
  if time_entry.key !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(time_entry.value)<>'number' then raise exception 'Thời gian theo ngày không hợp lệ.';end if;
  if time_entry.key::date > (now() at time zone 'Asia/Bangkok')::date+1 or (time_entry.value::text)::numeric<0 or (time_entry.value::text)::numeric>86400 or (time_entry.value::text)::numeric<>trunc((time_entry.value::text)::numeric) then raise exception 'Thời gian học vượt phạm vi.';end if;
  merged:=jsonb_set(merged,array[time_entry.key],to_jsonb(greatest(coalesce((merged->>time_entry.key)::integer,0),(time_entry.value::text)::integer)));
 end loop;
 update public.learning_devices set study_seconds=merged,updated_at=now() where user_id=u and device_id=p_device_id;
 insert into public.profiles(id) values(u) on conflict do nothing;
 update public.profiles set display_name=coalesce(trim(p_name),display_name),daily_goal=coalesce(p_daily_goal,daily_goal),last_node_id=coalesce(cursor_id,last_node_id),last_step=coalesce(cursor_step,last_step),updated_at=case when p_name is not null or p_daily_goal is not null or p_cursor is not null then now() else updated_at end where id=u returning * into profile;
 select coalesce(jsonb_object_agg(day,seconds),'{}'::jsonb) into total_seconds from(
  select day_item.key as day,least(86400,sum((day_item.value::text)::integer))::integer as seconds from public.learning_devices d cross join lateral jsonb_each(d.study_seconds) day_item where d.user_id=u group by day_item.key
 ) x;
 return jsonb_build_object('profile',to_jsonb(profile),'studySeconds',total_seconds,'deviceSeconds',merged,'attempts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]') from public.attempts a where a.user_id=u),'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.reviews r where r.user_id=u),'syncedAt',now());
end;$$;
revoke all on function public.sync_learning_state(uuid,jsonb,text,integer,jsonb) from public,anon;
grant execute on function public.sync_learning_state(uuid,jsonb,text,integer,jsonb) to authenticated;
-- One authenticated initial account state. No broad read or write policy is created.
notify pgrst,'reload schema';
commit;
