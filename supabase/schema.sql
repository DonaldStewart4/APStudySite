-- Road to 5 · Supabase schema
-- Run this once in Supabase → SQL Editor, then set supabaseUrl and
-- supabaseAnonKey in js/config.js. Accounts turn on automatically.
--
-- Each student gets one learning-profile row and one row per course they've
-- started. The app stores flexible JSON so new fields don't need migrations.

create table if not exists public.learning_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.course_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- Row-level security: students can only see and change their own rows.
alter table public.learning_profiles enable row level security;
alter table public.course_progress  enable row level security;

create policy "own profile: select" on public.learning_profiles
  for select using (auth.uid() = user_id);
create policy "own profile: insert" on public.learning_profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile: update" on public.learning_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own progress: select" on public.course_progress
  for select using (auth.uid() = user_id);
create policy "own progress: insert" on public.course_progress
  for insert with check (auth.uid() = user_id);
create policy "own progress: update" on public.course_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own progress: delete" on public.course_progress
  for delete using (auth.uid() = user_id);
