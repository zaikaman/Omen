import {
  REALTIME_LISTEN_TYPES,
  type RealtimeChannel,
  type RealtimeChannelOptions,
  type REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  type RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { z } from "zod";

import type {
  AgentEvent,
  AxlEnvelope,
  OutboundPost,
  Run,
  Signal,
} from "@omen/shared";

import type { OmenSupabaseClient } from "../client/supabase.js";

export const realtimeChangeEventSchema = z.enum([
  "INSERT",
  "UPDATE",
  "DELETE",
  "*",
]);

export const realtimeChannelScopeSchema = z.enum([
  "runs",
  "signals",
  "events",
  "posts",
  "custom",
]);

export type RealtimeChangeEvent = z.infer<typeof realtimeChangeEventSchema>;
export type RealtimeChannelScope = z.infer<typeof realtimeChannelScopeSchema>;

export interface PostgresChangeSubscription<Row extends Record<string, unknown>> {
  table: string;
  schema?: string;
  event?: RealtimeChangeEvent;
  filter?: string;
  onChange: (payload: RealtimePostgresChangesPayload<Row>) => void;
}

export const createRealtimeChannelName = (
  scope: RealtimeChannelScope,
  identifier: string,
) => `omen:${scope}:${identifier}`;

export const openRealtimeChannel = (
  client: OmenSupabaseClient,
  input: {
    scope: RealtimeChannelScope;
    identifier: string;
    options?: RealtimeChannelOptions;
  },
): RealtimeChannel =>
  client.channel(
    createRealtimeChannelName(input.scope, input.identifier),
    input.options,
  );

export const subscribeToPostgresChanges = <Row extends Record<string, unknown>>(
  channel: RealtimeChannel,
  subscription: PostgresChangeSubscription<Row>,
): RealtimeChannel =>
  channel.on(
    REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
    {
      event:
        (subscription.event ?? "*") as REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
      schema: subscription.schema ?? "public",
      table: subscription.table,
      filter: subscription.filter,
    },
    subscription.onChange,
  );

export const subscribeToRunStream = (
  client: OmenSupabaseClient,
  runId: string,
  handlers: {
    onRunChange?: (payload: RealtimePostgresChangesPayload<Run>) => void;
    onEvent?: (
      payload: RealtimePostgresChangesPayload<AgentEvent>,
    ) => void;
    onSignal?: (
      payload: RealtimePostgresChangesPayload<Signal>,
    ) => void;
    onPost?: (
      payload: RealtimePostgresChangesPayload<OutboundPost>,
    ) => void;
    onAxlMessage?: (
      payload: RealtimePostgresChangesPayload<AxlEnvelope>,
    ) => void;
  },
): RealtimeChannel => {
  const channel = openRealtimeChannel(client, {
    scope: "runs",
    identifier: runId,
  });

  if (handlers.onRunChange) {
    subscribeToPostgresChanges(channel, {
      table: "runs",
      event: "*",
      filter: `id=eq.${runId}`,
      onChange: handlers.onRunChange,
    });
  }

  if (handlers.onEvent) {
    subscribeToPostgresChanges(channel, {
      table: "agent_events",
      event: "*",
      filter: `run_id=eq.${runId}`,
      onChange: handlers.onEvent,
    });
  }

  if (handlers.onSignal) {
    subscribeToPostgresChanges(channel, {
      table: "signals",
      event: "*",
      filter: `run_id=eq.${runId}`,
      onChange: handlers.onSignal,
    });
  }

  if (handlers.onPost) {
    subscribeToPostgresChanges(channel, {
      table: "outbound_posts",
      event: "*",
      filter: `run_id=eq.${runId}`,
      onChange: handlers.onPost,
    });
  }

  if (handlers.onAxlMessage) {
    subscribeToPostgresChanges(channel, {
      table: "axl_messages",
      event: "*",
      filter: `run_id=eq.${runId}`,
      onChange: handlers.onAxlMessage,
    });
  }

  void channel.subscribe();

  return channel;
};

export const unsubscribeFromRealtimeChannel = async (
  channel: RealtimeChannel,
) => {
  await channel.unsubscribe();
};
