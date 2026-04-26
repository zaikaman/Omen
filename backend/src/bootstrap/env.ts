import path from "path";

import dotenv from "dotenv";

import { normalizeRuntimeMode, type RuntimeMode } from "../scheduler/runtime-mode";

export type BackendEnv = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  frontendOrigin: string;
  runtimeMode: RuntimeMode;
  allowConcurrentRuns: boolean;
  schedulerEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  frontend: {
    appName: string;
    apiBaseUrl: string;
  };
  supabase: {
    url: string | null;
    anonKey: string | null;
    serviceRoleKey: string | null;
    schema: string;
    projectId: string | null;
    dbPassword: string | null;
  };
  axl: {
    nodeBaseUrl: string;
    apiToken: string | null;
    nodes: {
      orchestrator: string;
      scanner: string;
      research: string;
      analyst: string;
      critic: string;
    };
  };
  zeroG: {
    rpcUrl: string | null;
    indexerUrl: string | null;
    kvNodeUrl: string | null;
    computeUrl: string | null;
    computeApiKey: string | null;
    privateKey: string | null;
    flowContractAddress: string | null;
  };
  providers: {
    openaiApiKey: string | null;
    openaiBaseUrl: string;
    openaiModel: string;
    tavilyApiKey: string | null;
    scannerApiKey: string | null;
    scannerBaseUrl: string | null;
    scannerModel: string | null;
    hfToken: string | null;
    iqaiApiKey: string | null;
    binanceApiKey: string | null;
    binanceSecretKey: string | null;
    coinGeckoApiKeys: string[];
    birdeyeApiKeys: string[];
    cmcApiKeys: string[];
  };
  twitterApi: {
    baseUrl: string;
    apiKey: string | null;
    loginCookies: string | null;
    proxy: string | null;
  };
  deferred: {
    futuresEncryptionKey: string | null;
    internalWebhookKey: string | null;
    telegramBotToken: string | null;
    solanaRpcUrl: string | null;
    agentTokenContract: string | null;
    officialX: {
      apiKey: string | null;
      apiKeySecret: string | null;
      bearerToken: string | null;
      accessToken: string | null;
      accessTokenSecret: string | null;
      clientId: string | null;
      clientSecret: string | null;
    };
    hyperliquid: {
      walletPrivateKey: string | null;
      walletAddress: string | null;
    };
  };
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

const parsePort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseApiKeyArray = (
  env: NodeJS.ProcessEnv,
  prefix: "COINGECKO" | "BIRDEYE" | "CMC",
) => {
  const keys: string[] = [];

  for (let index = 1; index <= 10; index += 1) {
    const key = env[`${prefix}_API_KEY_${index.toString()}`];

    if (typeof key === "string" && key.trim()) {
      keys.push(key);
    }
  }

  return keys;
};

const normalizeNodeEnv = (value: string | undefined): BackendEnv["nodeEnv"] => {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
};

const normalizeLogLevel = (
  value: string | undefined,
): BackendEnv["logLevel"] => {
  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  ) {
    return value;
  }

  return "info";
};

const loadEnvFiles = () => {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: false });
};

