import http from "node:http";

const publicPort = Number.parseInt(process.env.AXL_PUBLIC_PROXY_PORT ?? "8080", 10);
const bridgeHost = process.env.AXL_BRIDGE_PROXY_HOST ?? "127.0.0.1";
const bridgePort = Number.parseInt(process.env.AXL_API_PORT ?? "9002", 10);
const timeoutMs = Math.round(
  Number.parseFloat(process.env.AXL_PUBLIC_PROXY_TIMEOUT_SECONDS ?? "300") * 1000,
);
const topologyTimeoutMs = Math.round(
  Number.parseFloat(process.env.AXL_PUBLIC_PROXY_TOPOLOGY_TIMEOUT_SECONDS ?? "3") * 1000,
);
const axlPublicKey = process.env.AXL_PUBLIC_KEY ?? "";

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const writeJson = (res, statusCode, payload) => {
  const encoded = Buffer.from(JSON.stringify(payload));
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": encoded.length,
  });
  res.end(encoded);
};

const topologyFallback = (res, error) => {
  if (!axlPublicKey) {
    writeJson(res, 504, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  writeJson(res, 200, {
    our_public_key: axlPublicKey,
    peers: [],
    tree: [],
    partial: true,
    warning: `AXL bridge topology snapshot unavailable: ${
      error instanceof Error ? error.message : String(error)
    }`,
  });
};

const collectRequestBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const proxyRequest = async (req, res) => {
  if (req.url === "/health") {
    writeJson(res, 200, { ok: true });
    return;
  }

  const body = await collectRequestBody(req);
  const upstreamTimeoutMs = req.url === "/topology" ? topologyTimeoutMs : timeoutMs;

  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([key]) => !hopByHopHeaders.has(key.toLowerCase())),
  );

  const upstreamReq = http.request(
    {
      host: bridgeHost,
      port: bridgePort,
      path: req.url,
      method: req.method,
      headers,
      timeout: upstreamTimeoutMs,
    },
    (upstreamRes) => {
      const responseHeaders = Object.fromEntries(
        Object.entries(upstreamRes.headers).filter(
          ([key]) => !hopByHopHeaders.has(key.toLowerCase()),
        ),
      );
      const chunks = [];

      upstreamRes.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      upstreamRes.on("end", () => {
        const payload = Buffer.concat(chunks);
        res.writeHead(upstreamRes.statusCode ?? 502, {
          ...responseHeaders,
          "Content-Length": payload.length,
        });
        res.end(payload);
      });
    },
  );

  upstreamReq.on("timeout", () => {
    upstreamReq.destroy(new Error("timed out"));
  });

  upstreamReq.on("error", (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    if (req.url === "/topology") {
      topologyFallback(res, error);
      return;
    }

    writeJson(res, 504, {
      success: false,
      error: error.message,
    });
  });

  upstreamReq.end(body);
};

const server = http.createServer((req, res) => {
  proxyRequest(req, res).catch((error) => {
    if (!res.headersSent) {
      writeJson(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      res.destroy(error);
    }
  });
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(`[axl-public-proxy] listening on 0.0.0.0:${publicPort}`);
  console.log(`[axl-public-proxy] forwarding to ${bridgeHost}:${bridgePort}`);
});
