import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Activity01Icon,
    Calendar01Icon,
    Certificate01Icon,
    ChartHistogramIcon,
    GpsSignal01Icon,
    Home01Icon,
    Menu01Icon,
    Cancel01Icon,
    News01Icon,
} from '@hugeicons/core-free-icons';
import { useRunStatus } from '../../hooks/useRunStatus';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const REFRESH_INTERVAL_MS = 30_000;

const formatLabel = (value: string | null | undefined, defaultLabel = 'UNKNOWN') => {
  if (!value) {
    return defaultLabel;
  }

    return value.replace(/_/g, ' ').toUpperCase();
};

const formatDateTime = (value: string | null | undefined) => {
    if (!value) {
        return 'NOT SCHEDULED';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

const telegramUrl = import.meta.env.VITE_TELEGRAM_URL as string | undefined;

function TelegramIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
            <path d="M21.9 4.2 18.6 19.7c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.2 1.1 11.7c-1.1-.3-1.1-1.1.2-1.6L20.4 2.7c.9-.3 1.7.2 1.5 1.5Z" />
        </svg>
    );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const runStatus = useRunStatus({ refreshIntervalMs: REFRESH_INTERVAL_MS });

    const navItems = [
        { icon: Home01Icon, label: 'Dashboard', path: '/app' },
        { icon: GpsSignal01Icon, label: 'Signals', path: '/app/signals' },
        { icon: News01Icon, label: 'Intel', path: '/app/intel' },
        { icon: ChartHistogramIcon, label: 'Analytics', path: '/app/analytics' },
        { icon: Activity01Icon, label: 'Swarm Trace', path: '/app/swarm' },
        { icon: Certificate01Icon, label: '0G Evidence', path: '/app/evidence' },
    ];

    const pageTitles: Record<string, string> = {
        '/app': 'MISSION CONTROL',
        '/app/signals': 'SIGNAL INTERCEPT',
        '/app/intel': 'INTELLIGENCE FEED',
        '/app/analytics': 'SYSTEM ANALYTICS',
        '/app/swarm': 'SWARM TRACE',
        '/app/evidence': '0G EVIDENCE',
    };

    const currentTitle = pageTitles[location.pathname] || 'SYSTEM OVERVIEW';
    const currentRun = runStatus.activeRun ?? runStatus.latestRun;

    return (
        <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-cyan-500/30 flex">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        w-64 border-r border-gray-800 bg-gray-950/95 backdrop-blur flex flex-col fixed h-full z-50 transition-transform duration-300 ease-in-out
        md:translate-x-0 md:z-40
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
                    <Link to="/" className="flex items-center gap-3 no-underline" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="p-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20 flex items-center justify-center">
                            <img src="/generated/omen-logo-v2.png" alt="Omen" className="h-6 w-6 object-contain" />
                        </div>
                        <span className="font-bold text-white tracking-tight">OMEN</span>
                    </Link>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden text-gray-400 hover:text-white"
                    >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                                    }`}
                            >
                                <HugeiconsIcon icon={item.icon} className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-gray-500 group-hover:text-white'}`} />
                                <span className="font-medium text-sm">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-gray-800 bg-black space-y-3">
                    {telegramUrl ? (
                        <a
                            href={telegramUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition-colors hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-sky-200"
                        >
                            <TelegramIcon className="h-4 w-4" />
                            <span>Telegram</span>
                        </a>
                    ) : null}
                    <div className="text-[10px] text-gray-700 font-mono text-center">
                        OMEN_OS v1.0.0-alpha
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-gray-800 bg-gray-950/50 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between">
                    <div className="md:hidden flex items-center gap-3">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-400 hover:text-white">
                            <HugeiconsIcon icon={Menu01Icon} className="w-6 h-6" />
                        </button>
                        <Link to="/" className="font-bold text-white no-underline">OMEN</Link>
                    </div>

                    <div className="hidden md:flex items-center">
                        <div className="flex items-center gap-2 text-sm font-mono text-gray-500">
                            <span className="text-cyan-500">/</span>
                            <span className="tracking-widest">{currentTitle}</span>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono uppercase tracking-wider">
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4 text-cyan-500" />
                            <span>Next</span>
                            <span className="text-gray-300">{formatDateTime(runStatus.scheduler?.nextRunAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-purple-300" />
                            <span>Mode</span>
                            <span className="text-gray-300">{formatLabel(currentRun?.mode)}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
