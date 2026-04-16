-- Scott Gordon Fitness — Supabase Schema
-- Run this in your Supabase SQL editor

-- ── WAITLIST ──────────────────────────────────────────────
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz default now()
);

-- ── COACHING APPLICATIONS (FUNNEL QUIZ) ─────────────────
create table if not exists coaching_applications (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  first_name            text,
  goal                  text not null,
  timeline              text not null,
  training_days         text not null,
  support_level         text not null,
  primary_obstacle      text not null,
  coaching_history      text not null,
  budget_band           text not null,
  readiness             text not null,
  recommended_tier      text not null,
  source                text default 'apply_quiz',
  created_at            timestamptz default now()
);

create table if not exists marketing_email_queue (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  first_name            text,
  template_key          text not null,
  source                text not null default 'launch_funnel',
  send_after            timestamptz not null,
  status                text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts              int not null default 0,
  provider_message_id   text,
  last_error            text,
  sent_at               timestamptz,
  created_at            timestamptz default now()
);

-- ── CLIENTS ───────────────────────────────────────────────
create table if not exists clients (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text,
  phone           text,
  designated_coach_id uuid references clients(id) on delete set null,
  stripe_customer_id text unique,
  created_at      timestamptz default now()
);

-- ── ROLE MIGRATION (run after initial schema) ─────────────
alter table clients add column if not exists role text default 'client'
  check (role in ('client', 'coach'));

alter table clients add column if not exists designated_coach_id uuid references clients(id) on delete set null;

-- ── PACKAGES ──────────────────────────────────────────────
create table if not exists client_packages (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients(id) on delete cascade,
  package_name      text not null,           -- e.g. 'Momentum Pack'
  sessions_total    int not null,
  sessions_remaining int not null,
  stripe_payment_id text,
  purchased_at      timestamptz default now(),
  expires_at        timestamptz              -- optional expiry
);

-- ── SESSIONS ──────────────────────────────────────────────
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete cascade,
  package_id      uuid references client_packages(id),
  scheduled_at    timestamptz not null,
  duration_mins   int default 60,
  status          text default 'scheduled'  -- scheduled | completed | cancelled | no_show
    check (status in ('scheduled','completed','cancelled','no_show')),
  notes           text,                     -- coach notes post-session
  created_at      timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
alter table waitlist enable row level security;
alter table coaching_applications enable row level security;
alter table marketing_email_queue enable row level security;
alter table clients enable row level security;
alter table client_packages enable row level security;
alter table sessions enable row level security;

-- Waitlist: anyone can insert, only service role can read
drop policy if exists "Public can join waitlist" on waitlist;
create policy "Public can join waitlist" on waitlist
  for insert with check (true);

-- Coaching applications: anyone can submit, only service role reads
drop policy if exists "Public can submit coaching application" on coaching_applications;
create policy "Public can submit coaching application" on coaching_applications
  for insert with check (true);

-- Clients: users can only read/update their own record
drop policy if exists "Client reads own record" on clients;
create policy "Client reads own record" on clients
  for select using (auth.uid() = id);
drop policy if exists "Client updates own record" on clients;
create policy "Client updates own record" on clients
  for update using (auth.uid() = id);

-- Packages: clients see only their own
drop policy if exists "Client sees own packages" on client_packages;
create policy "Client sees own packages" on client_packages
  for select using (auth.uid() = client_id);

-- Sessions: clients see only their own
drop policy if exists "Client sees own sessions" on sessions;
create policy "Client sees own sessions" on sessions
  for select using (auth.uid() = client_id);

-- ── INDEXES ───────────────────────────────────────────────
create index if not exists sessions_client_id_idx on sessions(client_id);
create index if not exists sessions_scheduled_at_idx on sessions(scheduled_at);
create unique index if not exists sessions_unique_scheduled_slot_idx
  on sessions(scheduled_at)
  where status = 'scheduled';
create index if not exists packages_client_id_idx on client_packages(client_id);
create index if not exists coaching_applications_email_idx on coaching_applications(email);
create index if not exists coaching_applications_created_at_idx on coaching_applications(created_at);
create index if not exists marketing_email_queue_dispatch_idx on marketing_email_queue(status, send_after);
create unique index if not exists marketing_email_queue_unique_template_idx on marketing_email_queue(email, template_key);

