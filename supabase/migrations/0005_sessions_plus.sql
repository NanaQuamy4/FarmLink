-- FarmLink 0005: richer education sessions (FR13, FR14).
-- Expert hosts approved by admins, agenda, shared materials, live Q&A with votes, feedback,
-- and notifications to registered users. Run once after 0001-0004.

-- ---------- Who can host ----------
-- Verifiers (extension officers) and admins can always host. Admins can also approve other
-- experts (agronomists, NGO trainers, experienced farmers) as session hosts.
alter table public.profiles add column if not exists can_host_sessions boolean not null default false;

create or replace function public.can_host_sessions() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_approved_verifier()
      or coalesce((select can_host_sessions and not is_suspended from profiles where id = auth.uid()), false)
$$;

create or replace function public.set_session_host(p_user uuid, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can approve session hosts'; end if;
  perform public._internal();
  update profiles set can_host_sessions = p_allowed where id = p_user;
  if p_allowed then
    perform public.notify(p_user, 'host_approved', 'You can now host sessions', 'Schedule a session to share what you know with farmers.', '/sessions');
  end if;
end $$;

-- Only admins change can_host_sessions (extends the existing guard)
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id then raise exception 'Profile id cannot change'; end if;
  if auth.uid() is not null and not public.is_admin() and not public._is_internal()
     and (new.role is distinct from old.role or new.is_suspended is distinct from old.is_suspended
          or new.can_host_sessions is distinct from old.can_host_sessions) then
    raise exception 'Only an administrator can change roles, hosting rights or suspend accounts';
  end if;
  return new;
end $$;

drop policy if exists "sessions: verifiers and admins host" on public.sessions;
create policy "sessions: approved hosts create" on public.sessions for insert to authenticated
  with check (host_id = auth.uid() and public.can_host_sessions());

-- ---------- Session details ----------
alter table public.sessions add column if not exists agenda text;          -- one item per line
alter table public.sessions add column if not exists cover_image text;     -- site image path for the session page
alter table public.sessions add column if not exists audience text;        -- who it is for, e.g. "New maize farmers"

-- ---------- Materials ----------
create table if not exists public.session_resources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  storage_path text,                                   -- key in the session-files bucket
  url text,                                            -- or an external link
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint resource_target check (num_nonnulls(storage_path, url) = 1)
);
create index if not exists session_resources_session_idx on public.session_resources (session_id);

-- ---------- Q&A ----------
create table if not exists public.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1000),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists session_questions_session_idx on public.session_questions (session_id, created_at);

create table if not exists public.session_question_votes (
  question_id uuid not null references public.session_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (question_id, user_id)
);

