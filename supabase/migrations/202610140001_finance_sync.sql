-- Apply once in Supabase SQL Editor, or with Supabase CLI migrations.
begin;
create table public.finance_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null check (revision > 0),
  operation_id uuid not null,
  updated_at timestamptz not null default now(),
  constraint finance_document_shape check ((
    jsonb_typeof(payload) = 'object' and payload->>'schemaVersion' = '1'
    and jsonb_typeof(payload->'plans') = 'object'
    and jsonb_typeof(payload->'transactions') = 'array'
    and jsonb_typeof(payload->'budgets') = 'object'
    and jsonb_typeof(payload->'snapshots') = 'object'
    and jsonb_typeof(payload->'goals') = 'array'
    and jsonb_typeof(payload->'checklist') = 'array'
    and octet_length(payload::text) <= 5000000
  ) is true)
);
alter table public.finance_documents enable row level security;
revoke all on public.finance_documents from anon, authenticated;
grant select, insert, update on public.finance_documents to authenticated;
create policy "read own finance" on public.finance_documents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own finance" on public.finance_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own finance" on public.finance_documents for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_finance_document(p_payload jsonb, p_revision bigint, p_operation_id uuid, p_account_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  saved public.finance_documents%rowtype;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_account_id is distinct from account_id then raise exception 'Account changed' using errcode = '28000'; end if;
  if p_revision is null or p_revision < 0 or p_operation_id is null then raise exception 'Invalid revision'; end if;
  select * into saved from public.finance_documents where user_id = account_id;
  if saved.operation_id = p_operation_id then
    return jsonb_build_object('ok',true,'revision',saved.revision,'operationId',saved.operation_id);
  end if;
  if p_revision = 0 then
    insert into public.finance_documents(user_id,payload,revision,operation_id)
    values(account_id,p_payload,1,p_operation_id)
    on conflict(user_id) do nothing returning * into saved;
  else
    update public.finance_documents set payload=p_payload,revision=revision+1,operation_id=p_operation_id,updated_at=now()
    where user_id=account_id and revision=p_revision returning * into saved;
  end if;
  if found then return jsonb_build_object('ok',true,'revision',saved.revision,'operationId',saved.operation_id); end if;
  select * into saved from public.finance_documents where user_id=account_id;
  -- A concurrent retry of the same request is also idempotent.
  if saved.operation_id=p_operation_id then return jsonb_build_object('ok',true,'revision',saved.revision,'operationId',saved.operation_id); end if;
  return jsonb_build_object('ok',false,'remote',jsonb_build_object(
    'revision',coalesce(saved.revision,0),'data',saved.payload,'operationId',saved.operation_id,'updatedAt',saved.updated_at));
end;
$$;
revoke all on function public.save_finance_document(jsonb,bigint,uuid,uuid) from public, anon;
grant execute on function public.save_finance_document(jsonb,bigint,uuid,uuid) to authenticated;
commit;
