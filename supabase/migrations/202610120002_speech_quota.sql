begin;
create table private.speech_usage(user_id uuid not null references auth.users(id) on delete cascade,day date not null,requests integer not null default 0,primary key(user_id,day));
create function public.reserve_speech_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();used integer;
begin
 if u is null then raise exception 'Cần đăng nhập.';end if;
 insert into private.speech_usage(user_id,day,requests) values(u,(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set requests=private.speech_usage.requests+1 where private.speech_usage.requests<20 returning requests into used;
 return used is not null;
end;$$;
revoke all on function public.reserve_speech_quota() from public,anon;
grant execute on function public.reserve_speech_quota() to authenticated;
commit;
