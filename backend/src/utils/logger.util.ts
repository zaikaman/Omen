type LoggerMethod = (...args: unknown[]) => void;

const prefix =
  (label: string, method: LoggerMethod): LoggerMethod =>
  (...args) => {
    method(`[omen-backend] ${label}`, ...args);
  };

export const logger = {
  info: prefix("info", console.log),
  warn: prefix("warn", console.warn),
  error: prefix("error", console.error),
};
