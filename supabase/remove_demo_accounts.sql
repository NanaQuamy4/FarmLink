-- Removes the 10 demo accounts (emails ending in @farmlink.test) and everything they created:
-- plots, deals, chats, groups, sessions, listings, notifications and support requests.
-- Other accounts are kept. Run once in the Supabase SQL editor.
--
-- BEFORE RUNNING: the admin account below must already exist (sign up on the site first).
-- That account becomes the administrator. If the email is not found, nothing is deleted.

do $$
declare
  admin_email text := 'willstudios.design@gmail.com';   -- this account becomes the administrator
  new_admin uuid;
begin
  select id into new_admin from auth.users where lower(email) = lower(trim(admin_email));
  if new_admin is null then
    raise exception 'No account with the email %. Sign up on the site first, then put that email at the top of this script.', admin_email;
  end if;
  if admin_email ilike '%@farmlink.test' then
    raise exception 'Choose your own account, not a demo account';
  end if;

  create temp table demo on commit drop as select id from auth.users where email ilike '%@farmlink.test';
  create temp table demo_deals on commit drop as
    select id, application_id from public.deals
    where landowner_id in (select id from demo) or farmer_id in (select id from demo) or verifier_id in (select id from demo)
       or plot_id in (select id from public.plots where owner_id in (select id from demo));
  create temp table demo_sessions on commit drop as select id from public.sessions where host_id in (select id from demo);
  create temp table demo_groups on commit drop as select id from public.groups where created_by in (select id from demo);

  -- notifications and support
  delete from public.notifications where user_id in (select id from demo);
  delete from public.support_messages where sender_id in (select id from demo);
  delete from public.support_tickets where user_id in (select id from demo);

  -- sessions
  delete from public.session_feedback where user_id in (select id from demo) or session_id in (select id from demo_sessions);
  delete from public.session_question_votes where user_id in (select id from demo)
    or question_id in (select id from public.session_questions where session_id in (select id from demo_sessions));
  delete from public.session_questions where user_id in (select id from demo) or session_id in (select id from demo_sessions);
  delete from public.session_resources where added_by in (select id from demo) or session_id in (select id from demo_sessions);
  delete from public.session_registrations where user_id in (select id from demo) or session_id in (select id from demo_sessions);
  delete from public.sessions where id in (select id from demo_sessions);

  -- marketplace and ratings
  delete from public.ratings where rater_id in (select id from demo) or ratee_id in (select id from demo) or deal_id in (select id from demo_deals);
  delete from public.offers where buyer_id in (select id from demo)
    or listing_id in (select id from public.produce_listings where seller_id in (select id from demo));
  delete from public.produce_listings where seller_id in (select id from demo) or deal_id in (select id from demo_deals);

  -- chats and groups
  delete from public.messages where sender_id in (select id from demo) or group_id in (select id from demo_groups)
    or application_id in (select a.id from public.applications a join public.plots p on p.id = a.plot_id
                          where a.farmer_id in (select id from demo) or p.owner_id in (select id from demo));
  delete from public.group_members where user_id in (select id from demo) or group_id in (select id from demo_groups);
  delete from public.groups where id in (select id from demo_groups);

  -- deals and everything inside them
  delete from public.disputes where deal_id in (select id from demo_deals) or raised_by in (select id from demo);
  update public.disputes set verifier_id = null where verifier_id in (select id from demo);
  delete from public.harvest_records where deal_id in (select id from demo_deals);
  delete from public.season_milestones where deal_id in (select id from demo_deals);
  delete from public.agreements where deal_id in (select id from demo_deals);
  delete from public.deals where id in (select id from demo_deals);

  -- applications and plots
  delete from public.applications where farmer_id in (select id from demo)
    or plot_id in (select id from public.plots where owner_id in (select id from demo));
  delete from public.plot_verifications where verifier_id in (select id from demo)
    or plot_id in (select id from public.plots where owner_id in (select id from demo));
  delete from public.plot_photos where uploaded_by in (select id from demo)
    or plot_id in (select id from public.plots where owner_id in (select id from demo));
  delete from public.plots where owner_id in (select id from demo);

  -- verifiers
  update public.verifiers set approved_by = null where approved_by in (select id from demo);
  delete from public.verifiers where id in (select id from demo);

  -- the accounts themselves (profiles and contact details go with them)
  delete from auth.users where id in (select id from demo);

  -- the new administrator
  perform set_config('farmlink.internal', 'on', true);
  update public.profiles set role = 'admin', is_suspended = false where id = new_admin;
  raise notice 'Done. % is now the administrator.', admin_email;
end $$;

-- Leftover demo photos in Storage (plot-photos, milestone-photos) can be deleted from the
-- Supabase dashboard under Storage. Demo images that ship with the site are not affected.
