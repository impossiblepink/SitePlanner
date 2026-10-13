-- Run this in the Supabase SQL Editor after creating your owner account.
-- Public visitors can read the shared plan. Only the user recorded as owner_id
-- can create or update it.

create table if not exists public.shared_plans (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_plans enable row level security;

drop policy if exists "Shared plans are publicly readable" on public.shared_plans;
create policy "Shared plans are publicly readable"
  on public.shared_plans for select
  using (true);

drop policy if exists "Owner can create the shared plan" on public.shared_plans;
create policy "Owner can create the shared plan"
  on public.shared_plans for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owner can update the shared plan" on public.shared_plans;
create policy "Owner can update the shared plan"
  on public.shared_plans for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
