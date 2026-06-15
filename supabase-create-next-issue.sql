drop function if exists public.create_next_month_issue(text, text);

create or replace function public.create_next_month_issue(
  group_slug text,
  pin text
)
returns table (
  issue_id uuid,
  issue_slug text,
  issue_title text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin_id uuid;
  draft_issue record;
  latest_issue record;
  latest_month_number int;
  next_month_number int;
  next_date date;
  next_month_name text;
  next_issue_number int;
  next_slug text;
  existing_issue record;
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
    raise exception 'No tenes permiso para crear numeros nuevos.';
  end if;

  select id, slug, title
  into draft_issue
  from public.monthly_issues
  where status = 'draft'
  order by
    year desc,
    array_position(
      array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      lower(month)
    ) desc
  limit 1;

  if draft_issue.id is not null then
    issue_id := draft_issue.id;
    issue_slug := draft_issue.slug;
    issue_title := draft_issue.title;
    return next;
    return;
  end if;

  select *
  into latest_issue
  from public.monthly_issues
  order by
    year desc,
    array_position(
      array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      lower(month)
    ) desc
  limit 1;

  if latest_issue.id is null then
    next_date := date_trunc('month', current_date)::date;
    next_issue_number := 1;
  else
    latest_month_number := array_position(
      array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      lower(latest_issue.month)
    );
    next_date := (make_date(latest_issue.year, coalesce(latest_month_number, extract(month from current_date)::int), 1) + interval '1 month')::date;
    next_issue_number := latest_issue.issue_number + 1;
  end if;

  next_month_number := extract(month from next_date)::int;
  next_month_name := (array['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'])[next_month_number];
  next_slug := lower(next_month_name) || '-' || extract(year from next_date)::int::text;

  select id, slug, title
  into existing_issue
  from public.monthly_issues
  where slug = next_slug
  limit 1;

  if existing_issue.id is not null then
    issue_id := existing_issue.id;
    issue_slug := existing_issue.slug;
    issue_title := existing_issue.title;
    return next;
    return;
  end if;

  insert into public.monthly_issues (
    id,
    slug,
    title,
    month,
    year,
    issue_number,
    intro_text,
    cover_title,
    editor_group_id,
    status
  )
  values (
    gen_random_uuid(),
    next_slug,
    next_month_name || ' ' || extract(year from next_date)::int::text,
    next_month_name,
    extract(year from next_date)::int,
    next_issue_number,
    'Un nuevo mes para juntar escenas chiquitas, fotos sueltas y recuerdos que queremos guardar.',
    next_month_name,
    admin_id,
    'draft'
  )
  returning id, slug, title into issue_id, issue_slug, issue_title;

  insert into public.topics (id, monthly_issue_id, title, description, order_index, layout_type)
  values
    (gen_random_uuid(), issue_id, 'Una escena de este mes', 'Una foto simple de algo que quieras guardar de estos dias.', 1, 'hero'),
    (gen_random_uuid(), issue_id, 'Algo que comimos', 'Una comida, cafe, merienda o mesa compartida que haya valido la pena.', 2, 'polaroid'),
    (gen_random_uuid(), issue_id, 'Un lugar donde estuve', 'Una esquina, casa, camino o rincon que cuente algo del mes.', 3, 'notebook'),
    (gen_random_uuid(), issue_id, 'Algo que me hizo pensar en ustedes', 'Una imagen que te haya conectado con la familia, aunque sea por un segundo.', 4, 'hero'),
    (gen_random_uuid(), issue_id, 'Pequena alegria', 'Una cosa minima que te alegro el dia.', 5, 'polaroid');

  update public.monthly_issues
  set status = 'archived'
  where id = latest_issue.id
    and latest_issue.status = 'published';

  return next;
end;
$$;

grant execute on function public.create_next_month_issue(text, text) to anon, authenticated;
