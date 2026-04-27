import {
  axlMcpResponseSchema,
  axlMcpRouteSchema,
  axlMcpServiceContractSchema,
  type AxlMcpRequest,
  type AxlMcpResponse,
  type AxlMcpRoute,
  type AxlMcpServiceContract,
} from "@omen/shared";

export function defineAxlMcpServiceContract(
  input: AxlMcpServiceContract,
): AxlMcpServiceContract {
  return axlMcpServiceContractSchema.parse(input);
}

export function buildAxlMcpRoute(input: AxlMcpRoute): AxlMcpRoute {
  return axlMcpRouteSchema.parse(input);
}

export function assertAxlMcpMethodSupported(
  contract: AxlMcpServiceContract,
  request: AxlMcpRequest,
) {
  const parsedContract = axlMcpServiceContractSchema.parse(contract);

  if (parsedContract.service !== request.service) {
    throw new Error(
      `AXL MCP request service ${request.service} does not match contract ${parsedContract.service}.`,
    );
  }

  if (!parsedContract.methods.includes(request.method)) {
    throw new Error(
      `AXL MCP method ${request.method} is not registered on service ${parsedContract.service}.`,
    );
  }
}

export function createAxlMcpSuccessResponse(input: {
  id: AxlMcpResponse["id"];
  result: Record<string, unknown>;
}): AxlMcpResponse {
  return axlMcpResponseSchema.parse({
    jsonrpc: "2.0",
    id: input.id,
    result: input.result,
  });
}

export function createAxlMcpErrorResponse(input: {
  id: AxlMcpResponse["id"];
  code: number;
  message: string;
  data?: Record<string, unknown>;
}): AxlMcpResponse {
  return axlMcpResponseSchema.parse({
    jsonrpc: "2.0",
    id: input.id,
    error: {
      code: input.code,
      message: input.message,
      data: input.data ?? {},
    },
  });
}