-- ── COACH POLICIES ────────────────────────────────────────
-- Coach can read assigned clients
drop policy if exists "Coach reads all clients" on clients;
drop policy if exists "Coach reads assigned clients" on clients;
create policy "Coach reads assigned clients" on clients
  for select using (
    (
      id = auth.uid()
      and exists (select 1 from clients c where c.id = auth.uid() and c.role = 'coach')
    )
    or (
      designated_coach_id = auth.uid()
      and exists (select 1 from clients c where c.id = auth.uid() and c.role = 'coach')
    )
  );

-- Coach can read assigned client packages
drop policy if exists "Coach reads all packages" on client_packages;
drop policy if exists "Coach reads assigned packages" on client_packages;
create policy "Coach reads assigned packages" on client_packages
  for select using (
    exists (
      select 1
      from clients c
      join clients cl on cl.id = client_packages.client_id
      where c.id = auth.uid()
        and c.role = 'coach'
        and cl.designated_coach_id = auth.uid()
    )
  );

-- Coach can read and update assigned client sessions
drop policy if exists "Coach reads all sessions" on sessions;
drop policy if exists "Coach reads assigned sessions" on sessions;
create policy "Coach reads assigned sessions" on sessions
  for select using (
    exists (
      select 1
      from clients c
      join clients cl on cl.id = sessions.client_id
      where c.id = auth.uid()
        and c.role = 'coach'
        and cl.designated_coach_id = auth.uid()
    )
  );
drop policy if exists "Coach updates sessions" on sessions;
drop policy if exists "Coach updates assigned sessions" on sessions;
create policy "Coach updates assigned sessions" on sessions
  for update using (
    exists (
      select 1
      from clients c
      join clients cl on cl.id = sessions.client_id
      where c.id = auth.uid()
        and c.role = 'coach'
        and cl.designated_coach_id = auth.uid()
    )
  );

