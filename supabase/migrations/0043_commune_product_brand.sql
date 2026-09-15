-- Rename local and demo identities after the product was renamed to Commune.
update auth.identities
set
  provider_id = replace(replace(provider_id, '@circular.demo', '@commune.demo'), '@circular.local', '@commune.local'),
  identity_data = jsonb_set(
    identity_data,
    '{email}',
    to_jsonb(replace(replace(identity_data ->> 'email', '@circular.demo', '@commune.demo'), '@circular.local', '@commune.local'))
  ),
  updated_at = now()
where identity_data ->> 'email' like '%@circular.demo'
   or identity_data ->> 'email' like '%@circular.local';

update auth.users
set
  email = replace(replace(email, '@circular.demo', '@commune.demo'), '@circular.local', '@commune.local'),
  raw_user_meta_data = case
    when raw_user_meta_data ->> 'full_name' = 'Circular Platform Owner'
      then jsonb_set(raw_user_meta_data, '{full_name}', '"Commune Platform Owner"'::jsonb)
    else raw_user_meta_data
  end,
  updated_at = now()
where email like '%@circular.demo'
   or email like '%@circular.local';

update auth.users
set encrypted_password = crypt('Commune123!', gen_salt('bf'))
where email = 'owner@commune.local';

update public.profiles
set
  email = replace(replace(email, '@circular.demo', '@commune.demo'), '@circular.local', '@commune.local'),
  headline = case when headline = 'Circular platform owner' then 'Commune platform owner' else headline end,
  updated_at = now()
where email like '%@circular.demo'
   or email like '%@circular.local'
   or headline = 'Circular platform owner';
