-- FarmLink 0010: security fixes from the security review. Run once after 0009.

-- 1. Nothing is callable without signing in. Some RPCs compared auth.uid() with "<>", which is
--    NULL (not true) for anonymous callers, so the permission check was skipped.
--    Postgres also grants EXECUTE to PUBLIC by default, so revoke from PUBLIC as well.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

create or replace function public.join_session(p_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  select * into s from sessions where id = p_session;
  if not found or not public.can_view_session(p_session) then raise exception 'Session not found'; end if;
  if now() < s.starts_at - interval '15 minutes' then raise exception 'You can join 15 minutes before the start'; end if;
  if now() > s.starts_at + make_interval(mins => s.duration_minutes + 30) then raise exception 'This session has ended'; end if;
  if s.host_id is distinct from auth.uid() then
    update session_registrations set attended_at = coalesce(attended_at, now()) where session_id = s.id and user_id = auth.uid();
    if not found then raise exception 'Register for this session first'; end if;
  end if;
  return 'https://meet.jit.si/' || s.meeting_room;
end $$;
revoke execute on function public.join_session(uuid) from anon;

-- 2. Only safe links can be stored (no javascript:, data: or other schemes)
create or replace function public.is_web_url(u text) returns boolean
language sql immutable as $$ select u is null or u ~* '^https?://[^\s]+$' $$;
create or replace function public.is_storage_path(p text) returns boolean
language sql immutable as $$ select p is null or (p !~* '^[a-z][a-z0-9+.-]*:' and p !~ '^//' and p !~ '\.\.') $$;
create or replace function public.all_storage_paths(ps text[]) returns boolean
language sql immutable as $$ select coalesce(bool_and(public.is_storage_path(p)), true) from unnest(ps) p $$;

alter table public.sessions drop constraint if exists sessions_safe_urls;
alter table public.sessions add constraint sessions_safe_urls check (public.is_web_url(notes_url) and public.is_web_url(recording_url)) not valid;
alter table public.session_resources drop constraint if exists session_resources_safe_url;
alter table public.session_resources add constraint session_resources_safe_url check (public.is_web_url(url) and public.is_storage_path(storage_path)) not valid;
alter table public.support_tickets drop constraint if exists support_tickets_safe_link;
alter table public.support_tickets add constraint support_tickets_safe_link check (related_link is null or related_link ~ '^/[A-Za-z0-9/_?=&.-]*$') not valid;
alter table public.profiles drop constraint if exists profiles_safe_avatar;
alter table public.profiles add constraint profiles_safe_avatar check (public.is_web_url(avatar_url)) not valid;
alter table public.plot_photos drop constraint if exists plot_photos_safe_path;
alter table public.plot_photos add constraint plot_photos_safe_path check (public.is_storage_path(storage_path)) not valid;
alter table public.season_milestones drop constraint if exists season_milestones_safe_paths;
alter table public.season_milestones add constraint season_milestones_safe_paths check (public.all_storage_paths(photo_paths)) not valid;
alter table public.harvest_records drop constraint if exists harvest_records_safe_path;
alter table public.harvest_records add constraint harvest_records_safe_path check (public.is_storage_path(photo_path)) not valid;
alter table public.produce_listings drop constraint if exists produce_listings_safe_path;
alter table public.produce_listings add constraint produce_listings_safe_path check (public.is_storage_path(photo_path)) not valid;
alter table public.sessions drop constraint if exists sessions_safe_cover;
alter table public.sessions add constraint sessions_safe_cover check (cover_image is null or cover_image ~ '^/images/[A-Za-z0-9/_.-]+$' or cover_image ~* '^https://[^\s]+/storage/v1/object/public/session-covers/[^\s]+$') not valid;

-- 3. Supporting documents (plot-photos/{plot}/docs/...) are only for the owner, verifiers and admins
create or replace function public.can_view_plot_docs(p_plot uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from plots p where p.id = p_plot
    and (p.owner_id = auth.uid() or p.assigned_verifier_id = auth.uid() or public.verifier_covers(p.region)))
$$;
-- New documents go to {plot}/docs/; older ones are recognised by their plot_photos row
create or replace function public.is_plot_document(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select (storage.foldername(p_name))[2] is not distinct from 'docs'
      or exists (select 1 from plot_photos where storage_path = p_name and is_document)
$$;
drop policy if exists "plot-photos: view with plot" on storage.objects;
create policy "plot-photos: view with plot" on storage.objects for select to authenticated
  using (bucket_id = 'plot-photos' and case when public.is_plot_document(name)
    then public.can_view_plot_docs(public.path_uuid(name)) else public.can_view_plot(public.path_uuid(name)) end);

-- 4. Chat messages cannot be edited after sending. Leaders pin notices through an RPC.
drop policy if exists "messages: leaders pin, senders edit notices" on public.messages;
create or replace function public.set_message_pinned(p_message uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  select * into m from messages where id = p_message;
  if not found or m.group_id is null then raise exception 'Message not found'; end if;
  if not (public.is_group_leader(m.group_id) or public.is_admin()) then raise exception 'Only group leaders can pin notices'; end if;
  update messages set pinned = p_pinned where id = p_message;
end $$;

-- 5. Leaders change member roles through an RPC only (no rewriting who is a member)
drop policy if exists "group_members: leaders promote" on public.group_members;
create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_group_leader(p_group) or public.is_admin()) then raise exception 'Only group leaders can change roles'; end if;
  if p_role not in ('member', 'leader') then raise exception 'Role must be member or leader'; end if;
  update group_members set member_role = p_role where group_id = p_group and user_id = p_user;
  if not found then raise exception 'That person is not in the group'; end if;
end $$;

-- 6. Files of a group-only session are only for people who can see that session
drop policy if exists "session-files: signed-in read" on storage.objects;
create policy "session-files: people who can see the session" on storage.objects for select to authenticated
  using (bucket_id = 'session-files' and public.can_view_session(public.path_uuid(name)));

-- 8. Small integrity guards
-- notifications: users may only mark them read
create or replace function public.notifications_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (new.user_id, new.type, new.title, new.body, new.link, new.created_at)
     is distinct from (old.user_id, old.type, old.title, old.body, old.link, old.created_at) then
    raise exception 'Notifications can only be marked as read';
  end if;
  return new;
end $$;
drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before update on public.notifications for each row execute function public.notifications_guard();

-- offers: a buyer can only withdraw, without changing the offer itself
create or replace function public.offers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or public._is_internal() then return new; end if;
  if (new.listing_id, new.buyer_id, new.quantity, new.price_per_unit, new.message, new.created_at)
     is distinct from (old.listing_id, old.buyer_id, old.quantity, old.price_per_unit, old.message, old.created_at) then
    raise exception 'An offer cannot be changed after it is sent. Withdraw it and make a new one';
  end if;
  return new;
end $$;
drop trigger if exists offers_guard on public.offers;
create trigger offers_guard before update on public.offers for each row execute function public.offers_guard();

-- respond_to_offer updates offers as the seller; mark it internal so the guard allows it
create or replace function public.respond_to_offer(p_offer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o public.offers; l public.produce_listings; other record;
begin
  select * into o from offers where id = p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into l from produce_listings where id = o.listing_id for update;
  if l.seller_id is distinct from auth.uid() and not public.is_admin() then raise exception 'Only the seller can respond'; end if;
  if o.status <> 'pending' then raise exception 'This offer has already been answered'; end if;
  perform public._internal();
  update offers set status = case when p_accept then 'accepted'::public.offer_status else 'declined'::public.offer_status end,
                    responded_at = now() where id = o.id;
  perform public.notify(o.buyer_id, case when p_accept then 'offer_accepted' else 'offer_declined' end,
    case when p_accept then 'Offer accepted' else 'Offer declined' end, l.crop || ' · ' || o.quantity || ' ' || l.unit, '/market/offers');
  if p_accept then
    if o.quantity >= l.quantity then
      update produce_listings set status = 'sold' where id = l.id;
      for other in select id, buyer_id from offers where listing_id = l.id and status = 'pending' loop
        update offers set status = 'declined', responded_at = now() where id = other.id;
        perform public.notify(other.buyer_id, 'offer_declined', 'Offer declined', l.crop || ' has sold out', '/market/offers');
      end loop;
    else
      update produce_listings set quantity = quantity - o.quantity where id = l.id;
    end if;
  end if;
end $$;

-- Every function is for signed-in users only; internal helpers stay closed to clients
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.notify(uuid, text, text, text, text) from authenticated;
revoke execute on function public.notify_admins(text, text, text, text) from authenticated;
revoke execute on function public._internal() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.registrations_after_insert() from authenticated;
