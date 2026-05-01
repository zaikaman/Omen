import {
  Hyperliquid,
  type AllMids,
  type ClearinghouseState,
  type Meta,
  type OrderResponse,
  type UserFills,
} from "hyperliquid";

import type { Logger } from "../bootstrap/logger.js";

type HyperliquidChain = "Mainnet" | "Testnet";

type AssetInfo = Meta["universe"][number] & {
  isDelisted?: boolean;
};

export type HyperliquidTradeSide = "LONG" | "SHORT";

export type HyperliquidOpenPositionResult = {
  entryOrder: OrderResponse;
  takeProfitOrder: OrderResponse | null;
  stopLossOrder: OrderResponse | null;
  entryOrderId: string | null;
  takeProfitOrderId: string | null;
  stopLossOrderId: string | null;
  quantity: number;
  entryPrice: number;
  notionalUsd: number;
  leverage: number;
};

export type HyperliquidPosition = {
  coin: string;
  entryPrice: number;
  quantity: number;
  direction: HyperliquidTradeSide;
  positionValue: number;
  unrealizedPnl: number;
  leverage: number;
};

const META_CACHE_TTL_MS = 5 * 60 * 1000;
const MIDS_CACHE_TTL_MS = 3_000;
const STATE_CACHE_TTL_MS = 5_000;
const FILLS_CACHE_TTL_MS = 10_000;
const MARKET_ORDER_SLIPPAGE = 0.005;

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractOrderId = (response: OrderResponse | null) => {
  const status = response?.response?.data?.statuses?.[0];
  const oid = status?.filled?.oid ?? status?.resting?.oid;
  return typeof oid === "number" ? oid.toString() : null;
};

const firstOrderStatusError = (response: OrderResponse) => {
  const status = response.response?.data?.statuses?.[0] as
    | { error?: unknown }
    | undefined;
  return typeof status?.error === "string" ? status.error : null;
};

export class HyperliquidCopytradeService {
  private readonly sdk: Hyperliquid;

  private connected = false;

  private assetInfoCache = new Map<string, AssetInfo>();

  private metaFetchedAt = 0;

  private midsCache: { data: AllMids | null; fetchedAt: number } = {
    data: null,
    fetchedAt: 0,
  };

  private stateCache: { data: ClearinghouseState | null; fetchedAt: number } = {
    data: null,
    fetchedAt: 0,
  };

  private fillsCache: { data: UserFills | null; fetchedAt: number } = {
    data: null,
    fetchedAt: 0,
  };

  constructor(
    private readonly input: {
      agentPrivateKey: string;
      walletAddress: string;
      chain: HyperliquidChain;
      logger: Logger;
    },
  ) {
    this.sdk = new Hyperliquid({
      enableWs: false,
      privateKey: input.agentPrivateKey,
      testnet: input.chain === "Testnet",
      disableAssetMapRefresh: false,
    });
  }

  async disconnect() {
    if (!this.connected) {
      return;
    }

    this.sdk.disconnect();
    this.connected = false;
  }

  async getAccountEquity(forceRefresh = false) {
    const state = await this.getUserState(forceRefresh);
    return Number(state.marginSummary.accountValue);
  }

  async getPositions(forceRefresh = false): Promise<HyperliquidPosition[]> {
    const state = await this.getUserState(forceRefresh);

    return state.assetPositions
      .map(({ position }) => {
        const quantity = Number(position.szi);
        const entryPrice = Number(position.entryPx);
        const positionValue = Number(position.positionValue);
        const unrealizedPnl = Number(position.unrealizedPnl);

        if (!Number.isFinite(quantity) || quantity === 0) {
          return null;
        }

        return {
          coin: this.formatSymbol(position.coin),
          entryPrice: Number.isFinite(entryPrice) ? entryPrice : 0,
          quantity: Math.abs(quantity),
          direction: quantity > 0 ? "LONG" : "SHORT",
          positionValue: Number.isFinite(positionValue) ? positionValue : 0,
          unrealizedPnl: Number.isFinite(unrealizedPnl) ? unrealizedPnl : 0,
          leverage: position.leverage.value,
        } satisfies HyperliquidPosition;
      })
      .filter((position): position is HyperliquidPosition => position !== null);
  }

