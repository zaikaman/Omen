import {
  BinanceMarketService,
  CoinGeckoMarketService,
  marketSnapshotSchema,
  type MarketSnapshot,
} from "@omen/market-data";
import { z } from "zod";

import { scannerInputSchema, scannerOutputSchema } from "../contracts/scanner.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import { candidateStateSchema, type SwarmState } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildScannerSystemPrompt } from "../prompts/scanner/system.js";

const scannerServiceOptionsSchema = z.object({
  binance: z.custom<BinanceMarketService>().optional(),
  coinGecko: z.custom<CoinGeckoMarketService>().optional(),
  llmClient: z.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const scannerLlmCandidateSchema = z.object({
  symbol: z.string().min(1),
  reason: z.string().min(1),
  directionHint: z.enum(["LONG", "SHORT", "WATCHLIST"]).nullable().default(null),
});

const scannerLlmResponseSchema = z.object({
  candidates: z.array(scannerLlmCandidateSchema).max(3).default([]),
  rejectedSymbols: z.array(z.string().min(1)).default([]),
});

export class ScannerAgentFactory {
  private readonly binance: BinanceMarketService;

  private readonly coinGecko: CoinGeckoMarketService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: z.input<typeof scannerServiceOptionsSchema> = {}) {
    const parsed = scannerServiceOptionsSchema.parse(input);
    this.binance = parsed.binance ?? new BinanceMarketService();
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("scanner"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof scannerInputSchema>,
    z.input<typeof scannerOutputSchema>
  > {
    return {
      key: "scanner-agent",
      role: "scanner",
      inputSchema: scannerInputSchema,
      outputSchema: scannerOutputSchema,
      invoke: async (input, state) => this.scan(input, state),
    };
  }

  private async scan(
    input: z.input<typeof scannerInputSchema>,
    state: SwarmState,
  ): Promise<z.infer<typeof scannerOutputSchema>> {
    const parsed = scannerInputSchema.parse(input);
    const snapshots = await this.collectSnapshots(parsed.universe);
    const existingDedupeKeys = new Set(
      state.activeCandidates.map((candidate) => candidate.dedupeKey),
    );
    const blockedSymbols = new Set(parsed.activeTradeSymbols.map((symbol) => symbol.toUpperCase()));

    if (this.llmClient === null) {
      throw new Error("Scanner candidate selection requires a configured LLM client.");
    }

    return this.scanWithModel({
      parsed,
      snapshots,
      existingDedupeKeys,
      blockedSymbols,
      state,
    });
  }

  private async scanWithModel(input: {
    parsed: z.infer<typeof scannerInputSchema>;
    snapshots: MarketSnapshot[];
    existingDedupeKeys: Set<string>;
    blockedSymbols: Set<string>;
    state: SwarmState;
  }) {
    if (
      this.llmClient === null ||
      input.parsed.bias.marketBias === "NEUTRAL" ||
      input.parsed.bias.marketBias === "UNKNOWN"
    ) {
      return scannerOutputSchema.parse({
        marketBias: input.parsed.bias.marketBias,
        candidates: [],
        rejectedSymbols: input.parsed.universe,
      });
    }

    try {
      const response = await this.llmClient.completeJson({
        schema: scannerLlmResponseSchema,
        systemPrompt: buildScannerSystemPrompt({
          universe: input.parsed.universe,
          marketBias: input.parsed.bias.marketBias,
          snapshotCount: input.snapshots.length,
          blockedSymbols: Array.from(input.blockedSymbols),
        }),
        userPrompt: JSON.stringify(
          {
            marketBias: input.parsed.bias,
            universe: input.parsed.universe,
            existingDedupeKeys: Array.from(input.existingDedupeKeys),
            activeTradeSymbols: Array.from(input.blockedSymbols),
            snapshots: input.snapshots.map((snapshot) => ({
              symbol: snapshot.symbol,
              price: snapshot.price,
              change24hPercent: snapshot.change24hPercent,
              volume24h: snapshot.volume24h,
              fundingRate: snapshot.fundingRate,
              openInterest: snapshot.openInterest,
              capturedAt: snapshot.capturedAt,
            })),
            instruction:
              "Return at most three candidates. Use only symbols from the provided universe. Do not select activeTradeSymbols because those symbols already have active or pending trades. Keep rejectedSymbols limited to the symbols you explicitly ruled out.",
          },
          null,
          2,
        ),
      });
      const universe = new Set(input.parsed.universe.map((symbol) => symbol.toUpperCase()));
      const candidates = (response.candidates ?? [])
        .map((candidate, index) => ({
          candidate,
          index,
        }))
        .filter(({ candidate }) => {
          const symbol = candidate.symbol.toUpperCase();

          return (
            universe.has(symbol) &&
            !input.existingDedupeKeys.has(symbol) &&
            !input.blockedSymbols.has(symbol)
          );
        })
        .slice(0, 3)
        .map(({ candidate, index }) =>
          candidateStateSchema.parse({
            id: `candidate-${candidate.symbol.toLowerCase()}-llm-${index.toString()}`,
            symbol: candidate.symbol.toUpperCase(),
            reason: candidate.reason,
            directionHint:
              candidate.directionHint === "WATCHLIST"
                ? input.parsed.bias.marketBias === "LONG" || input.parsed.bias.marketBias === "SHORT"
                  ? input.parsed.bias.marketBias
                  : null
                : candidate.directionHint,
            status: "pending",
            sourceUniverse: input.state.config.marketUniverse.join(","),
            dedupeKey: candidate.symbol.toUpperCase(),
            missingDataNotes: [],
          }),
        );

      return scannerOutputSchema.parse({
        marketBias: input.parsed.bias.marketBias,
        candidates,
        rejectedSymbols: Array.from(
          new Set(
            (response.rejectedSymbols ?? [])
              .map((symbol) => symbol.toUpperCase())
              .filter((symbol) => universe.has(symbol)),
          ),
        ),
      });
    } catch (error) {
      throw new Error(
        `Scanner model selection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async collectSnapshots(symbols: string[]): Promise<MarketSnapshot[]> {
    const [binance, coinGecko] = await Promise.all([
      this.binance.getSnapshots(symbols),
      this.coinGecko.getAssetSnapshots(symbols),
    ]);
    const bySymbol = new Map<string, MarketSnapshot>();

    const append = (snapshots: MarketSnapshot[]) => {
      for (const snapshot of snapshots) {
        const symbol = snapshot.symbol.toUpperCase();

        if (!bySymbol.has(symbol)) {
          bySymbol.set(symbol, marketSnapshotSchema.parse(snapshot));
        }
      }
    };

    if (binance.ok) {
      append(binance.value);
    }

    if (coinGecko.ok) {
      append(coinGecko.value);
    }

    if (bySymbol.size === 0) {
      throw new Error("Scanner could not collect live market snapshots from Binance or CoinGecko.");
    }

    return Array.from(bySymbol.values());
  }
}

export const createScannerAgent = (input: z.input<typeof scannerServiceOptionsSchema> = {}) =>
  new ScannerAgentFactory(input).createDefinition();
