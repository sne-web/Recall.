-- Recall. database schema (Supabase / Postgres).
-- Run in the Supabase SQL editor on a fresh project.
-- Users themselves live in Supabase Auth (auth.users); this file only defines app data.

create table if not exists public.meetings (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users (id) on delete cascade,
    filename         text not null,
    upload_date      timestamptz not null default now(),
    status           text not null default 'uploaded' check (status in ('uploaded', 'processed')),
    word_count       integer not null default 0,
    speakers         jsonb not null default '[]'::jsonb,
    transcript_text  text not null,
    -- {"decisions": [...], "action_items": [...], "sentiment": {...}} written by /api/analysis
    analysis_results jsonb
);

create index if not exists meetings_user_id_upload_date_idx
    on public.meetings (user_id, upload_date desc);

-- Row-Level Security: the backend forwards each user's JWT to Postgres, so these
-- policies are what actually isolate one user's meetings from another's.
alter table public.meetings enable row level security;

create policy "Users can read their own meetings"
    on public.meetings for select using (auth.uid() = user_id);

create policy "Users can insert their own meetings"
    on public.meetings for insert with check (auth.uid() = user_id);

create policy "Users can update their own meetings"
    on public.meetings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own meetings"
    on public.meetings for delete using (auth.uid() = user_id);
