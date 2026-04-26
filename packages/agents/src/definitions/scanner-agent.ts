import {
  BinanceMarketService,
  CoinGeckoMarketService,
  marketSnapshotSchema,
  type MarketSnapshot,
} from "@omen/market-data";
import { z } from "zod";

import { scannerInputSchema, scannerOutputSchema } from "../contracts/scanner.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import { candidateStateSchema, type CandidateState, type SwarmState } from "../framework/state.js";

const scannerServiceOptionsSchema = z.object({
  binance: z.custom<BinanceMarketService>().optional(),
  coinGecko: z.custom<CoinGeckoMarketService>().optional(),
});

const seededChangePercent = (symbol: string) => {
  const seed = symbol
    .toUpperCase()
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return ((seed % 17) - 8) * 0.8;
};

const resolveSnapshotScore = (snapshot: MarketSnapshot) =>
  snapshot.change24hPercent ?? seededChangePercent(snapshot.symbol);

const toDirectionHint = (
  score: number,
  bias: z.infer<typeof scannerInputSchema>["bias"]["marketBias"],
) => {
  if (bias === "LONG") {
    return score >= 0 ? "LONG" : null;
  }

  if (bias === "SHORT") {
    return score <= 0 ? "SHORT" : null;
  }

  return Math.abs(score) >= 2 ? "WATCHLIST" : null;
};

const buildCandidate = (input: {
  symbol: string;
  bias: z.infer<typeof scannerInputSchema>["bias"];
  score: number;
  sourceUniverse: string;
}): CandidateState =>
  candidateStateSchema.parse({
    id: `candidate-${input.symbol.toLowerCase()}-${Math.abs(Math.round(input.score * 10)).toString()}`,
    symbol: input.symbol,
    reason:
      input.bias.marketBias === "LONG"
        ? `${input.symbol} aligned with the LONG market bias and ranked ${input.score.toFixed(2)} on the scanner momentum heuristic.`
        : input.bias.marketBias === "SHORT"
          ? `${input.symbol} aligned with the SHORT market bias and ranked ${input.score.toFixed(2)} on the scanner momentum heuristic.`
          : `${input.symbol} stayed on watchlist because scanner conviction remained mixed at ${input.score.toFixed(2)}.`,
    directionHint: toDirectionHint(input.score, input.bias.marketBias),
    status: "pending",
    sourceUniverse: input.sourceUniverse,
    dedupeKey: input.symbol.toUpperCase(),
    missingDataNotes: [],
  });

export class ScannerAgentFactory {
  private readonly binance: BinanceMarketService;

  private readonly coinGecko: CoinGeckoMarketService;

  constructor(input: z.input<typeof scannerServiceOptionsSchema> = {}) {
    const parsed = scannerServiceOptionsSchema.parse(input);
    this.binance = parsed.binance ?? new BinanceMarketService();
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
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
    input: z.infer<typeof scannerInputSchema>,
    state: SwarmState,
  ): Promise<z.infer<typeof scannerOutputSchema>> {
    const parsed = scannerInputSchema.parse(input);
    const snapshots = await this.collectSnapshots(parsed.universe);
    const existingDedupeKeys = new Set(state.activeCandidates.map((candidate) => candidate.dedupeKey));
    const ranked = snapshots
      .map((snapshot) => ({
        snapshot,
        score: resolveSnapshotScore(snapshot),
      }))
      .sort((left, right) =>
        parsed.bias.marketBias === "SHORT"
          ? left.score - right.score
          : right.score - left.score,
      );

    const candidates: CandidateState[] = [];
    const rejectedSymbols: string[] = [];

    for (const rankedSnapshot of ranked) {
      const symbol = rankedSnapshot.snapshot.symbol.toUpperCase();
      const directionHint = toDirectionHint(rankedSnapshot.score, parsed.bias.marketBias);

      if (!directionHint || existingDedupeKeys.has(symbol)) {
        rejectedSymbols.push(symbol);
        continue;
      }

      candidates.push(
        buildCandidate({
          symbol,
          bias: parsed.bias,
          score: rankedSnapshot.score,
          sourceUniverse: state.config.marketUniverse.join(","),
        }),
      );

      if (candidates.length === 3) {
        break;
      }
    }

    for (const rankedSnapshot of ranked.slice(candidates.length)) {
      const symbol = rankedSnapshot.snapshot.symbol.toUpperCase();

      if (!candidates.some((candidate) => candidate.symbol === symbol)) {
        rejectedSymbols.push(symbol);
      }
    }

    return scannerOutputSchema.parse({
      marketBias: parsed.bias.marketBias,
      candidates,
      rejectedSymbols: Array.from(new Set(rejectedSymbols)),
    });
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
      append(
        symbols.map((symbol) =>
          marketSnapshotSchema.parse({
            symbol: symbol.toUpperCase(),
            provider: "scanner-fallback",
            price: 0,
            change24hPercent: seededChangePercent(symbol),
            volume24h: null,
            fundingRate: null,
            openInterest: null,
            candles: [],
            capturedAt: new Date().toISOString(),
          }),
        ),
      );
    }

    return Array.from(bySymbol.values());
  }
}

export const createScannerAgent = (
  input: z.input<typeof scannerServiceOptionsSchema> = {},
) => new ScannerAgentFactory(input).createDefinition();
