import type { BackendEnv } from "./env.js";

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const LOG_LEVEL_ORDER: Record<BackendEnv["logLevel"], number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const createLogMethod = (
  level: BackendEnv["logLevel"],
  activeLevel: BackendEnv["logLevel"],
  sink: (...args: unknown[]) => void,
) => {
  if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[activeLevel]) {
    return () => undefined;
  }

  return (...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    sink(`[omen-backend] [${timestamp}] [${level}]`, ...args);
  };
};

export const createLogger = (env: Pick<BackendEnv, "logLevel">): Logger => ({
  debug: createLogMethod("debug", env.logLevel, console.debug),
  info: createLogMethod("info", env.logLevel, console.log),
  warn: createLogMethod("warn", env.logLevel, console.warn),
  error: createLogMethod("error", env.logLevel, console.error),
});
