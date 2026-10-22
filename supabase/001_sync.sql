-- Execute once in your Supabase SQL Editor. No service_role key belongs in the apps.
begin;
create schema if not exists yixu_private;
revoke all on schema yixu_private from public,anon,authenticated;
grant usage on schema yixu_private to authenticated;
create table if not exists public.yixu_records(owner_id uuid not null references auth.users(id) on delete cascade,key text not null,value jsonb,version bigint not null default 0,primary key(owner_id,key));
create table if not exists public.yixu_changes(seq bigint generated always as identity primary key,owner_id uuid not null references auth.users(id) on delete cascade,key text not null,value jsonb,version bigint not null,kind text not null);
create index if not exists yixu_changes_owner_seq on public.yixu_changes(owner_id,seq);
create table if not exists public.yixu_ops(owner_id uuid not null references auth.users(id) on delete cascade,id uuid not null,result jsonb not null,primary key(owner_id,id));
alter table public.yixu_records enable row level security;
alter table public.yixu_changes enable row level security;
alter table public.yixu_ops enable row level security;
drop policy if exists yixu_ops_no_client_access on public.yixu_ops;
create policy yixu_ops_no_client_access on public.yixu_ops for all to anon,authenticated using(false) with check(false);
revoke all on public.yixu_records,public.yixu_changes,public.yixu_ops from anon,authenticated;
grant select on public.yixu_records,public.yixu_changes to authenticated;
drop policy if exists yixu_records_read on public.yixu_records;
create policy yixu_records_read on public.yixu_records for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists yixu_changes_read on public.yixu_changes;
create policy yixu_changes_read on public.yixu_changes for select to authenticated using(owner_id=(select auth.uid()));
create or replace function yixu_private.apply_change(p_op uuid,p_key text,p_base bigint,p_kind text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); current_row public.yixu_records; cached jsonb; v jsonb; result jsonb; next_version bigint;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_op is null or p_key is null or p_base is null or p_base<0 or p_kind is null or p_kind not in ('set','counter') or length(p_key)>500 or octet_length(p_value::text)>1000000 or p_key !~ '^(habits|checkins|notes|sessions|events|learning|journals|records|restDays|holidays|adjustments|plans|tasks|entries|checkinRecords):' then raise exception 'Invalid operation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select o.result into cached from public.yixu_ops o where o.owner_id=u and o.id=p_op;
 if found then return cached; end if;
 insert into public.yixu_records(owner_id,key,value) values(u,p_key,null) on conflict do nothing;
 select * into current_row from public.yixu_records where owner_id=u and key=p_key for update;
 if p_kind='set' and current_row.version<>p_base then return jsonb_build_object('conflict',true,'row',jsonb_build_object('key',p_key,'value',current_row.value,'version',current_row.version,'kind','set')); end if;
 if p_kind='counter' then
  if p_key not like 'checkinRecords:%' or p_value->>'delta' is null or p_value->>'target' is null or (p_value->>'target')::int not between 1 and 100 or abs((p_value->>'delta')::int)>100 then raise exception 'Invalid counter'; end if;
  v=jsonb_build_object('count',coalesce((current_row.value->>'count')::int,0)+(p_value->>'delta')::int,'target',coalesce((p_value->>'target')::int,1));
 else v=p_value; end if;
 next_version=current_row.version+1;
 update public.yixu_records set value=v,version=next_version where owner_id=u and key=p_key;
 insert into public.yixu_changes(owner_id,key,value,version,kind) values(u,p_key,v,next_version,p_kind);
 result=jsonb_build_object('conflict',false,'row',jsonb_build_object('key',p_key,'value',v,'version',next_version,'kind',p_kind));
 insert into public.yixu_ops(owner_id,id,result) values(u,p_op,result);
 return result;
end;$$;
revoke all on function yixu_private.apply_change(uuid,text,bigint,text,jsonb) from public,anon;
grant execute on function yixu_private.apply_change(uuid,text,bigint,text,jsonb) to authenticated;
create or replace function public.yixu_apply(p_op uuid,p_key text,p_base bigint,p_kind text,p_value jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select yixu_private.apply_change(p_op,p_key,p_base,p_kind,p_value);
$$;
revoke all on function public.yixu_apply(uuid,text,bigint,text,jsonb) from public,anon;
grant execute on function public.yixu_apply(uuid,text,bigint,text,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('yixu-attachments','yixu-attachments',false,15728640,array['image/png','image/jpeg','image/webp','image/gif']) on conflict(id) do update set public=false;
drop policy if exists yixu_attachment_read on storage.objects;
create policy yixu_attachment_read on storage.objects for select to authenticated using(bucket_id='yixu-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists yixu_attachment_insert on storage.objects;
create policy yixu_attachment_insert on storage.objects for insert to authenticated with check(bucket_id='yixu-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
