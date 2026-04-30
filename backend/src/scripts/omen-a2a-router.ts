import type { Server } from "node:http";

import express from "express";

type JsonObject = Record<string, unknown>;

const parsePort = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const defaultRouterByService: Record<string, string> = {
  market_bias: "http://127.0.0.1:9003",
  chart_vision: "http://127.0.0.1:9003",
  intel: "http://127.0.0.1:9003",
  generator: "http://127.0.0.1:9003",
  writer: "http://127.0.0.1:9003",
  memory: "http://127.0.0.1:9003",
  publisher: "http://127.0.0.1:9003",
  scanner: "http://127.0.0.1:9013",
  research: "http://127.0.0.1:9023",
  analyst: "http://127.0.0.1:9033",
  critic: "http://127.0.0.1:9043",
};

const env = {
  host: process.env.OMEN_A2A_HOST ?? "127.0.0.1",
  port: parsePort(process.env.OMEN_A2A_PORT, 9004),
  routerMapJson: process.env.OMEN_A2A_ROUTER_MAP_JSON ?? "",
};

const parseRouterMap = () => {
  if (!env.routerMapJson.trim()) {
    return defaultRouterByService;
  }

  const parsed = JSON.parse(env.routerMapJson) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OMEN_A2A_ROUTER_MAP_JSON must be a JSON object.");
  }

  return {
    ...defaultRouterByService,
    ...(parsed as Record<string, string>),
  };
};

const routerByService = parseRouterMap();

const asJsonObject = (value: unknown): JsonObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const findTextPart = (value: unknown): string | null => {
  const object = asJsonObject(value);
  const params = asJsonObject(object?.params);
  const message = asJsonObject(params?.message);
  const parts = Array.isArray(message?.parts) ? message.parts : [];

  for (const part of parts) {
    const partObject = asJsonObject(part);
    if (typeof partObject?.text === "string") {
      return partObject.text;
    }
  }

  return null;
};

const parseA2AMcpRequest = (body: unknown) => {
  const text = findTextPart(body);

  if (!text) {
    throw new Error("A2A request did not include a text MCP payload.");
  }

  const parsed = JSON.parse(text) as unknown;
  const payload = asJsonObject(parsed);
  const request = asJsonObject(payload?.request);
  const service = typeof payload?.service === "string" ? payload.service : "";

  if (!service || !request) {
    throw new Error("A2A MCP payload must include service and request.");
  }

  return { service, request };
};

const createArtifactResponse = (input: {
  id: unknown;
  service: string;
  response: unknown;
}) => ({
  jsonrpc: "2.0",
  id: typeof input.id === "string" || typeof input.id === "number" ? input.id : null,
  result: {
    artifacts: [
      {
        name: "mcp_response",
        description: `Response from ${input.service} MCP service`,
        parts: [
          {
            text: JSON.stringify(input.response),
          },
        ],
      },
    ],
  },
});

const createErrorResponse = (input: { id: unknown; code: number; message: string }) => ({
  jsonrpc: "2.0",
  id: typeof input.id === "string" || typeof input.id === "number" ? input.id : null,
  error: {
    code: input.code,
    message: input.message,
  },
});

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "omen-a2a-router",
    status: "ok",
    routers: routerByService,
  });
});

app.get("/.well-known/agent-card.json", (_req, res) => {
  res.json({
    name: "Omen AXL Demo A2A Router",
    description: "Routes A2A MCP requests to Omen split-node role routers.",
    version: "0.1.0",
    default_input_modes: ["text", "application/json"],
    default_output_modes: ["text", "application/json"],
    skills: Object.keys(routerByService).map((service) => ({
      id: service,
      name: `${service} MCP service`,
      tags: [service, "omen", "axl"],
    })),
  });
});

app.post(/.*/, async (req, res) => {
  const id = asJsonObject(req.body)?.id ?? null;

  try {
    const { service, request } = parseA2AMcpRequest(req.body);
    const routerUrl = routerByService[service];

    if (!routerUrl) {
      res.status(404).json(
        createErrorResponse({
          id,
          code: -32601,
          message: `No Omen A2A router is configured for service ${service}.`,
        }),
      );
      return;
    }

    const response = await fetch(`${routerUrl.replace(/\/$/, "")}/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service,
        request,
        from_peer_id: req.header("X-From-Peer-Id") ?? "axl-peer",
      }),
    });

    const result = (await response.json()) as unknown;
    const resultObject = asJsonObject(result);

    if (!response.ok || typeof resultObject?.error === "string") {
      res.status(response.ok ? 502 : response.status).json(
        createErrorResponse({
          id,
          code: -32000,
          message:
            typeof resultObject?.error === "string"
              ? resultObject.error
              : `Router ${routerUrl} returned HTTP ${response.status.toString()}.`,
        }),
      );
      return;
    }

    res.json(
      createArtifactResponse({
        id,
        service,
        response: resultObject?.response ?? result,
      }),
    );
  } catch (error) {
    res.status(400).json(
      createErrorResponse({
        id,
        code: -32600,
        message: error instanceof Error ? error.message : "Invalid A2A request.",
      }),
    );
  }
});

let server: Server | null = null;

server = app.listen(env.port, env.host, () => {
  console.log(`[omen-a2a-router] listening on http://${env.host}:${env.port.toString()}`);
  console.log(`[omen-a2a-router] routing ${Object.keys(routerByService).length.toString()} services`);
});

const shutdown = () => {
  server?.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
