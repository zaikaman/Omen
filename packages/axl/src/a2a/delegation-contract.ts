import {
  axlA2AAcceptedResponseSchema,
  axlA2ADelegationEnvelopeSchema,
  axlA2ADelegationRequestSchema,
  axlA2AResultSchema,
  type AxlA2AAcceptedResponse,
  type AxlA2ADelegationEnvelope,
  type AxlA2ADelegationRequest,
  type AxlA2AResult,
} from "@omen/shared";

export function createDelegationRequest(
  input: AxlA2ADelegationRequest,
): AxlA2ADelegationRequest {
  return axlA2ADelegationRequestSchema.parse(input);
}

export function acceptDelegation(input: {
  request: AxlA2ADelegationRequest;
  assignedPeerId: string;
  assignedRole: AxlA2AAcceptedResponse["assignedRole"];
  acceptedAt: string;
}): AxlA2AAcceptedResponse {
  return axlA2AAcceptedResponseSchema.parse({
    delegationId: input.request.delegationId,
    state: "accepted",
    assignedPeerId: input.assignedPeerId,
    assignedRole: input.assignedRole,
    acceptedAt: input.acceptedAt,
  });
}

export function resolveDelegation(input: {
  request: AxlA2ADelegationRequest;
  responderPeerId: string;
  responderRole: AxlA2AResult["responderRole"];
  state: AxlA2AResult["state"];
  output?: Record<string, unknown>;
  error?: string | null;
  completedAt?: string | null;
}): AxlA2AResult {
  return axlA2AResultSchema.parse({
    delegationId: input.request.delegationId,
    state: input.state,
    responderPeerId: input.responderPeerId,
    responderRole: input.responderRole,
    output: input.output ?? {},
    error: input.error ?? null,
    completedAt:
      input.state === "completed" || input.state === "failed"
        ? (input.completedAt ?? new Date().toISOString())
        : null,
  });
}

export function buildDelegationEnvelope(input: {
  request: AxlA2ADelegationRequest;
  receipt?: AxlA2AAcceptedResponse | null;
  result?: AxlA2AResult | null;
}): AxlA2ADelegationEnvelope {
  return axlA2ADelegationEnvelopeSchema.parse({
    request: input.request,
    receipt: input.receipt ?? null,
    result: input.result ?? null,
  });
}
