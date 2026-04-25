import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogEntry {
  id: string;
  type: 'signal' | 'intel' | 'skip';
  created_at: string;
  content: any;
  confidence_score?: number;
}

interface TerminalLogProps {
  logs: LogEntry[];
  className?: string;
}

export function TerminalLog({ logs, className }: TerminalLogProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'signal': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'intel': return <Terminal className="w-4 h-4 text-blue-500" />;
      case 'skip': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Terminal className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className={cn("bg-gray-900/30 border border-gray-800 rounded-xl font-mono text-xs flex flex-col", className)}>
      <div className="p-3 border-b border-gray-800 bg-gray-900/50 rounded-t-xl text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2 shrink-0">
        <Terminal className="w-3.5 h-3.5" />
        System Logs
      </div>
      <ScrollArea className="flex-1 h-0">
        <div className="p-2 space-y-1">
          {logs.length === 0 && (
            <div className="text-gray-500 text-xs text-center py-8 italic">
              No recent system activity...
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 p-2 hover:bg-gray-900/50 rounded transition-colors group">
              <div className="mt-0.5 opacity-70">{getIcon(log.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-gray-500 text-[10px]">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 border-gray-700 text-gray-400 uppercase">
                    {log.type}
                  </Badge>
                  {log.confidence_score && (
                    <span className="ml-2 text-[10px] text-cyan-400/80 font-mono">
                      Score: {log.confidence_score}/100
                    </span>
                  )}
                </div>
                <div className="text-gray-300 truncate font-mono text-xs">
                  {log.content?.log_message || (log.type === 'signal' 
                    ? `SIGNAL DETECTED: ${log.content.token?.symbol} - ${log.content.token?.name}`
                    : log.type === 'skip'
                    ? 'Scan completed. No high-confidence signals found.'
                    : 'Intel thread generated.')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
