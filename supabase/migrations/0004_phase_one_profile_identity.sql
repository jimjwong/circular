-- A tenant-visible email is required for organization team administration.

alter table public.profiles add column email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id;

create unique index profiles_email_idx on public.profiles (lower(email)) where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    lower(new.email)
  );
  return new;
end;
$$;
