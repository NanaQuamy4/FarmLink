-- FarmLink Row Level Security. Every table has RLS on; anonymous users see nothing.
-- Writes that change a status (verify, accept, confirm, record harvest, resolve...) have no
-- direct UPDATE policy: they go through the RPCs in 0002, which check the caller.

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.verifiers enable row level security;
alter table public.plots enable row level security;
alter table public.plot_photos enable row level security;
alter table public.plot_verifications enable row level security;
alter table public.applications enable row level security;
alter table public.deals enable row level security;
alter table public.agreements enable row level security;
alter table public.season_milestones enable row level security;
alter table public.harvest_records enable row level security;
alter table public.messages enable row level security;
alter table public.disputes enable row level security;
alter table public.notifications enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_registrations enable row level security;
alter table public.produce_listings enable row level security;
alter table public.offers enable row level security;
alter table public.ratings enable row level security;

-- ---------- profiles ----------
-- Names, roles, regions and group details are public to signed-in users (needed for listings,
-- public profiles and chat). Phone numbers live in profile_contacts.
create policy "profiles: signed-in users can read" on public.profiles for select to authenticated using (true);
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "contacts: read own or admin" on public.profile_contacts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "contacts: update own" on public.profile_contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- verifiers ----------
create policy "verifiers: signed-in users can read approved, self, admin" on public.verifiers for select to authenticated
  using (approved or id = auth.uid() or public.is_admin());
-- requests go through request_verifier_role(); approvals through approve_verifier()

-- ---------- plots ----------
-- owner_id is checked directly so a just-inserted row can be returned to its owner
create policy "plots: read verified, own, assigned, region verifier, deal party, admin" on public.plots for select to authenticated
  using (owner_id = auth.uid() or status = 'verified' or public.can_view_plot(id));
create policy "plots: landowners create" on public.plots for insert to authenticated
  with check (owner_id = auth.uid() and public.my_role() in ('landowner', 'admin'));
create policy "plots: owner edits" on public.plots for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "plots: owner deletes unless a deal exists" on public.plots for delete to authenticated
  using ((owner_id = auth.uid() or public.is_admin()) and not exists (select 1 from public.deals d where d.plot_id = plots.id));

create policy "plot_photos: read with plot" on public.plot_photos for select to authenticated
  using (public.can_view_plot(plot_id)
         and (not is_document or exists (select 1 from public.plots p where p.id = plot_id
                                           and (p.owner_id = auth.uid() or p.assigned_verifier_id = auth.uid() or public.verifier_covers(p.region)))
              or public.is_admin()));
create policy "plot_photos: owner adds" on public.plot_photos for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from public.plots p where p.id = plot_id and p.owner_id = auth.uid()));
create policy "plot_photos: owner updates" on public.plot_photos for update to authenticated
  using (exists (select 1 from public.plots p where p.id = plot_id and p.owner_id = auth.uid()));
create policy "plot_photos: owner deletes" on public.plot_photos for delete to authenticated
  using (exists (select 1 from public.plots p where p.id = plot_id and p.owner_id = auth.uid()) or public.is_admin());

create policy "plot_verifications: owner, verifiers, admin read" on public.plot_verifications for select to authenticated
  using (public.is_admin() or verifier_id = auth.uid()
         or exists (select 1 from public.plots p where p.id = plot_id and (p.owner_id = auth.uid() or public.verifier_covers(p.region))));

-- ---------- applications ----------
create policy "applications: farmer and landowner read" on public.applications for select to authenticated
  using (farmer_id = auth.uid() or public.can_access_application(id));
create policy "applications: farmers apply" on public.applications for insert to authenticated
  with check (farmer_id = auth.uid());

-- ---------- deals and everything inside a deal ----------
create policy "deals: parties, verifier, admin read" on public.deals for select to authenticated
  using (public.can_view_deal(id));

create policy "agreements: deal viewers read" on public.agreements for select to authenticated
  using (public.can_view_deal(deal_id));

create policy "milestones: deal viewers read" on public.season_milestones for select to authenticated
  using (public.can_view_deal(deal_id));
create policy "milestones: farmer posts" on public.season_milestones for insert to authenticated
  with check (posted_by = auth.uid() and exists (select 1 from public.deals d where d.id = deal_id and d.farmer_id = auth.uid()));

