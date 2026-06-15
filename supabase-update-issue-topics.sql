drop function if exists public.update_issue_topics(text, text, uuid, jsonb);

create or replace function public.update_issue_topics(
  group_slug text,
  pin text,
  target_issue_id uuid,
  topic_updates jsonb
)
returns table (
  issue_id uuid,
  updated_count int
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin_id uuid;
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
    raise exception 'No tenes permiso para editar topics.';
  end if;

  if topic_updates is null
    or jsonb_typeof(topic_updates) <> 'array'
    or jsonb_array_length(topic_updates) = 0 then
    raise exception 'No hay topics para actualizar.';
  end if;

  with input_topics as (
    select
      (topic->>'id')::uuid as topic_id,
      left(nullif(trim(topic->>'title'), ''), 90) as title,
      nullif(left(trim(coalesce(topic->>'description', '')), 220), '') as description
    from jsonb_array_elements(topic_updates) as items(topic)
    where nullif(trim(topic->>'id'), '') is not null
      and nullif(trim(topic->>'title'), '') is not null
  ),
  updated as (
    update public.topics topic
    set
      title = input_topics.title,
      description = input_topics.description
    from input_topics
    where topic.id = input_topics.topic_id
      and topic.monthly_issue_id = target_issue_id
    returning topic.id
  )
  select count(*)::int
  into updated_count
  from updated;

  issue_id := target_issue_id;
  return next;
end;
$$;

grant execute on function public.update_issue_topics(text, text, uuid, jsonb) to anon, authenticated;
