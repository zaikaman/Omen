import { z } from "zod";

export const modelProfileSchema = z.enum(["scanner", "reasoning"]);

export type ModelProfile = z.infer<typeof modelProfileSchema>;

export const agentModelRoutingSchema = z.enum([
  "market_bias",
  "scanner",
  "research",
  "chart_vision",
  "analyst",
  "critic",
  "intel",
  "publisher",
]);

export type AgentModelRoutingRole = z.infer<typeof agentModelRoutingSchema>;

const ROUTING_TABLE: Record<AgentModelRoutingRole, ModelProfile> = {
  market_bias: "scanner",
  scanner: "scanner",
  research: "scanner",
  chart_vision: "scanner",
  analyst: "reasoning",
  critic: "reasoning",
  intel: "scanner",
  publisher: "reasoning",
};

export const resolveModelProfileForRole = (role: AgentModelRoutingRole) =>
  ROUTING_TABLE[agentModelRoutingSchema.parse(role)];
