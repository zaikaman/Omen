import { ArrowUpRight, Activity, Target, ShieldAlert, Maximize2, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon } from '@hugeicons/core-free-icons';

const AGENT_AVATAR = '/logo.webp';

interface SignalCardProps {
  signal: any;
  isLoading?: boolean;
  isLatest?: boolean;
}

export function SignalCard({ signal, isLoading, isLatest }: SignalCardProps) {
  if (isLoading) {
    return <div className="h-64 bg-gray-900/50 animate-pulse rounded-xl border border-gray-800" />;
  }

  if (!signal) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Activity className="w-12 h-12 mb-4 opacity-20" />
          <p>No active signal</p>
        </CardContent>
      </Card>
    );
  }

  const { token, confidence, analysis, entry_price, target_price, stop_loss, status, pnl_percent, current_price, direction } = signal.content;
  
  // Format the timestamp
  const date = new Date(signal.created_at).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Infer direction from price structure if not explicitly set
  const tradeDirection = direction || (target_price > entry_price ? 'LONG' : 'SHORT');
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
                {confidence}/100
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
              {analysis}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div className="flex flex-col p-2 bg-gray-800/30 rounded border border-gray-800/50">
                <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Entry
                </span>
                <span className="font-mono text-sm text-gray-300">${entry_price}</span>
              </div>
              <div className="flex flex-col p-2 bg-gray-800/30 rounded border border-gray-800/50">
                <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                  <Target className="w-3 h-3 text-cyan-400" /> Target
                </span>
                <span className="font-mono text-sm text-cyan-300">${target_price}</span>
              </div>
              <div className="flex flex-col p-2 bg-gray-800/30 rounded border border-gray-800/50">
                <span className="text-xs text-gray-500 uppercase flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-red-400" /> Stop
                </span>
                <span className="font-mono text-sm text-red-300">${stop_loss}</span>
              </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full mt-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 border border-cyan-900/30">
                <Maximize2 className="w-4 h-4 mr-2" /> View Full Analysis
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                   <span className="text-3xl">{token?.symbol}</span>
                   {getDirectionBadge()}
                   {getStatusBadge()}
                </DialogTitle>
                <div className="text-gray-400">{token?.name}</div>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                 <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                      <span className="text-xs text-gray-500 uppercase mb-1">Entry</span>
                      <span className="font-mono text-lg text-gray-300">${entry_price}</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                      <span className="text-xs text-gray-500 uppercase mb-1">Target</span>
                      <span className="font-mono text-lg text-cyan-400">${target_price}</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                      <span className="text-xs text-gray-500 uppercase mb-1">Stop Loss</span>
                      <span className="font-mono text-lg text-red-400">${stop_loss}</span>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      Signal Analysis
                    </h3>
                    <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
                      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
                        {analysis}
                      </p>
                    </div>
                 </div>

                 <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                    <div className="text-sm text-gray-500">
                      Confidence Score
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" 
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                      <span className="font-mono text-cyan-400">{confidence}/100</span>
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
                <AvatarFallback className="bg-cyan-950 text-cyan-400 text-[10px]">RA</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Rogue Agent</span>
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
