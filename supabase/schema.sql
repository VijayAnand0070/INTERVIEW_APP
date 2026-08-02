-- Pucca Interview App Supabase schema
-- Run this in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  job_role text not null,
  job_description text not null,
  parsed_json jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ats_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  score numeric(5,2) not null default 0,
  matched_skills text[] not null default '{}',
  missing_skills text[] not null default '{}',
  suggestions text[] not null default '{}',
  strengths text[] not null default '{}',
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  ats_score_id uuid references public.ats_scores(id) on delete set null,
  job_role text not null,
  questions_json jsonb not null default '[]'::jsonb,
  current_question_index integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'evaluating', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_index integer not null,
  question_text text not null,
  audio_path text,
  transcription text not null default '',
  evaluation_json jsonb not null default '{}'::jsonb,
  score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(session_id, question_index)
);

create table if not exists public.final_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall_score numeric(5,2) not null default 0,
  technical_score numeric(5,2) not null default 0,
  communication_score numeric(5,2) not null default 0,
  confidence_score numeric(5,2) not null default 0,
  resume_relevance_score numeric(5,2) not null default 0,
  strengths text[] not null default '{}',
  weak_areas text[] not null default '{}',
  improvements text[] not null default '{}',
  roadmap jsonb not null default '[]'::jsonb,
  report_json jsonb not null default '{}'::jsonb,
  report_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_resumes_user_id on public.resumes(user_id);
create index if not exists idx_ats_scores_resume_id on public.ats_scores(resume_id);
create index if not exists idx_interview_sessions_user_id on public.interview_sessions(user_id);
create index if not exists idx_interview_answers_session_id on public.interview_answers(session_id);
create index if not exists idx_final_reports_user_id on public.final_reports(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists handle_resumes_updated_at on public.resumes;
create trigger handle_resumes_updated_at before update on public.resumes
for each row execute procedure public.set_updated_at();

drop trigger if exists handle_interview_sessions_updated_at on public.interview_sessions;
create trigger handle_interview_sessions_updated_at before update on public.interview_sessions
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.ats_scores enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.final_reports enable row level security;

create policy "Users can read their profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update their profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read their resumes"
on public.resumes for select
using (auth.uid() = user_id);

create policy "Users can insert their resumes"
on public.resumes for insert
with check (auth.uid() = user_id);

create policy "Users can delete their resumes"
on public.resumes for delete
using (auth.uid() = user_id);

create policy "Users can read their ats scores"
on public.ats_scores for select
using (auth.uid() = user_id);

create policy "Users can insert their ats scores"
on public.ats_scores for insert
with check (auth.uid() = user_id);

create policy "Users can read their interview sessions"
on public.interview_sessions for select
using (auth.uid() = user_id);

create policy "Users can insert their interview sessions"
on public.interview_sessions for insert
with check (auth.uid() = user_id);

create policy "Users can update their interview sessions"
on public.interview_sessions for update
using (auth.uid() = user_id);

create policy "Users can read their interview answers"
on public.interview_answers for select
using (auth.uid() = user_id);

create policy "Users can insert their interview answers"
on public.interview_answers for insert
with check (auth.uid() = user_id);

create policy "Users can read their final reports"
on public.final_reports for select
using (auth.uid() = user_id);

create policy "Users can insert their final reports"
on public.final_reports for insert
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resumes', 'resumes', false, 10485760, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('user-audio', 'user-audio', false, 52428800, array['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg']),
  ('tts-audio', 'tts-audio', false, 52428800, array['audio/wav', 'audio/mpeg']),
  ('reports', 'reports', false, 10485760, array['application/pdf', 'application/json'])
on conflict (id) do nothing;

create policy "Users can read own resume files"
on storage.objects for select
using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload own resume files"
on storage.objects for insert
with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own audio files"
on storage.objects for select
using (bucket_id = 'user-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload own audio files"
on storage.objects for insert
with check (bucket_id = 'user-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own tts files"
on storage.objects for select
using (bucket_id = 'tts-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own reports"
on storage.objects for select
using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload own reports"
on storage.objects for insert
with check (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);
