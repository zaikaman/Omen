import { afterEach, describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "@omen/shared";

import {
  createZeroGArtifactLink,
  RunManifestBuilder,
  ZeroGClientAdapter,
  ZeroGAdjudication,
  ZeroGFileStore,
  ZeroGLogStore,
  ZeroGNamespaceBuilder,
  ZeroGProofAnchor,
  ZeroGProofRegistry,
  ZeroGReportSynthesis,
  ZeroGStateStore,
} from "../src/index.js";
import { ZeroGLogAdapter } from "../src/storage/log-adapter.js";
import { ZeroGStorageAdapter } from "../src/storage/storage-adapter.js";
import { ZeroGSdkClient } from "../src/internal/sdk-client.js";

type SignerQueueHarness = {
  withSerializedSignerResult<T>(
    blockchainRpcUrl: string,
    operation: () => Promise<Result<T, Error>>,
  ): Promise<Result<T, Error>>;
};

type UploadRetryHarness = ZeroGSdkClient & {
  uploadObjectWithWorker(bytes: Uint8Array): Promise<
    Result<
      {
        locator: string;
        rootHash: string;
        rootHashes: string[];
        txHash: string | null;
        txHashes: string[];
        txSeq: number | null;
        txSeqs: number[];
      },
      Error
    >
  >;
  delay(delayMs: number): Promise<void>;
};

describe("zero-g adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const storageBridge = {
    putKeyValue: vi.fn(async (key: string) =>
      ok({
        locator: `https://storage.0g.ai/kv/stream/${encodeURIComponent(key)}`,
        streamId: "0xstream",
        encodedKey: Buffer.from(key).toString("base64"),
        txHash: "0xtx",
        rootHash: "0xroot",
      }),
    ),
    getKeyValue: vi.fn(async (key: string) =>
      ok({
        key,
        value: "state",
        streamId: "0xstream",
        encodedKey: Buffer.from(key).toString("base64"),
        locator: `https://storage.0g.ai/kv/stream/${encodeURIComponent(key)}`,
        version: 1,
        size: 5,
      }),
    ),
    uploadObject: vi.fn(async ({ logicalName }: { logicalName: string }) =>
      ok({
        locator: `0g://file/${logicalName}`,
        rootHash: "0xfile-root",
        rootHashes: ["0xfile-root"],
        txHash: "0xfile-tx",
        txHashes: ["0xfile-tx"],
        txSeq: 7,
        txSeqs: [7],
      }),
    ),
  };
  const logBridge = {
    uploadObject: vi.fn(async ({ logicalName }: { logicalName: string }) =>
      ok({
        locator: `0g://file/${logicalName}`,
        rootHash: "0xlog-root",
        rootHashes: ["0xlog-root"],
        txHash: "0xlog-tx",
        txHashes: ["0xlog-tx"],
        txSeq: 8,
        txSeqs: [8],
      }),
    ),
  };
  const adapter = new ZeroGClientAdapter({
    storage: {
      indexerUrl: "https://indexer-storage-testnet.0g.ai",
    },
    log: {
      baseUrl: "https://indexer-storage-testnet.0g.ai",
    },
  }, {
    storage: new ZeroGStorageAdapter(
      {
        indexerUrl: "https://indexer-storage-testnet.0g.ai",
      },
      storageBridge,
    ),
    log: new ZeroGLogAdapter(
      {
        baseUrl: "https://indexer-storage-testnet.0g.ai",
      },
      logBridge,
    ),
  });

  it("creates proof artifacts for KV writes", async () => {
    const result = await adapter.putState({
      key: "runs/run-1/checkpoint",
      value: "state",
      metadata: { step: "scanner" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refType).toBe("kv_state");
      expect(result.value.key).toBe("runs/run-1/checkpoint");
    }
  });

  it("serializes 0G signer writes that share an RPC and private key", async () => {
    const firstClient = new ZeroGSdkClient({
      indexerUrl: "https://indexer-storage-testnet.0g.ai",
      blockchainRpcUrl: "https://evmrpc-testnet.0g.ai",
      privateKey: `0x${"1".repeat(64)}`,
    }) as unknown as SignerQueueHarness;
    const secondClient = new ZeroGSdkClient({
      indexerUrl: "https://indexer-storage-testnet.0g.ai",
      blockchainRpcUrl: "https://evmrpc-testnet.0g.ai",
      privateKey: `0x${"1".repeat(64)}`,
    }) as unknown as SignerQueueHarness;
    const calls: string[] = [];
    const first = firstClient.withSerializedSignerResult(
      "https://evmrpc-testnet.0g.ai",
      async () => {
        calls.push("first:start");
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        calls.push("first:end");
        return ok("first");
      },
    );
    const second = secondClient.withSerializedSignerResult(
      "https://evmrpc-testnet.0g.ai",
      async () => {
        calls.push("second:start");
        calls.push("second:end");
        return ok("second");
      },
    );

    await Promise.all([first, second]);

    expect(calls).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("retries 0G file uploads three times before surfacing success", async () => {
    const client = new ZeroGSdkClient({
      indexerUrl: "https://indexer-storage-testnet.0g.ai",
      blockchainRpcUrl: "https://evmrpc-testnet.0g.ai",
      privateKey: `0x${"1".repeat(64)}`,
    }) as UploadRetryHarness;
    const uploadObjectWithWorker = vi
      .spyOn(client, "uploadObjectWithWorker")
      .mockResolvedValueOnce(err(new Error("first upload failure")))
      .mockResolvedValueOnce(err(new Error("second upload failure")))
      .mockResolvedValueOnce(
        ok({
          locator: "0g://file/retried",
          rootHash: "0xretried",
          rootHashes: ["0xretried"],
          txHash: "0xtx",
          txHashes: ["0xtx"],
          txSeq: 1,
          txSeqs: [1],
        }),
      );
    const delay = vi.spyOn(client, "delay").mockResolvedValue(undefined);

    const result = await client.uploadObject({
      logicalName: "retried.json",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result.ok).toBe(true);
    expect(uploadObjectWithWorker).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it("creates proof artifacts for log appends", async () => {
    const result = await adapter.appendLog({
      stream: "runs/run-1/trace",
      content: "trace line",
      metadata: { entries: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refType).toBe("log_entry");
      expect(result.value.locator).toContain("0g://file/");
    }
  });

  it("writes run-bound checkpoint artifacts through the state store", async () => {
    const stateStore = new ZeroGStateStore(adapter);
    const result = await stateStore.writeRunCheckpoint({
      environment: "testnet",
      runId: "run-1",
      checkpointLabel: "critic-approved",
      state: { status: "completed" },
      metadata: { step: "critic" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.runId).toBe("run-1");
      expect(result.value.key).toContain("/kv/critic-approved");
      expect(result.value.metadata.checkpointLabel).toBe("critic-approved");
    }
  });

  it("writes run-bound immutable log artifacts through the log store", async () => {
    const logStore = new ZeroGLogStore(adapter);
    const result = await logStore.appendRunLog({
      environment: "testnet",
      runId: "run-1",
      stream: "debate-trace",
      content: ["scanner complete", "critic approved"],
      metadata: { stepCount: 2 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.runId).toBe("run-1");
      expect(result.value.locator).toContain("0g://file/");
      expect(result.value.metadata.stream).toContain("/logs/debate-trace");
    }
  });

  it("writes run-bound file bundle artifacts through the file store", async () => {
    const fileStore = new ZeroGFileStore(adapter);
    const result = await fileStore.publishRunBundle({
      environment: "testnet",
      runId: "run-1",
      signalId: "signal-1",
      segments: ["evidence-bundles"],
      bundle: "evidence-pack.json",
      contentType: "application/json",
      bytes: JSON.stringify({ evidence: 2 }),
      metadata: { label: "evidence-pack" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.runId).toBe("run-1");
      expect(result.value.refType).toBe("file_artifact");
      expect(result.value.key).toContain("/files/evidence-pack.json");
      expect(result.value.metadata.label).toBe("evidence-pack");
    }
  });

  it("rejects compute requests when compute is not configured", async () => {
    const result = await adapter.requestCompute({
      model: "glm-5",
      prompt: "summarize",
      metadata: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/compute adapter is not configured/i);
    }
  });

  it("returns a compute proof artifact for report synthesis when compute is configured", async () => {
    const computeAdapter = new ZeroGClientAdapter({
      storage: {
        indexerUrl: "https://indexer-storage-testnet.0g.ai",
      },
      log: {
        baseUrl: "https://indexer-storage-testnet.0g.ai",
      },
      compute: {
        baseUrl: "https://compute.0g.ai/infer",
      },
    });
    const synthesis = new ZeroGReportSynthesis(computeAdapter);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({
          ok: true,
          headers: new Headers({
            "ZG-Res-Key": "job-1",
            "ZG-TEE-Mode": "tee",
          }),
          json: async () => ({
            choices: [
              {
                message: {
                  content: "Synthesized report",
                },
              },
            ],
            requestHash: "req-hash",
            responseHash: "res-hash",
          }),
        }) as Response),
    );

    const result = await synthesis.synthesizeRunReport({
      runId: "run-1",
      prompt: "Summarize this run",
      model: "glm-5",
      metadata: { phase: "demo" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.artifact.refType).toBe("compute_result");
      expect(result.value.proof.jobId).toBe("job-1");
      expect(result.value.output).toBe("Synthesized report");
    }
    expect(fetch).toHaveBeenCalledWith(
      "https://compute.0g.ai/infer/v1/proxy/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("returns a compute proof artifact for adjudication when compute is configured", async () => {
    const computeAdapter = new ZeroGClientAdapter({
      storage: {
        indexerUrl: "https://indexer-storage-testnet.0g.ai",
      },
      log: {
        baseUrl: "https://indexer-storage-testnet.0g.ai",
      },
      compute: {
        baseUrl: "https://compute.0g.ai/infer",
      },
    });
    const adjudication = new ZeroGAdjudication(computeAdapter);

    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          headers: new Headers({
            "ZG-Res-Key": "job-2",
            "ZG-TEE-Mode": "tee",
          }),
          json: async () => ({
            choices: [
              {
                message: {
                  content: "Approved because confluence and evidence remain strong.",
                },
              },
            ],
            requestHash: "req-hash-2",
            responseHash: "res-hash-2",
          }),
        }) as Response,
    );

    const result = await adjudication.adjudicate({
      runId: "run-1",
      thesis: "BTC long with breakout confirmation.",
      evidence: ["Momentum breakout", "Funding remains supportive"],
      priorDecision: "approved",
      model: "glm-5",
      metadata: { phase: "final" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.artifact.refType).toBe("compute_result");
      expect(result.value.artifact.metadata.stage).toBe("adjudication");
      expect(result.value.artifact.metadata.stepName).toBe("0G Compute Adjudication");
      expect(result.value.artifact.metadata.prompt).toContain("BTC long");
      expect(result.value.artifact.metadata.output).toBe(
        "Approved because confluence and evidence remain strong.",
      );
      expect(result.value.decisionHint).toBe("approved");
      expect(result.value.proof.jobId).toBe("job-2");
    }
  });

  it("derives compute request and response hashes when the provider omits them", async () => {
    const computeAdapter = new ZeroGClientAdapter({
      storage: {
        indexerUrl: "https://indexer-storage-testnet.0g.ai",
      },
      log: {
        baseUrl: "https://indexer-storage-testnet.0g.ai",
      },
      compute: {
        baseUrl: "https://compute.0g.ai/infer",
      },
    });

    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          headers: new Headers({
            "ZG-Res-Key": "job-3",
          }),
          json: async () => ({
            choices: [
              {
                message: {
                  content: "Risk review complete",
                },
              },
            ],
          }),
        }) as Response,
    );

    const result = await computeAdapter.requestCompute({
      model: "glm-5",
      prompt: "Review this thesis",
      metadata: { stage: "adjudication" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requestHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.value.responseHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it("builds deterministic namespaces for run artifacts", () => {
    const namespaceBuilder = new ZeroGNamespaceBuilder();

    expect(
      namespaceBuilder.buildStateKey({
        environment: "testnet",
        scope: "run",
        runId: "run-1",
        segments: ["checkpoints"],
        checkpoint: "latest",
      }),
    ).toBe("omen/testnet/run/run/run-1/checkpoints/kv/latest");
  });

  it("categorizes manifestable artifacts into manifest link records", async () => {
    const uploaded = await adapter.uploadFile({
      fileName: "report.json",
      contentType: "application/json",
      bytes: new Uint8Array([1, 2, 3]),
      metadata: { stage: "final" },
    });

    expect(uploaded.ok).toBe(true);
    if (uploaded.ok) {
      expect(
        createZeroGArtifactLink({
          label: "final-report",
          namespacePath: "omen/runtime/proof/run/run-1/run-manifests",
          artifact: uploaded.value,
        }),
      ).toMatchObject({
        category: "file_bundle",
        label: "final-report",
      });
    }
  });

  it("builds proof bundles with an attached manifest artifact", () => {
    const registry = new ZeroGProofRegistry();

    registry.registerArtifacts([
      {
        id: "run-1:kv",
        runId: "run-1",
        signalId: null,
        intelId: null,
        refType: "kv_state",
        key: "runs/run-1/checkpoint",
        locator: "https://storage.0g.ai/kv/runs%2Frun-1%2Fcheckpoint",
        metadata: {},
        compute: null,
        createdAt: "2026-04-25T08:00:00.000Z",
      },
    ]);

    const bundle = registry.attachManifestArtifact("run-1", {
      id: "run-1:manifest",
      runId: "run-1",
      signalId: null,
      intelId: null,
      refType: "manifest",
      key: "run-1",
      locator: "https://storage.0g.ai/files/run-1/manifest.json",
      metadata: {},
      compute: null,
      createdAt: "2026-04-25T08:00:01.000Z",
    });

    expect(bundle.manifestRefId).toBe("run-1:manifest");
    expect(bundle.artifactRefs).toHaveLength(2);
  });

  it("builds categorized run manifests and attaches a manifest artifact", () => {
    const builder = new RunManifestBuilder();
    const run = {
      id: "run-1",
      mode: "mocked" as const,
      status: "completed" as const,
      marketBias: "LONG" as const,
      startedAt: "2026-04-25T08:00:00.000Z",
      completedAt: "2026-04-25T08:10:00.000Z",
      triggeredBy: "scheduler" as const,
      activeCandidateCount: 1,
      currentCheckpointRefId: "run-1:kv",
      finalSignalId: "signal-1",
      finalIntelId: null,
      failureReason: null,
      outcome: {
        outcomeType: "signal" as const,
        summary: "BTC approved",
        signalId: "signal-1",
        intelId: null,
      },
      configSnapshot: {},
      createdAt: "2026-04-25T08:00:00.000Z",
      updatedAt: "2026-04-25T08:10:00.000Z",
    };
    const manifest = builder.build({
      environment: "testnet",
      run,
      artifacts: [
        {
          id: "run-1:kv",
          runId: "run-1",
          signalId: "signal-1",
          intelId: null,
          refType: "kv_state",
          key: "omen/testnet/run/run/run-1/checkpoints/kv/latest",
        locator: "https://storage.0g.ai/kv/run-1",
        metadata: {},
        compute: null,
        createdAt: "2026-04-25T08:00:00.000Z",
      },
        {
          id: "run-1:log",
          runId: "run-1",
          signalId: "signal-1",
          intelId: null,
          refType: "log_entry",
          key: "omen/testnet/run/run/run-1/logs/runtime-trace",
          locator: "https://storage.0g.ai/log/run-1",
          metadata: {},
          compute: null,
          createdAt: "2026-04-25T08:01:00.000Z",
        },
        {
          id: "run-1:report",
          runId: "run-1",
          signalId: "signal-1",
          intelId: null,
          refType: "compute_result",
          key: null,
          locator: "https://storage.0g.ai/compute/run-1",
          metadata: {},
          compute: {
            provider: "0g",
            model: "glm-5",
            jobId: "job-1",
            requestHash: "req-1",
            responseHash: "res-1",
            verificationMode: "tee",
          },
          createdAt: "2026-04-25T08:02:00.000Z",
        },
      ],
    });
    const manifestArtifact = builder.createManifestArtifact({
      run,
      uploadArtifact: {
        id: "manifest-upload:file",
        runId: "unbound",
        signalId: null,
        intelId: null,
        refType: "file_artifact",
        key: "omen/testnet/proof/run/run-1/signal/signal-1/run-manifests/files/manifest.json",
        locator: "https://storage.0g.ai/files/manifest.json",
        metadata: {
          rootHashHint: "manifest.json:10",
        },
        compute: null,
        createdAt: "2026-04-25T08:03:00.000Z",
      },
    });
    const finalized = builder.build({
      environment: "testnet",
      run,
      artifacts: manifest.relatedArtifacts.map((link) => link.artifact),
      manifestArtifact,
    });

    expect(manifest.checkpoints).toHaveLength(1);
    expect(manifest.logs).toHaveLength(1);
    expect(manifest.computeProofs).toHaveLength(1);
    expect(finalized.manifestArtifact?.artifact.refType).toBe("manifest");
    expect(finalized.summary.artifactCount).toBe(4);
  });

  it("creates a chain proof artifact when anchoring is configured", async () => {
    const proofAnchor = new ZeroGProofAnchor({
      rpcUrl: "https://rpc.0g.ai",
      chainId: 16601,
    });

    const result = await proofAnchor.anchorManifest({
      runId: "run-1",
      manifestRoot: "root-1",
      metadata: { source: "manifest" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.chainProof.status).toBe("anchored");
      expect(result.value?.artifact.refType).toBe("chain_proof");
    }
  });
});
