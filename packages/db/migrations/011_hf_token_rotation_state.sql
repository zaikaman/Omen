create table if not exists public.hf_token_rotation_state (
  id text primary key default 'default',
  next_token_index integer not null default 0 check (next_token_index >= 0),
  token_count integer not null default 0 check (token_count >= 0),
  reserved_start_index integer not null default 0 check (reserved_start_index >= 0),
  updated_at timestamptz not null default now()
);

insert into public.hf_token_rotation_state (
  id,
  next_token_index,
  token_count,
  reserved_start_index,
  updated_at
)
select
  'default',
  case
    when metadata->>'nextTokenIndex' ~ '^[0-9]+$'
      then (metadata->>'nextTokenIndex')::integer
    else 0
  end,
  case
    when metadata->>'tokenCount' ~ '^[0-9]+$'
      then (metadata->>'tokenCount')::integer
    else 0
  end,
  case
    when metadata->>'reservedStartIndex' ~ '^[0-9]+$'
      then (metadata->>'reservedStartIndex')::integer
    else 0
  end,
  coalesce(captured_at, now())
from public.service_registry_snapshots
where source = 'hf_token_rotation'
  and metadata ? 'nextTokenIndex'
order by captured_at desc
limit 1
on conflict (id) do nothing;
