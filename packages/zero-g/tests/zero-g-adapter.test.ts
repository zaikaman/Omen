import { describe, expect, it } from "vitest";

import {
  createZeroGArtifactLink,
  ZeroGClientAdapter,
  ZeroGNamespaceBuilder,
  ZeroGProofAnchor,
  ZeroGProofRegistry,
} from "../src/index.js";

describe("zero-g adapter", () => {
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
