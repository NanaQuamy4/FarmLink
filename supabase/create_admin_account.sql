-- Creates the FarmLink administrator account (or promotes it if it already exists).
-- 1. Put your password on the line marked below (at least 8 characters).
-- 2. Run this whole file in the Supabase SQL editor.
-- 3. Then run remove_demo_accounts.sql to remove the demo accounts.
-- Don't save this file with your real password in it, or commit it to GitHub.

do $$
declare
  admin_email text := 'willstudios.design@gmail.com';
  admin_password text := 'CHANGE-ME';          -- <-- your password here
  admin_name text := 'FarmLink Admin';
  uid uuid;
begin
  if admin_password = 'CHANGE-ME' or char_length(admin_password) < 8 then
    raise exception 'Put a password of at least 8 characters on the admin_password line first';
  end if;

  select id into uid from auth.users where lower(email) = lower(admin_email);

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(admin_email),
            crypt(admin_password, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', admin_name, 'role', 'farmer'),
            now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', lower(admin_email), 'email_verified', true), 'email', now(), now(), now());
    raise notice 'Created % with the password you chose.', admin_email;
  else
    update auth.users set encrypted_password = crypt(admin_password, gen_salt('bf')),
                          email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
    where id = uid;
    raise notice '% already existed; its password has been set to the one you chose.', admin_email;
  end if;

  -- the profile row is created by the sign-up trigger; make it the administrator
  perform set_config('farmlink.internal', 'on', true);
  update public.profiles set role = 'admin', is_suspended = false where id = uid;
  raise notice '% is now the administrator. Next, run remove_demo_accounts.sql.', admin_email;
end $$;
