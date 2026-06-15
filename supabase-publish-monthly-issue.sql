drop function if exists public.publish_monthly_issue(text, text, uuid);

create or replace function public.publish_monthly_issue(
  group_slug text,
  pin text,
  target_issue_id uuid
)
returns table (
  issue_id uuid,
  issue_title text,
  issue_status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin_id uuid;
  target_issue public.monthly_issues%rowtype;
begin
  select id
  into admin_id
  from public.family_groups
  where slug = group_slug
    and is_active = true
    and can_manage_issues = true
    and pin_hash = crypt(pin, pin_hash)
  limit 1;

  if admin_id is null then
    raise exception 'No tenes permiso para publicar numeros.';
  end if;

  select *
  into target_issue
  from public.monthly_issues
  where id = target_issue_id
  limit 1;

  if target_issue.id is null then
    raise exception 'No encontre ese numero.';
  end if;

  if target_issue.status <> 'draft' then
    issue_id := target_issue.id;
    issue_title := target_issue.title;
    issue_status := target_issue.status;
    return next;
    return;
  end if;

  update public.monthly_issues
  set status = 'published'
  where id = target_issue.id
  returning id, title, status into issue_id, issue_title, issue_status;

  return next;
end;
$$;

grant execute on function public.publish_monthly_issue(text, text, uuid) to anon, authenticated;
