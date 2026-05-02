import {
  signalDetailResponseSchema,
  signalFeedResponseSchema,
  type SignalDetailResponse,
  type SignalFeedResponse,
} from '@omen/shared';

import { apiRequest } from './client';

export type GetSignalsOptions = {
  cursor?: string | null;
  limit?: number;
  page?: number;
  status?: string;
  direction?: string;
  query?: string;
  sort?: string;
};

export type SignalChartTimeframe = '15m' | '1h' | '4h';

export type SignalCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SignalCandlesResponse = {
  symbol: string;
  timeframe: SignalChartTimeframe;
  candles: SignalCandle[];
};

const isSignalChartTimeframe = (value: unknown): value is SignalChartTimeframe =>
  value === '15m' || value === '1h' || value === '4h';

const signalCandlesResponseParser = {
  parse(input: unknown): SignalCandlesResponse {
    const value = input as Partial<SignalCandlesResponse> | null;

    if (!value || typeof value !== 'object') {
      throw new Error('Invalid signal candles response.');
    }

    if (typeof value.symbol !== 'string' || !isSignalChartTimeframe(value.timeframe) || !Array.isArray(value.candles)) {
      throw new Error('Invalid signal candles response.');
    }

    return {
      symbol: value.symbol,
      timeframe: value.timeframe,
      candles: value.candles.map((candle) => {
        const candidate = candle as Partial<SignalCandle>;

        if (
          typeof candidate.timestamp !== 'string' ||
          typeof candidate.open !== 'number' ||
          typeof candidate.high !== 'number' ||
          typeof candidate.low !== 'number' ||
          typeof candidate.close !== 'number' ||
          typeof candidate.volume !== 'number'
        ) {
          throw new Error('Invalid signal candle item.');
        }

        return {
          timestamp: candidate.timestamp,
          open: candidate.open,
          high: candidate.high,
          low: candidate.low,
          close: candidate.close,
          volume: candidate.volume,
        };
      }),
    };
  },
};

export const getLiveSignals = async (
  options: GetSignalsOptions = {},
): Promise<SignalFeedResponse> => {
  const searchParams = new URLSearchParams();

  if (options.cursor) {
    searchParams.set('cursor', options.cursor);
  }

  if (typeof options.limit === 'number') {
    searchParams.set('limit', options.limit.toString());
  }

  if (typeof options.page === 'number') {
    searchParams.set('page', options.page.toString());
  }

  if (options.status) {
    searchParams.set('status', options.status);
  }

  if (options.direction) {
    searchParams.set('direction', options.direction);
  }

  if (options.query) {
    searchParams.set('query', options.query);
  }

  if (options.sort) {
    searchParams.set('sort', options.sort);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return apiRequest(`/signals${suffix}`, signalFeedResponseSchema);
};

export const getSignals = (
  options: GetSignalsOptions = {},
): Promise<SignalFeedResponse> =>
  getLiveSignals(options);

export const getLiveSignalDetail = (
  id: string,
): Promise<SignalDetailResponse> =>
  apiRequest(`/signals/${encodeURIComponent(id)}`, signalDetailResponseSchema);

export const getSignalDetail = (id: string): Promise<SignalDetailResponse> =>
  getLiveSignalDetail(id);

export const getSignalCandles = (
  id: string,
  timeframe: SignalChartTimeframe,
): Promise<SignalCandlesResponse> =>
  apiRequest(
    `/signals/${encodeURIComponent(id)}/candles?timeframe=${encodeURIComponent(timeframe)}`,
    signalCandlesResponseParser,
  );
