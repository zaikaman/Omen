alter table public.agent_nodes
drop constraint if exists agent_nodes_role_check;

alter table public.agent_nodes
add constraint agent_nodes_role_check
check (
  role in (
    'orchestrator',
    'market_bias',
    'scanner',
    'research',
    'chart_vision',
    'analyst',
    'critic',
    'intel',
    'publisher',
    'memory',
    'monitor'
  )
);

alter table public.agent_events
drop constraint if exists agent_events_agent_role_check;

alter table public.agent_events
add constraint agent_events_agent_role_check
check (
  agent_role in (
    'orchestrator',
    'market_bias',
    'scanner',
    'research',
    'chart_vision',
    'analyst',
    'critic',
    'intel',
    'publisher',
    'memory',
    'monitor'
  )
);

alter table public.axl_messages
drop constraint if exists axl_messages_from_role_check;

alter table public.axl_messages
add constraint axl_messages_from_role_check
check (
  from_role in (
    'orchestrator',
    'market_bias',
    'scanner',
    'research',
    'chart_vision',
    'analyst',
    'critic',
    'intel',
    'publisher',
    'memory',
    'monitor'
  )
);

alter table public.axl_messages
drop constraint if exists axl_messages_to_role_check;

alter table public.axl_messages
add constraint axl_messages_to_role_check
check (
  to_role in (
    'orchestrator',
    'market_bias',
    'scanner',
    'research',
    'chart_vision',
    'analyst',
    'critic',
    'intel',
    'publisher',
    'memory',
    'monitor'
  )
);
