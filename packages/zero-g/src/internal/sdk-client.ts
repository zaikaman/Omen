import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Batcher, Indexer, KvClient, getFlowContract } from "@0gfoundation/0g-ts-sdk";
import { err, ok, type Result } from "@omen/shared";
import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from "ethers";

const DEFAULT_EXPECTED_REPLICA = 1;
const DEFAULT_NAMESPACE_SEED = "omen-zero-g-kv-v1";
const ZERO_G_UPLOAD_RESULT_PREFIX = "__ZERO_G_UPLOAD_RESULT__";
const ZERO_G_CHILD_UPLOAD_TIMEOUT_MS = 180_000;
const ZERO_G_WRITE_RETRY_DELAYS_MS = [2_000, 5_000];
const ZERO_G_UPLOAD_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const signerWriteQueues = new Map<string, Promise<void>>();

const zeroGSdkVerboseLoggingEnabled = () =>
  process.env.ZERO_G_SDK_LOGS === "true" || process.env.LOG_LEVEL === "debug";

const withSilencedZeroGSdkConsole = async <T>(operation: () => Promise<T>) => {
  if (zeroGSdkVerboseLoggingEnabled()) {
    return operation();
  }

  const originalConsole = {
    debug: console.debug,
    info: console.info,
    log: console.log,
  };

  try {
    console.debug = () => undefined;
    console.info = () => undefined;
    console.log = () => undefined;

    return await operation();
  } finally {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.log = originalConsole.log;
  }
};

export type ZeroGSdkClientConfig = {
  indexerUrl: string;
  blockchainRpcUrl?: string | null;
  kvNodeUrl?: string | null;
  privateKey?: string | null;
  flowContractAddress?: string | null;
  expectedReplica?: number;
  namespaceSeed?: string;
  requestTimeoutMs?: number;
};

export type ZeroGUploadedObject = {
  locator: string;
  rootHash: string;
  rootHashes: string[];
  txHash: string | null;
  txHashes: string[];
  txSeq: number | null;
  txSeqs: number[];
};

export type ZeroGStoredValue = {
  key: string;
  value: string;
  streamId: string;
  encodedKey: string;
  locator: string;
  version: number;
  size: number;
};

export type ZeroGStoredKey = {
  key: string;
  streamId: string;
  encodedKey: string;
  locator: string;
  txHash: string;
  rootHash: string;
};

export class ZeroGSdkClient {
  private readonly blockchainRpcUrl: string | null;

  private readonly kvNodeUrl: string | null;

  private readonly privateKey: string | null;

  private readonly flowContractAddress: string | null;

  private readonly expectedReplica: number;

  private readonly namespaceSeed: string;

  private readonly requestTimeoutMs: number;

  constructor(private readonly config: ZeroGSdkClientConfig) {
    this.blockchainRpcUrl = config.blockchainRpcUrl?.trim() || null;
    this.kvNodeUrl = config.kvNodeUrl?.trim() || null;
    this.privateKey = config.privateKey?.trim() || null;
    this.flowContractAddress = config.flowContractAddress?.trim() || null;
    this.expectedReplica = config.expectedReplica ?? DEFAULT_EXPECTED_REPLICA;
    this.namespaceSeed = config.namespaceSeed ?? DEFAULT_NAMESPACE_SEED;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 10_000;
  }

  async putKeyValue(key: string, value: Uint8Array): Promise<Result<ZeroGStoredKey, Error>> {
    const blockchainRpcUrl = this.requireBlockchainRpcUrl();

    if (!blockchainRpcUrl.ok) {
      return blockchainRpcUrl;
    }

    return this.withSerializedSignerResult(blockchainRpcUrl.value, async () => {
      const signer = this.createSigner(blockchainRpcUrl.value);
      const indexer = new Indexer(this.config.indexerUrl);

      try {
        const selectedNodes = await this.withTimeout(
          indexer.selectNodes(this.expectedReplica),
          "0G indexer node selection timed out.",
        );
        const [clients, selectError] = selectedNodes;

        if (selectError || clients.length === 0) {
          return err(
            selectError ?? new Error("0G indexer did not return any writable storage nodes."),
          );
        }

        const flowAddress = await this.resolveFlowAddress(clients);

        if (!flowAddress.ok) {
          return flowAddress;
        }

        const batcher = new Batcher(
          1,
          clients,
          getFlowContract(flowAddress.value, signer),
          blockchainRpcUrl.value,
        );
        const streamId = this.deriveStreamId(key);
        const encodedKeyBytes = this.encodeKeyBytes(key);

        batcher.streamDataBuilder.set(streamId, encodedKeyBytes, value);

        const executed = await this.withTimeout(
          withSilencedZeroGSdkConsole(() => batcher.exec()),
          "0G KV batch execution timed out.",
        );
        const [result, execError] = executed;

        if (execError) {
          return err(execError);
        }

        const encodedKey = this.encodeKeyBase64(key);

        return ok({
          key,
          streamId,
          encodedKey,
          locator: this.buildKvLocator(streamId, encodedKey),
          txHash: result.txHash,
          rootHash: result.rootHash,
        });
      } catch (error) {
        return err(error instanceof Error ? error : new Error("0G KV write failed."));
      }
    });
  }

