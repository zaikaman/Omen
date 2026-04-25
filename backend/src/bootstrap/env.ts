import path from "path";

import dotenv from "dotenv";

import { normalizeRuntimeMode, type RuntimeMode } from "../scheduler/runtime-mode";

export type BackendEnv = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  frontendOrigin: string;
  runtimeMode: RuntimeMode;
  allowConcurrentRuns: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  twitterApi: {
    baseUrl: string;
    apiKey: string | null;
    loginCookies: string | null;
    proxy: string | null;
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

  return {
    nodeEnv: normalizeNodeEnv(env.NODE_ENV),
    port: parsePort(env.RUNTIME_PORT ?? env.PORT, 4001),
    frontendOrigin:
      env.FRONTEND_ORIGIN ?? `http://localhost:${webPort.toString()}`,
    runtimeMode: normalizeRuntimeMode(env.RUNTIME_MODE),
    allowConcurrentRuns: parseBoolean(env.ALLOW_CONCURRENT_RUNS, false),
    logLevel: normalizeLogLevel(env.LOG_LEVEL),
    twitterApi: {
      baseUrl: env.TWITTERAPI_BASE_URL ?? "https://api.twitterapi.io",
      apiKey: env.TWITTERAPI_API_KEY ?? null,
      loginCookies: env.TWITTERAPI_LOGIN_COOKIES ?? null,
      proxy: env.TWITTERAPI_PROXY ?? null,
    },
  };
};