create policy "harvest: deal viewers read" on public.harvest_records for select to authenticated
  using (public.can_view_deal(deal_id));

create policy "disputes: deal viewers read" on public.disputes for select to authenticated
  using (public.can_view_deal(deal_id) or verifier_id = auth.uid());
create policy "disputes: parties raise" on public.disputes for insert to authenticated
  with check (raised_by = auth.uid() and public.is_deal_party(deal_id));

-- ---------- messages ----------
create policy "messages: thread members read" on public.messages for select to authenticated
  using ((application_id is not null and public.can_access_application(application_id))
         or (group_id is not null and (public.is_group_member(group_id) or public.is_admin())));
create policy "messages: thread members send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (
    (application_id is not null and exists (
       select 1 from public.applications a join public.plots p on p.id = a.plot_id
       where a.id = application_id and auth.uid() in (a.farmer_id, p.owner_id)
         and a.status in ('pending', 'accepted')))
    or (group_id is not null and public.is_group_member(group_id))));
create policy "messages: leaders pin, senders edit notices" on public.messages for update to authenticated
  using (group_id is not null and (sender_id = auth.uid() or public.is_group_leader(group_id) or public.is_admin()));
create policy "messages: senders and leaders delete group posts" on public.messages for delete to authenticated
  using (group_id is not null and (sender_id = auth.uid() or public.is_group_leader(group_id) or public.is_admin()));

-- ---------- notifications ----------
create policy "notifications: read own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: mark own read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------- groups ----------
create policy "groups: signed-in users read" on public.groups for select to authenticated using (true);
create policy "groups: signed-in users create" on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy "groups: leaders edit" on public.groups for update to authenticated using (public.is_group_leader(id) or public.is_admin());
create policy "groups: leaders delete" on public.groups for delete to authenticated using (public.is_group_leader(id) or public.is_admin());

create policy "group_members: signed-in users read" on public.group_members for select to authenticated using (true);
create policy "group_members: join self" on public.group_members for insert to authenticated
  with check (user_id = auth.uid() and member_role = 'member');
create policy "group_members: leave self or leader removes" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_leader(group_id) or public.is_admin());
create policy "group_members: leaders promote" on public.group_members for update to authenticated
  using (public.is_group_leader(group_id) or public.is_admin());

-- ---------- sessions ----------
create policy "sessions: signed-in users read" on public.sessions for select to authenticated using (true);
create policy "sessions: verifiers and admins host" on public.sessions for insert to authenticated
  with check (host_id = auth.uid() and (public.is_approved_verifier() or public.is_admin()));
create policy "sessions: host edits" on public.sessions for update to authenticated using (host_id = auth.uid() or public.is_admin());
create policy "sessions: host deletes" on public.sessions for delete to authenticated using (host_id = auth.uid() or public.is_admin());

create policy "registrations: own, host, admin read" on public.session_registrations for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.sessions s where s.id = session_id and s.host_id = auth.uid()));
create policy "registrations: register self" on public.session_registrations for insert to authenticated with check (user_id = auth.uid());
create policy "registrations: cancel own" on public.session_registrations for delete to authenticated using (user_id = auth.uid());

-- ---------- marketplace ----------
create policy "listings: signed-in users read" on public.produce_listings for select to authenticated using (true);
create policy "listings: farmers and landowners create" on public.produce_listings for insert to authenticated
  with check (seller_id = auth.uid() and public.my_role() in ('farmer', 'landowner'));
create policy "listings: seller edits" on public.produce_listings for update to authenticated
  using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
create policy "listings: seller deletes" on public.produce_listings for delete to authenticated using (seller_id = auth.uid() or public.is_admin());

create policy "offers: buyer and seller read" on public.offers for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.produce_listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "offers: buyers offer" on public.offers for insert to authenticated with check (buyer_id = auth.uid());
create policy "offers: buyer withdraws" on public.offers for update to authenticated
  using (buyer_id = auth.uid() and status = 'pending') with check (buyer_id = auth.uid() and status = 'withdrawn');

-- ---------- ratings ----------
create policy "ratings: signed-in users read" on public.ratings for select to authenticated using (true);
create policy "ratings: deal parties rate" on public.ratings for insert to authenticated
  with check (rater_id = auth.uid() and public.is_deal_party(deal_id));
