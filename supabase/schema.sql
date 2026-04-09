-- Scott Gordon Fitness — Supabase Schema
-- Run this in your Supabase SQL editor

-- ── WAITLIST ──────────────────────────────────────────────
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz default now()
);

-- ── CLIENTS ───────────────────────────────────────────────
create table if not exists clients (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text,
  phone           text,
  stripe_customer_id text unique,
  created_at      timestamptz default now()

-- ── ROLE MIGRATION (run after initial schema) ─────────────
alter table clients add column if not exists role text default 'client'
  check (role in ('client', 'coach'));
);

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
alter table clients enable row level security;
alter table client_packages enable row level security;
alter table sessions enable row level security;

-- Waitlist: anyone can insert, only service role can read
create policy "Public can join waitlist" on waitlist
  for insert with check (true);

-- Clients: users can only read/update their own record
create policy "Client reads own record" on clients
  for select using (auth.uid() = id);
create policy "Client updates own record" on clients
  for update using (auth.uid() = id);

-- Packages: clients see only their own
create policy "Client sees own packages" on client_packages
  for select using (auth.uid() = client_id);

-- Sessions: clients see only their own
create policy "Client sees own sessions" on sessions
  for select using (auth.uid() = client_id);

-- ── INDEXES ───────────────────────────────────────────────
create index if not exists sessions_client_id_idx on sessions(client_id);
create index if not exists sessions_scheduled_at_idx on sessions(scheduled_at);
create index if not exists packages_client_id_idx on client_packages(client_id);

-- ── COACH POLICIES ────────────────────────────────────────
-- Coach can read all clients
create policy "Coach reads all clients" on clients
  for select using (
    exists (
      select 1 from clients c where c.id = auth.uid() and c.role = 'coach'
    )
  );

-- Coach can read all packages
create policy "Coach reads all packages" on client_packages
  for select using (
    exists (
      select 1 from clients c where c.id = auth.uid() and c.role = 'coach'
    )
  );

-- Coach can read and update all sessions
create policy "Coach reads all sessions" on sessions
  for select using (
    exists (
      select 1 from clients c where c.id = auth.uid() and c.role = 'coach'
    )
  );
create policy "Coach updates sessions" on sessions
  for update using (
    exists (
      select 1 from clients c where c.id = auth.uid() and c.role = 'coach'
    )
  );
