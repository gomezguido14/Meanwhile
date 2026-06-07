drop function if exists public.save_family_avatar(text, text, text);

create or replace function public.save_family_avatar(
  group_slug text,
  pin text,
  new_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  changed_count int;
begin
  update public.family_groups
  set avatar_url = new_avatar_url
  where slug = group_slug
    and is_active = true
    and pin_hash = crypt(pin, pin_hash);

  get diagnostics changed_count = row_count;

  if changed_count = 0 then
    raise exception 'PIN invalido.';
  end if;
end;
$$;

grant execute on function public.save_family_avatar(text, text, text) to anon, authenticated;
