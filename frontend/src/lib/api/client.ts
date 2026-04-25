const DEFAULT_API_BASE_URL = 'http://localhost:4001/api';

export type Parser<TOutput> = {
  parse: (input: unknown) => TOutput;
};

export class ApiClientError extends Error {
  readonly status: number;

  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const resolveApiBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (typeof envBaseUrl === 'string' && envBaseUrl.trim()) {
    return envBaseUrl.replace(/\/$/, '');
  }

  return DEFAULT_API_BASE_URL;
};

export const buildApiUrl = (path: string) =>
  new URL(path.replace(/^\//, ''), `${resolveApiBaseUrl()}/`).toString();

export const apiRequest = async <TOutput>(
  path: string,
  schema: Parser<TOutput>,
  options: ApiRequestOptions = {},
): Promise<TOutput> => {
  const response = await fetch(buildApiUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorPayload: unknown = null;

    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = await response.text();
    }

    throw new ApiClientError(
      `API request to ${path} failed with status ${response.status.toString()}.`,
      response.status,
      errorPayload,
    );
  }

  if (response.status === 204) {
    return schema.parse(undefined);
  }

  const payload = (await response.json()) as unknown;
  return schema.parse(payload);
};
