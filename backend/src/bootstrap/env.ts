import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

import { normalizeRuntimeMode, type RuntimeMode } from "../scheduler/runtime-mode.js";

export type BackendEnv = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  frontendOrigin: string;
  runtimeMode: RuntimeMode;
  allowConcurrentRuns: boolean;
  schedulerEnabled: boolean;
  copytradeExecutorEnabled: boolean;
  copytradeExecutorIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
  supabase: {
    url: string | null;
    anonKey: string | null;
    serviceRoleKey: string | null;
    schema: string;
  };
  axl: {
    nodeBaseUrl: string;
    apiToken: string | null;
    requestTimeoutMs: number;
    nodes: {
      orchestrator: string;
      marketBias: string;
      scanner: string;
      research: string;
      chartVision: string;
      analyst: string;
      critic: string;
      intel: string;
      generator: string;
      writer: string;
      publisher: string;
      memory: string;
    };
  };
  zeroG: {
    rpcUrl: string | null;
    indexerUrl: string | null;
    kvNodeUrl: string | null;
    computeUrl: string | null;
    computeApiKey: string | null;
    computeModel: string;
    privateKey: string | null;
    flowContractAddress: string | null;
    runRegistryAddress: string | null;
    chainId: string;
    chainExplorerBaseUrl: string | null;
    checkpointStrategy: "milestone" | "all";
  };
  inft: {
    attestorAddress: string | null;
    contractAddress: string | null;
    tokenId: string | null;
    ownerAddress: string | null;
    encryptedIntelligenceUri: string | null;
    memoryRoot: string | null;
    proofManifestUri: string | null;
    latestRunId: string | null;
    mintTransactionHash: string | null;
  };
  providers: {
    openaiApiKey: string | null;
    openaiBaseUrl: string;
    openaiModel: string;
    scannerApiKey: string | null;
    scannerBaseUrl: string | null;
    scannerModel: string | null;
    hfToken: string | null;
    hfTokens: string[];
    iqaiApiKey: string | null;
    binanceApiKey: string | null;
    binanceSecretKey: string | null;
    coinGeckoApiKeys: string[];
    birdeyeApiKeys: string[];
    cmcApiKeys: string[];
  };
  r2: {
    accountId: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    bucketName: string;
    publicUrl: string | null;
  };
  twitterApi: {
    baseUrl: string;
    apiKey: string | null;
    loginCookies: string | null;
    proxy: string | null;
    userName: string | null;
    email: string | null;
    password: string | null;
    totpSecret: string | null;
  };
  telegram: {
    botToken: string | null;
    chatId: string | null;
    baseUrl: string;
  };
  heroku: {
    apiToken: string | null;
    appName: string | null;
    apiBaseUrl: string;
    logLineCount: number;
    requestTimeoutMs: number;
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

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
};

const parsePort = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const parseApiKeyArray = (env: NodeJS.ProcessEnv, prefix: "COINGECKO" | "BIRDEYE" | "CMC") => {
  const keys: string[] = [];
  const primaryKey = env[`${prefix}_API_KEY`];

  if (typeof primaryKey === "string" && primaryKey.trim()) {
    keys.push(primaryKey);
  }

  for (let index = 1; index <= 10; index += 1) {
    const key = env[`${prefix}_API_KEY_${index.toString()}`];

    if (typeof key === "string" && key.trim()) {
      keys.push(key);
    }
  }

  return keys;
};

const parseHfTokens = (env: NodeJS.ProcessEnv) => {
  const tokens: string[] = [];
  const primaryToken = env.HF_TOKEN;

  if (typeof primaryToken === "string" && primaryToken.trim()) {
    tokens.push(primaryToken);
  }

  for (let index = 2; index <= 17; index += 1) {
    const token = env[`HF_TOKEN_${index.toString()}`];

    if (typeof token === "string" && token.trim()) {
      tokens.push(token);
    }
  }

  return tokens;
};

const normalizeNodeEnv = (value: string | undefined): BackendEnv["nodeEnv"] => {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
};

const normalizeLogLevel = (value: string | undefined): BackendEnv["logLevel"] => {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
};

