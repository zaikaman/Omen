import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createZeroGArtifactLink,
  ZeroGClientAdapter,
  ZeroGLogStore,
  ZeroGNamespaceBuilder,
  ZeroGProofAnchor,
  ZeroGProofRegistry,
  ZeroGReportSynthesis,
  ZeroGStateStore,
} from "../src/index.js";

describe("zero-g adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const adapter = new ZeroGClientAdapter({
    storage: {
      indexerUrl: "https://indexer-storage-testnet.0g.ai",
    },
    log: {
      baseUrl: "https://indexer-storage-testnet.0g.ai",
    },
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

  it("creates proof artifacts for log appends", async () => {
    const result = await adapter.appendLog({
      stream: "runs/run-1/trace",
      content: "trace line",
      metadata: { entries: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refType).toBe("log_entry");
      expect(result.value.locator).toContain("/log/");
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
      expect(result.value.locator).toContain("/log/");
      expect(result.value.metadata.stream).toContain("/logs/debate-trace");
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
      async () =>
        ({
          ok: true,
          json: async () => ({
            id: "job-1",
            output: "Synthesized report",
            verificationMode: "tee",
            requestHash: "req-hash",
            responseHash: "res-hash",
          }),
        }) as Response,
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