  async getKeyValue(key: string): Promise<Result<ZeroGStoredValue | null, Error>> {
    if (!this.kvNodeUrl) {
      return err(new Error("0G KV reads require ZERO_G_KV_NODE_URL."));
    }

    const streamId = this.deriveStreamId(key);
    const encodedKey = this.encodeKeyBase64(key);
    const client = new KvClient(this.kvNodeUrl);

    try {
      const value = await this.withTimeout(
        client.getValue(streamId, encodedKey as unknown as Uint8Array),
        "0G KV read timed out.",
      );

      if (!value) {
        return ok(null);
      }

      const decoded = Buffer.from(value.data, "base64");

      return ok({
        key,
        value: textDecoder.decode(decoded),
        streamId,
        encodedKey,
        locator: this.buildKvLocator(streamId, encodedKey),
        version: value.version,
        size: value.size,
      });
    } catch (error) {
      return err(error instanceof Error ? error : new Error("0G KV read failed."));
    }
  }

  async uploadObject(input: {
    logicalName: string;
    bytes: Uint8Array;
  }): Promise<Result<ZeroGUploadedObject, Error>> {
    const blockchainRpcUrl = this.requireBlockchainRpcUrl();

    if (!blockchainRpcUrl.ok) {
      return blockchainRpcUrl;
    }

    return this.withSerializedSignerResult(blockchainRpcUrl.value, async () => {
      try {
        const retryDelays: Array<number | null> = [...ZERO_G_UPLOAD_RETRY_DELAYS_MS, null];
        let lastError: Error | null = null;

        for (const delayMs of retryDelays) {
          const uploaded = await this.uploadObjectWithWorker(input.bytes);

          if (uploaded.ok) {
            return ok(uploaded.value);
          }

          lastError = uploaded.error;

          if (delayMs !== null) {
            await this.delay(delayMs);
          }
        }

        return err(lastError ?? new Error("0G file upload failed."));
      } catch (error) {
        return err(error instanceof Error ? error : new Error("0G file upload failed."));
      }
    });
  }

  deriveStreamId(key: string) {
    const marker = "/kv/";
    const streamNamespace = key.includes(marker) ? (key.split(marker)[0] ?? key) : key;

    return keccak256(toUtf8Bytes(`${this.namespaceSeed}:${streamNamespace}`));
  }

  encodeKeyBase64(key: string) {
    return Buffer.from(this.encodeKeyBytes(key)).toString("base64");
  }

  private requireBlockchainRpcUrl(): Result<string, Error> {
    if (!this.blockchainRpcUrl) {
      return err(new Error("0G writes require ZERO_G_RPC_URL."));
    }

    if (!this.privateKey) {
      return err(new Error("0G writes require ZERO_G_PRIVATE_KEY."));
    }

    return ok(this.blockchainRpcUrl);
  }

  private createSigner(blockchainRpcUrl: string) {
    return new Wallet(this.privateKey!, new JsonRpcProvider(blockchainRpcUrl));
  }

  private async withSerializedSignerResult<T>(
    blockchainRpcUrl: string,
    operation: () => Promise<Result<T, Error>>,
  ): Promise<Result<T, Error>> {
    const queueKey = this.getSignerQueueKey(blockchainRpcUrl);
    const previous = signerWriteQueues.get(queueKey) ?? Promise.resolve();
    let releaseQueue: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);

    signerWriteQueues.set(queueKey, queued);
    await previous.catch(() => undefined);

