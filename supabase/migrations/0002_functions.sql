-- FarmLink functions: permission helpers, harvest split, triggers and RPC actions.
--
-- Status changes (verify a plot, accept an application, confirm an agreement, record a harvest...)
-- go through the security-definer RPCs below so the rules live in one place. Each RPC checks the
-- caller with auth.uid() before doing anything.

-- ---------- Permission helpers (security definer so RLS policies can use them without recursion) ----------
create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and not is_suspended
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and not is_suspended from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_approved_verifier() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from verifiers v join profiles p on p.id = v.id
    where v.id = auth.uid() and v.approved and p.role = 'verifier' and not p.is_suspended)
$$;

create or replace function public.verifier_covers(p_region text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from verifiers v join profiles p on p.id = v.id
    where v.id = auth.uid() and v.approved and p.role = 'verifier' and not p.is_suspended
      and p_region = any (v.regions))
$$;

create or replace function public.is_deal_party(p_deal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from deals where id = p_deal and auth.uid() in (landowner_id, farmer_id))
$$;

create or replace function public.can_view_deal(p_deal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from deals where id = p_deal and auth.uid() in (landowner_id, farmer_id, verifier_id))
$$;

create or replace function public.can_view_plot(p_plot uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (
        select 1 from plots p
        where p.id = p_plot
          and (p.status = 'verified' or p.owner_id = auth.uid() or p.assigned_verifier_id = auth.uid()
               or public.verifier_covers(p.region)))
      or exists (select 1 from deals d where d.plot_id = p_plot and auth.uid() in (d.landowner_id, d.farmer_id, d.verifier_id))
$$;

create or replace function public.can_access_application(p_app uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from applications a join plots p on p.id = a.plot_id
                 where a.id = p_app and auth.uid() in (a.farmer_id, p.owner_id))
      or exists (select 1 from deals d where d.application_id = p_app and d.verifier_id = auth.uid())
$$;

create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid())
$$;

create or replace function public.is_group_leader(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid() and member_role = 'leader')
$$;

-- Internal: lets an RPC make changes that triggers would otherwise block for normal users.
create or replace function public._internal() returns void
language sql as $$ select set_config('farmlink.internal', 'on', true) $$;

create or replace function public._is_internal() returns boolean
language sql stable as $$ select coalesce(current_setting('farmlink.internal', true), '') = 'on' $$;

-- ---------- Notifications ----------
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link)
  select p_user, p_type, p_title, p_body, p_link where p_user is not null
$$;

create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from profiles where role = 'admin' and not is_suspended
$$;

-- ---------- Harvest split (FR8) ----------
-- Same rule as src/lib/harvestSplit.js:
-- deduction off the top to the input supplier, rest split by landowner %, rounding leftovers to the farmer.
create or replace function public.calculate_harvest_split(
  p_total numeric, p_landowner_percent numeric, p_deduction numeric default 0,
  p_deduction_to text default 'farmer', p_decimals int default 1)
returns table (landowner_share numeric, farmer_share numeric, deduction numeric, remaining numeric)
language plpgsql immutable as $$
declare
  scale numeric := power(10, p_decimals);
  total_u bigint; ded_u bigint; rem_u bigint; lo_u bigint; fa_u bigint;
begin
  if p_total is null or p_total < 0 then raise exception 'Total harvest must be zero or more'; end if;
  if p_landowner_percent is null or p_landowner_percent < 0 or p_landowner_percent > 100 then
    raise exception 'Landowner share must be between 0 and 100%%'; end if;
  if coalesce(p_deduction, 0) < 0 then raise exception 'Deduction must be zero or more'; end if;
  if coalesce(p_deduction, 0) > p_total then raise exception 'Deduction cannot be more than the total harvest'; end if;
  if p_deduction_to not in ('farmer', 'landowner') then raise exception 'Deduction must go to the farmer or the landowner'; end if;

  total_u := round(p_total * scale);
  ded_u := round(coalesce(p_deduction, 0) * scale);
  rem_u := total_u - ded_u;
  lo_u := floor(rem_u * p_landowner_percent / 100);
  fa_u := rem_u - lo_u;
  if p_deduction_to = 'landowner' then lo_u := lo_u + ded_u; else fa_u := fa_u + ded_u; end if;

  return query select lo_u / scale, fa_u / scale, ded_u / scale, rem_u / scale;
end $$;