export const createBackendEnv = (
  env: NodeJS.ProcessEnv = process.env,
): BackendEnv => {
  loadEnvFiles();

  const webPort = parsePort(env.WEB_PORT, 3000);
  const runtimePort = parsePort(env.RUNTIME_PORT ?? env.PORT, 4001);
  const frontendOrigin =
    env.FRONTEND_ORIGIN ??
    env.FRONTEND_URL ??
    `http://localhost:${webPort.toString()}`;
  const twitterApiKey =
    env.TWITTERAPI_API_KEY ??
    env.TWITTER_API_KEY ??
    env.TWITTERIO_API_KEY ??
    null;
  const twitterLoginCookies =
    env.TWITTERAPI_LOGIN_COOKIES ?? env.TWITTER_LOGIN_COOKIES ?? null;
  const twitterProxy =
    env.TWITTERAPI_PROXY ?? env.TWITTER_PROXY ?? env.PROXY ?? null;

  return {
    nodeEnv: normalizeNodeEnv(env.NODE_ENV),
    port: runtimePort,
    frontendOrigin,
    runtimeMode: normalizeRuntimeMode(env.RUNTIME_MODE),
    allowConcurrentRuns: parseBoolean(env.ALLOW_CONCURRENT_RUNS, false),
    schedulerEnabled: parseBoolean(env.SCHEDULER_ENABLED, true),
    logLevel: normalizeLogLevel(env.LOG_LEVEL),
    frontend: {
      appName: env.NEXT_PUBLIC_APP_NAME ?? "Omen",
      apiBaseUrl:
        env.VITE_API_BASE_URL ?? `http://localhost:${runtimePort.toString()}/api`,
    },
    supabase: {
      url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? null,
      anonKey:
        env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
      serviceRoleKey:
        env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY ?? null,
      schema: env.SUPABASE_SCHEMA ?? "public",
      projectId: env.SUPABASE_PROJECT_ID ?? null,
      dbPassword: env.SUPABASE_DB_PASSWORD ?? null,
    },
    axl: {
      nodeBaseUrl: env.AXL_NODE_BASE_URL ?? "http://127.0.0.1:8080",
      apiToken: env.AXL_API_TOKEN ?? null,
      nodes: {
        orchestrator: env.AXL_ORCHESTRATOR_NODE_ID ?? "omen-orchestrator",
        scanner: env.AXL_SCANNER_NODE_ID ?? "omen-scanner",
        research: env.AXL_RESEARCH_NODE_ID ?? "omen-research",
        analyst: env.AXL_ANALYST_NODE_ID ?? "omen-analyst",
        critic: env.AXL_CRITIC_NODE_ID ?? "omen-critic",
      },
    },
    zeroG: {
      rpcUrl: env.ZERO_G_RPC_URL ?? null,
      indexerUrl: env.ZERO_G_INDEXER_URL ?? null,
      kvNodeUrl: env.ZERO_G_KV_NODE_URL ?? null,
      computeUrl: env.ZERO_G_COMPUTE_URL ?? null,
      computeApiKey: env.ZERO_G_COMPUTE_API_KEY ?? null,
      privateKey: env.ZERO_G_PRIVATE_KEY ?? null,
      flowContractAddress: env.ZERO_G_FLOW_CONTRACT_ADDRESS ?? null,
    },
    providers: {
      openaiApiKey: env.OPENAI_API_KEY ?? null,
      openaiBaseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      openaiModel: env.OPENAI_MODEL ?? "gpt-5-mini",
      tavilyApiKey: env.TAVILY_API_KEY ?? null,
      scannerApiKey: env.SCANNER_API_KEY ?? null,
      scannerBaseUrl: env.SCANNER_BASE_URL ?? null,
      scannerModel: env.SCANNER_MODEL ?? null,
      hfToken: env.HF_TOKEN ?? null,
      iqaiApiKey: env.IQAI_API_KEY ?? null,
      binanceApiKey: env.BINANCE_API_KEY ?? null,
      binanceSecretKey: env.BINANCE_SECRET_KEY ?? null,
      coinGeckoApiKeys: parseApiKeyArray(env, "COINGECKO"),
      birdeyeApiKeys: parseApiKeyArray(env, "BIRDEYE"),
      cmcApiKeys: parseApiKeyArray(env, "CMC"),
    },
    twitterApi: {
      baseUrl: env.TWITTERAPI_BASE_URL ?? "https://api.twitterapi.io",
      apiKey: twitterApiKey,
      loginCookies: twitterLoginCookies,
      proxy: twitterProxy,
    },
    deferred: {
      futuresEncryptionKey: env.FUTURES_ENCRYPTION_KEY ?? null,
      internalWebhookKey: env.INTERNAL_WEBHOOK_KEY ?? null,
      telegramBotToken: env.TELEGRAM_BOT_TOKEN ?? null,
      solanaRpcUrl: env.SOLANA_RPC_URL ?? null,
      agentTokenContract: env.AGENT_TOKEN_CONTRACT ?? null,
      officialX: {
        apiKey: env.X_API_KEY ?? null,
        apiKeySecret: env.X_API_KEY_SECRET ?? null,
        bearerToken: env.X_BEARER_TOKEN ?? null,
        accessToken: env.X_ACCESS_TOKEN ?? null,
        accessTokenSecret: env.X_ACCESS_TOKEN_SECRET ?? null,
        clientId: env.X_CLIENT_ID ?? null,
        clientSecret: env.X_CLIENT_SECRET ?? null,
      },
      hyperliquid: {
        walletPrivateKey: env.HYPERLIQUID_WALLET_PRIVATE_KEY ?? null,
        walletAddress: env.HYPERLIQUID_WALLET_ADDRESS ?? null,
      },
    },
  };
};
