create or replace function public.save_forja_state(
  p_state jsonb,
  p_schema_version integer,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'forja_unauthorized';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception using errcode = '22023', message = 'forja_state_must_be_object';
  end if;

  if p_schema_version is null or p_schema_version <= 0 then
    raise exception using errcode = '22023', message = 'forja_schema_version_invalid';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'forja_expected_revision_invalid';
  end if;

  if p_expected_revision = 0 then
    insert into public.forja_states (user_id, state, schema_version, revision)
    values (v_user_id, p_state, p_schema_version, 1)
    on conflict (user_id) do nothing
    returning revision into v_revision;

    if v_revision is not null then
      return v_revision;
    end if;
  end if;

  update public.forja_states
  set state = p_state,
      schema_version = p_schema_version,
      revision = revision + 1
  where user_id = v_user_id
    and revision = p_expected_revision
  returning revision into v_revision;

  if v_revision is null then
    raise exception using errcode = '40001', message = 'forja_conflict';
  end if;

  return v_revision;
end;
$$;

revoke execute on function public.save_forja_state(jsonb, integer, bigint) from anon;
revoke execute on function public.save_forja_state(jsonb, integer, bigint) from public;
grant execute on function public.save_forja_state(jsonb, integer, bigint) to authenticated;
