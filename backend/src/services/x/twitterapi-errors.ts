export type TwitterApiErrorKind =
  | "auth"
  | "payment_required"
  | "rate_limited"
  | "validation"
  | "transient"
  | "provider"
  | "configuration";

export class TwitterApiProviderError extends Error {
  constructor(
    message: string,
    readonly input: {
      kind: TwitterApiErrorKind;
      statusCode?: number;
      retryable: boolean;
      resetAt?: string | null;
      providerResponse?: unknown;
    },
  ) {
    super(message);
    this.name = "TwitterApiProviderError";
  }

  get kind() {
    return this.input.kind;
  }

  get statusCode() {
    return this.input.statusCode;
  }

  get retryable() {
    return this.input.retryable;
  }

  get resetAt() {
    return this.input.resetAt ?? null;
  }

  get providerResponse() {
    return this.input.providerResponse;
  }
}

const extractMessage = (body: unknown, defaultMessage: string) => {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const detail = record.detail;
    const msg = record.msg ?? record.message;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((entry) =>
          entry && typeof entry === "object" && "msg" in entry
            ? String((entry as { msg: unknown }).msg)
            : JSON.stringify(entry),
        )
        .join("; ");
    }

    if (typeof msg === "string" && msg.trim()) {
      return msg;
    }
  }

  return defaultMessage;
};

export const normalizeTwitterApiHttpError = (input: {
  statusCode: number;
  body: unknown;
  resetAt?: string | null;
}) => {
  const defaultMessage = `twitterapi returned HTTP ${input.statusCode.toString()}.`;
  const message = extractMessage(input.body, defaultMessage);

  if (input.statusCode === 401 || input.statusCode === 403) {
    return new TwitterApiProviderError(message, {
      kind: "auth",
      statusCode: input.statusCode,
      retryable: false,
      providerResponse: input.body,
    });
  }

  if (input.statusCode === 402) {
    return new TwitterApiProviderError(message, {
      kind: "payment_required",
      statusCode: input.statusCode,
      retryable: false,
      providerResponse: input.body,
    });
  }

  if (input.statusCode === 429) {
    return new TwitterApiProviderError(message, {
      kind: "rate_limited",
      statusCode: input.statusCode,
      retryable: true,
      resetAt: input.resetAt ?? null,
      providerResponse: input.body,
    });
  }

  if (input.statusCode === 400 || input.statusCode === 422) {
    return new TwitterApiProviderError(message, {
      kind: "validation",
      statusCode: input.statusCode,
      retryable: false,
      providerResponse: input.body,
    });
  }

  return new TwitterApiProviderError(message, {
    kind: input.statusCode >= 500 ? "transient" : "provider",
    statusCode: input.statusCode,
    retryable: input.statusCode >= 500,
    providerResponse: input.body,
  });
};

export const normalizeTwitterApiSemanticError = (body: unknown) =>
  new TwitterApiProviderError(extractMessage(body, "twitterapi returned an error."), {
    kind: "provider",
    retryable: false,
    providerResponse: body,
  });