  async getFills(limit = 100, forceRefresh = false) {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.fillsCache.data &&
      now - this.fillsCache.fetchedAt < FILLS_CACHE_TTL_MS
    ) {
      return this.fillsCache.data.slice(0, limit);
    }

    await this.ensureConnected();
    const fills = await this.sdk.info.getUserFills(this.input.walletAddress);
    this.fillsCache = { data: fills, fetchedAt: now };
    return fills.slice(0, limit);
  }

  async isAssetTradable(symbol: string) {
    await this.getMeta();
    const normalized = this.normalizeSymbol(symbol);
    const base = this.formatSymbol(symbol);

    if (!this.assetInfoCache.has(normalized) && !this.assetInfoCache.has(base)) {
      return {
        tradable: false,
        symbol: base,
        reason: `${base} is not listed on Hyperliquid perps.`,
      };
    }

    const mids = await this.getAllMids();
    const price = this.findPrice(mids, base);

    if (price === null) {
      return {
        tradable: false,
        symbol: base,
        reason: `${base} has no current Hyperliquid mid price.`,
      };
    }

    return { tradable: true, symbol: base, price };
  }

  async getMaxLeverage(symbol: string) {
    await this.getMeta();
    const info =
      this.assetInfoCache.get(this.normalizeSymbol(symbol)) ??
      this.assetInfoCache.get(this.formatSymbol(symbol));
    return info?.maxLeverage ?? 1;
  }

  async getPrice(symbol: string) {
    const mids = await this.getAllMids();
    const price = this.findPrice(mids, symbol);

    if (price === null) {
      throw new Error(`No Hyperliquid mid price is available for ${symbol}.`);
    }

    return price;
  }

  async openBracketPosition(input: {
    symbol: string;
    side: HyperliquidTradeSide;
    notionalUsd: number;
    leverage: number;
    takeProfitPrice: number;
    stopLossPrice: number;
    entryPrice?: number;
    orderType: "market" | "limit";
  }): Promise<HyperliquidOpenPositionResult> {
    const symbol = this.formatSymbol(input.symbol);
    const isBuy = input.side === "LONG";
    const currentPrice = await this.getPrice(symbol);
    const referencePrice = input.orderType === "limit" && input.entryPrice
      ? input.entryPrice
      : currentPrice;
    const quantity = await this.roundSize(symbol, input.notionalUsd / referencePrice);

    if (quantity <= 0) {
      throw new Error(`Calculated Hyperliquid order size for ${symbol} is zero.`);
    }

    await this.setLeverage(symbol, input.leverage);

    const entryLimitPrice = input.orderType === "limit" && input.entryPrice
      ? this.roundPrice(input.entryPrice)
      : this.roundPrice(currentPrice * (isBuy ? 1 + MARKET_ORDER_SLIPPAGE : 1 - MARKET_ORDER_SLIPPAGE));
    const entryOrder = await this.placeOrder({
      symbol,
      isBuy,
      size: quantity,
      price: entryLimitPrice,
      orderType: input.orderType,
      reduceOnly: false,
    });

    const entryError = firstOrderStatusError(entryOrder);
    if (entryOrder.status !== "ok" || entryError) {
      throw new Error(entryError ?? `Hyperliquid rejected ${symbol} entry order.`);
    }

    const entryFilled = entryOrder.response?.data?.statuses?.[0]?.filled;
    const entryResting = entryOrder.response?.data?.statuses?.[0]?.resting;

    if (input.orderType === "market" && !entryFilled) {
      throw new Error(`Hyperliquid did not fill ${symbol} market entry order.`);
    }

    if (input.orderType === "limit" && !entryFilled && !entryResting) {
      throw new Error(`Hyperliquid did not accept ${symbol} limit entry order.`);
    }

    const filledQuantity = entryFilled?.totalSz ? Number(entryFilled.totalSz) : quantity;
    const filledEntryPrice = entryFilled?.avgPx ? Number(entryFilled.avgPx) : referencePrice;

    let takeProfitOrder: OrderResponse | null = null;
    let stopLossOrder: OrderResponse | null = null;

    if (entryFilled || input.orderType === "market") {
      takeProfitOrder = await this.placeTriggerOrder({
        symbol,
        isBuy: !isBuy,
        size: filledQuantity,
        triggerPrice: input.takeProfitPrice,
        triggerType: "tp",
      });
      stopLossOrder = await this.placeTriggerOrder({
        symbol,
        isBuy: !isBuy,
        size: filledQuantity,
        triggerPrice: input.stopLossPrice,
        triggerType: "sl",
      });
    }

    this.clearCaches();
    this.input.logger.info(
      `Copytrade submitted ${input.side} ${symbol}: entry=${extractOrderId(entryOrder) ?? "unknown"} resting=${Boolean(entryResting).toString()}`,
    );

    return {
      entryOrder,
      takeProfitOrder,
      stopLossOrder,
      entryOrderId: extractOrderId(entryOrder),
      takeProfitOrderId: extractOrderId(takeProfitOrder),
      stopLossOrderId: extractOrderId(stopLossOrder),
      quantity: filledQuantity,
      entryPrice: filledEntryPrice,
      notionalUsd: filledQuantity * filledEntryPrice,
      leverage: input.leverage,
    };
  }

  async closePosition(symbol: string) {
    const formatted = this.formatSymbol(symbol);
    const positions = await this.getPositions(true);
    const position = positions.find((candidate) => candidate.coin === formatted);

    if (!position) {
      return null;
    }

    return this.placeOrder({
      symbol: formatted,
      isBuy: position.direction === "SHORT",
      size: position.quantity,
      price: await this.getMarketClosePrice(formatted, position.direction),
      orderType: "market",
      reduceOnly: true,
    });
  }

  async placePositionTriggers(input: {
    symbol: string;
    side: HyperliquidTradeSide;
    quantity: number;
    takeProfitPrice: number;
    stopLossPrice: number;
  }) {
    const isBuy = input.side === "LONG";
    const takeProfitOrder = await this.placeTriggerOrder({
      symbol: input.symbol,
      isBuy: !isBuy,
      size: input.quantity,
      triggerPrice: input.takeProfitPrice,
      triggerType: "tp",
    });
    const stopLossOrder = await this.placeTriggerOrder({
      symbol: input.symbol,
      isBuy: !isBuy,
      size: input.quantity,
      triggerPrice: input.stopLossPrice,
      triggerType: "sl",
    });

    this.clearCaches();

    return {
      takeProfitOrder,
      stopLossOrder,
      takeProfitOrderId: extractOrderId(takeProfitOrder),
      stopLossOrderId: extractOrderId(stopLossOrder),
    };
  }

  formatSymbol(symbol: string) {
    return symbol.toUpperCase().replace(/USDT$/, "").replace(/-PERP$/, "").trim();
  }

  private async ensureConnected() {
    if (this.connected) {
      return;
    }

    await this.sdk.connect();
    this.connected = true;
  }

  private clearCaches() {
    this.midsCache = { data: null, fetchedAt: 0 };
    this.stateCache = { data: null, fetchedAt: 0 };
    this.fillsCache = { data: null, fetchedAt: 0 };
  }

  private async getUserState(forceRefresh = false) {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.stateCache.data &&
      now - this.stateCache.fetchedAt < STATE_CACHE_TTL_MS
    ) {
      return this.stateCache.data;
    }

    await this.ensureConnected();
    const state = await this.sdk.info.perpetuals.getClearinghouseState(this.input.walletAddress);
    this.stateCache = { data: state, fetchedAt: now };
    return state;
  }

  private async getAllMids(forceRefresh = false) {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.midsCache.data &&
      now - this.midsCache.fetchedAt < MIDS_CACHE_TTL_MS
    ) {
      return this.midsCache.data;
    }

    await this.ensureConnected();
    const mids = await this.sdk.info.getAllMids();
    this.midsCache = { data: mids, fetchedAt: now };
    return mids;
  }

  private async getMeta() {
    if (Date.now() - this.metaFetchedAt < META_CACHE_TTL_MS && this.assetInfoCache.size > 0) {
      return;
    }

    await this.ensureConnected();
    const meta = await this.sdk.info.perpetuals.getMeta();
    this.assetInfoCache.clear();

    for (const asset of meta.universe as AssetInfo[]) {
      if (asset.isDelisted) {
        continue;
      }

      const base = this.formatSymbol(asset.name);
      this.assetInfoCache.set(asset.name, asset);
      this.assetInfoCache.set(base, asset);
      this.assetInfoCache.set(`${base}-PERP`, asset);
    }

    this.metaFetchedAt = Date.now();
  }

  private findPrice(mids: AllMids, symbol: string) {
    const base = this.formatSymbol(symbol);
    const candidates = [base, `${base}-PERP`, symbol.toUpperCase()];

    for (const candidate of candidates) {
      const price = parseNumber(mids[candidate]);

      if (price !== null && price > 0) {
        return price;
      }
    }

    return null;
  }

  private normalizeSymbol(symbol: string) {
    return `${this.formatSymbol(symbol)}-PERP`;
  }

  private async roundSize(symbol: string, size: number) {
    await this.getMeta();
    const info =
      this.assetInfoCache.get(this.formatSymbol(symbol)) ??
      this.assetInfoCache.get(this.normalizeSymbol(symbol));
    const decimals = info?.szDecimals ?? 4;
    const scale = 10 ** decimals;
    return Math.floor(size * scale) / scale;
  }

  private roundPrice(price: number) {
    const significant = Number(price.toPrecision(5));
    return Number(significant.toFixed(6));
  }

  private async setLeverage(symbol: string, leverage: number) {
    await this.ensureConnected();
    await this.sdk.exchange.updateLeverage(this.normalizeSymbol(symbol), "cross", leverage);
  }

  private async placeOrder(input: {
    symbol: string;
    isBuy: boolean;
    size: number;
    price: number;
    orderType: "market" | "limit";
    reduceOnly: boolean;
  }) {
    await this.ensureConnected();
    const roundedSize = await this.roundSize(input.symbol, input.size);

    return this.sdk.exchange.placeOrder({
      coin: this.normalizeSymbol(input.symbol),
      is_buy: input.isBuy,
      sz: roundedSize.toString(),
      limit_px: this.roundPrice(input.price).toString(),
      order_type: {
        limit: {
          tif: input.orderType === "market" ? "Ioc" : "Gtc",
        },
      },
      reduce_only: input.reduceOnly,
    }) as Promise<OrderResponse>;
  }

  private async placeTriggerOrder(input: {
    symbol: string;
    isBuy: boolean;
    size: number;
    triggerPrice: number;
    triggerType: "tp" | "sl";
  }) {
    await this.ensureConnected();
    const roundedSize = await this.roundSize(input.symbol, input.size);
    const triggerPrice = this.roundPrice(input.triggerPrice);

    return this.sdk.exchange.placeOrder({
      coin: this.normalizeSymbol(input.symbol),
      is_buy: input.isBuy,
      sz: roundedSize.toString(),
      limit_px: triggerPrice.toString(),
      order_type: {
        trigger: {
          triggerPx: triggerPrice.toString(),
          isMarket: true,
          tpsl: input.triggerType,
        },
      },
      reduce_only: true,
    }) as Promise<OrderResponse>;
  }

  private async getMarketClosePrice(symbol: string, direction: HyperliquidTradeSide) {
    const currentPrice = await this.getPrice(symbol);
    return this.roundPrice(
      currentPrice * (direction === "SHORT" ? 1 + MARKET_ORDER_SLIPPAGE : 1 - MARKET_ORDER_SLIPPAGE),
    );
  }
}
