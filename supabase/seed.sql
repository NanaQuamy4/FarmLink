-- FarmLink demo data. Run once in the Supabase SQL editor after migrations 0001-0004.
--
-- Every account's password is:  FarmLink#2026
--
--   admin@farmlink.test      Administrator
--   officer@farmlink.test    Abena Mensah, extension officer (Bono East, Bono, Ashanti)
--   community@farmlink.test  Kofi Agbeko, community verifier (Volta, Eastern)
--   ama@farmlink.test        Ama Owusu, landowner (Bono East)
--   yaw@farmlink.test        Yaw Boateng, landowner (Volta)
--   kwame@farmlink.test      Kwame Asante, farmer (Bono East)
--   group@farmlink.test      Esi Adjei for Nkoranza Youth Farmers, farmer group
--   efua@farmlink.test       Efua Mensah, farmer (Volta)
--   buyer@farmlink.test      Akosua Darko, buyer
--   samuel@farmlink.test     Samuel Tetteh, farmer who asked to become a verifier
--
-- The story is acted out through the same RPCs the app calls (signing in as each user with
-- request.jwt.claims), so the seed also exercises the business rules.

do $$
declare
  pw text := crypt('FarmLink#2026', gen_salt('bf'));
  u_admin uuid := gen_random_uuid(); u_officer uuid := gen_random_uuid(); u_comm uuid := gen_random_uuid();
  u_ama uuid := gen_random_uuid(); u_yaw uuid := gen_random_uuid(); u_kwame uuid := gen_random_uuid();
  u_group uuid := gen_random_uuid(); u_efua uuid := gen_random_uuid(); u_buyer uuid := gen_random_uuid();
  u_samuel uuid := gen_random_uuid();
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  a1 uuid; a2 uuid; a3 uuid; d1 uuid; d2 uuid; ag uuid;
  g1 uuid; g2 uuid; s_past uuid; s1 uuid; s2 uuid; s3 uuid; l1 uuid; l2 uuid; o1 uuid;
  rec record;
