begin;

select plan(15);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_forja_state'
      and pg_get_function_identity_arguments(p.oid) = 'jsonb, integer, bigint'
  ),
  'save_forja_state has the expected signature'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_forja_state(jsonb, integer, bigint)',
    'execute'
  ),
  'anon cannot execute save_forja_state'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_forja_state(jsonb, integer, bigint)',
    'execute'
  ),
  'authenticated can execute save_forja_state'
);

set local role anon;
select throws_ok(
  $$select public.save_forja_state('{}'::jsonb, 1, 0)$$,
  '42501',
  null,
  'anon is rejected'
);
reset role;

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000041', 'authenticated', 'authenticated', 'forja-rpc-a@example.test'),
  ('00000000-0000-0000-0000-000000000042', 'authenticated', 'authenticated', 'forja-rpc-b@example.test')
on conflict (id) do nothing;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000041', 'role', 'authenticated')::text,
  true
);

select is(
  public.save_forja_state('{"owner":"a"}'::jsonb, 1, 0),
  1::bigint,
  'first save creates revision 1'
);

select is(
  public.save_forja_state('{"owner":"a-updated"}'::jsonb, 1, 1),
  2::bigint,
  'matching revision updates atomically'
);

select throws_ok(
  $$select public.save_forja_state('{"owner":"stale"}'::jsonb, 1, 1)$$,
  '40001',
  'forja_conflict',
  'stale revision returns the stable conflict'
);

select is(
  (select state->>'owner'
   from public.forja_states
   where user_id = '00000000-0000-0000-0000-000000000041'),
  'a-updated',
  'conflict leaves the owner state unchanged'
);

select throws_ok(
  $$select public.save_forja_state('[]'::jsonb, 1, 2)$$,
  '22023',
  'forja_state_must_be_object',
  'non-object state is rejected'
);

select throws_ok(
  $$select public.save_forja_state('{}'::jsonb, 0, 2)$$,
  '22023',
  'forja_schema_version_invalid',
  'invalid schema version is rejected'
);

select throws_ok(
  $$select public.save_forja_state('{}'::jsonb, 1, -1)$$,
  '22023',
  'forja_expected_revision_invalid',
  'negative expected revision is rejected'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000042', 'role', 'authenticated')::text,
  true
);

select throws_ok(
  $$select public.save_forja_state('{"owner":"cross-user"}'::jsonb, 1, 2)$$,
  '40001',
  'forja_conflict',
  'a user cannot update another user revision'
);

select is(
  public.save_forja_state('{"owner":"b"}'::jsonb, 1, 0),
  1::bigint,
  'another user gets an independent initial revision'
);

select is(
  (select count(*)::integer
   from public.forja_states
   where user_id = '00000000-0000-0000-0000-000000000041'),
  0,
  'RLS hides the other user row'
);

select is(
  (select state->>'owner'
   from public.forja_states
   where user_id = '00000000-0000-0000-0000-000000000042'),
  'b',
  'the authenticated user sees its own row'
);

reset role;
select * from finish();
rollback;
