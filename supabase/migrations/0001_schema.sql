-- FarmLink schema: types, tables, indexes.
-- Run the migrations in order: 0001 → 0004. Then seed.sql for demo data.
--
-- Core (13 + 1):   profiles, profile_contacts, verifiers, plots, plot_photos, plot_verifications,
--                  applications, deals, agreements, season_milestones, harvest_records,
--                  messages, disputes, notifications
-- Extended (7):    groups, group_members, sessions, session_registrations,
--                  produce_listings, offers, ratings

-- ---------- Types ----------
create type public.user_role as enum ('landowner', 'farmer', 'verifier', 'admin', 'buyer');
create type public.plot_status as enum ('pending', 'verified', 'rejected', 'in_deal', 'archived');
create type public.application_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.deal_status as enum ('drafting', 'active', 'harvested', 'completed', 'cancelled');
create type public.milestone_type as enum ('cleared', 'planted', 'weeded', 'harvested');
create type public.dispute_status as enum ('open', 'in_mediation', 'resolved', 'closed');
create type public.verifier_type as enum ('extension_officer', 'community');
create type public.listing_status as enum ('open', 'sold', 'closed');
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

-- Ghana's 16 regions, used to check region columns
create or replace function public.is_ghana_region(r text) returns boolean
language sql immutable as $$
  select r = any (array['Ahafo','Ashanti','Bono','Bono East','Central','Eastern','Greater Accra','North East',
                        'Northern','Oti','Savannah','Upper East','Upper West','Volta','Western','Western North'])
$$;

-- ---------- Users ----------
-- One row per Supabase Auth user, created by the handle_new_user trigger (0002).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'farmer',
  full_name text not null check (char_length(full_name) between 2 and 120),
  region text check (region is null or public.is_ghana_region(region)),
  district text,
  bio text check (bio is null or char_length(bio) <= 1000),
  avatar_url text,
  is_group boolean not null default false,            -- farmer group account
  group_name text,
  group_size int check (group_size is null or group_size between 2 and 500),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_fields check (not is_group or (group_name is not null and group_size is not null))
);

-- Phone numbers are private: only the user, admins, and people who need to reach them
-- (deal counterpart, assigned verifier) can read them, via get_contact_phone().
create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{9,16}$'),
  phone_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Verifier details. Extension officers or admin-approved community verifiers.
create table public.verifiers (
  id uuid primary key references public.profiles (id) on delete cascade,
  verifier_type public.verifier_type not null,
  organisation text,                                   -- e.g. district agric office, farmer association
  regions text[] not null default '{}',                -- regions this verifier covers
  approved boolean not null default false,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Plots ----------
create table public.plots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 2000),
  region text not null check (public.is_ghana_region(region)),
  district text,
  community text,
  size_acres numeric(8, 2) not null check (size_acres > 0 and size_acres <= 10000),
  soil_type text not null,
  water_access text not null,
  suitable_crops text[] not null default '{}',
  latitude numeric(9, 6) check (latitude between 4 and 12),       -- Ghana's bounds, roughly
  longitude numeric(9, 6) check (longitude between -4 and 2),
  available_from date,
  min_duration_months int check (min_duration_months is null or min_duration_months between 1 and 120),
  status public.plot_status not null default 'pending',
  assigned_verifier_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plots_status_region_idx on public.plots (status, region);
create index plots_owner_idx on public.plots (owner_id);
create index plots_verifier_idx on public.plots (assigned_verifier_id);

-- Photos and optional supporting documents. storage_path is a key in the plot-photos bucket,
-- or a site path starting with "/" for demo images.
create table public.plot_photos (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  storage_path text not null,
  caption text,
  is_document boolean not null default false,
  sort_order int not null default 0,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index plot_photos_plot_idx on public.plot_photos (plot_id);

create table public.plot_verifications (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  verifier_id uuid not null references public.profiles (id),
  decision text not null check (decision in ('approved', 'rejected')),
  checklist jsonb not null default '{}',               -- {"exists":true,"size_matches":true,...}
  notes text,
  visited_on date,
  created_at timestamptz not null default now()
);
create index plot_verifications_plot_idx on public.plot_verifications (plot_id);

-- ---------- Applications and deals ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  planned_crop text not null,
  proposed_duration_months int check (proposed_duration_months is null or proposed_duration_months between 1 and 120),
  message text check (message is null or char_length(message) <= 2000),
  status public.application_status not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
-- One live application per farmer per plot
create unique index applications_one_pending_idx on public.applications (plot_id, farmer_id) where status = 'pending';
create index applications_farmer_idx on public.applications (farmer_id);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id),
  application_id uuid not null unique references public.applications (id),
  landowner_id uuid not null references public.profiles (id),
  farmer_id uuid not null references public.profiles (id),
  verifier_id uuid references public.profiles (id),
  status public.deal_status not null default 'drafting',
  started_at timestamptz,                              -- when the agreement was confirmed by both
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_landowner_idx on public.deals (landowner_id);
create index deals_farmer_idx on public.deals (farmer_id);
create index deals_verifier_idx on public.deals (verifier_id);

