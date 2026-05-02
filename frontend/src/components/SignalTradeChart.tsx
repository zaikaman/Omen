import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { BarChart3 } from 'lucide-react';

import {
  getSignalCandles,
  type SignalCandle,
  type SignalChartTimeframe,
} from '../lib/api/signals';

const TIMEFRAMES: SignalChartTimeframe[] = ['15m', '1h', '4h'];

const toChartTime = (timestamp: string) =>
  Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;

const formatChartPrice = (value: number) => {
  if (value >= 100) {
    return value.toFixed(1);
  }

  if (value >= 1) {
    return value.toFixed(2);
  }

  return value.toFixed(6);
};

type TradeBoxInput = {
  direction: 'LONG' | 'SHORT';
  entry?: number;
  target?: number;
  stopLoss?: number;
};

type SignalTradeChartProps = TradeBoxInput & {
  signalId: string;
  symbol?: string;
};

type LoadedChartState = {
  candles: SignalCandle[];
  isLoading: boolean;
  error: string | null;
};

const drawTradeBoxes = (input: {
  canvas: HTMLCanvasElement;
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  candleData: CandlestickData<UTCTimestamp>[];
  levels: TradeBoxInput;
}) => {
  const { canvas, chart, series, candleData, levels } = input;
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));

  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  if (
    candleData.length === 0 ||
    typeof levels.entry !== 'number' ||
    typeof levels.target !== 'number' ||
    typeof levels.stopLoss !== 'number'
  ) {
    return;
  }

  const startIndex = Math.max(0, candleData.length - 45);
  const startX = chart.timeScale().timeToCoordinate(candleData[startIndex].time);
  const entryY = series.priceToCoordinate(levels.entry);
  const targetY = series.priceToCoordinate(levels.target);
  const stopY = series.priceToCoordinate(levels.stopLoss);

  if (startX === null || entryY === null || targetY === null || stopY === null) {
    return;
  }

  const x = Math.max(0, startX);
  const rightPadding = 76;
  const boxWidth = Math.max(0, width - rightPadding - x);
  const rewardTop = Math.min(entryY, targetY);
  const rewardHeight = Math.abs(entryY - targetY);
  const riskTop = Math.min(entryY, stopY);
  const riskHeight = Math.abs(entryY - stopY);

  if (boxWidth <= 0) {
    return;
  }

  context.fillStyle = 'rgba(0, 212, 255, 0.20)';
  context.strokeStyle = 'rgba(0, 212, 255, 0.85)';
  context.lineWidth = 1;
  context.fillRect(x, rewardTop, boxWidth, rewardHeight);
  context.strokeRect(x, rewardTop, boxWidth, rewardHeight);

  context.fillStyle = 'rgba(239, 68, 68, 0.20)';
  context.strokeStyle = 'rgba(239, 68, 68, 0.85)';
  context.fillRect(x, riskTop, boxWidth, riskHeight);
  context.strokeRect(x, riskTop, boxWidth, riskHeight);

  context.strokeStyle = 'rgba(229, 231, 235, 0.9)';
  context.setLineDash([6, 5]);
  context.beginPath();
  context.moveTo(0, entryY);
  context.lineTo(width - rightPadding, entryY);
  context.stroke();
  context.setLineDash([]);
};

export function SignalTradeChart({
  signalId,
  symbol,
  direction,
  entry,
  target,
  stopLoss,
}: SignalTradeChartProps) {
  const [timeframe, setTimeframe] = useState<SignalChartTimeframe>('15m');
  const [state, setState] = useState<LoadedChartState>({
    candles: [],
    isLoading: true,
    error: null,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isActive = true;

    setState((current) => ({ ...current, isLoading: true, error: null }));

    getSignalCandles(signalId, timeframe)
      .then((response) => {
        if (!isActive) {
          return;
        }

        setState({
          candles: response.candles,
          isLoading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setState({
          candles: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load chart candles.',
        });
      });

    return () => {
      isActive = false;
    };
  }, [signalId, timeframe]);

  const candleData = useMemo<CandlestickData<UTCTimestamp>[]>(
    () =>
      state.candles.map((candle) => ({
        time: toChartTime(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    [state.candles],
  );
  const volumeData = useMemo<HistogramData<UTCTimestamp>[]>(
    () =>
      state.candles.map((candle) => ({
        time: toChartTime(candle.timestamp),
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.42)' : 'rgba(239, 83, 80, 0.42)',
      })),
    [state.candles],
  );

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;

    if (!container || !overlay || candleData.length === 0) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(55, 65, 81, 0.42)' },
        horzLines: { color: 'rgba(55, 65, 81, 0.42)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(156, 163, 175, 0.65)', style: LineStyle.Dashed },
        horzLine: { color: 'rgba(156, 163, 175, 0.65)', style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(55, 65, 81, 0.8)',
        scaleMargins: { top: 0.08, bottom: 0.26 },
      },
      timeScale: {
        borderColor: 'rgba(55, 65, 81, 0.8)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
      },
      localization: {
        priceFormatter: formatChartPrice,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceLineColor: '#ef5350',
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    series.setData(candleData);
    volumeSeries.setData(volumeData);

    if (typeof target === 'number') {
      series.createPriceLine({
        price: target,
        color: '#00d4ff',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'TP',
      });
    }

    if (typeof entry === 'number') {
      series.createPriceLine({
        price: entry,
        color: '#e5e7eb',
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'Entry',
      });
    }

    if (typeof stopLoss === 'number') {
      series.createPriceLine({
        price: stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'SL',
      });
    }

    chart.timeScale().fitContent();

    const redraw = () => {
      drawTradeBoxes({
        canvas: overlay,
        chart,
        series,
        candleData,
        levels: { direction, entry, target, stopLoss },
      });
    };
    const resizeObserver = new ResizeObserver(redraw);

    resizeObserver.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    requestAnimationFrame(redraw);
    const settledRedrawId = window.setTimeout(redraw, 250);

    return () => {
      resizeObserver.disconnect();
      window.clearTimeout(settledRedrawId);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw);
      chart.remove();
    };
  }, [candleData, direction, entry, stopLoss, target, volumeData]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
      <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">Trade Map</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
            {symbol ? `${symbol}/USDT` : 'Signal'} candles
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/70 p-1">
          {TIMEFRAMES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTimeframe(option)}
              className={`h-7 rounded-md px-3 font-mono text-xs transition-colors ${
                timeframe === option
                  ? 'bg-cyan-500 text-gray-950'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[360px] bg-gray-900 sm:h-[460px]">
        <div ref={containerRef} className="absolute inset-0" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" />
        {state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/75 text-sm text-gray-400">
            Loading {timeframe} candles...
          </div>
        )}
        {!state.isLoading && state.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 px-6 text-center text-sm text-red-200">
            {state.error}
          </div>
        )}
      </div>
    </div>
  );
}
