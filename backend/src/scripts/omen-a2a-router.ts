import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

import express from "express";

import { loadEnvFiles } from "../bootstrap/env.js";

loadEnvFiles();

type JsonObject = Record<string, unknown>;

const parsePort = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const rolePeerEnvByService: Record<string, string> = {
  market_bias: "AXL_MARKET_BIAS_NODE_ID",
  scanner: "AXL_SCANNER_NODE_ID",
  research: "AXL_RESEARCH_NODE_ID",
  chart_vision: "AXL_CHART_VISION_NODE_ID",
  analyst: "AXL_ANALYST_NODE_ID",
  critic: "AXL_CRITIC_NODE_ID",
  intel: "AXL_INTEL_NODE_ID",
  generator: "AXL_GENERATOR_NODE_ID",
  writer: "AXL_WRITER_NODE_ID",
  memory: "AXL_MEMORY_NODE_ID",
  publisher: "AXL_PUBLISHER_NODE_ID",
};

const env = {
  host: process.env.OMEN_A2A_HOST ?? "127.0.0.1",
  port: parsePort(process.env.OMEN_A2A_PORT, 9004),
  axlApiBaseUrl: process.env.OMEN_A2A_AXL_API_BASE_URL ?? process.env.AXL_NODE_BASE_URL ?? "http://127.0.0.1:9002",
  demoDir:
    process.env.OMEN_A2A_DEMO_DIR ??
    path.resolve(process.cwd(), "..", "local", "axl", "demo"),
  mcpTimeoutMs: parsePort(process.env.OMEN_A2A_MCP_TIMEOUT_MS, 300_000),
};

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

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolvePeerIdFromDemoFile = (service: string) => {
  try {
    return readFileSync(path.join(env.demoDir, service, "peer-id.txt"), "utf8").trim();
  } catch {
    return "";
  }
};

const isValidAxlPeerId = (value: string) => /^[0-9a-f]{64}$/i.test(value);

const resolvePeerIdForService = (service: string) => {
  const envName = rolePeerEnvByService[service];
  const configured = envName ? process.env[envName]?.trim() : "";
  const demoPeerId = resolvePeerIdFromDemoFile(service);
  const fallback = process.env.AXL_SERVICE_PEER_ID?.trim() ?? "";

  for (const peerId of [configured, demoPeerId, fallback]) {
    if (peerId && isValidAxlPeerId(peerId)) {
      return peerId;
    }
  }

  return "";
};

const buildAxlMcpEndpoint = (service: string, peerId: string) =>
  `${trimTrailingSlash(env.axlApiBaseUrl)}/mcp/${encodeURIComponent(peerId)}/${encodeURIComponent(service)}`;

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
    mode: "axl-mcp-router",
    axlApiBaseUrl: env.axlApiBaseUrl,
    demoDir: env.demoDir,
    mcpTimeoutMs: env.mcpTimeoutMs,
    services: Object.keys(rolePeerEnvByService),
  });
});

app.get("/.well-known/agent-card.json", (_req, res) => {
  res.json({
    name: "Omen AXL Demo A2A Router",
    description: "Routes A2A MCP requests through AXL MCP peer routing into Omen role MCP routers.",
    version: "0.1.0",
    default_input_modes: ["text", "application/json"],
    default_output_modes: ["text", "application/json"],
    skills: Object.keys(rolePeerEnvByService).map((service) => ({
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
    const peerId = resolvePeerIdForService(service);

    if (!rolePeerEnvByService[service]) {
      res.status(404).json(
        createErrorResponse({
          id,
          code: -32601,
          message: `No Omen A2A MCP endpoint is configured for service ${service}.`,
        }),
      );
      return;
    }

    if (!peerId) {
      res.status(404).json(
        createErrorResponse({
          id,
          code: -32601,
          message: `No AXL peer ID is configured for service ${service}.`,
        }),
      );
      return;
    }

    const endpoint = buildAxlMcpEndpoint(service, peerId);

    const timeoutSignal = AbortSignal.timeout(env.mcpTimeoutMs);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "X-From-Peer-Id": req.header("X-From-Peer-Id") ?? "axl-peer",
        "X-Service": service,
      },
      body: JSON.stringify(request),
      signal: timeoutSignal,
    });

    const responseText = await response.text();
    let result: unknown = null;

    try {
      result = responseText ? (JSON.parse(responseText) as unknown) : null;
    } catch {
      res.status(response.ok ? 502 : response.status).json(
        createErrorResponse({
          id,
          code: -32000,
          message: responseText || `AXL MCP endpoint ${endpoint} returned a non-JSON response.`,
        }),
      );
      return;
    }

    const resultObject = asJsonObject(result);
    const mcpError = asJsonObject(resultObject?.error);

    if (!response.ok || mcpError) {
      res.status(response.ok ? 502 : response.status).json(
        createErrorResponse({
          id,
          code:
            typeof mcpError?.code === "number"
              ? mcpError.code
              : -32000,
          message:
            typeof mcpError?.message === "string"
              ? mcpError.message
            : `AXL MCP endpoint ${endpoint} returned HTTP ${response.status.toString()}.`,
        }),
      );
      return;
    }

    res.json(
      createArtifactResponse({
        id,
        service,
        response: result,
      }),
    );
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    res.status(isTimeout ? 504 : 400).json(
      createErrorResponse({
        id,
        code: isTimeout ? -32001 : -32600,
        message: isTimeout
          ? `Omen AXL MCP endpoint timed out after ${env.mcpTimeoutMs.toString()}ms.`
          : error instanceof Error
            ? error.message
            : "Invalid A2A request.",
      }),
    );
  }
});

let server: Server | null = null;

server = app.listen(env.port, env.host, () => {
  console.log(`[omen-a2a-router] listening on http://${env.host}:${env.port.toString()}`);
  console.log(
    `[omen-a2a-router] routing ${Object.keys(rolePeerEnvByService).length.toString()} services through AXL MCP endpoints`,
  );
  console.log(`[omen-a2a-router] AXL API base ${env.axlApiBaseUrl}`);
  console.log(`[omen-a2a-router] MCP timeout ${env.mcpTimeoutMs.toString()}ms`);
});

const shutdown = () => {
  server?.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
