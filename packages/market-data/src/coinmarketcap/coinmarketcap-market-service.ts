import {
  CoinMarketCapAdapter,
  type CoinMarketCapAdapterConfig,
} from "./coinmarketcap-adapter.js";
import type { CmcQuote, ProviderResult } from "../types.js";

export class CoinMarketCapMarketService {
  private readonly adapter: CoinMarketCapAdapter;

  constructor(config: Partial<CoinMarketCapAdapterConfig> = {}) {
    this.adapter = new CoinMarketCapAdapter(config);
  }

  async getPriceWithChange(symbol: string): Promise<ProviderResult<CmcQuote>> {
    return this.adapter.getPriceWithChange(symbol);
  }
}
