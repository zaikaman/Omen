import { readFile } from "node:fs/promises";
import path from "node:path";

import { TRADEABLE_SYMBOLS } from "@omen/shared";

import { canonicalJson, sha256Hex } from "./encryption.js";

const promptFiles = [
  "packages/agents/src/prompts/market-bias/system.ts",
  "packages/agents/src/prompts/scanner/system.ts",
  "packages/agents/src/prompts/research/system.ts",
  "packages/agents/src/prompts/chart-vision/system.ts",
  "packages/agents/src/prompts/analyst/system.ts",
  "packages/agents/src/prompts/critic/system.ts",
  "packages/agents/src/prompts/intel/system.ts",
  "packages/agents/src/prompts/generator/system.ts",
  "packages/agents/src/prompts/writer/system.ts",
  "packages/agents/src/prompts/memory/system.ts",
  "packages/agents/src/prompts/publisher/system.ts",
] as const;

const roles = [
  "orchestrator",
  "market_bias",
  "scanner",
  "research",
  "chart_vision",
  "analyst",
  "critic",
  "intel",
  "generator",
  "writer",
  "memory",
  "publisher",
] as const;

export type OmenAgentIntelligenceBundle = {
  schemaVersion: "omen-agent-inft/v1";
  project: "Omen";
  agentKind: "multi-agent-swarm";
  createdAt: string;
  chain: {
    chainId: string;
    network: "0g-galileo-testnet" | "0g-mainnet" | "custom-0g";
  };
  storage: {
    provider: "0G Storage";
    encrypted: true;
    encryption: "AES-256-GCM";
  };
  compute: {
    provider: "0G Compute";
    adjudicationModel: string;
  };
  memory: {
    root: string;
    description: string;
    proofManifestUri: string | null;
    latestRunId: string | null;
  };
  swarm: {
    roles: typeof roles;
    graph: Array<{ from: string; to: string; condition?: string }>;
    tradeableUniverse: readonly string[];
  };
  prompts: Array<{
    path: string;
    sha256: string;
    source: string;
  }>;
};

export const buildOmenAgentIntelligenceBundle = async (input: {
  repoRoot: string;
  memoryRoot: string;
  memoryDescription: string;
  proofManifestUri?: string | null;
  latestRunId?: string | null;
  chainId: string;
  computeModel: string;
}): Promise<OmenAgentIntelligenceBundle> => {
  if (!input.memoryRoot.trim()) {
    throw new Error("OMEN_INFT_MEMORY_ROOT is required to mint the swarm iNFT.");
  }

  const prompts = await Promise.all(
    promptFiles.map(async (promptPath) => {
      const source = await readFile(path.join(input.repoRoot, promptPath), "utf8");

      return {
        path: promptPath,
        sha256: sha256Hex(source),
        source,
      };
    }),
  );

  return {
    schemaVersion: "omen-agent-inft/v1",
    project: "Omen",
    agentKind: "multi-agent-swarm",
    createdAt: new Date().toISOString(),
    chain: {
      chainId: input.chainId,
      network:
        input.chainId === "16602"
          ? "0g-galileo-testnet"
          : input.chainId === "16661"
            ? "0g-mainnet"
            : "custom-0g",
    },
    storage: {
      provider: "0G Storage",
      encrypted: true,
      encryption: "AES-256-GCM",
    },
    compute: {
      provider: "0G Compute",
      adjudicationModel: input.computeModel,
    },
    memory: {
      root: input.memoryRoot,
      description: input.memoryDescription,
      proofManifestUri: input.proofManifestUri?.trim() || null,
      latestRunId: input.latestRunId?.trim() || null,
    },
    swarm: {
      roles,
      graph: [
        { from: "orchestrator", to: "market_bias" },
        { from: "market_bias", to: "scanner" },
        { from: "scanner", to: "research", condition: "candidate selected" },
        { from: "research", to: "chart_vision" },
        { from: "chart_vision", to: "analyst" },
        { from: "analyst", to: "critic" },
        { from: "critic", to: "memory", condition: "approved thesis" },
        { from: "critic", to: "intel", condition: "no approved thesis" },
        { from: "intel", to: "generator", condition: "intel report ready" },
        { from: "generator", to: "writer" },
        { from: "writer", to: "memory" },
        { from: "memory", to: "publisher" },
      ],
      tradeableUniverse: TRADEABLE_SYMBOLS,
    },
    prompts,
  };
};

export const hashOmenAgentBundle = (bundle: OmenAgentIntelligenceBundle) =>
  sha256Hex(canonicalJson(bundle));