-- Each edit is a new version; both parties must confirm the latest version.
create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  version int not null,
  crop text not null,
  start_date date not null,
  end_date date not null,
  landowner_percent numeric(5, 2) not null check (landowner_percent between 0 and 100),
  harvest_unit text not null default 'bags',
  deduction_amount numeric(10, 2) not null default 0 check (deduction_amount >= 0),
  deduction_to text not null default 'farmer' check (deduction_to in ('farmer', 'landowner')),
  responsibilities jsonb not null default '{}',        -- {"seed":"farmer","fertiliser":"farmer","clearing":"landowner",...}
  notes text,
  created_by uuid not null references public.profiles (id),
  landowner_confirmed_at timestamptz,
  farmer_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (deal_id, version),
  constraint agreement_dates check (end_date > start_date)
);

create table public.season_milestones (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  milestone public.milestone_type not null,
  note text check (note is null or char_length(note) <= 1000),
  photo_paths text[] not null default '{}',            -- keys in the milestone-photos bucket
  occurred_on date not null default current_date,
  posted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index season_milestones_deal_idx on public.season_milestones (deal_id);

-- One harvest record per deal. Shares are calculated by record_harvest() (0002).
create table public.harvest_records (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.deals (id) on delete cascade,
  agreement_id uuid not null references public.agreements (id),
  total_quantity numeric(12, 2) not null check (total_quantity >= 0),
  unit text not null,
  deduction_applied numeric(12, 2) not null default 0,
  landowner_share numeric(12, 2) not null,
  farmer_share numeric(12, 2) not null,
  sale_price_per_unit numeric(12, 2) check (sale_price_per_unit is null or sale_price_per_unit >= 0),
  landowner_value numeric(14, 2),
  farmer_value numeric(14, 2),
  photo_path text,
  notes text,
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Chat. A thread is either an application (one-to-one; carries on into the deal)
-- or a group (group chat and notice board posts).
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications (id) on delete cascade,
  group_id uuid,                                       -- FK added after groups is created
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  is_notice boolean not null default false,            -- group notice board post
  notice_title text,
  pinned boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint one_thread check (num_nonnulls(application_id, group_id) = 1),
  constraint notice_in_group check (not is_notice or group_id is not null)
);
create index messages_application_idx on public.messages (application_id, created_at);
create index messages_group_idx on public.messages (group_id, created_at);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  raised_by uuid not null references public.profiles (id),
  category text not null check (category in ('inputs', 'harvest_share', 'land_access', 'timing', 'conduct', 'other')),
  description text not null check (char_length(description) between 10 and 4000),
  status public.dispute_status not null default 'open',
  verifier_id uuid references public.profiles (id),
  proposed_resolution text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_deal_idx on public.disputes (deal_id);
create index disputes_verifier_idx on public.disputes (verifier_id, status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,                                           -- in-app route, e.g. /deals/<id>
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- Extended: community ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 80),
  description text,
  region text check (region is null or public.is_ghana_region(region)),
  crop text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.messages add constraint messages_group_fk foreign key (group_id) references public.groups (id) on delete cascade;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('member', 'leader')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- ---------- Extended: education ----------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id),
  title text not null check (char_length(title) between 3 and 160),
  description text,
  topic text,
  region text check (region is null or public.is_ghana_region(region)),
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 480),
  capacity int not null default 100 check (capacity between 1 and 1000),
  meeting_room text not null default ('farmlink-' || replace(gen_random_uuid()::text, '-', '')),  -- Jitsi room name
  notes_url text,                                      -- FR14: notes or slides after the session
  recording_url text,                                  -- FR14: recording link after the session
  created_at timestamptz not null default now()
);
create index sessions_starts_idx on public.sessions (starts_at);

create table public.session_registrations (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  registered_at timestamptz not null default now(),
  attended_at timestamptz,
  primary key (session_id, user_id)
);

-- ---------- Extended: marketplace and reputation ----------
create table public.produce_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete set null,
  crop text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null,
  price_per_unit numeric(12, 2) check (price_per_unit is null or price_per_unit >= 0),
  region text not null check (public.is_ghana_region(region)),
  description text,
  photo_path text,
  status public.listing_status not null default 'open',
  created_at timestamptz not null default now()
);
create index produce_listings_status_idx on public.produce_listings (status, region);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  quantity numeric(12, 2) not null check (quantity > 0),
  price_per_unit numeric(12, 2) not null check (price_per_unit >= 0),
  message text,
  status public.offer_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index offers_listing_idx on public.offers (listing_id);
create index offers_buyer_idx on public.offers (buyer_id);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  score int not null check (score between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (deal_id, rater_id),
  constraint no_self_rating check (rater_id <> ratee_id)
);
create index ratings_ratee_idx on public.ratings (ratee_id);
