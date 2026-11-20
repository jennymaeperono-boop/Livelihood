-- Livelihood Hub starter schema. Run in the Supabase SQL Editor.
create type public.app_role as enum (
  'admin', 'section_leader', 'stock_requisition', 'gatepass_verifier', 'guard'
);
create type public.workflow_status as enum ('pending', 'approved', 'rejected', 'fulfilled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null,
  section text,
  created_at timestamptz not null default now()
);
create table public.items (
  id bigint generated always as identity primary key,
  name text not null,
  unit text not null default 'pcs',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now()
);
create table public.stock_requests (
  id bigint generated always as identity primary key,
  requested_by uuid not null references public.profiles(id),
  section text,
  status public.workflow_status not null default 'pending',
  stock_note text,
  created_at timestamptz not null default now()
);
create table public.stock_request_items (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.stock_requests(id) on delete cascade,
  item_id bigint not null references public.items(id),
  quantity integer not null check (quantity > 0)
);
create table public.gatepasses (
  id bigint generated always as identity primary key,
  created_by uuid not null references public.profiles(id),
  section text,
  purpose text,
  status public.workflow_status not null default 'pending',
  verifier_id uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.gatepass_items (
  id bigint generated always as identity primary key,
  gatepass_id bigint not null references public.gatepasses(id) on delete cascade,
  item_id bigint not null references public.items(id),
  quantity integer not null check (quantity > 0)
);

create schema if not exists private;
create or replace function private.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = required_role
  );
$$;
revoke all on function private.has_role(public.app_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.stock_requests enable row level security;
alter table public.stock_request_items enable row level security;
alter table public.gatepasses enable row level security;
alter table public.gatepass_items enable row level security;

create policy "Read own profile or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.has_role('admin'));
create policy "Authenticated read items" on public.items for select to authenticated using (true);
create policy "Admin manages items" on public.items for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy "Read requests by owner stock or admin" on public.stock_requests for select to authenticated
  using (requested_by = (select auth.uid()) or private.has_role('stock_requisition') or private.has_role('admin'));
create policy "Leader creates own requests" on public.stock_requests for insert to authenticated
  with check (requested_by = (select auth.uid()) and private.has_role('section_leader'));
create policy "Stock or admin updates requests" on public.stock_requests for update to authenticated
  using (private.has_role('stock_requisition') or private.has_role('admin'))
  with check (private.has_role('stock_requisition') or private.has_role('admin'));
create policy "Read request item lines" on public.stock_request_items for select to authenticated
  using (exists (select 1 from public.stock_requests r where r.id = request_id and
    (r.requested_by = (select auth.uid()) or private.has_role('stock_requisition') or private.has_role('admin'))));
create policy "Leader adds lines to own request" on public.stock_request_items for insert to authenticated
  with check (private.has_role('section_leader') and exists (
    select 1 from public.stock_requests r where r.id = request_id and r.requested_by = (select auth.uid())
  ));

create policy "Gatepass visibility by role" on public.gatepasses for select to authenticated
  using (created_by = (select auth.uid()) or private.has_role('gatepass_verifier') or private.has_role('admin')
    or (private.has_role('guard') and status = 'approved'));
create policy "Leader creates own gatepass" on public.gatepasses for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_role('section_leader'));
create policy "Verifier or admin updates gatepass" on public.gatepasses for update to authenticated
  using (private.has_role('gatepass_verifier') or private.has_role('admin'))
  with check (private.has_role('gatepass_verifier') or private.has_role('admin'));
create policy "Gatepass item visibility by parent" on public.gatepass_items for select to authenticated
  using (exists (select 1 from public.gatepasses g where g.id = gatepass_id and
    (g.created_by = (select auth.uid()) or private.has_role('gatepass_verifier') or private.has_role('admin')
      or (private.has_role('guard') and g.status = 'approved'))));
create policy "Leader adds lines to own gatepass" on public.gatepass_items for insert to authenticated
  with check (private.has_role('section_leader') and exists (
    select 1 from public.gatepasses g where g.id = gatepass_id and g.created_by = (select auth.uid())
  ));

-- Example seed inventory (optional)
-- insert into public.items (name, unit, stock_quantity) values
-- ('Cotton thread', 'rolls', 24), ('Packaging box', 'pcs', 80);

-- After creating the first user in Authentication > Users, insert their profile:
-- insert into public.profiles (id, full_name, role, section)
-- values ('AUTH_USER_UUID', 'Admin Name', 'admin', null);
