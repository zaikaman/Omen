import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Activity,
  Cpu,
  FileCheck2,
  RadioTower,
  Target,
  ShieldAlert,
  Maximize2,
  TrendingUp,
  TrendingDown,
  Crosshair,
  Clock3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { XLogo } from './ui/XLogo';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon } from '@hugeicons/core-free-icons';
import type { SignalCardItem } from '../types/ui-models';
import { SignalTradeChart } from './SignalTradeChart';

const AGENT_AVATAR = '/generated/omen-logo-v2.png';

const formatPriceValue = (value: number | undefined) => {
  if (typeof value !== 'number') {
    return 'TBD';
  }

  return `$${value < 1 ? value.toFixed(6) : value.toFixed(2)}`;
};

interface SignalCardProps {
  signal: SignalCardItem | null | undefined;
  isLoading?: boolean;
  error?: Error | null;
  isLatest?: boolean;
}

export function SignalCard({ signal, isLoading, error, isLatest }: SignalCardProps) {
  if (isLoading) {
    return <div className="h-64 bg-gray-900/50 animate-pulse rounded-xl border border-gray-800" />;
  }

  if (!signal) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Activity className="w-12 h-12 mb-4 opacity-20" />
          <p>{error ? 'Unable to load latest signal.' : 'No active signal'}</p>
        </CardContent>
      </Card>
    );
  }

  const { token, confidence, analysis, entry_price, target_price, stop_loss, status, pnl_percent, current_price, direction } = signal.content;
  const confidenceScore = confidence ?? signal.content.confidence_score ?? 0;
  const proofBadges = signal.proofBadges;
  const proofHref = (section: string) =>
    proofBadges
      ? `/app/evidence?runId=${encodeURIComponent(proofBadges.runId)}&section=${encodeURIComponent(section)}`
      : null;

  // Format the timestamp
  const date = new Date(signal.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Infer direction from price structure if not explicitly set
  const tradeDirection =
    direction ||
    (target_price !== undefined && entry_price !== undefined && target_price > entry_price
      ? 'LONG'
      : 'SHORT');
  const isLong = tradeDirection === 'LONG';

  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50 animate-pulse">ACTIVE</Badge>;
      case 'tp_hit':
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">TP HIT</Badge>;
      case 'sl_hit':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">SL HIT</Badge>;
      case 'closed':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">CLOSED</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 animate-pulse">LIMIT ORDER</Badge>;
    }
  };

  const getDirectionBadge = () => {
    if (isLong) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/50 font-bold flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> LONG
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/50 font-bold flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> SHORT
        </Badge>
      );
    }
  };

  const pnlColor = (pnl_percent || 0) >= 0 ? 'text-green-400' : 'text-red-400';
  const visibleProofBadges = proofBadges
    ? [
        {
          label: '0G Manifest',
          isVisible: proofBadges.hasManifest,
          section: 'storage',
          icon: FileCheck2,
          className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400/50',
        },
        {
          label: 'Compute Hash',
          isVisible: proofBadges.hasComputeHash,
          section: 'compute',
          icon: Cpu,
          className: 'border-green-500/30 bg-green-500/10 text-green-200 hover:border-green-400/50',
        },
        {
          label: 'AXL Routed',
          isVisible: proofBadges.hasAxlRoute,
          section: 'axl-routes',
          icon: RadioTower,
          className: 'border-purple-500/30 bg-purple-500/10 text-purple-200 hover:border-purple-400/50',
        },
        {
          label: 'Post Proof',
          isVisible: proofBadges.hasPostProof,
          href: proofBadges.postProofUrl,
          icon: XLogo,
          className: 'border-pink-500/30 bg-pink-500/10 text-pink-200 hover:border-pink-400/50',
        },
      ].filter((badge) => badge.isVisible)
    : [];

  return (
    <Card className="bg-gray-900/50 border-gray-800 overflow-hidden relative group">
      <div className={`absolute top-0 left-0 w-1 h-full ${isLong ? 'bg-gradient-to-b from-green-500 to-cyan-500' : 'bg-gradient-to-b from-red-500 to-orange-500'}`} />

      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isLatest && <div className="text-xs text-gray-500 uppercase tracking-wider">Latest Signal</div>}
              {getDirectionBadge()}
              {getStatusBadge()}
            </div>
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
              {token?.symbol || 'UNKNOWN'}
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-950/30 text-xs h-5">
                {confidenceScore}/100
              </Badge>
            </CardTitle>
            <div className="text-sm text-gray-400 mt-0.5">{token?.name}</div>
          </div>
          <div className="text-right">
            {current_price && (
              <div className="text-2xl font-mono font-bold text-white">
                ${current_price < 1 ? current_price.toFixed(6) : current_price.toFixed(2)}
              </div>
            )}
            {pnl_percent !== undefined && (
              <div className={`text-sm font-mono ${pnlColor}`}>
                {pnl_percent > 0 ? '+' : ''}{pnl_percent.toFixed(2)}R
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="space-y-4">
          <div className="p-3 bg-gray-950/50 rounded-lg border border-gray-800/50">
            <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
              {analysis || 'Signal report is pending final analysis.'}
            </p>
          </div>

          {proofBadges && visibleProofBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {visibleProofBadges.map((proofBadge) => {
                const Icon = proofBadge.icon;
                const href = 'href' in proofBadge ? proofBadge.href : proofHref(proofBadge.section);

                if (href?.startsWith('http')) {
                  return (
                    <a
                      key={proofBadge.label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${proofBadge.className}`}
                      aria-label={`Open ${proofBadge.label} for this signal`}
                    >
                      <Icon className="h-3 w-3" />
                      {proofBadge.label}
                    </a>
                  );
                }

                return (
                  <Link
                    key={proofBadge.label}
                    to={href ?? '/app/evidence'}
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${proofBadge.className}`}
                    aria-label={`Open ${proofBadge.label} evidence for this signal`}
                  >
                    <Icon className="h-3 w-3" />
                    {proofBadge.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col p-2 bg-gray-800/30 rounded border border-gray-800/50">
              <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Entry
              </span>
              <span className="font-mono text-sm text-gray-300">{entry_price ? `$${entry_price}` : 'TBD'}</span>
            </div>
            <div className="flex flex-col p-2 bg-gray-800/30 rounded border border-gray-800/50">
              <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <Target className="w-3 h-3 text-cyan-400" /> Target
              </span>
              <span className="font-mono text-sm text-cyan-300">{target_price ? `$${target_price}` : 'TBD'}</span>
            </div>
            <div className="flex flex-col p-2 bg-gray-800/30 rounded border border-gray-800/50">
              <span className="text-xs text-gray-500 uppercase flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-red-400" /> Stop
              </span>
              <span className="font-mono text-sm text-red-300">{stop_loss ? `$${stop_loss}` : 'TBD'}</span>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full mt-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 border border-cyan-900/30">
                <Maximize2 className="w-4 h-4 mr-2" /> View Full Analysis
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 text-white w-[calc(100vw-2rem)] max-w-6xl max-h-[88vh] overflow-y-auto p-0">
              <DialogHeader className="border-b border-gray-800 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 pr-8 md:flex-row md:items-start md:justify-between">
                  <div>
                    <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-bold">
                      <span className="text-3xl">{token?.symbol}</span>
                      {getDirectionBadge()}
                      {getStatusBadge()}
                    </DialogTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                      <span>{token?.name}</span>
                      <span className="text-gray-700">/</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        15m execution chart
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Confidence</span>
                    <span className="font-mono text-sm text-cyan-300">{confidenceScore}/100</span>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_360px]">
                <div className="space-y-4">
                  <SignalTradeChart
                    signalId={signal.id}
                    symbol={token?.symbol}
                    direction={isLong ? 'LONG' : 'SHORT'}
                    entry={entry_price}
                    target={target_price}
                    stopLoss={stop_loss}
                  />

                  <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      Signal Analysis
                    </h3>
                    <p className="max-w-[72ch] whitespace-pre-wrap text-sm leading-7 text-gray-300">
                      {analysis || 'Signal report is pending final analysis.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                      <Crosshair className="h-4 w-4 text-cyan-400" />
                      Execution Levels
                    </h3>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                        <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
                          <ArrowUpRight className="h-3 w-3" /> Entry
                        </span>
                        <span className="font-mono text-lg text-gray-100">{formatPriceValue(entry_price)}</span>
                      </div>
                      <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3">
                        <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan-200/80">
                          <Target className="h-3 w-3" /> Take Profit
                        </span>
                        <span className="font-mono text-lg text-cyan-300">{formatPriceValue(target_price)}</span>
                      </div>
                      <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                        <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-200/80">
                          <ShieldAlert className="h-3 w-3" /> Stop Loss
                        </span>
                        <span className="font-mono text-lg text-red-300">{formatPriceValue(stop_loss)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-400">Confidence Score</span>
                      <span className="font-mono text-sm text-cyan-300">{confidenceScore}/100</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                        style={{ width: `${confidenceScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Current</div>
                        <div className="mt-1 font-mono text-gray-200">{formatPriceValue(current_price)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">P&L</div>
                        <div className={`mt-1 font-mono ${pnlColor}`}>
                          {pnl_percent !== undefined ? `${pnl_percent > 0 ? '+' : ''}${pnl_percent.toFixed(2)}R` : 'TBD'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Direction</div>
                        <div className="mt-1 font-mono text-gray-200">{tradeDirection}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Published</div>
                        <div className="mt-1 font-mono text-gray-200">{date}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Timestamp Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-7 w-7 border border-gray-700">
                <AvatarImage src={AGENT_AVATAR} />
                <AvatarFallback className="bg-cyan-950 text-cyan-400 text-[10px]">OM</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Omen</span>
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
                  {date}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
