-- Run ONCE in the Supabase SQL editor to create an administrator.
-- Replace the e-mail and the password, then run. (Do not commit real passwords.)
do $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'NEW_ADMIN@EXAMPLE.COM', extensions.crypt('CHANGE-THIS-PASSWORD', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', 'NEW_ADMIN@EXAMPLE.COM', 'email_verified', true),
    'email', now(), now(), now());
  insert into public.admins (user_id) values (uid);
end $$;
