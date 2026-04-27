import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { SignalCard } from '../components/SignalCard';
import { IntelCard } from '../components/IntelCard';
import { TerminalLog } from '../components/TerminalLog';
import type { IntelCardItem, LogEntry, SignalCardItem } from '../types/ui-models';

const mockSignal: SignalCardItem = {
    id: 'mock-signal-1',
    created_at: new Date().toISOString(),
    content: {
        token: { symbol: 'OMEN', name: 'Omen Protocol' },
        confidence: 88,
        analysis: 'Strong momentum detected. Technical structure favors upside.',
        entry_price: 1.25,
        target_price: 1.50,
        stop_loss: 1.15,
        status: 'active',
        pnl_percent: 5.2,
        current_price: 1.28,
        direction: 'LONG'
    }
};

const mockIntel: IntelCardItem = {
    id: 'mock-1',
    type: 'deep_dive',
    created_at: new Date().toISOString(),
    content: {
        topic: 'Omen Network Upgrade Phase 2',
        tweet_text: 'Omen core developers announce major stability update coming next week improving node synchronization times safely.',
    }
};

const mockLogs: LogEntry[] = [
    { id: '1', type: 'intel', created_at: new Date().toISOString(), content: { log_message: 'Initializing OMEN OS...' } },
    { id: '2', type: 'signal', created_at: new Date().toISOString(), content: { log_message: 'Systems nominal.' } },
    { id: '3', type: 'skip', created_at: new Date().toISOString(), content: { log_message: 'Scan completed. Awaiting parameters.' } }
];

export function DashboardHome() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <HugeiconsIcon icon={Home01Icon} className="w-6 h-6 text-cyan-500" />
                        Dashboard
                    </h2>
                    <p className="text-gray-400 mt-1">Overview of your agent status and latest intelligence.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Latest Intel Preview */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Intelligence</h3>
                            <Link to="/app/intel" className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1">
                                View Feed <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
                            </Link>
                        </div>
                        <IntelCard intel={mockIntel} />
                    </div>

                    {/* Latest Signal Preview */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Signal</h3>
                            <Link to="/app/signals" className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1">
                                View All <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
                            </Link>
                        </div>
                        <SignalCard signal={mockSignal} isLatest={true} />
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="lg:relative">
                    <div className="flex flex-col gap-6 lg:absolute lg:inset-0">
                        {/* Quick Actions or Status */}
                        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 shrink-0">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">System Status</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Agent Status</span>
                                    <span className="text-green-400 font-mono">ONLINE</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Network</span>
                                    <span className="text-cyan-400 font-mono">SECURE</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Uptime</span>
                                    <span className="text-gray-300 font-mono">99.9%</span>
                                </div>
                            </div>
                        </div>

                        {/* Terminal Log View */}
                        <TerminalLog
                            logs={mockLogs}
                            className="flex-1 min-h-[300px] lg:min-h-0"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