begin
  -- ---------- Accounts ----------
  for rec in select * from (values
    (u_admin, 'admin@farmlink.test', '{"full_name":"FarmLink Admin","role":"farmer","phone":"0200000001"}'),
    (u_officer, 'officer@farmlink.test', '{"full_name":"Abena Mensah","role":"farmer","region":"Bono East","district":"Techiman","phone":"0244000002"}'),
    (u_comm, 'community@farmlink.test', '{"full_name":"Kofi Agbeko","role":"farmer","region":"Volta","district":"Ho","phone":"0244000003"}'),
    (u_ama, 'ama@farmlink.test', '{"full_name":"Ama Owusu","role":"landowner","region":"Bono East","district":"Techiman","phone":"0244000004"}'),
    (u_yaw, 'yaw@farmlink.test', '{"full_name":"Yaw Boateng","role":"landowner","region":"Volta","district":"Ho","phone":"0244000005"}'),
    (u_kwame, 'kwame@farmlink.test', '{"full_name":"Kwame Asante","role":"farmer","region":"Bono East","district":"Techiman","phone":"0244000006"}'),
    (u_group, 'group@farmlink.test', '{"full_name":"Esi Adjei","role":"farmer","region":"Bono East","district":"Nkoranza","phone":"0244000007","is_group":true,"group_name":"Nkoranza Youth Farmers","group_size":6}'),
    (u_efua, 'efua@farmlink.test', '{"full_name":"Efua Mensah","role":"farmer","region":"Volta","district":"Ho","phone":"0244000008"}'),
    (u_buyer, 'buyer@farmlink.test', '{"full_name":"Akosua Darko","role":"buyer","region":"Ashanti","district":"Kumasi","phone":"0244000009"}'),
    (u_samuel, 'samuel@farmlink.test', '{"full_name":"Samuel Tetteh","role":"farmer","region":"Central","district":"Cape Coast","phone":"0244000010"}')
  ) as t(id, email, meta) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', rec.id, 'authenticated', 'authenticated', rec.email, pw, now(),
            '{"provider":"email","providers":["email"]}', rec.meta::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), rec.id, rec.id::text,
            jsonb_build_object('sub', rec.id::text, 'email', rec.email, 'email_verified', true), 'email', now(), now(), now());
  end loop;

  -- Roles that sign-up cannot choose (seed runs without a signed-in user, so the guards allow it)
  update profiles set role = 'admin' where id = u_admin;
  update profile_contacts set phone_verified_at = now() where user_id in (u_ama, u_yaw);
  insert into verifiers (id, verifier_type, organisation, regions, approved, approved_by, approved_at) values
    (u_officer, 'extension_officer', 'Techiman Municipal Agriculture Office', array['Bono East','Bono','Ashanti'], true, u_admin, now()),
    (u_comm, 'community', 'Ho Farmers Association', array['Volta','Eastern'], true, u_admin, now());
  update profiles set role = 'verifier' where id in (u_officer, u_comm);
  update profiles set bio = 'Third-generation landowner in Techiman. Looking for serious young farmers.' where id = u_ama;
  update profiles set bio = 'Maize and cowpea farmer, four seasons of experience.' where id = u_kwame;

  -- ---------- Plots (as the landowners) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_ama, 'role', 'authenticated')::text, true);
  insert into plots (owner_id, title, description, region, district, community, size_acres, soil_type, water_access, suitable_crops, latitude, longitude, available_from, min_duration_months)
  values (u_ama, 'Techiman roadside maize plot', 'Flat, cleared last year. Five minutes from the main road for easy transport.', 'Bono East', 'Techiman', 'Tanoso', 2.5, 'Loamy', 'Stream nearby', array['Maize','Cowpea','Groundnut'], 7.5862, -1.9381, current_date - 200, 6)
  returning id into p1;
  insert into plots (owner_id, title, description, region, district, community, size_acres, soil_type, water_access, suitable_crops, latitude, longitude, available_from, min_duration_months)
  values (u_ama, 'Tuobodom valley plot', 'Low-lying land that holds moisture well into the dry season.', 'Bono East', 'Techiman North', 'Tuobodom', 4, 'Sandy loam', 'Borehole', array['Maize','Vegetables','Cassava'], 7.6610, -1.9905, current_date, 12)
  returning id into p2;
  insert into plots (owner_id, title, description, region, district, community, size_acres, soil_type, water_access, suitable_crops, latitude, longitude, available_from, min_duration_months)
  values (u_ama, 'Kintampo hillside plot', 'Gentle slope with good drainage. Some tree stumps to clear.', 'Bono East', 'Kintampo North', 'Babatorkuma', 6, 'Clay loam', 'Rain-fed only', array['Cassava','Yam'], 8.0569, -1.7302, current_date + 30, 12)
  returning id into p3;

  perform set_config('request.jwt.claims', json_build_object('sub', u_yaw, 'role', 'authenticated')::text, true);
  insert into plots (owner_id, title, description, region, district, community, size_acres, soil_type, water_access, suitable_crops, latitude, longitude, available_from, min_duration_months)
  values (u_yaw, 'Ho vegetable garden', 'Irrigated garden plot behind the family house.', 'Volta', 'Ho', 'Sokode', 1.5, 'Clay loam', 'Irrigated', array['Tomato','Pepper','Okra'], 6.6008, 0.4713, current_date - 200, 4)
  returning id into p4;
  insert into plots (owner_id, title, description, region, district, community, size_acres, soil_type, water_access, suitable_crops, latitude, longitude, available_from, min_duration_months)
  values (u_yaw, 'Kpando riverside plot', 'Fertile land near the Volta, good for rice and vegetables.', 'Volta', 'Kpando', 'Torkor', 3, 'Alluvial', 'River nearby', array['Rice','Vegetables'], 6.9950, 0.2930, current_date, 6)
  returning id into p5;
  insert into plots (owner_id, title, description, region, district, community, size_acres, soil_type, water_access, suitable_crops, latitude, longitude, available_from, min_duration_months)
  values (u_yaw, 'Akatsi dry plot', 'Open land, currently grass.', 'Volta', 'Akatsi South', 'Akatsi', 2, 'Sandy', 'None', array['Cassava'], 6.1270, 0.8030, current_date, 6)
  returning id into p6;

  insert into plot_photos (plot_id, storage_path, caption, sort_order, uploaded_by) values
    (p1, '/images/corn-field.jpg', 'View from the road', 0, u_ama),
    (p1, '/images/idle-land-green.jpg', 'Before clearing', 1, u_ama),
    (p2, '/images/vegetable-farm.jpg', 'Valley floor', 0, u_ama),
    (p2, '/images/crop-rows.jpg', 'Last season', 1, u_ama),
    (p3, '/images/farmland-hillside.jpg', 'Slope', 0, u_ama),
    (p4, '/images/irrigating-farm.jpg', 'Garden beds', 0, u_yaw),
    (p5, '/images/open-farmland-sky.jpg', 'Towards the river', 0, u_yaw),
    (p6, '/images/idle-land-dry.jpg', 'Current state', 0, u_yaw);

  -- ---------- Verification ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_officer, 'role', 'authenticated')::text, true);
  perform verify_plot(p1, true, '{"exists":true,"size_matches":true,"soil_matches":true,"phone_confirmed":true}', 'Visited with the landowner. Boundaries marked with teak trees.', current_date - 190);
  perform verify_plot(p2, true, '{"exists":true,"size_matches":true,"soil_matches":true,"phone_confirmed":true}', 'Borehole working.', current_date - 3);
  perform set_config('request.jwt.claims', json_build_object('sub', u_comm, 'role', 'authenticated')::text, true);
  perform verify_plot(p4, true, '{"exists":true,"size_matches":true,"soil_matches":true,"phone_confirmed":true}', null, current_date - 195);
  perform verify_plot(p5, true, '{"exists":true,"size_matches":true,"soil_matches":true,"phone_confirmed":true}', null, current_date - 5);
  perform verify_plot(p6, false, '{"exists":true,"size_matches":false}', 'Plot is about 1 acre, not 2. Please correct the size and resubmit.', current_date - 4);
  -- p3 stays pending for the verifier queue demo

  -- ---------- Deal 1: Kwame on the Techiman plot (active season) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_kwame, 'role', 'authenticated')::text, true);
  insert into applications (plot_id, farmer_id, planned_crop, proposed_duration_months, message)
  values (p1, u_kwame, 'Maize', 6, 'I have farmed maize for four seasons and can supply my own seed and fertiliser.') returning id into a1;
  insert into messages (application_id, sender_id, body) values (a1, u_kwame, 'Good afternoon. Can I come and see the plot on Saturday?');
  perform set_config('request.jwt.claims', json_build_object('sub', u_ama, 'role', 'authenticated')::text, true);
  insert into messages (application_id, sender_id, body) values (a1, u_ama, 'Yes, Saturday morning is fine. The stream slows in January but never dries up.');
  d1 := respond_to_application(a1, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_kwame, 'role', 'authenticated')::text, true);
  insert into messages (application_id, sender_id, body) values (a1, u_kwame, 'Thank you! I will draft the agreement after the visit.');
  select id into ag from propose_agreement(d1, 'Maize', current_date - 150, current_date + 30, 30, 'bags', 4, 'farmer',
    '{"seed":"farmer","fertiliser":"farmer","land_clearing":"landowner","labour":"farmer","transport":"shared"}',
    'Four bags go back to the farmer for seed and fertiliser before the split.');
  perform set_config('request.jwt.claims', json_build_object('sub', u_ama, 'role', 'authenticated')::text, true);
  perform confirm_agreement(ag);
  perform set_config('request.jwt.claims', json_build_object('sub', u_kwame, 'role', 'authenticated')::text, true);
  insert into season_milestones (deal_id, milestone, note, photo_paths, occurred_on, posted_by) values
    (d1, 'cleared', 'Cleared and ploughed. Some stumps remained on the east side.', array['/images/idle-land-dry.jpg'], current_date - 140, u_kwame),
    (d1, 'planted', 'Planted Obatanpa maize, 75 cm rows.', array['/images/crop-rows.jpg'], current_date - 125, u_kwame),
    (d1, 'weeded', 'First weeding done with help from the group.', array['/images/farmers-weeding.jpg'], current_date - 90, u_kwame);
  insert into disputes (deal_id, raised_by, category, description)
  values (d1, u_kwame, 'inputs', 'Land clearing was agreed as the landowner''s job, but stumps on the east side were not removed before planting. I paid two labourers to finish it.');
  perform set_config('request.jwt.claims', json_build_object('sub', u_officer, 'role', 'authenticated')::text, true);
  perform update_dispute((select id from disputes where deal_id = d1), 'in_mediation',
    'The agreement lists clearing under the landowner. Proposed: the landowner covers 2 bags of the farmer''s input costs at harvest.', null);

  -- Another applicant for the valley plot (pending, for the landowner's applications screen)
  perform set_config('request.jwt.claims', json_build_object('sub', u_group, 'role', 'authenticated')::text, true);
  insert into applications (plot_id, farmer_id, planned_crop, proposed_duration_months, message)
  values (p2, u_group, 'Maize and vegetables', 12, 'We are six young farmers from Nkoranza. We share labour and can start clearing next week.') returning id into a2;
  insert into messages (application_id, sender_id, body) values (a2, u_group, 'Hello Madam Ama, is the borehole shared with neighbours?');

  -- ---------- Deal 2: Efua on the Ho garden (completed, rated) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_efua, 'role', 'authenticated')::text, true);
  insert into applications (plot_id, farmer_id, planned_crop, proposed_duration_months, message)
  values (p4, u_efua, 'Tomato', 4, 'Dry-season tomatoes with the existing irrigation.') returning id into a3;
  perform set_config('request.jwt.claims', json_build_object('sub', u_yaw, 'role', 'authenticated')::text, true);
  d2 := respond_to_application(a3, true);
  select id into ag from propose_agreement(d2, 'Tomato', current_date - 180, current_date - 60, 25, 'crates', 0, 'farmer',
    '{"seed":"farmer","fertiliser":"landowner","land_clearing":"farmer","labour":"farmer","transport":"farmer","irrigation":"landowner"}', null);
  perform set_config('request.jwt.claims', json_build_object('sub', u_efua, 'role', 'authenticated')::text, true);
  perform confirm_agreement(ag);
  insert into season_milestones (deal_id, milestone, note, photo_paths, occurred_on, posted_by) values
    (d2, 'cleared', 'Beds prepared.', array['/images/irrigating-farm.jpg'], current_date - 175, u_efua),
    (d2, 'planted', 'Transplanted 1,200 seedlings.', array['/images/vegetable-farm.jpg'], current_date - 160, u_efua),
    (d2, 'weeded', 'Weeded and staked.', array['/images/cabbage-farm.jpg'], current_date - 120, u_efua),
    (d2, 'harvested', 'Harvest finished, 60 crates.', array['/images/hero-tomato-harvest.jpg'], current_date - 65, u_efua);
  perform record_harvest(d2, 60, 450, 'Sold most at Ho central market.', '/images/hero-tomato-harvest.jpg');
  perform set_config('request.jwt.claims', json_build_object('sub', u_yaw, 'role', 'authenticated')::text, true);
  perform complete_deal(d2);
  insert into ratings (deal_id, rater_id, ratee_id, score, comment) values (d2, u_yaw, u_efua, 5, 'Hard-working and kept me updated every week.');
  perform set_config('request.jwt.claims', json_build_object('sub', u_efua, 'role', 'authenticated')::text, true);
  insert into ratings (deal_id, rater_id, ratee_id, score, comment) values (d2, u_efua, u_yaw, 4, 'Fair landowner. Irrigation pump broke once but was fixed quickly.');

  -- ---------- Verifier request waiting for admin ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_samuel, 'role', 'authenticated')::text, true);
  perform request_verifier_role('community', 'Cape Coast Young Farmers Association', array['Central']);

  -- ---------- Groups (FR12) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_kwame, 'role', 'authenticated')::text, true);
  insert into groups (name, description, region, crop, created_by) values
    ('Techiman Maize Growers', 'Maize farmers around Techiman. Labour days, input buying and market prices.', 'Bono East', 'Maize', u_kwame) returning id into g1;
  insert into messages (group_id, sender_id, body, is_notice, notice_title, pinned) values
    (g1, u_kwame, 'Weeding on my Tanoso plot, Saturday 7am. Next week we move to Esi''s group plot.', true, 'Nnoboa labour day', true),
    (g1, u_kwame, 'Who has a knapsack sprayer we can share on Saturday?', false, null, false);
  perform set_config('request.jwt.claims', json_build_object('sub', u_group, 'role', 'authenticated')::text, true);
  insert into group_members (group_id, user_id) values (g1, u_group);
  insert into messages (group_id, sender_id, body, is_notice, notice_title) values
    (g1, u_group, 'We are buying NPK together for a better price. Add your bags by Friday.', true, 'Group fertiliser purchase'),
    (g1, u_group, 'Ours is free. We will bring it.', false, null);
  perform set_config('request.jwt.claims', json_build_object('sub', u_ama, 'role', 'authenticated')::text, true);
  insert into group_members (group_id, user_id) values (g1, u_ama);
  perform set_config('request.jwt.claims', json_build_object('sub', u_efua, 'role', 'authenticated')::text, true);
  insert into groups (name, description, region, crop, created_by) values
    ('Volta Youth Vegetable Club', 'Young vegetable growers in the Volta Region.', 'Volta', 'Vegetables', u_efua) returning id into g2;
  insert into messages (group_id, sender_id, body) values (g2, u_efua, 'Welcome everyone! Share your dry-season plans here.');

  -- ---------- Sessions (FR13, FR14) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_officer, 'role', 'authenticated')::text, true);
  insert into sessions (host_id, title, description, topic, region, starts_at, duration_minutes, capacity, notes_url, recording_url)
  values (u_officer, 'Storing grain to cut post-harvest losses', 'Drying, bagging and storage for maize and cowpea.', 'Post-harvest', 'Bono East',
          now() - interval '20 days', 60, 100, 'https://www.fao.org/3/x5036e/x5036e00.htm', 'https://www.youtube.com/results?search_query=maize+post+harvest+storage')
  returning id into s_past;
  insert into sessions (host_id, title, description, topic, region, starts_at, duration_minutes, capacity) values
    (u_officer, 'Controlling fall armyworm in maize', 'Spotting early damage and safe control options.', 'Maize', 'Bono East', date_trunc('hour', now()) + interval '3 days 10 hours', 60, 60)
  returning id into s1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_comm, 'role', 'authenticated')::text, true);
  insert into sessions (host_id, title, description, topic, region, starts_at, duration_minutes, capacity) values
    (u_comm, 'Dry-season vegetables with drip irrigation', 'Setting up a low-cost drip line.', 'Vegetables', 'Volta', date_trunc('hour', now()) + interval '7 days 16 hours', 75, 40)
  returning id into s2;
  insert into sessions (host_id, title, description, topic, region, starts_at, duration_minutes, capacity) values
    (u_comm, 'Reading your soil before you plant', 'Simple field tests and when to get a lab test.', 'Soil', null, date_trunc('hour', now()) + interval '12 days 11 hours', 60, 80)
  returning id into s3;
  -- registrations (past one attended)
  insert into session_registrations (session_id, user_id, registered_at, attended_at) values
    (s1, u_kwame, now(), null), (s1, u_group, now(), null), (s2, u_efua, now(), null), (s3, u_kwame, now(), null);
  -- the past session: insert directly (the trigger blocks registering for ended sessions)
  alter table session_registrations disable trigger registrations_before_insert;
  insert into session_registrations (session_id, user_id, registered_at, attended_at) values
    (s_past, u_kwame, now() - interval '25 days', now() - interval '20 days'),
    (s_past, u_group, now() - interval '25 days', now() - interval '20 days'),
    (s_past, u_ama, now() - interval '24 days', null);
  alter table session_registrations enable trigger registrations_before_insert;

  -- ---------- Marketplace (FR15, FR16) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_efua, 'role', 'authenticated')::text, true);
  insert into produce_listings (seller_id, deal_id, crop, quantity, unit, price_per_unit, region, description, photo_path)
  values (u_efua, d2, 'Tomato', 12, 'crates', 480, 'Volta', 'Firm, ripe tomatoes from the last picking.', '/images/hero-tomato-harvest.jpg') returning id into l1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_group, 'role', 'authenticated')::text, true);
  insert into produce_listings (seller_id, crop, quantity, unit, price_per_unit, region, description, photo_path)
  values (u_group, 'Pineapple', 300, 'fruits', 12, 'Bono East', 'Sweet MD2 pineapples, ready in two weeks.', '/images/hero-pineapple-farm.jpg') returning id into l2;
  perform set_config('request.jwt.claims', json_build_object('sub', u_buyer, 'role', 'authenticated')::text, true);
  insert into offers (listing_id, buyer_id, quantity, price_per_unit, message) values
    (l1, u_buyer, 10, 450, 'Can collect in Ho on Thursday.') returning id into o1;
  insert into offers (listing_id, buyer_id, quantity, price_per_unit, message) values
    (l2, u_buyer, 150, 11, 'For our Kumasi shop.');

  -- Spread deal dates over past months so the admin chart has a shape
  update deals set created_at = now() - interval '6 months', started_at = now() - interval '6 months', completed_at = now() - interval '2 months' where id = d2;
  update deals set created_at = now() - interval '5 months', started_at = now() - interval '5 months' where id = d1;

  perform set_config('request.jwt.claims', '', true);
end $$;