-- ---------- Generic triggers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger profile_contacts_touch before update on public.profile_contacts for each row execute function public.touch_updated_at();
create trigger deals_touch before update on public.deals for each row execute function public.touch_updated_at();
create trigger disputes_touch before update on public.disputes for each row execute function public.touch_updated_at();

-- ---------- Accounts ----------
-- New Supabase Auth user → profile + contact row. Sign-up may only choose landowner, farmer or buyer.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  r public.user_role := case when meta ->> 'role' in ('landowner', 'farmer', 'buyer') then (meta ->> 'role')::public.user_role else 'farmer' end;
  grp boolean := coalesce((meta ->> 'is_group')::boolean, false) and r = 'farmer'
                 and nullif(trim(meta ->> 'group_name'), '') is not null and nullif(meta ->> 'group_size', '') is not null;
begin
  insert into profiles (id, role, full_name, region, district, is_group, group_name, group_size)
  values (
    new.id, r,
    coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    case when public.is_ghana_region(meta ->> 'region') then meta ->> 'region' end,
    nullif(trim(meta ->> 'district'), ''),
    grp,
    case when grp then trim(meta ->> 'group_name') end,
    case when grp then (meta ->> 'group_size')::int end);
  insert into profile_contacts (user_id, phone) values (new.id, nullif(trim(meta ->> 'phone'), ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Users edit their own profile, but only admins change role or suspension.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id then raise exception 'Profile id cannot change'; end if;
  if auth.uid() is not null and not public.is_admin() and not public._is_internal()
     and (new.role is distinct from old.role or new.is_suspended is distinct from old.is_suspended) then
    raise exception 'Only an administrator can change roles or suspend accounts';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- Phone number of another user, only for people with a reason to contact them.
create or replace function public.get_contact_phone(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select c.phone from profile_contacts c
  where c.user_id = p_user and (
    p_user = auth.uid() or public.is_admin()
    or exists (select 1 from deals d where (d.landowner_id = p_user and auth.uid() in (d.farmer_id, d.verifier_id))
                                         or (d.farmer_id = p_user and auth.uid() in (d.landowner_id, d.verifier_id)))
    or exists (select 1 from plots p where p.owner_id = p_user
                 and (p.assigned_verifier_id = auth.uid() or (p.status = 'pending' and public.verifier_covers(p.region)))))
$$;

-- A user asks to become a community verifier (or an extension officer registers). Admin approves later.
create or replace function public.request_verifier_role(p_type public.verifier_type, p_organisation text, p_regions text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if p_regions is null or cardinality(p_regions) = 0 then raise exception 'Choose at least one region'; end if;
  if exists (select 1 from unnest(p_regions) r where not public.is_ghana_region(r)) then raise exception 'Unknown region'; end if;
  insert into verifiers (id, verifier_type, organisation, regions, approved)
  values (auth.uid(), p_type, p_organisation, p_regions, false)
  on conflict (id) do update set verifier_type = excluded.verifier_type, organisation = excluded.organisation,
                                 regions = excluded.regions, approved = false, approved_by = null, approved_at = null;
  perform public.notify_admins('verifier_request', 'New verifier request',
    (select full_name from profiles where id = auth.uid()) || ' asked to become a verifier', '/admin/verifiers');
end $$;

-- ---------- Admin actions ----------
create or replace function public.approve_verifier(p_user uuid, p_approve boolean, p_regions text[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can approve verifiers'; end if;
  if not exists (select 1 from verifiers where id = p_user) then raise exception 'No verifier request for this user'; end if;
  perform public._internal();
  if p_approve then
    update verifiers set approved = true, approved_by = auth.uid(), approved_at = now(),
                         regions = coalesce(p_regions, regions) where id = p_user;
    update profiles set role = 'verifier' where id = p_user;
    perform public.notify(p_user, 'verifier_approved', 'You are now a verifier',
      'You can check plots and mediate disputes in your regions.', '/verify');
  else
    update verifiers set approved = false, approved_by = auth.uid(), approved_at = now() where id = p_user;
    update profiles set role = case when role = 'verifier' then 'farmer' else role end where id = p_user;
    perform public.notify(p_user, 'verifier_declined', 'Verifier request not approved', null, '/profile');
  end if;
end $$;

create or replace function public.set_user_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can change roles'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

create or replace function public.set_user_suspended(p_user uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can suspend accounts'; end if;
  if p_user = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  update profiles set is_suspended = p_suspended where id = p_user;
end $$;

-- ---------- Plots ----------
-- Least-busy approved verifier covering the region, or null (then admins handle it).
create or replace function public.pick_verifier(p_region text) returns uuid
language sql stable security definer set search_path = public as $$
  select v.id from verifiers v join profiles p on p.id = v.id
  where v.approved and p.role = 'verifier' and not p.is_suspended and p_region = any (v.regions)
  order by (select count(*) from plots pl where pl.assigned_verifier_id = v.id and pl.status = 'pending'), v.created_at
  limit 1
$$;

create or replace function public.plots_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if public.my_role() <> 'landowner' then raise exception 'Only landowners can list plots'; end if;
    new.owner_id := auth.uid();
    new.status := 'pending';
  end if;
  if new.status = 'pending' and new.assigned_verifier_id is null then
    new.assigned_verifier_id := public.pick_verifier(new.region);
  end if;
  return new;
end $$;
create trigger plots_before_insert before insert on public.plots for each row execute function public.plots_before_insert();

create or replace function public.plots_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    if new.assigned_verifier_id is not null then
      perform public.notify(new.assigned_verifier_id, 'plot_to_verify', 'New plot to check',
        new.title || ' in ' || new.region, '/verify/plots/' || new.id);
    else
      perform public.notify_admins('plot_to_verify', 'Plot needs a verifier',
        new.title || ' in ' || new.region || ' has no verifier for its region', '/admin/plots');
    end if;
  end if;
  return new;
end $$;
create trigger plots_after_insert after insert on public.plots for each row execute function public.plots_after_insert();

-- Owners can edit their listing, withdraw it or resubmit it. Changing size, location, soil or water
-- on a verified plot sends it back for verification. Other status changes go through RPCs.
create or replace function public.plots_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is null or public.is_admin() or public._is_internal() then return new; end if;

  if new.owner_id <> old.owner_id then raise exception 'Plot owner cannot be changed'; end if;
  new.assigned_verifier_id := old.assigned_verifier_id;

  if old.status = 'in_deal' and
     (new.size_acres, new.region, new.district, new.latitude, new.longitude, new.soil_type, new.water_access, new.status)
     is distinct from
     (old.size_acres, old.region, old.district, old.latitude, old.longitude, old.soil_type, old.water_access, old.status) then
    raise exception 'Plot details cannot change while a deal is running';
  end if;

  if new.status is distinct from old.status and not (
       (new.status = 'archived' and old.status in ('pending', 'verified', 'rejected'))
    or (new.status = 'pending' and old.status in ('archived', 'rejected'))) then
    raise exception 'You cannot change this plot from % to %', old.status, new.status;
  end if;

  if old.status = 'verified' and new.status = 'verified' and
     (new.size_acres, new.region, new.district, new.latitude, new.longitude, new.soil_type, new.water_access)
     is distinct from
     (old.size_acres, old.region, old.district, old.latitude, old.longitude, old.soil_type, old.water_access) then
    new.status := 'pending';
  end if;

  if new.status = 'pending' and old.status <> 'pending' then
    new.assigned_verifier_id := public.pick_verifier(new.region);
  end if;
  return new;
end $$;
create trigger plots_before_update before update on public.plots for each row execute function public.plots_before_update();

-- FR9: a verifier (or admin) approves or rejects a pending plot.
create or replace function public.verify_plot(
  p_plot uuid, p_approve boolean, p_checklist jsonb default '{}', p_notes text default null, p_visited_on date default null)
returns public.plots language plpgsql security definer set search_path = public as $$
declare pl public.plots;
begin
  select * into pl from plots where id = p_plot for update;
  if not found then raise exception 'Plot not found'; end if;
  if pl.status <> 'pending' then raise exception 'This plot is not waiting for verification'; end if;
  if not (public.is_admin() or public.verifier_covers(pl.region) or pl.assigned_verifier_id = auth.uid() and public.is_approved_verifier()) then
    raise exception 'You are not a verifier for this region';
  end if;
  if not p_approve and nullif(trim(p_notes), '') is null then raise exception 'Give a reason when rejecting a plot'; end if;

  insert into plot_verifications (plot_id, verifier_id, decision, checklist, notes, visited_on)
  values (p_plot, auth.uid(), case when p_approve then 'approved' else 'rejected' end, coalesce(p_checklist, '{}'), p_notes, p_visited_on);

  perform public._internal();
  update plots set status = case when p_approve then 'verified'::public.plot_status else 'rejected'::public.plot_status end,
                   assigned_verifier_id = coalesce(assigned_verifier_id, auth.uid())
  where id = p_plot returning * into pl;

  perform public.notify(pl.owner_id, case when p_approve then 'plot_verified' else 'plot_rejected' end,
    case when p_approve then 'Your plot is verified' else 'Your plot was not verified' end,
    case when p_approve then pl.title || ' is now visible to farmers.' else p_notes end,
    '/plots/' || pl.id);
  return pl;
end $$;

-- ---------- Applications (FR4) ----------
create or replace function public.applications_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl public.plots;
begin
  if auth.uid() is not null and not public.is_admin() then
    if public.my_role() <> 'farmer' then raise exception 'Only farmers and farmer groups can apply for plots'; end if;
    new.farmer_id := auth.uid();
  end if;
  select * into pl from plots where id = new.plot_id;
  if pl.status <> 'verified' then raise exception 'This plot is not open for applications'; end if;
  if pl.owner_id = new.farmer_id then raise exception 'You cannot apply for your own plot'; end if;
  new.status := 'pending';
  new.decided_at := null;
  return new;
end $$;
create trigger applications_before_insert before insert on public.applications for each row execute function public.applications_before_insert();

create or replace function public.applications_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl public.plots;
begin
  select * into pl from plots where id = new.plot_id;
  perform public.notify(pl.owner_id, 'application_new', 'New application',
    (select coalesce(group_name, full_name) from profiles where id = new.farmer_id) || ' applied for ' || pl.title,
    '/applications/' || new.id);
  return new;
end $$;
create trigger applications_after_insert after insert on public.applications for each row execute function public.applications_after_insert();

-- Landowner accepts (opens a deal, declines the other applicants) or declines an application.
create or replace function public.respond_to_application(p_application uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.applications; pl public.plots; d_id uuid; other record;
begin
  select * into a from applications where id = p_application for update;
  if not found then raise exception 'Application not found'; end if;
  select * into pl from plots where id = a.plot_id for update;
  if pl.owner_id <> auth.uid() and not public.is_admin() then raise exception 'Only the landowner can respond'; end if;
  if a.status <> 'pending' then raise exception 'This application has already been answered'; end if;

  perform public._internal();
  if not p_accept then
    update applications set status = 'declined', decided_at = now() where id = a.id;
    perform public.notify(a.farmer_id, 'application_declined', 'Application not accepted',
      'The landowner chose another applicant for ' || pl.title || '.', '/applications/' || a.id);
    return null;
  end if;

  if pl.status <> 'verified' then raise exception 'This plot is no longer available'; end if;
  update applications set status = 'accepted', decided_at = now() where id = a.id;
  insert into deals (plot_id, application_id, landowner_id, farmer_id, verifier_id)
  values (pl.id, a.id, pl.owner_id, a.farmer_id, pl.assigned_verifier_id) returning id into d_id;
  update plots set status = 'in_deal' where id = pl.id;

  for other in select id, farmer_id from applications where plot_id = pl.id and status = 'pending' loop
    update applications set status = 'declined', decided_at = now() where id = other.id;
    perform public.notify(other.farmer_id, 'application_declined', 'Application not accepted',
      'The landowner chose another applicant for ' || pl.title || '.', '/applications/' || other.id);
  end loop;

  perform public.notify(a.farmer_id, 'application_accepted', 'Application accepted',
    'Next step: agree the terms for ' || pl.title || '.', '/deals/' || d_id);
  return d_id;
end $$;

create or replace function public.withdraw_application(p_application uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update applications set status = 'withdrawn', decided_at = now()
  where id = p_application and farmer_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Only a pending application of yours can be withdrawn'; end if;
end $$;

-- ---------- Agreements (FR6) ----------
-- The agreement in force: latest version both parties confirmed.
create or replace function public.current_agreement(p_deal uuid) returns public.agreements
language sql stable security definer set search_path = public as $$
  select * from agreements
  where deal_id = p_deal and landowner_confirmed_at is not null and farmer_confirmed_at is not null
  order by version desc limit 1
$$;

-- Either party proposes terms. This makes a new version, confirmed by the proposer only.
create or replace function public.propose_agreement(
  p_deal uuid, p_crop text, p_start_date date, p_end_date date, p_landowner_percent numeric,
  p_harvest_unit text default 'bags', p_deduction_amount numeric default 0, p_deduction_to text default 'farmer',
  p_responsibilities jsonb default '{}', p_notes text default null)
returns public.agreements language plpgsql security definer set search_path = public as $$
declare d public.deals; ag public.agreements; is_landowner boolean;
begin
  select * into d from deals where id = p_deal for update;
  if not found then raise exception 'Deal not found'; end if;
  if auth.uid() not in (d.landowner_id, d.farmer_id) then raise exception 'Only the landowner or farmer can propose terms'; end if;
  if d.status not in ('drafting', 'active') then raise exception 'Terms can no longer be changed on this deal'; end if;
  is_landowner := auth.uid() = d.landowner_id;

  insert into agreements (deal_id, version, crop, start_date, end_date, landowner_percent, harvest_unit,
                          deduction_amount, deduction_to, responsibilities, notes, created_by,
                          landowner_confirmed_at, farmer_confirmed_at)
  values (p_deal, coalesce((select max(version) from agreements where deal_id = p_deal), 0) + 1,
          p_crop, p_start_date, p_end_date, p_landowner_percent, coalesce(nullif(trim(p_harvest_unit), ''), 'bags'),
          coalesce(p_deduction_amount, 0), coalesce(p_deduction_to, 'farmer'), coalesce(p_responsibilities, '{}'), p_notes, auth.uid(),
          case when is_landowner then now() end, case when not is_landowner then now() end)
  returning * into ag;

  perform public.notify(case when is_landowner then d.farmer_id else d.landowner_id end, 'agreement_proposed',
    'Agreement terms to review', 'Version ' || ag.version || ' is waiting for your confirmation.', '/deals/' || d.id || '?tab=agreement');
  return ag;
end $$;

create or replace function public.confirm_agreement(p_agreement uuid)
returns public.agreements language plpgsql security definer set search_path = public as $$
declare ag public.agreements; d public.deals;
begin
  select * into ag from agreements where id = p_agreement for update;
  if not found then raise exception 'Agreement not found'; end if;
  select * into d from deals where id = ag.deal_id for update;
  if auth.uid() not in (d.landowner_id, d.farmer_id) then raise exception 'Only the landowner or farmer can confirm'; end if;
  if ag.version <> (select max(version) from agreements where deal_id = ag.deal_id) then
    raise exception 'A newer version exists. Please review the latest terms';
  end if;

  update agreements set
    landowner_confirmed_at = case when auth.uid() = d.landowner_id then coalesce(landowner_confirmed_at, now()) else landowner_confirmed_at end,
    farmer_confirmed_at = case when auth.uid() = d.farmer_id then coalesce(farmer_confirmed_at, now()) else farmer_confirmed_at end
  where id = ag.id returning * into ag;

  if ag.landowner_confirmed_at is not null and ag.farmer_confirmed_at is not null then
    if d.status = 'drafting' then
      update deals set status = 'active', started_at = now() where id = d.id;
    end if;
    perform public.notify(d.landowner_id, 'agreement_confirmed', 'Agreement confirmed by both parties', 'Version ' || ag.version || ' is now in force.', '/deals/' || d.id);
    perform public.notify(d.farmer_id, 'agreement_confirmed', 'Agreement confirmed by both parties', 'Version ' || ag.version || ' is now in force.', '/deals/' || d.id);
  end if;
  return ag;
end $$;

-- Either party can cancel before the first agreement is confirmed. The plot becomes available again.
create or replace function public.cancel_deal(p_deal uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = p_deal for update;
  if not found then raise exception 'Deal not found'; end if;
  if auth.uid() not in (d.landowner_id, d.farmer_id) and not public.is_admin() then raise exception 'Not your deal'; end if;
  if d.status <> 'drafting' then raise exception 'Only a deal that has not started can be cancelled'; end if;
  perform public._internal();
  update deals set status = 'cancelled' where id = d.id;
  update plots set status = 'verified' where id = d.plot_id and status = 'in_deal';
  perform public.notify(case when auth.uid() = d.landowner_id then d.farmer_id else d.landowner_id end,
    'deal_cancelled', 'Deal cancelled', 'The other party cancelled before the agreement was confirmed.', '/deals/' || d.id);
end $$;

-- ---------- Season (FR7) ----------
create or replace function public.milestones_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = new.deal_id;
  if auth.uid() is not null and not public.is_admin() then
    if auth.uid() <> d.farmer_id then raise exception 'Only the farmer posts season updates'; end if;
    new.posted_by := auth.uid();
  end if;
  if d.status <> 'active' then raise exception 'Season updates start once the agreement is confirmed'; end if;
  return new;
end $$;
create trigger milestones_before_insert before insert on public.season_milestones for each row execute function public.milestones_before_insert();

create or replace function public.milestones_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = new.deal_id;
  perform public.notify(d.landowner_id, 'milestone', 'Season update: ' || initcap(new.milestone::text),
    coalesce(new.note, 'The farmer posted a new update.'), '/deals/' || d.id || '?tab=season');
  return new;
end $$;
create trigger milestones_after_insert after insert on public.season_milestones for each row execute function public.milestones_after_insert();

-- ---------- Harvest (FR8) ----------
create or replace function public.record_harvest(
  p_deal uuid, p_total numeric, p_sale_price_per_unit numeric default null, p_notes text default null, p_photo_path text default null)
returns public.harvest_records language plpgsql security definer set search_path = public as $$
declare d public.deals; ag public.agreements; s record; hr public.harvest_records;
begin
  select * into d from deals where id = p_deal for update;
  if not found then raise exception 'Deal not found'; end if;
  if auth.uid() <> d.farmer_id and not public.is_admin() then raise exception 'Only the farmer records the harvest'; end if;
  if d.status <> 'active' then raise exception 'The harvest can be recorded once, on an active deal'; end if;
  ag := public.current_agreement(p_deal);
  if ag.id is null then raise exception 'There is no confirmed agreement for this deal'; end if;

  select * into s from public.calculate_harvest_split(p_total, ag.landowner_percent, least(ag.deduction_amount, p_total), ag.deduction_to);

  insert into harvest_records (deal_id, agreement_id, total_quantity, unit, deduction_applied, landowner_share, farmer_share,
                               sale_price_per_unit, landowner_value, farmer_value, photo_path, notes, recorded_by)
  values (p_deal, ag.id, p_total, ag.harvest_unit, s.deduction, s.landowner_share, s.farmer_share, p_sale_price_per_unit,
          round(s.landowner_share * p_sale_price_per_unit, 2), round(s.farmer_share * p_sale_price_per_unit, 2),
          p_photo_path, p_notes, auth.uid())
  returning * into hr;

  update deals set status = 'harvested' where id = d.id;
  perform public.notify(d.landowner_id, 'harvest_recorded', 'Harvest recorded',
    'Your share: ' || s.landowner_share || ' ' || ag.harvest_unit || '.', '/deals/' || d.id || '?tab=harvest');
  return hr;
end $$;

-- Landowner confirms they received their share. The plot is listed again.
create or replace function public.complete_deal(p_deal uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = p_deal for update;
  if not found then raise exception 'Deal not found'; end if;
  if auth.uid() <> d.landowner_id and not public.is_admin() then raise exception 'Only the landowner can close the season'; end if;
  if d.status <> 'harvested' then raise exception 'Record the harvest before completing the deal'; end if;
  perform public._internal();
  update deals set status = 'completed', completed_at = now() where id = d.id;
  update plots set status = 'verified' where id = d.plot_id and status = 'in_deal';
  perform public.notify(d.farmer_id, 'deal_completed', 'Season completed', 'The landowner confirmed the harvest share. You can now rate each other.', '/deals/' || d.id);
end $$;

-- ---------- Chat (FR5) ----------
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.sender_id := auth.uid(); end if;
  new.read_at := null;
  if new.is_notice and not (public.is_group_leader(new.group_id) or public.is_admin()) then
    -- members can post notices too, but only leaders can pin them
    new.pinned := false;
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.applications; owner uuid; recipient uuid;
begin
  if new.application_id is null then return new; end if;
  select * into a from applications where id = new.application_id;
  select owner_id into owner from plots where id = a.plot_id;
  recipient := case when new.sender_id = a.farmer_id then owner else a.farmer_id end;
  -- one unread "new message" notification per thread is enough
  if not exists (select 1 from notifications where user_id = recipient and type = 'message' and read_at is null
                   and link = '/messages/' || new.application_id) then
    perform public.notify(recipient, 'message', 'New message',
      (select full_name from profiles where id = new.sender_id) || ': ' || left(new.body, 80), '/messages/' || new.application_id);
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

create or replace function public.mark_thread_read(p_application uuid)
returns void language sql security definer set search_path = public as $$
  update messages set read_at = now()
  where application_id = p_application and sender_id <> auth.uid() and read_at is null
    and public.can_access_application(p_application);
  update notifications set read_at = now()
  where user_id = auth.uid() and type = 'message' and link = '/messages/' || p_application and read_at is null;
$$;

-- ---------- Disputes (FR9) ----------
create or replace function public.disputes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = new.deal_id;
  if auth.uid() is not null and not public.is_admin() then
    if auth.uid() not in (d.landowner_id, d.farmer_id) then raise exception 'Only the landowner or farmer can raise a dispute'; end if;
    new.raised_by := auth.uid();
  end if;
  if d.status in ('cancelled') then raise exception 'This deal was cancelled'; end if;
  new.status := 'open';
  new.verifier_id := coalesce(d.verifier_id, public.pick_verifier((select region from plots where id = d.plot_id)));
  new.resolution := null; new.proposed_resolution := null; new.resolved_at := null;
  return new;
end $$;
create trigger disputes_before_insert before insert on public.disputes for each row execute function public.disputes_before_insert();

create or replace function public.disputes_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = new.deal_id;
  perform public.notify(case when new.raised_by = d.landowner_id then d.farmer_id else d.landowner_id end,
    'dispute_opened', 'A dispute was raised', left(new.description, 120), '/deals/' || d.id || '?tab=dispute');
  if new.verifier_id is not null then
    perform public.notify(new.verifier_id, 'dispute_assigned', 'Dispute to mediate', left(new.description, 120), '/verify/disputes/' || new.id);
  else
    perform public.notify_admins('dispute_assigned', 'Dispute needs a mediator', left(new.description, 120), '/admin/disputes');
  end if;
  return new;
end $$;
create trigger disputes_after_insert after insert on public.disputes for each row execute function public.disputes_after_insert();

-- The verifier (or an admin) moves a dispute forward and records the outcome.
create or replace function public.update_dispute(
  p_dispute uuid, p_status public.dispute_status, p_proposed_resolution text default null, p_resolution text default null)
returns public.disputes language plpgsql security definer set search_path = public as $$
declare ds public.disputes; d public.deals;
begin
  select * into ds from disputes where id = p_dispute for update;
  if not found then raise exception 'Dispute not found'; end if;
  if not (public.is_admin() or (ds.verifier_id = auth.uid() and public.is_approved_verifier())) then
    raise exception 'Only the assigned verifier or an administrator can update this dispute';
  end if;
  if p_status in ('resolved', 'closed') and nullif(trim(coalesce(p_resolution, ds.resolution)), '') is null then
    raise exception 'Record the outcome before resolving the dispute';
  end if;
  update disputes set status = p_status,
                      proposed_resolution = coalesce(p_proposed_resolution, proposed_resolution),
                      resolution = coalesce(p_resolution, resolution),
                      resolved_at = case when p_status in ('resolved', 'closed') then now() end,
                      verifier_id = coalesce(verifier_id, auth.uid())
  where id = ds.id returning * into ds;
  select * into d from deals where id = ds.deal_id;
  perform public.notify(d.landowner_id, 'dispute_updated', 'Dispute ' || replace(p_status::text, '_', ' '), coalesce(p_resolution, p_proposed_resolution), '/deals/' || d.id || '?tab=dispute');
  perform public.notify(d.farmer_id, 'dispute_updated', 'Dispute ' || replace(p_status::text, '_', ' '), coalesce(p_resolution, p_proposed_resolution), '/deals/' || d.id || '?tab=dispute');
  return ds;
end $$;

-- ---------- Notifications (FR10) ----------
create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

-- ---------- Extended: groups (FR12) ----------
create or replace function public.groups_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_members (group_id, user_id, member_role) values (new.id, new.created_by, 'leader')
  on conflict do nothing;
  return new;
end $$;
create trigger groups_after_insert after insert on public.groups for each row execute function public.groups_after_insert();

create or replace function public.groups_before_insert() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger groups_before_insert before insert on public.groups for each row execute function public.groups_before_insert();

-- ---------- Extended: sessions (FR13, FR14) ----------
create or replace function public.registrations_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from sessions where id = new.session_id;
  if s.starts_at + make_interval(mins => s.duration_minutes) < now() then raise exception 'This session has ended'; end if;
  if (select count(*) from session_registrations where session_id = s.id) >= s.capacity then raise exception 'This session is full'; end if;
  new.attended_at := null;
  return new;
end $$;
create trigger registrations_before_insert before insert on public.session_registrations for each row execute function public.registrations_before_insert();

-- Called when a registered user clicks "Join". Records attendance and returns the Jitsi room URL.
create or replace function public.join_session(p_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from sessions where id = p_session;
  if not found then raise exception 'Session not found'; end if;
  if now() < s.starts_at - interval '15 minutes' then raise exception 'You can join 15 minutes before the start'; end if;
  if now() > s.starts_at + make_interval(mins => s.duration_minutes + 30) then raise exception 'This session has ended'; end if;
  if s.host_id <> auth.uid() then
    update session_registrations set attended_at = coalesce(attended_at, now()) where session_id = s.id and user_id = auth.uid();
    if not found then raise exception 'Register for this session first'; end if;
  end if;
  return 'https://meet.jit.si/' || s.meeting_room;
end $$;

-- ---------- Extended: marketplace (FR15, FR16) ----------
create or replace function public.offers_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare l public.produce_listings;
begin
  select * into l from produce_listings where id = new.listing_id;
  if l.status <> 'open' then raise exception 'This listing is no longer open'; end if;
  if auth.uid() is not null and not public.is_admin() then
    if public.my_role() <> 'buyer' then raise exception 'Only buyers can make offers'; end if;
    new.buyer_id := auth.uid();
  end if;
  if new.quantity > l.quantity then raise exception 'Offer is for more than is listed'; end if;
  new.status := 'pending'; new.responded_at := null;
  return new;
end $$;
create trigger offers_before_insert before insert on public.offers for each row execute function public.offers_before_insert();

create or replace function public.offers_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare l public.produce_listings;
begin
  select * into l from produce_listings where id = new.listing_id;
  perform public.notify(l.seller_id, 'offer_new', 'New offer for your ' || l.crop,
    new.quantity || ' ' || l.unit || ' at GH₵ ' || new.price_per_unit || ' each', '/market/listings/' || l.id);
  return new;
end $$;
create trigger offers_after_insert after insert on public.offers for each row execute function public.offers_after_insert();

create or replace function public.respond_to_offer(p_offer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o public.offers; l public.produce_listings; other record;
begin
  select * into o from offers where id = p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into l from produce_listings where id = o.listing_id for update;
  if l.seller_id <> auth.uid() and not public.is_admin() then raise exception 'Only the seller can respond'; end if;
  if o.status <> 'pending' then raise exception 'This offer has already been answered'; end if;

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

-- ---------- Extended: ratings (FR17) ----------
create or replace function public.ratings_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from deals where id = new.deal_id;
  if auth.uid() is not null then new.rater_id := auth.uid(); end if;
  if d.status <> 'completed' then raise exception 'You can rate once the season is completed'; end if;
  if new.rater_id not in (d.landowner_id, d.farmer_id) then raise exception 'Only the two parties can rate each other'; end if;
  new.ratee_id := case when new.rater_id = d.landowner_id then d.farmer_id else d.landowner_id end;
  return new;
end $$;
create trigger ratings_before_insert before insert on public.ratings for each row execute function public.ratings_before_insert();

-- Public profile summary: completed seasons, sessions attended, average rating.
create or replace function public.profile_stats(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'completed_seasons', (select count(*) from deals where status = 'completed' and p_user in (landowner_id, farmer_id)),
    'sessions_attended', (select count(*) from session_registrations where user_id = p_user and attended_at is not null),
    'rating_average', (select round(avg(score)::numeric, 1) from ratings where ratee_id = p_user),
    'rating_count', (select count(*) from ratings where ratee_id = p_user),
    'verified_plots', (select count(*) from plots where owner_id = p_user and status in ('verified', 'in_deal')))
$$;

-- ---------- Admin reports (FR11) ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrators only'; end if;
  return jsonb_build_object(
    'users_by_role', (select coalesce(jsonb_object_agg(role, n), '{}') from (select role, count(*) n from profiles group by role) x),
    'plots_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from plots group by status) x),
    'deals_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from deals group by status) x),
    'disputes_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from disputes group by status) x),
    'plots_by_region', (select coalesce(jsonb_object_agg(region, n), '{}') from (select region, count(*) n from plots group by region) x),
    'deals_per_month', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', n) order by m), '[]')
                        from (select to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) n
                              from deals where created_at > now() - interval '12 months' group by 1) x),
    'pending_verifier_requests', (select count(*) from verifiers where not approved and approved_at is null),
    'harvest_totals', (select coalesce(jsonb_object_agg(unit, total), '{}') from (select unit, sum(total_quantity) total from harvest_records group by unit) x)
  );
end $$;

-- Internal helpers are not for clients. Supabase grants EXECUTE on new functions to anon and
-- authenticated directly, so revoke from those roles as well as PUBLIC.
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;
revoke execute on function public._internal() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