-- ---------- Feedback ----------
create table if not exists public.session_feedback (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score int not null check (score between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create or replace function public.is_session_host(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from sessions where id = p_session and host_id = auth.uid())
$$;

-- Host answers a question (only the answer fields change)
create or replace function public.answer_question(p_question uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare q public.session_questions; s public.sessions;
begin
  select * into q from session_questions where id = p_question;
  if not found then raise exception 'Question not found'; end if;
  if not public.is_session_host(q.session_id) then raise exception 'Only the host can answer questions'; end if;
  update session_questions set answer = nullif(trim(p_answer), ''), answered_at = case when nullif(trim(p_answer), '') is null then null else now() end
  where id = p_question;
  select * into s from sessions where id = q.session_id;
  if nullif(trim(p_answer), '') is not null and q.user_id <> auth.uid() then
    perform public.notify(q.user_id, 'question_answered', 'Your question was answered', s.title, '/sessions/' || s.id || '?tab=qa');
  end if;
end $$;

-- Feedback is for people who registered, after the session has started
create or replace function public.session_feedback_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from sessions where id = new.session_id;
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  if now() < s.starts_at then raise exception 'You can leave feedback once the session has started'; end if;
  if not exists (select 1 from session_registrations where session_id = s.id and user_id = new.user_id) then
    raise exception 'Only people who registered can leave feedback';
  end if;
  return new;
end $$;
drop trigger if exists session_feedback_before on public.session_feedback;
create trigger session_feedback_before before insert on public.session_feedback for each row execute function public.session_feedback_before();

create or replace function public.session_summary(p_session uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registered', (select count(*) from session_registrations where session_id = p_session),
    'attended', (select count(*) from session_registrations where session_id = p_session and attended_at is not null),
    'questions', (select count(*) from session_questions where session_id = p_session),
    'feedback_count', (select count(*) from session_feedback where session_id = p_session),
    'feedback_average', (select round(avg(score)::numeric, 1) from session_feedback where session_id = p_session))
$$;

-- ---------- Notifications ----------
create or replace function public.registrations_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from sessions where id = new.session_id;
  perform public.notify(new.user_id, 'session_registered', 'You are registered',
    s.title || ' · ' || to_char(s.starts_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI'), '/sessions/' || s.id);
  return new;
end $$;
drop trigger if exists registrations_after_insert on public.session_registrations;
create trigger registrations_after_insert after insert on public.session_registrations for each row execute function public.registrations_after_insert();

-- Tell registered people when the time changes or notes/recordings are posted
create or replace function public.sessions_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare msg text; ttl text;
begin
  if new.starts_at is distinct from old.starts_at then
    ttl := 'Session rescheduled'; msg := new.title || ' now starts ' || to_char(new.starts_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI');
  elsif (new.notes_url is distinct from old.notes_url and new.notes_url is not null)
     or (new.recording_url is distinct from old.recording_url and new.recording_url is not null) then
    ttl := 'Notes and recording posted'; msg := new.title;
  else
    return new;
  end if;
  insert into notifications (user_id, type, title, body, link)
  select r.user_id, 'session_update', ttl, msg, '/sessions/' || new.id from session_registrations r where r.session_id = new.id;
  return new;
end $$;
drop trigger if exists sessions_after_update on public.sessions;
create trigger sessions_after_update after update on public.sessions for each row execute function public.sessions_after_update();

create or replace function public.session_resources_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from sessions where id = new.session_id;
  insert into notifications (user_id, type, title, body, link)
  select r.user_id, 'session_update', 'New material: ' || new.title, s.title, '/sessions/' || s.id || '?tab=materials'
  from session_registrations r where r.session_id = s.id;
  return new;
end $$;
drop trigger if exists session_resources_after_insert on public.session_resources;
create trigger session_resources_after_insert after insert on public.session_resources for each row execute function public.session_resources_after_insert();

create or replace function public.session_questions_before() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  new.answer := null; new.answered_at := null;
  return new;
end $$;
drop trigger if exists session_questions_before on public.session_questions;
create trigger session_questions_before before insert on public.session_questions for each row execute function public.session_questions_before();

-- ---------- RLS ----------
alter table public.session_resources enable row level security;
alter table public.session_questions enable row level security;
alter table public.session_question_votes enable row level security;
alter table public.session_feedback enable row level security;

create policy "resources: signed-in users read" on public.session_resources for select to authenticated using (true);
create policy "resources: host adds" on public.session_resources for insert to authenticated
  with check (added_by = auth.uid() and public.is_session_host(session_id));
create policy "resources: host removes" on public.session_resources for delete to authenticated using (public.is_session_host(session_id));

create policy "questions: signed-in users read" on public.session_questions for select to authenticated using (true);
create policy "questions: signed-in users ask" on public.session_questions for insert to authenticated with check (user_id = auth.uid());
create policy "questions: asker or host deletes" on public.session_questions for delete to authenticated
  using (user_id = auth.uid() or public.is_session_host(session_id));

create policy "votes: signed-in users read" on public.session_question_votes for select to authenticated using (true);
create policy "votes: vote as yourself" on public.session_question_votes for insert to authenticated with check (user_id = auth.uid());
create policy "votes: remove your vote" on public.session_question_votes for delete to authenticated using (user_id = auth.uid());

create policy "feedback: own, host, admin read" on public.session_feedback for select to authenticated
  using (user_id = auth.uid() or public.is_session_host(session_id));
create policy "feedback: registered users give" on public.session_feedback for insert to authenticated with check (user_id = auth.uid());

-- ---------- Storage for materials ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('session-files', 'session-files', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "session-files: signed-in read" on storage.objects for select to authenticated using (bucket_id = 'session-files');
create policy "session-files: host uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-files' and public.is_session_host(public.path_uuid(name)));
create policy "session-files: host deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'session-files' and public.is_session_host(public.path_uuid(name)));

-- Live Q&A
alter publication supabase_realtime add table public.session_questions;
alter publication supabase_realtime add table public.session_question_votes;

revoke execute on function public.registrations_after_insert() from public, anon, authenticated;

-- ---------- Demo content for the seeded sessions ----------
update public.sessions set
  agenda = E'How fall armyworm damages maize\nScouting your field: what to look for\nSafe control: hand picking, neem, approved sprays\nYour questions',
  audience = 'Maize farmers in Bono East and nearby', cover_image = '/images/maize-field.jpg'
where title = 'Controlling fall armyworm in maize' and agenda is null;
update public.sessions set
  agenda = E'Why drip saves water and money\nParts of a low-cost drip line\nLaying it out on a vegetable bed\nYour questions',
  audience = 'Vegetable growers planning a dry-season crop', cover_image = '/images/irrigating-farm.jpg'
where title = 'Dry-season vegetables with drip irrigation' and agenda is null;
update public.sessions set
  agenda = E'Reading colour, texture and smell\nThe jar test for soil texture\nWhen a lab test is worth it\nYour questions',
  audience = 'Anyone about to plant a new plot', cover_image = '/images/crop-rows.jpg'
where title = 'Reading your soil before you plant' and agenda is null;
update public.sessions set
  agenda = E'Drying grain to the right moisture\nBagging and hermetic storage\nKeeping pests out of the store',
  audience = 'Maize and cowpea farmers after harvest', cover_image = '/images/maize-harvest.jpg'
where title = 'Storing grain to cut post-harvest losses' and agenda is null;

-- Demo Q&A, a shared resource and feedback (only if the seed accounts exist and nothing is there yet)
insert into public.session_questions (session_id, user_id, body)
select s.id, p.id, q.body
from public.sessions s
join (values ('Kwame Asante', 'Which sprays are safe to use near the house and the children?'),
             ('Esi Adjei', 'Can neem leaves from our own trees work as well as bought neem oil?')) q(name, body) on true
join public.profiles p on p.full_name = q.name
where s.title = 'Controlling fall armyworm in maize'
  and not exists (select 1 from public.session_questions x where x.session_id = s.id);

insert into public.session_question_votes (question_id, user_id)
select q.id, p.id from public.session_questions q join public.profiles p on p.full_name = 'Esi Adjei'
where q.body like 'Which sprays are safe%' on conflict do nothing;

insert into public.session_resources (session_id, title, url, added_by)
select s.id, 'FAO guide: fall armyworm in Africa', 'https://www.fao.org/fall-armyworm/en/', s.host_id
from public.sessions s where s.title = 'Controlling fall armyworm in maize'
  and not exists (select 1 from public.session_resources r where r.session_id = s.id);

insert into public.session_feedback (session_id, user_id, score, comment)
select s.id, p.id, 5, 'Very practical. We dried our maize the way she showed us.'
from public.sessions s join public.profiles p on p.full_name = 'Kwame Asante'
where s.title = 'Storing grain to cut post-harvest losses' on conflict do nothing;