const normalizeZeroGCheckpointStrategy = (value: string | undefined) =>
  value === "all" ? "all" : "milestone";

const backendEnvPaths = () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  return [
    path.resolve(currentDir, "../../.env"),
    path.resolve(currentDir, "../../../../.env"),
  ].filter((envPath) => path.basename(path.dirname(envPath)) === "backend");
};

export const loadEnvFiles = () => {
  for (const envPath of backendEnvPaths()) {
    dotenv.config({ path: envPath, override: false });
  }
};

export const createBackendEnv = (env: NodeJS.ProcessEnv = process.env): BackendEnv => {
  loadEnvFiles();

  const runtimePort = parsePort(env.PORT, 4001);
  const frontendOrigin = env.FRONTEND_ORIGIN ?? env.FRONTEND_URL ?? "http://localhost:5173";
  const twitterApiKey =
    env.TWITTERAPI_API_KEY ??
    env.TWITTERAPI_IO_KEY ??
    env.TWITTER_API_KEY ??
    env.TWITTERIO_API_KEY ??
    null;
  const twitterLoginCookies = env.TWITTERAPI_LOGIN_COOKIES ?? env.TWITTER_LOGIN_COOKIES ?? null;
  const twitterProxy = env.TWITTERAPI_PROXY ?? env.TWITTER_PROXY ?? null;

  return {
    nodeEnv: normalizeNodeEnv(env.NODE_ENV),
    port: runtimePort,
    frontendOrigin,
    runtimeMode: normalizeRuntimeMode(env.RUNTIME_MODE),
    allowConcurrentRuns: parseBoolean(env.ALLOW_CONCURRENT_RUNS, false),
    schedulerEnabled: parseBoolean(env.SCHEDULER_ENABLED, true),
    copytradeExecutorEnabled: parseBoolean(env.COPYTRADE_EXECUTOR_ENABLED, true),
    copytradeExecutorIntervalMs: parsePort(env.COPYTRADE_EXECUTOR_INTERVAL_MS, 20_000),
    logLevel: normalizeLogLevel(env.LOG_LEVEL),
    supabase: {
      url: env.SUPABASE_URL ?? null,
      anonKey: env.SUPABASE_ANON_KEY ?? null,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? null,
      schema: env.SUPABASE_SCHEMA ?? "public",
    },
    axl: {
      nodeBaseUrl: env.AXL_NODE_BASE_URL ?? "",
      apiToken: env.AXL_API_TOKEN ?? null,
      requestTimeoutMs: parsePort(env.AXL_REQUEST_TIMEOUT_MS, 300_000),
      nodes: {
        orchestrator: env.AXL_ORCHESTRATOR_NODE_ID ?? "",
        marketBias: env.AXL_MARKET_BIAS_NODE_ID ?? "",
        scanner: env.AXL_SCANNER_NODE_ID ?? "",
        research: env.AXL_RESEARCH_NODE_ID ?? "",
        chartVision: env.AXL_CHART_VISION_NODE_ID ?? "",
        analyst: env.AXL_ANALYST_NODE_ID ?? "",
        critic: env.AXL_CRITIC_NODE_ID ?? "",
        intel: env.AXL_INTEL_NODE_ID ?? "",
        generator: env.AXL_GENERATOR_NODE_ID ?? "",
        writer: env.AXL_WRITER_NODE_ID ?? "",
        publisher: env.AXL_PUBLISHER_NODE_ID ?? "",
        memory: env.AXL_MEMORY_NODE_ID ?? "",
      },
    },
    zeroG: {
      rpcUrl: env.ZERO_G_RPC_URL ?? null,
      indexerUrl: env.ZERO_G_INDEXER_URL ?? null,
      kvNodeUrl: env.ZERO_G_KV_NODE_URL ?? null,
      computeUrl: env.ZERO_G_COMPUTE_URL ?? null,
      computeApiKey: env.ZERO_G_COMPUTE_API_KEY ?? null,
      computeModel: env.ZERO_G_COMPUTE_MODEL ?? "qwen/qwen-2.5-7b-instruct",
      privateKey: env.ZERO_G_PRIVATE_KEY ?? null,
      flowContractAddress: env.ZERO_G_FLOW_CONTRACT_ADDRESS ?? null,
      runRegistryAddress: env.ZERO_G_RUN_REGISTRY_ADDRESS ?? null,
      chainId: env.ZERO_G_CHAIN_ID ?? "16602",
      chainExplorerBaseUrl: env.ZERO_G_CHAIN_EXPLORER_BASE_URL ?? null,
      checkpointStrategy: normalizeZeroGCheckpointStrategy(env.ZERO_G_CHECKPOINT_STRATEGY),
    },
    inft: {
      attestorAddress: env.OMEN_INFT_ATTESTOR_ADDRESS ?? null,
      contractAddress: env.OMEN_INFT_CONTRACT_ADDRESS ?? null,
      tokenId: env.OMEN_INFT_TOKEN_ID ?? null,
      ownerAddress: env.OMEN_INFT_OWNER_ADDRESS ?? null,
      encryptedIntelligenceUri: env.OMEN_INFT_ENCRYPTED_INTELLIGENCE_URI ?? null,
      memoryRoot: env.OMEN_INFT_MEMORY_ROOT ?? null,
      proofManifestUri: env.OMEN_INFT_PROOF_MANIFEST_URI ?? null,
      latestRunId: env.OMEN_INFT_LATEST_RUN_ID ?? null,
      mintTransactionHash: env.OMEN_INFT_MINT_TRANSACTION_HASH ?? null,
    },
    providers: {
      openaiApiKey: env.OPENAI_API_KEY ?? null,
      openaiBaseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      openaiModel: env.OPENAI_MODEL ?? "gpt-5-mini",
      scannerApiKey: env.SCANNER_API_KEY ?? null,
      scannerBaseUrl: env.SCANNER_BASE_URL ?? null,
      scannerModel: env.SCANNER_MODEL ?? null,
      hfToken: env.HF_TOKEN ?? null,
      hfTokens: parseHfTokens(env),
      iqaiApiKey: env.IQAI_API_KEY ?? null,
      binanceApiKey: env.BINANCE_API_KEY ?? null,
      binanceSecretKey: env.BINANCE_SECRET_KEY ?? null,
      coinGeckoApiKeys: parseApiKeyArray(env, "COINGECKO"),
      birdeyeApiKeys: parseApiKeyArray(env, "BIRDEYE"),
      cmcApiKeys: parseApiKeyArray(env, "CMC"),
    },
    r2: {
      accountId: env.R2_ACCOUNT_ID ?? null,
      accessKeyId: env.R2_ACCESS_KEY_ID ?? null,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? null,
      bucketName: env.R2_BUCKET_NAME ?? "omen",
      publicUrl: env.R2_PUBLIC_URL ?? null,
    },
    twitterApi: {
      baseUrl: env.TWITTERAPI_BASE_URL ?? "https://api.twitterapi.io",
      apiKey: twitterApiKey,
      loginCookies: twitterLoginCookies,
      proxy: twitterProxy,
      userName: env.TWITTERAPI_USER_NAME ?? env.TWITTER_USER_NAME ?? null,
      email: env.TWITTERAPI_EMAIL ?? env.TWITTER_EMAIL ?? null,
      password: env.TWITTERAPI_PASSWORD ?? env.TWITTER_PASSWORD ?? null,
      totpSecret: env.TWITTERAPI_TOTP_SECRET ?? env.TWITTER_TOTP_SECRET ?? null,
    },
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN ?? null,
      chatId: env.TELEGRAM_CHAT_ID ?? env.TELEGRAM_CHANNEL_ID ?? null,
      baseUrl: env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org",
    },
    heroku: {
      apiToken: env.HEROKU_API_TOKEN ?? env.HEROKU_API_KEY ?? null,
      appName: env.HEROKU_APP_NAME ?? env.HEROKU_APP_ID ?? null,
      apiBaseUrl: env.HEROKU_API_BASE_URL ?? "https://api.heroku.com",
      logLineCount: parsePort(env.HEROKU_LOG_LINE_COUNT, 80),
      requestTimeoutMs: parsePort(env.HEROKU_LOG_REQUEST_TIMEOUT_MS, 5000),
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
