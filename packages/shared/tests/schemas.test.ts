import { describe, expect, it } from "vitest";

import {
  axlA2ADelegationEnvelopeSchema,
  axlMcpResponseSchema,
  chainProofSchema,
  computeProofRecordSchema,
  runSchema,
  signalSchema,
  twitterApiCreateTweetRequestSchema,
  zeroGRunManifestSchema,
} from "../src/index.js";

describe("shared schemas", () => {
  it("rejects terminal runs without completedAt", () => {
    expect(() =>
      runSchema.parse({
        id: "run-1",
        mode: "mocked",
        status: "completed",
        marketBias: "LONG",
        startedAt: "2026-04-25T08:00:00.000Z",
        completedAt: null,
        triggeredBy: "scheduler",
        activeCandidateCount: 1,
        currentCheckpointRefId: null,
        finalSignalId: null,
        finalIntelId: null,
        failureReason: null,
        outcome: null,
        configSnapshot: {},
        createdAt: "2026-04-25T08:00:00.000Z",
        updatedAt: "2026-04-25T08:00:00.000Z",
      }),
    ).toThrow(/completedAt/i);
  });

  it("rejects actionable signals below minimum confidence or risk reward", () => {
    expect(() =>
      signalSchema.parse({
        id: "signal-1",
        runId: "run-1",
        candidateId: null,
        asset: "BTC",
        direction: "LONG",
        confidence: 80,
        riskReward: 1.5,
        entryZone: null,
        invalidation: null,
        targets: [],
        whyNow: "Momentum breakout",
        confluences: [],
        uncertaintyNotes: "Macro risk",
        missingDataNotes: "None",
        criticDecision: "approved",
        reportStatus: "draft",
        finalReportRefId: null,
        proofRefIds: [],
        disclaimer:
          "Omen market intelligence is for informational purposes only and is not financial advice.",
        publishedAt: null,
        createdAt: "2026-04-25T08:00:00.000Z",
        updatedAt: "2026-04-25T08:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects twitterapi payloads that set both quote_tweet_id and attachment_url", () => {
    expect(() =>
      twitterApiCreateTweetRequestSchema.parse({
        login_cookies: "cookie=value",
        tweet_text: "hello world",
        proxy: "http://user:pass@proxy:8080",
        quote_tweet_id: "123",
        attachment_url: "https://x.com/someone/status/123",
      }),
    ).toThrow(/either quote_tweet_id or attachment_url/i);
  });

  it("requires compute metadata for compute proof links inside a 0G manifest", () => {
    expect(() =>
      zeroGRunManifestSchema.parse({
        id: "manifest-1",
        runId: "run-1",
        version: 1,
        namespace: {
          app: "omen",
          environment: "runtime",
          scope: "proof",
          runId: "run-1",
          signalId: null,
          intelId: null,
          segments: ["run-manifests"],
          path: "omen/runtime/proof/run/run-1/run-manifests",
        },
        manifestArtifact: null,
        checkpoints: [],
        logs: [],
        files: [],
        computeProofs: [
          {
            label: "adjudication",
            category: "compute_proof",
            namespacePath: "omen/runtime/proof/run/run-1/run-manifests",
            artifact: {
              id: "compute-1",
              runId: "run-1",
              signalId: null,
              intelId: null,
              refType: "compute_result",
              key: null,
              locator: "https://storage.0g.ai/compute/compute-1",
              metadata: {},
              compute: null,
              createdAt: "2026-04-25T08:00:00.000Z",
            },
          },
        ],
        chainAnchors: [],
        relatedArtifacts: [],
        summary: {
          status: "completed",
          finalSignalId: null,
          finalIntelId: null,
          checkpointCount: 1,
          artifactCount: 1,
        },
        createdAt: "2026-04-25T08:00:00.000Z",
      }),
    ).toThrow(/compute metadata/i);
  });

  it("rejects MCP responses that contain both result and error", () => {
    expect(() =>
      axlMcpResponseSchema.parse({
        jsonrpc: "2.0",
        id: "req-1",
        result: { ok: true },
        error: {
          code: -32000,
          message: "bad request",
          data: {},
        },
      }),
    ).toThrow(/both result and error/i);
  });

  it("accepts A2A delegation envelopes with receipt and final result", () => {
    expect(() =>
      axlA2ADelegationEnvelopeSchema.parse({
        request: {
          delegationId: "delegation-1",
          runId: "run-1",
          correlationId: "corr-1",
          fromPeerId: "peer-orchestrator",
          fromRole: "orchestrator",
          toPeerId: "peer-analyst",
          requestedRole: "analyst",
          taskType: "thesis.generate",
          requiredServices: ["analyst.generate"],
          payload: { asset: "BTC" },
          timeoutMs: 15000,
          routeHints: ["low-latency"],
        },
        receipt: {
          delegationId: "delegation-1",
          state: "accepted",
          assignedPeerId: "peer-analyst",
          assignedRole: "analyst",
          acceptedAt: "2026-04-25T08:00:01.000Z",
        },
        result: {
          delegationId: "delegation-1",
          state: "completed",
          responderPeerId: "peer-analyst",
          responderRole: "analyst",
          output: { verdict: "bullish" },
          error: null,
          completedAt: "2026-04-25T08:00:03.000Z",
        },
      }),
    ).not.toThrow();
  });

  it("rejects anchored chain proofs without an anchoredAt timestamp", () => {
    expect(() =>
      chainProofSchema.parse({
        manifestRoot: "root-1",
        chainId: "16601",
        status: "anchored",
        contractAddress: null,
        transactionHash: "0xabc",
        blockNumber: 10,
        explorerUrl: null,
        anchoredAt: null,
      }),
    ).toThrow();
  });

  it("requires a non-empty output preview for normalized compute proof records", () => {
    expect(() =>
      computeProofRecordSchema.parse({
        artifactId: "artifact-1",
        runId: "run-1",
        signalId: null,
        intelId: null,
        stage: "adjudication",
        provider: "0g-compute",
        model: "glm-5",
        jobId: "job-1",
        requestHash: "req-1",
        responseHash: "res-1",
        verificationMode: "tee",
        locator: "0g://compute/job-1/adjudication",
        outputPreview: "",
        recordedAt: "2026-04-25T08:00:00.000Z",
      }),
    ).toThrow(/at least 1 character/i);
  });
});
