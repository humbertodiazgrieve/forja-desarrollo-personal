begin;

select plan(9);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.forja_states'::regclass),
  'RLS is enabled on public.forja_states'
);

select ok(
  not has_table_privilege('anon', 'public.forja_states', 'select'),
  'anon has no select privilege'
);

select ok(
  not has_table_privilege('anon', 'public.forja_states', 'insert'),
  'anon has no insert privilege'
);

select ok(
  has_table_privilege('authenticated', 'public.forja_states', 'select'),
  'authenticated has select privilege for policy evaluation'
);

select is(
  (select count(*)::integer
   from pg_policies
   where schemaname = 'public'
     and tablename = 'forja_states'
     and roles = array['authenticated']::name[]),
  4,
  'four authenticated-only policies exist'
);

select ok(
  (select qual like '%auth.uid()%' from pg_policies
   where schemaname = 'public'
     and tablename = 'forja_states'
     and policyname = 'forja_states_select_own'),
  'select policy is scoped to auth.uid()'
);

select ok(
  (select with_check like '%auth.uid()%' from pg_policies
   where schemaname = 'public'
     and tablename = 'forja_states'
     and policyname = 'forja_states_insert_own'),
  'insert policy is scoped to auth.uid()'
);

set local role anon;
select throws_ok(
  $$select * from public.forja_states$$,
  '42501',
  null,
  'anon cannot read forja_states'
);
reset role;

set local role authenticated;
select is(
  (select count(*)::integer from public.forja_states),
  0,
  'authenticated without a JWT identity sees no rows'
);
reset role;

select * from finish();
rollback;
