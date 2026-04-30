import {
  createAnalystAgent,
  deriveAnalystThesis,
  analystInputSchema,
  analystOutputSchema,
} from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import {
  BinanceMarketService,
  CoinGeckoMarketService,
} from "@omen/market-data";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime.js";
import { isAxlOptionalLlmDisabled } from "./service-runtime.js";

export const analystMcpContract = defineAxlMcpServiceContract({
  service: "analyst",
  version: "0.1.0",
  peerId: null,
  role: "analyst",
  description:
    "Template-aligned analyst capability for researched candidates, with live-run enrichment from price, technical, fundamental, and news inputs before thesis generation.",
  methods: [
    "thesis.generate",
    "analyst.health",
    "get_token_price",
    "get_technical_analysis",
    "get_fundamental_analysis",
  ],
  tools: [
    {
      name: "thesis.generate",
      description:
        "Generate a structured thesis draft from a research bundle. In live modes the analyst enriches missing market, technical, fundamental, and sentiment evidence before drafting.",
      inputSchema: {
        input: "AnalystInput",
      },
    },
    {
      name: "get_token_price",
      description:
        "Analyst-stage live price enrichment backed by Binance market snapshots when thesis.generate runs in live modes.",
      inputSchema: {
        symbol: "string",
      },
    },
    {
      name: "get_technical_analysis",
      description:
        "Analyst-stage technical enrichment backed by Binance OHLCV candles, support/resistance, momentum, volume, and range-position analysis.",
      inputSchema: {
        symbol: "string",
        interval: "1h",
      },
    },
    {
      name: "get_fundamental_analysis",
      description:
        "Analyst-stage fundamental enrichment backed by CoinGecko market data when thesis.generate runs in live modes.",
      inputSchema: {
        symbol: "string",
      },
    },
  ],
  tags: ["runtime", "mvp", "analyst"],
});

export class AnalystMcpService {
  private readonly marketData = new BinanceMarketService();

  private readonly coinGecko = new CoinGeckoMarketService();

  private readonly agent = createAnalystAgent();

  readonly contract = analystMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "analyst.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      if (parsed.method === "get_token_price") {
        const symbol = String(parsed.params.symbol ?? "").toUpperCase();
        const snapshot = await this.marketData.getSnapshot(symbol);

        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: snapshot,
        });
      }

      if (parsed.method === "get_technical_analysis") {
        const symbol = String(parsed.params.symbol ?? "").toUpperCase();
        const candles = await this.marketData.getCandles({
          symbol,
          interval: "1h",
          limit: 96,
        });

        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: candles,
        });
      }

      if (parsed.method === "get_fundamental_analysis") {
        const symbol = String(parsed.params.symbol ?? "").toUpperCase();
        const snapshot = await this.coinGecko.getAssetSnapshot(symbol);

        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: snapshot,
        });
      }

      const input = analystInputSchema.parse(parsed.params.input ?? {});
      const output = isAxlOptionalLlmDisabled("analyst")
        ? deriveAnalystThesis(input)
        : await this.agent.invoke(
            input,
            createServiceSwarmState({
              runId: input.context.runId,
              mode: input.context.mode,
            }),
          );

      return createAxlMcpSuccessResponse({
        id: parsed.id,
        result: {
          output: analystOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Analyst MCP request failed.",
      });
    }
  }
}
