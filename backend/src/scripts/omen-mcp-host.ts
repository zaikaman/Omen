import type { Server } from "node:http";

import express from "express";

import { AnalystMcpService } from "../nodes/services/analyst-mcp.js";
import { ChartVisionMcpService } from "../nodes/services/chart-vision-mcp.js";
import { CriticMcpService } from "../nodes/services/critic-mcp.js";
import { GeneratorMcpService } from "../nodes/services/generator-mcp.js";
import { IntelMcpService } from "../nodes/services/intel-mcp.js";
import { MarketBiasMcpService } from "../nodes/services/market-bias-mcp.js";
import { MemoryMcpService } from "../nodes/services/memory-mcp.js";
import { PublisherMcpService } from "../nodes/services/publisher-mcp.js";
import { ResearchMcpService } from "../nodes/services/research-mcp.js";
import { ScannerMcpService } from "../nodes/services/scanner-mcp.js";
import { WriterMcpService } from "../nodes/services/writer-mcp.js";

type HostedService = {
  service: string;
  path: string;
  description: string;
  handle: (request: unknown) => Promise<unknown>;
};

const parsePort = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const env = {
  host: process.env.OMEN_MCP_HOST ?? "127.0.0.1",
  port: parsePort(process.env.OMEN_MCP_PORT, 7100),
  routerUrl: process.env.OMEN_MCP_ROUTER_URL ?? "http://127.0.0.1:9003",
  publicBaseUrl:
    process.env.OMEN_MCP_PUBLIC_BASE_URL ??
    `http://127.0.0.1:${parsePort(process.env.OMEN_MCP_PORT, 7100).toString()}`,
  registerRetries: parsePort(process.env.OMEN_MCP_REGISTER_RETRIES, 20),
  registerRetryDelayMs: parsePort(process.env.OMEN_MCP_REGISTER_RETRY_DELAY_MS, 1_500),
};

const services: HostedService[] = [
  {
    service: "market_bias",
    path: "/mcp/market_bias",
    description: "Market regime and directional bias derivation.",
    handle: (request) => new MarketBiasMcpService().handle(request),
  },
  {
    service: "scanner",
    path: "/mcp/scanner",
    description: "Bias-aligned candidate selection.",
    handle: (request) => new ScannerMcpService().handle(request),
  },
  {
    service: "research",
    path: "/mcp/research",
    description: "Research bundle and catalyst synthesis.",
    handle: (request) => new ResearchMcpService().handle(request),
  },
  {
    service: "analyst",
    path: "/mcp/analyst",
    description: "Structured thesis generation.",
    handle: (request) => new AnalystMcpService().handle(request),
  },
  {
    service: "chart_vision",
    path: "/mcp/chart_vision",
    description: "Chart frame analysis.",
    handle: (request) => new ChartVisionMcpService().handle(request),
  },
  {
    service: "critic",
    path: "/mcp/critic",
    description: "Quality gate and final review.",
    handle: (request) => new CriticMcpService().handle(request),
  },
  {
    service: "generator",
    path: "/mcp/generator",
    description: "Publishable intel content generation.",
    handle: (request) => new GeneratorMcpService().handle(request),
  },
  {
    service: "intel",
    path: "/mcp/intel",
    description: "Market intelligence report synthesis.",
    handle: (request) => new IntelMcpService().handle(request),
  },
  {
    service: "writer",
    path: "/mcp/writer",
    description: "Long-form intel article drafting.",
    handle: (request) => new WriterMcpService().handle(request),
  },
  {
    service: "memory",
    path: "/mcp/memory",
    description: "Checkpoint and proof reference memory.",
    handle: (request) => new MemoryMcpService().handle(request),
  },
  {
    service: "publisher",
    path: "/mcp/publisher",
    description: "Publication outcome and draft preparation.",
    handle: (request) => new PublisherMcpService().handle(request),
  },
];

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const registerService = async (service: HostedService) => {
  const endpoint = `${env.publicBaseUrl}${service.path}`;

  for (let attempt = 1; attempt <= env.registerRetries; attempt += 1) {
    try {
      const response = await fetch(`${env.routerUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service: service.service,
          endpoint,
        }),
      });

      if (!response.ok) {
        throw new Error(`Router returned HTTP ${response.status.toString()}.`);
      }

      console.log(`[omen-mcp-host] registered ${service.service} -> ${endpoint}`);
      return;
    } catch (error) {
      if (attempt === env.registerRetries) {
        throw error;
      }

      console.warn(
        `[omen-mcp-host] register retry ${attempt.toString()}/${env.registerRetries.toString()} failed for ${service.service}`,
        error,
      );
      await wait(env.registerRetryDelayMs);
    }
  }
};

const deregisterService = async (service: HostedService) => {
  try {
    await fetch(`${env.routerUrl}/register/${encodeURIComponent(service.service)}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.warn(`[omen-mcp-host] failed to deregister ${service.service}`, error);
  }
};

const registerAllServices = async () => {
  for (const service of services) {
    await registerService(service);
  }
};

const deregisterAllServices = async () => {
  await Promise.all(services.map((service) => deregisterService(service)));
};

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "omen-mcp-host",
    status: "ok",
    routerUrl: env.routerUrl,
    services: services.map((service) => ({
      service: service.service,
      path: service.path,
      description: service.description,
    })),
  });
});

app.get("/services", (_req, res) => {
  res.json({
    success: true,
    data: services.map((service) => ({
      service: service.service,
      path: service.path,
      endpoint: `${env.publicBaseUrl}${service.path}`,
      description: service.description,
    })),
  });
});

for (const service of services) {
  app.post(service.path, async (req, res) => {
    try {
      const response = await service.handle(req.body);
      res.json(response);
    } catch (error) {
      res.status(500).json({
        jsonrpc: "2.0",
        id:
          typeof req.body?.id === "number" || typeof req.body?.id === "string" ? req.body.id : null,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : `${service.service} service failed.`,
        },
      });
    }
  });
}

let server: Server | null = null;
let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[omen-mcp-host] shutting down on ${signal}`);
  await deregisterAllServices();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }).catch((error) => {
      console.warn("[omen-mcp-host] failed to close server cleanly", error);
    });
  }

  process.exit(0);
};

server = app.listen(env.port, env.host, async () => {
  console.log(`[omen-mcp-host] listening on http://${env.host}:${env.port.toString()}`);
  console.log(`[omen-mcp-host] router target ${env.routerUrl}`);

  try {
    await registerAllServices();
  } catch (error) {
    console.error("[omen-mcp-host] failed to register MCP services", error);
    process.exit(1);
  }
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
