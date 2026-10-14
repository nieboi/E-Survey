create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household jsonb not null default '{}'::jsonb
    check (jsonb_typeof(household) = 'object'),
  members jsonb not null default '[]'::jsonb
    check (jsonb_typeof(members) = 'array'),
  assets jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assets) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveys_user_updated_idx
  on public.surveys (user_id, updated_at desc);

alter table public.surveys enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.surveys to authenticated;

drop policy if exists "Users can read their own surveys" on public.surveys;
create policy "Users can read their own surveys"
  on public.surveys for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own surveys" on public.surveys;
create policy "Users can create their own surveys"
  on public.surveys for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own surveys" on public.surveys;
create policy "Users can update their own surveys"
  on public.surveys for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own surveys" on public.surveys;
create policy "Users can delete their own surveys"
  on public.surveys for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_survey_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_survey_updated_at on public.surveys;
create trigger set_survey_updated_at
  before update on public.surveys
  for each row execute function public.set_survey_updated_at();
