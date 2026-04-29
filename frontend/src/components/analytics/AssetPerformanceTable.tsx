import { useMemo } from 'react';
import type { ChartSignal } from '../../types/ui-models';

interface Props {
  signals: ChartSignal[];
}

type AssetRow = {
  asset: string;
  total: number;
  closed: number;
  wins: number;
  losses: number;
  winRate: number | null;
  pnl: number;
};

export function AssetPerformanceTable({ signals }: Props) {
  const rows = useMemo<AssetRow[]>(() => {
    const grouped = new Map<string, ChartSignal[]>();

    for (const signal of signals) {
      const asset = signal.content.trade_setup?.asset ?? signal.content.asset;

      if (!asset) {
        continue;
      }

      grouped.set(asset, [...(grouped.get(asset) ?? []), signal]);
    }

    return [...grouped.entries()]
      .map(([asset, assetSignals]) => {
        const closed = assetSignals.filter(
          (signal) =>
            signal.content.status === 'tp_hit' || signal.content.status === 'sl_hit',
        );
        const wins = closed.filter((signal) => signal.content.status === 'tp_hit').length;
        const losses = closed.filter((signal) => signal.content.status === 'sl_hit').length;
        const pnl = closed.reduce(
          (total, signal) => total + (signal.content.pnl_percent ?? 0),
          0,
        );

        return {
          asset,
          total: assetSignals.length,
          closed: closed.length,
          wins,
          losses,
          winRate: closed.length > 0 ? (wins / closed.length) * 100 : null,
          pnl,
        };
      })
      .sort((left, right) => right.total - left.total)
      .slice(0, 8);
  }, [signals]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Asset</th>
            <th className="px-4 py-3 text-right font-semibold">Signals</th>
            <th className="px-4 py-3 text-right font-semibold">Closed</th>
            <th className="px-4 py-3 text-right font-semibold">W / L</th>
            <th className="px-4 py-3 text-right font-semibold">Win Rate</th>
            <th className="px-4 py-3 text-right font-semibold">PnL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((row) => (
            <tr key={row.asset} className="bg-gray-900/20 text-gray-300">
              <td className="px-4 py-3 font-semibold text-white">{row.asset}</td>
              <td className="px-4 py-3 text-right">{row.total}</td>
              <td className="px-4 py-3 text-right">{row.closed}</td>
              <td className="px-4 py-3 text-right">
                <span className="text-emerald-400">{row.wins}</span>
                <span className="text-gray-600"> / </span>
                <span className="text-red-400">{row.losses}</span>
              </td>
              <td className="px-4 py-3 text-right">
                {row.winRate === null ? 'N/A' : `${row.winRate.toFixed(1)}%`}
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${row.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.pnl > 0 ? '+' : ''}{row.pnl.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
