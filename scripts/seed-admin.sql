-- Crea un usuario admin de prueba directo por SQL (sin pasar por /registro).
-- Correr una sola vez en el SQL Editor de Supabase.
-- Email: superadmin@admin.com · Password: admin

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'superadmin@admin.com',
  crypt('admin', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), id,
       jsonb_build_object('sub', id::text, 'email', email),
       'email', id::text, now(), now(), now()
from auth.users
where email = 'superadmin@admin.com';

update public.usuarios set rol = 'admin' where email = 'superadmin@admin.com';
