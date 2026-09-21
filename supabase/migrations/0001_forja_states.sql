create table public.forja_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  schema_version integer not null default 1,
  revision bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint forja_states_state_is_object check (jsonb_typeof(state) = 'object'),
  constraint forja_states_schema_version_positive check (schema_version > 0),
  constraint forja_states_revision_nonnegative check (revision >= 0)
);

create or replace function public.set_forja_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_forja_states_updated_at on public.forja_states;
create trigger set_forja_states_updated_at
before update on public.forja_states
for each row execute function public.set_forja_states_updated_at();

alter table public.forja_states enable row level security;

revoke all on table public.forja_states from anon;
revoke all on table public.forja_states from public;
grant select, insert, update, delete on table public.forja_states to authenticated;

create policy "forja_states_select_own"
on public.forja_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "forja_states_insert_own"
on public.forja_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "forja_states_update_own"
on public.forja_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "forja_states_delete_own"
on public.forja_states
for delete
to authenticated
using ((select auth.uid()) = user_id);
