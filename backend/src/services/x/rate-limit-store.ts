type RateLimitState = {
  isRateLimited: boolean;
  resetAt: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};

export class RateLimitStore {
  private readonly stateByProvider = new Map<string, RateLimitState>();

  get(provider: string): RateLimitState {
    const existing = this.stateByProvider.get(provider);

    if (existing) {
      return existing;
    }

    const initial: RateLimitState = {
      isRateLimited: false,
      resetAt: null,
      lastUpdatedAt: new Date().toISOString(),
      lastError: null,
    };

    this.stateByProvider.set(provider, initial);
    return initial;
  }

  markRateLimited(provider: string, input: { resetAt?: string | null; error?: string | null }) {
    this.stateByProvider.set(provider, {
      isRateLimited: true,
      resetAt: input.resetAt ?? null,
      lastUpdatedAt: new Date().toISOString(),
      lastError: input.error ?? null,
    });
  }

  clear(provider: string) {
    this.stateByProvider.set(provider, {
      isRateLimited: false,
      resetAt: null,
      lastUpdatedAt: new Date().toISOString(),
      lastError: null,
    });
  }
}
