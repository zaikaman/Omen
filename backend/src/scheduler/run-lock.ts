export class RunLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunLockError";
  }
}

export type RunLease = {
  runId: string;
  acquiredAt: string;
};

export class RunLock {
  private activeLease: RunLease | null = null;

  constructor(private readonly allowConcurrentRuns: boolean) {}

  acquire(runId: string): RunLease {
    if (!this.allowConcurrentRuns && this.activeLease) {
      throw new RunLockError(
        `Run ${this.activeLease.runId} is already active; overlapping runs are disabled.`,
      );
    }

    const lease: RunLease = {
      runId,
      acquiredAt: new Date().toISOString(),
    };

    this.activeLease = lease;
    return lease;
  }

  release(runId?: string) {
    if (!this.activeLease) {
      return;
    }

    if (runId && this.activeLease.runId !== runId) {
      throw new RunLockError(
        `Cannot release run ${runId}; active run is ${this.activeLease.runId}.`,
      );
    }

    this.activeLease = null;
  }

  isLocked() {
    return this.activeLease !== null;
  }

  getActiveLease() {
    return this.activeLease;
  }

  async withRunLock<T>(runId: string, callback: () => Promise<T>): Promise<T> {
    const lease = this.acquire(runId);

    try {
      return await callback();
    } finally {
      this.release(lease.runId);
    }
  }
}