-- ── FITNESS PROFILES / WORKOUT TRACKER ───────────────────
create table if not exists fitness_profiles (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  preferred_units          text default 'metric' check (preferred_units in ('metric', 'imperial')),
  age                      int,
  sex                      text check (sex in ('male', 'female', 'other')),
  height_cm                numeric(5,2),
  weight_kg                numeric(5,2),
  waist_cm                 numeric(5,2),
  neck_cm                  numeric(5,2),
  hip_cm                   numeric(5,2),
  activity_level           text,
  training_days_per_week   int,
  fitness_goal             text,
  target_weight_kg         numeric(5,2),
  target_bodyfat_percent   numeric(5,2),
  injuries_limitations     text,
  experience_level         text,
  workout_location         text,
  equipment_access         text[] default array['bodyweight']::text[],
  before_photo_url         text,
  onboarding_completed_at  timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create table if not exists client_intake_forms (
  user_id                        uuid primary key references auth.users(id) on delete cascade,
  parq_answers                   jsonb not null,
  parq_any_yes                   boolean default false,
  medical_conditions             text,
  medications                    text,
  surgeries_or_injuries          text,
  allergies                      text,
  emergency_contact_name         text not null,
  emergency_contact_phone        text not null,
  primary_physician_name         text,
  primary_physician_phone        text,
  consent_liability_waiver       boolean not null default false,
  consent_informed_consent       boolean not null default false,
  consent_privacy_practices      boolean not null default false,
  consent_coaching_agreement     boolean not null default false,
  consent_emergency_care         boolean not null default false,
  consent_signature_name         text not null,
  consent_signed_at              timestamptz not null default now(),
  created_at                     timestamptz default now(),
  updated_at                     timestamptz default now()
);

create table if not exists coach_client_messages (
  id                             uuid primary key default gen_random_uuid(),
  client_id                      uuid not null references clients(id) on delete cascade,
  coach_id                       uuid not null references clients(id) on delete cascade,
  sender_id                      uuid not null references clients(id) on delete cascade,
  message_body                   text not null,
  read_at                        timestamptz,
  created_at                     timestamptz default now()
);

alter table fitness_profiles
  add column if not exists preferred_units text default 'metric'
  check (preferred_units in ('metric', 'imperial'));

alter table fitness_profiles
  add column if not exists before_photo_url text;

alter table fitness_profiles
  add column if not exists before_photo_path text;

alter table fitness_profiles
  add column if not exists workout_location text;

alter table fitness_profiles
  add column if not exists equipment_access text[] default array['bodyweight']::text[];

create table if not exists workout_plans (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade,
  name                      text not null,
  goal                      text,
  nasm_opt_phase            int not null check (nasm_opt_phase between 1 and 5),
  phase_name                text not null,
  sessions_per_week         int not null,
  estimated_duration_mins   int not null,
  plan_json                 jsonb not null,
  created_at                timestamptz default now()
);

create table if not exists workout_program_templates (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text unique,
  source                    text not null default 'licensed_import',
  title                     text not null,
  goal                      text,
  nasm_opt_phase            int check (nasm_opt_phase between 1 and 5),
  phase_name                text,
  sessions_per_week         int,
  estimated_duration_mins   int,
  template_json             jsonb not null default '{}'::jsonb,
  is_active                 boolean not null default true,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create table if not exists exercise_library_entries (
  id                        uuid primary key default gen_random_uuid(),
  source                    text not null default 'licensed_import',
  source_id                 text,
  slug                      text,
  name                      text not null,
  description               text,
  coaching_cues             text[] default array[]::text[],
  primary_equipment         text[] default array[]::text[],
  media_image_url           text,
  media_video_url           text,
  metadata_json             jsonb not null default '{}'::jsonb,
  is_active                 boolean not null default true,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create unique index if not exists exercise_library_entries_source_id_idx
  on exercise_library_entries(source, source_id)
  where source_id is not null;

create table if not exists equipment_library_entries (
  id                        uuid primary key default gen_random_uuid(),
  source                    text not null default 'licensed_import',
  source_id                 text,
  slug                      text,
  name                      text not null,
  description               text,
  media_image_url           text,
  metadata_json             jsonb not null default '{}'::jsonb,
  is_active                 boolean not null default true,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create unique index if not exists equipment_library_entries_source_id_idx
  on equipment_library_entries(source, source_id)
  where source_id is not null;

do $$
begin
  -- Legacy typo migration for older databases:
  -- if only nams_opt_phase exists, rename it;
  -- if both exist, keep nasm_opt_phase and remove the typo column after backfill.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_plans'
      and column_name = 'nams_opt_phase'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_plans'
      and column_name = 'nasm_opt_phase'
  ) then
    execute 'alter table public.workout_plans rename column nams_opt_phase to nasm_opt_phase';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_plans'
      and column_name = 'nams_opt_phase'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_plans'
      and column_name = 'nasm_opt_phase'
  ) then
    execute 'update public.workout_plans set nasm_opt_phase = coalesce(nasm_opt_phase, nams_opt_phase)';
    execute 'alter table public.workout_plans drop column nams_opt_phase';
  end if;
end $$;

create table if not exists workout_logs (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade,
  workout_plan_id           uuid references workout_plans(id) on delete set null,
  session_date              date not null,
  session_title             text not null,
  completed                 boolean default false,
  exertion_rpe              int check (exertion_rpe between 1 and 10),
  notes                     text,
  created_at                timestamptz default now()
);

create table if not exists workout_set_logs (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade,
  workout_log_id            uuid references workout_logs(id) on delete set null,
  workout_plan_id           uuid references workout_plans(id) on delete set null,
  session_date              date not null,
  exercise_name             text not null,
  set_number                int,
  reps                      int not null,
  weight_kg                 numeric(7,2),
  rest_seconds              int,
  rpe                       numeric(3,1),
  rir                       numeric(3,1),
  tempo                     text,
  is_warmup                 boolean default false,
  notes                     text,
  created_at                timestamptz default now()
);

create table if not exists body_composition_analyses (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade,
  photo_data_url            text,
  estimated_bodyfat_percent numeric(5,2),
  method                    text,
  confidence_score          numeric(5,2),
  created_at                timestamptz default now()
);

alter table fitness_profiles enable row level security;
alter table client_intake_forms enable row level security;
alter table coach_client_messages enable row level security;
alter table workout_plans enable row level security;
alter table workout_logs enable row level security;
alter table workout_set_logs enable row level security;
alter table body_composition_analyses enable row level security;
alter table workout_program_templates enable row level security;
alter table exercise_library_entries enable row level security;
alter table equipment_library_entries enable row level security;

drop policy if exists "User reads own fitness profile" on fitness_profiles;
create policy "User reads own fitness profile" on fitness_profiles
  for select using (auth.uid() = user_id);
drop policy if exists "User writes own fitness profile" on fitness_profiles;
create policy "User writes own fitness profile" on fitness_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "User reads own intake form" on client_intake_forms;
create policy "User reads own intake form" on client_intake_forms
  for select using (auth.uid() = user_id);
drop policy if exists "User writes own intake form" on client_intake_forms;
create policy "User writes own intake form" on client_intake_forms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Client reads own messages" on coach_client_messages;
create policy "Client reads own messages" on coach_client_messages
  for select using (auth.uid() = client_id);

drop policy if exists "Coach reads designated messages" on coach_client_messages;
create policy "Coach reads designated messages" on coach_client_messages
  for select using (
    auth.uid() = coach_id
    and exists (
      select 1
      from clients c
      where c.id = coach_client_messages.client_id
        and c.designated_coach_id = auth.uid()
    )
  );

drop policy if exists "Client sends message to designated coach" on coach_client_messages;
create policy "Client sends message to designated coach" on coach_client_messages
  for insert with check (
    auth.uid() = client_id
    and auth.uid() = sender_id
    and exists (
      select 1
      from clients c
      where c.id = coach_client_messages.client_id
        and c.designated_coach_id = coach_client_messages.coach_id
    )
  );

drop policy if exists "Coach sends message to assigned client" on coach_client_messages;
create policy "Coach sends message to assigned client" on coach_client_messages
  for insert with check (
    auth.uid() = coach_id
    and auth.uid() = sender_id
    and exists (
      select 1
      from clients c
      where c.id = coach_client_messages.client_id
        and c.designated_coach_id = auth.uid()
    )
  );

drop policy if exists "User reads own workout plans" on workout_plans;
create policy "User reads own workout plans" on workout_plans
  for select using (auth.uid() = user_id);
drop policy if exists "User writes own workout plans" on workout_plans;
create policy "User writes own workout plans" on workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "User reads own workout logs" on workout_logs;
create policy "User reads own workout logs" on workout_logs
  for select using (auth.uid() = user_id);
drop policy if exists "User writes own workout logs" on workout_logs;
create policy "User writes own workout logs" on workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "User reads own workout set logs" on workout_set_logs;
create policy "User reads own workout set logs" on workout_set_logs
  for select using (auth.uid() = user_id);
drop policy if exists "User writes own workout set logs" on workout_set_logs;
create policy "User writes own workout set logs" on workout_set_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "User reads own body composition analyses" on body_composition_analyses;
create policy "User reads own body composition analyses" on body_composition_analyses
  for select using (auth.uid() = user_id);
drop policy if exists "User writes own body composition analyses" on body_composition_analyses;
create policy "User writes own body composition analyses" on body_composition_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated reads workout program templates" on workout_program_templates;
create policy "Authenticated reads workout program templates" on workout_program_templates
  for select to authenticated using (is_active = true);

drop policy if exists "Authenticated reads exercise library" on exercise_library_entries;
create policy "Authenticated reads exercise library" on exercise_library_entries
  for select to authenticated using (is_active = true);

drop policy if exists "Authenticated reads equipment library" on equipment_library_entries;
create policy "Authenticated reads equipment library" on equipment_library_entries
  for select to authenticated using (is_active = true);

create index if not exists fitness_profiles_updated_at_idx on fitness_profiles(updated_at desc);
create index if not exists client_intake_forms_signed_at_idx on client_intake_forms(user_id, consent_signed_at desc);
create index if not exists clients_designated_coach_idx on clients(designated_coach_id);
create index if not exists coach_client_messages_thread_idx on coach_client_messages(client_id, coach_id, created_at desc);
create index if not exists workout_plans_user_id_idx on workout_plans(user_id, created_at desc);
create index if not exists workout_logs_user_id_idx on workout_logs(user_id, session_date desc);
create index if not exists workout_set_logs_user_id_idx on workout_set_logs(user_id, session_date desc);
create index if not exists workout_set_logs_exercise_idx on workout_set_logs(user_id, exercise_name, session_date desc);
create index if not exists body_composition_user_id_idx on body_composition_analyses(user_id, created_at desc);
create index if not exists workout_program_templates_active_idx on workout_program_templates(is_active, created_at desc);
create index if not exists exercise_library_entries_name_idx on exercise_library_entries(name);
create index if not exists equipment_library_entries_name_idx on equipment_library_entries(name);

-- ── STORAGE: BEFORE PHOTOS ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fitness-photos',
  'fitness-photos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'fitness-photos';

drop policy if exists "Users upload own fitness photos" on storage.objects;
create policy "Users upload own fitness photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fitness-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users view own fitness photos" on storage.objects;
create policy "Users view own fitness photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fitness-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own fitness photos" on storage.objects;
create policy "Users delete own fitness photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fitness-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.book_client_session(
  p_client_id uuid,
  p_package_id uuid,
  p_scheduled_at timestamptz
)
returns setof public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  package_row public.client_packages%rowtype;
  booked_session public.sessions%rowtype;
begin
  if p_client_id is null then
    raise exception 'CLIENT_ID_REQUIRED';
  end if;

  if p_package_id is null then
    raise exception 'PACKAGE_ID_REQUIRED';
  end if;

  if p_scheduled_at is null then
    raise exception 'SCHEDULED_AT_REQUIRED';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'SLOT_MUST_BE_IN_FUTURE';
  end if;

  perform pg_advisory_xact_lock(hashtext('session-slot:' || p_scheduled_at::text));

  select *
  into package_row
  from public.client_packages
  where id = p_package_id
    and client_id = p_client_id
  for update;

  if not found then
    raise exception 'PACKAGE_NOT_FOUND';
  end if;

  if package_row.sessions_remaining <= 0 then
    raise exception 'NO_SESSIONS_REMAINING';
  end if;

  if exists (
    select 1
    from public.sessions
    where scheduled_at = p_scheduled_at
      and status = 'scheduled'
  ) then
    raise exception 'SLOT_ALREADY_BOOKED';
  end if;

  begin
    insert into public.sessions (
      client_id,
      package_id,
      scheduled_at,
      status
    )
    values (
      p_client_id,
      p_package_id,
      p_scheduled_at,
      'scheduled'
    )
    returning * into booked_session;
  exception
    when unique_violation then
      raise exception 'SLOT_ALREADY_BOOKED';
  end;

  update public.client_packages
  set sessions_remaining = sessions_remaining - 1
  where id = package_row.id;

  return next booked_session;
end;
$$;

revoke all on function public.book_client_session(uuid, uuid, timestamptz) from public;
grant execute on function public.book_client_session(uuid, uuid, timestamptz) to service_role;

-- ── API RATE LIMITING ────────────────────────────────────
create table if not exists api_rate_limits (
  key              text primary key,
  window_start     timestamptz not null,
  count            int not null default 0,
  updated_at       timestamptz not null default now()
);

alter table api_rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns table(
  allowed boolean,
  remaining int,
  reset_at timestamptz,
  current_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  row_state public.api_rate_limits%rowtype;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'p_key is required';
  end if;

  if p_limit <= 0 then
    raise exception 'p_limit must be greater than zero';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be greater than zero';
  end if;

  insert into public.api_rate_limits as rl (key, window_start, count, updated_at)
  values (p_key, now_ts, 1, now_ts)
  on conflict (key) do update
    set window_start = case
      when rl.window_start <= now_ts - make_interval(secs => p_window_seconds) then now_ts
      else rl.window_start
    end,
    count = case
      when rl.window_start <= now_ts - make_interval(secs => p_window_seconds) then 1
      else rl.count + 1
    end,
    updated_at = now_ts
  returning * into row_state;

  allowed := row_state.count <= p_limit;
  remaining := greatest(p_limit - row_state.count, 0);
  reset_at := row_state.window_start + make_interval(secs => p_window_seconds);
  current_count := row_state.count;

  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
