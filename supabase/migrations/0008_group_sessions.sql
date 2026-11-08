-- FarmLink 0008: community sessions. Group leaders can schedule sessions for their own group
-- without admin approval. Group sessions are only visible to that group's members (and the host
-- and admins). Sessions open to everyone still need an approved host. Run once after 0007.

alter table public.sessions add column if not exists group_id uuid references public.groups (id) on delete cascade;
create index if not exists sessions_group_idx on public.sessions (group_id);

-- Leads at least one group (used for the cover upload rule)
create or replace function public.leads_a_group() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where user_id = auth.uid() and member_role = 'leader')
$$;

create or replace function public.can_view_session(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sessions s where s.id = p_session
      and (s.group_id is null or s.host_id = auth.uid() or public.is_admin() or public.is_group_member(s.group_id)))
$$;

-- Who may create which session
drop policy if exists "sessions: approved hosts create" on public.sessions;
create policy "sessions: approved hosts or group leaders create" on public.sessions for insert to authenticated
  with check (host_id = auth.uid() and (
    (group_id is null and public.can_host_sessions())
    or (group_id is not null and (public.is_group_leader(group_id) or public.can_host_sessions()))));

-- Group sessions are only visible to members
drop policy if exists "sessions: signed-in users read" on public.sessions;
create policy "sessions: public, or your group's" on public.sessions for select to authenticated
  using (group_id is null or host_id = auth.uid() or public.is_admin() or public.is_group_member(group_id));

-- Moving a session into another group is only allowed into a group you lead
create or replace function public.sessions_group_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.group_id is distinct from old.group_id then
    if new.group_id is null and not public.can_host_sessions() then
      raise exception 'Only approved hosts can open a session to everyone';
    end if;
    if new.group_id is not null and not (public.is_group_leader(new.group_id) or public.can_host_sessions()) then
      raise exception 'You can only schedule sessions for a group you lead';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sessions_group_guard on public.sessions;
create trigger sessions_group_guard before update on public.sessions for each row execute function public.sessions_group_guard();

-- Registration: group sessions are for members only (extends the existing capacity check)
create or replace function public.registrations_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from sessions where id = new.session_id;
  if s.starts_at + make_interval(mins => s.duration_minutes) < now() then raise exception 'This session has ended'; end if;
  if s.group_id is not null and not exists (select 1 from group_members where group_id = s.group_id and user_id = new.user_id) then
    raise exception 'This session is for members of the group. Join the group first';
  end if;
  if (select count(*) from session_registrations where session_id = s.id) >= s.capacity then raise exception 'This session is full'; end if;
  new.attended_at := null;
  return new;
end $$;

-- Tell group members when their leader schedules a session
create or replace function public.sessions_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null then
    insert into notifications (user_id, type, title, body, link)
    select m.user_id, 'session_update', 'New group session: ' || new.title,
           (select name from groups where id = new.group_id) || ' · ' || to_char(new.starts_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI'),
           '/sessions/' || new.id
    from group_members m where m.group_id = new.group_id and m.user_id <> new.host_id;
  end if;
  return new;
end $$;
drop trigger if exists sessions_after_insert on public.sessions;
create trigger sessions_after_insert after insert on public.sessions for each row execute function public.sessions_after_insert();

-- Questions, votes and materials of a group session stay inside the group
drop policy if exists "questions: signed-in users read" on public.session_questions;
create policy "questions: people who can see the session" on public.session_questions for select to authenticated
  using (public.can_view_session(session_id));
drop policy if exists "questions: signed-in users ask" on public.session_questions;
create policy "questions: people who can see the session ask" on public.session_questions for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_session(session_id));
drop policy if exists "votes: signed-in users read" on public.session_question_votes;
create policy "votes: people who can see the session" on public.session_question_votes for select to authenticated
  using (exists (select 1 from public.session_questions q where q.id = question_id and public.can_view_session(q.session_id)));
drop policy if exists "resources: signed-in users read" on public.session_resources;
create policy "resources: people who can see the session" on public.session_resources for select to authenticated
  using (public.can_view_session(session_id));

-- Group leaders may upload cover photos too
drop policy if exists "session-covers: hosts upload to own folder" on storage.objects;
create policy "session-covers: hosts upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-covers' and public.path_uuid(name) = auth.uid()
              and (public.can_host_sessions() or public.leads_a_group()));
