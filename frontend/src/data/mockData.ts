export const mockHistorySignals = [
    {
        id: 'mock-hist-1',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        content: {
            topic: 'Frax Expansion',
            tweet_text: 'Frax Finance launching new L2 mechanics. Whales migrating collateral.',
            sentiment_score: 0.88,
            confidence_score: 0.92,
            trade_setup: {
                asset: 'FXS',
                direction: 'LONG',
                entry_price: 6.45,
                target_price: 8.20,
                stop_loss: 5.90
            },
            status: 'tp_hit',
            pnl_percent: 2.1
        }
    },
    {
        id: 'mock-hist-2',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        content: {
            topic: 'ZkSync Airdrop Rumors',
            tweet_text: 'Major volume spike on ZK sync native protocols.',
            sentiment_score: 0.75,
            confidence_score: 0.84,
            trade_setup: {
                asset: 'ZK',
                direction: 'LONG',
                entry_price: 1.15,
                target_price: 1.50,
                stop_loss: 1.05
            },
            status: 'sl_hit',
            pnl_percent: -1.0
        }
    },
    {
        id: 'mock-hist-3',
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        content: {
            topic: 'Solana DeFi Summer',
            tweet_text: 'Solana DEX volume overtakes Ethereum L1 for the first time.',
            sentiment_score: 0.95,
            confidence_score: 0.96,
            trade_setup: {
                asset: 'SOL',
                direction: 'LONG',
                entry_price: 145.20,
                target_price: 175.00,
                stop_loss: 135.00
            },
            status: 'tp_hit',
            pnl_percent: 3.5
        }
    },
    {
        id: 'mock-hist-4',
        created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
        content: {
            topic: 'AI Coin Correction',
            tweet_text: 'AI narrative losing momentum, profit taking observed across major wallets.',
            sentiment_score: 0.20,
            confidence_score: 0.89,
            trade_setup: {
                asset: 'FET',
                direction: 'SHORT',
                entry_price: 2.10,
                target_price: 1.60,
                stop_loss: 2.25
            },
            status: 'tp_hit',
            pnl_percent: 1.5
        }
    }
];

export const mockRunStatus = {
    mindshare: [
        { topic: 'AI', volume: 14500, sentiment: 0.8 },
        { topic: 'L2', volume: 12000, sentiment: 0.6 },
        { topic: 'DeFi', volume: 8000, sentiment: 0.9 },
        { topic: 'GameFi', volume: 4500, sentiment: 0.4 },
        { topic: 'Memecoins', volume: 22000, sentiment: 0.3 }
    ]
};
