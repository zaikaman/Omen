import { describe, expect, it } from "vitest";

import {
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
});