    try {
      const retryDelays: Array<number | null> = [...ZERO_G_WRITE_RETRY_DELAYS_MS, null];

      for (const delayMs of retryDelays) {
        const result = await operation();

        if (result.ok || !this.isReplacementUnderpricedError(result.error) || delayMs === null) {
          return result;
        }

        await this.delay(delayMs);
      }

      return operation();
    } finally {
      releaseQueue();

      if (signerWriteQueues.get(queueKey) === queued) {
        signerWriteQueues.delete(queueKey);
      }
    }
  }

  private getSignerQueueKey(blockchainRpcUrl: string) {
    return keccak256(toUtf8Bytes(`${blockchainRpcUrl}:${this.privateKey ?? ""}`));
  }

  private isReplacementUnderpricedError(error: Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes("replacement_underpriced") ||
      message.includes("replacement transaction underpriced") ||
      message.includes("replacement fee too low")
    );
  }

  private async delay(delayMs: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  private encodeKeyBytes(key: string) {
    return textEncoder.encode(key);
  }

  private async resolveFlowAddress(
    clients: { getStatus(): Promise<{ networkIdentity?: { flowAddress?: string } } | null> }[],
  ) {
    if (this.flowContractAddress) {
      return ok(this.flowContractAddress);
    }

    const firstNode = clients[0];

    if (!firstNode) {
      return err(new Error("0G indexer returned no nodes to resolve the flow contract."));
    }

    const status = await this.withTimeout(
      firstNode.getStatus(),
      "0G node status request timed out.",
    );
    const flowAddress = status?.networkIdentity?.flowAddress?.trim();

    if (!flowAddress) {
      return err(new Error("0G node status did not expose a flow contract address."));
    }

    return ok(flowAddress);
  }

  private async withTimeout<T>(promise: Promise<T>, message: string) {
    let timer: NodeJS.Timeout | null = null;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(message));
          }, this.requestTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private buildKvLocator(streamId: string, encodedKey: string) {
    const base = this.kvNodeUrl ?? this.config.indexerUrl;
    return `${base.replace(/\/$/, "")}/kv/${streamId}/${encodeURIComponent(encodedKey)}`;
  }

  private buildFileLocator(rootHash: string) {
    return `0g://file/${rootHash}`;
  }

  private async uploadObjectWithWorker(
    bytes: Uint8Array,
  ): Promise<Result<ZeroGUploadedObject, Error>> {
    const blockchainRpcUrl = this.requireBlockchainRpcUrl();

    if (!blockchainRpcUrl.ok) {
      return blockchainRpcUrl;
    }

    const workerScriptUrl = new URL("./zero-g-upload-runner.mjs", import.meta.url);
    const payload = JSON.stringify({
      indexerUrl: this.config.indexerUrl,
      blockchainRpcUrl: blockchainRpcUrl.value,
      privateKey: this.privateKey,
      flowContractAddress: this.flowContractAddress,
      expectedReplica: this.expectedReplica,
      base64: Buffer.from(bytes).toString("base64"),
    });

    return new Promise<Result<ZeroGUploadedObject, Error>>((resolve) => {
      const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [
        fileURLToPath(workerScriptUrl),
      ]);
      const timeoutMs = Math.max(this.requestTimeoutMs, ZERO_G_CHILD_UPLOAD_TIMEOUT_MS);
      let stdoutBuffer = "";
      let stderrBuffer = "";
      let settled = false;
      let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
        child.kill("SIGKILL");
        settle(
          err(new Error(`0G file upload exceeded ${timeoutMs.toString()}ms and was terminated.`)),
        );
      }, timeoutMs);

      const settle = (result: Result<ZeroGUploadedObject, Error>) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        resolve(result);
      };

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdin.end(payload);

      child.stdout.on("data", (chunk: string) => {
        stdoutBuffer += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderrBuffer += chunk;
      });
      child.on("error", (error: Error) => {
        settle(err(error instanceof Error ? error : new Error(String(error))));
      });
      child.on("close", () => {
        const lines = stdoutBuffer
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        const payloadLine = [...lines]
          .reverse()
          .find((line) => line.startsWith(ZERO_G_UPLOAD_RESULT_PREFIX));

        if (!payloadLine) {
          settle(
            err(
              new Error(
                stderrBuffer.trim() ||
                  "0G upload worker exited without returning a result payload.",
              ),
            ),
          );
          return;
        }

        try {
          const parsed = JSON.parse(payloadLine.slice(ZERO_G_UPLOAD_RESULT_PREFIX.length)) as
            | { ok: true; value: ZeroGUploadedObject }
            | { ok: false; error: string };

          if (!parsed.ok) {
            settle(err(new Error(parsed.error)));
            return;
          }

          settle(ok(parsed.value));
        } catch (error) {
          settle(
            err(
              error instanceof Error
                ? error
                : new Error("Failed to parse 0G upload worker response."),
            ),
          );
        }
      });
    });
  }
}
