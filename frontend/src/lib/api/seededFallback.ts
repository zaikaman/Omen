import {
  OMEN_DISCLAIMER,
  analyticsFeedResponseSchema,
  analyticsLatestResponseSchema,
  dashboardSummarySchema,
  intelDetailResponseSchema,
  intelFeedResponseSchema,
  logFeedResponseSchema,
  schedulerStatusSchema,
  signalDetailResponseSchema,
  signalFeedResponseSchema,
  type AnalyticsFeedResponse,
  type AnalyticsLatestResponse,
  type DashboardSummary,
  type IntelDetailResponse,
  type IntelFeedResponse,
  type LogFeedResponse,
  type SchedulerStatus,
  type SignalDetailResponse,
  type SignalFeedResponse,
} from '@omen/shared';

const DEMO_SIGNAL_RUN_STARTED_AT = '2026-04-25T08:00:00.000Z';
const DEMO_SIGNAL_RUN_COMPLETED_AT = '2026-04-25T08:06:10.000Z';
const DEMO_INTEL_RUN_STARTED_AT = '2026-04-25T09:00:00.000Z';
const DEMO_INTEL_RUN_COMPLETED_AT = '2026-04-25T09:04:20.000Z';

export const seededSchedulerStatus: SchedulerStatus = schedulerStatusSchema.parse({
  enabled: true,
  isRunning: false,
  nextRunAt: '2026-04-25T10:00:00.000Z',
  lastRunAt: DEMO_INTEL_RUN_STARTED_AT,
  scanIntervalMinutes: 60,
  overlapPrevented: false,
});

const seededSignalRun = {
  id: 'run-signal-001',
  mode: 'mocked',
  status: 'completed',
  marketBias: 'LONG',
  startedAt: DEMO_SIGNAL_RUN_STARTED_AT,
  completedAt: DEMO_SIGNAL_RUN_COMPLETED_AT,
  triggeredBy: 'scheduler',
  finalSignalId: 'signal-btc-long-001',
  finalIntelId: null,
  failureReason: null,
  outcome: {
    outcomeType: 'signal',
    summary: 'BTC long setup approved after scanner, analyst, and critic convergence.',
    signalId: 'signal-btc-long-001',
    intelId: null,
  },
};

const seededIntelRun = {
  id: 'run-intel-001',
  mode: 'mocked',
  status: 'completed',
  marketBias: 'NEUTRAL',
  startedAt: DEMO_INTEL_RUN_STARTED_AT,
  completedAt: DEMO_INTEL_RUN_COMPLETED_AT,
  triggeredBy: 'scheduler',
  finalSignalId: null,
  finalIntelId: 'intel-ai-rotation-001',
  failureReason: null,
  outcome: {
    outcomeType: 'intel',
    summary: 'Narrative intel published on AI infrastructure rotation.',
    signalId: null,
    intelId: 'intel-ai-rotation-001',
  },
};

const seededSignal = {
  id: 'signal-btc-long-001',
  runId: seededSignalRun.id,
  candidateId: 'candidate-btc-breakout-001',
  asset: 'BTC',
  direction: 'LONG',
  confidence: 91,
  orderType: 'limit',
  tradingStyle: 'swing_trade',
  expectedDuration: '1-3 days',
  currentPrice: 93120,
  entryPrice: 92625,
  targetPrice: 94850,
  stopLoss: 91550,
  signalStatus: 'active',
  pnlPercent: null,
  closedAt: null,
  priceUpdatedAt: DEMO_SIGNAL_RUN_COMPLETED_AT,
  riskReward: 2.8,
  entryZone: {
    low: 92450,
    high: 92800,
    rationale: 'Retest of intraday breakout zone',
  },
  invalidation: {
    low: 91550,
    high: 91800,
    rationale: 'Loss of breakout structure invalidates thesis',
  },
  targets: [
    { label: 'TP1', price: 93900 },
    { label: 'TP2', price: 94850 },
  ],
  whyNow:
    'BTC reclaimed range highs while funding stayed contained and spot-led strength held across majors.',
  confluences: [
    '4H breakout above local resistance',
    'Positive spot-led order flow',
    'Critic-approved risk/reward above threshold',
  ],
  uncertaintyNotes:
    'Macro headlines can still interrupt follow-through if US rates commentary turns risk-off.',
  missingDataNotes:
    'Order-book depth was estimated from fallback market snapshots instead of direct exchange L2.',
  criticDecision: 'approved',
  reportStatus: 'published',
  finalReportRefId: 'proof-signal-manifest-001',
  proofRefIds: [
    'proof-signal-kv-001',
    'proof-signal-log-001',
    'proof-signal-compute-001',
    'proof-signal-manifest-001',
    'proof-signal-post-001',
  ],
  disclaimer: OMEN_DISCLAIMER,
  publishedAt: '2026-04-25T08:06:10.000Z',
  createdAt: '2026-04-25T08:04:30.000Z',
  updatedAt: '2026-04-25T08:06:10.000Z',
};

const seededIntel = {
  id: 'intel-ai-rotation-001',
  runId: seededIntelRun.id,
  title: 'AI Infrastructure Names Keep Absorbing Attention While Majors Chop',
  slug: 'ai-infrastructure-rotation-2026-04-25',
  summary:
    'Omen detected sustained attention rotation into AI-linked infrastructure tokens while BTC stayed rangebound.',
  body: 'Market breadth stayed mixed, but AI-linked infrastructure symbols kept outpacing majors on both mindshare and relative strength. The swarm treated it as intel rather than a trade because BTC posture stayed neutral and catalyst confirmation was narrative-led.',
  category: 'narrative_shift',
  status: 'published',
  symbols: ['TAO', 'RNDR', 'AKT'],
  confidence: 88,
  imagePrompt: null,
  imageUrl: null,
  sources: [
    {
      label: 'AI infrastructure narrative thread',
      url: 'https://example.com/ai-rotation',
      provider: 'news',
    },
    {
      label: 'Mindshare snapshot',
      url: null,
      provider: 'defillama',
    },
  ],
  proofRefIds: [
    'proof-intel-kv-001',
    'proof-intel-log-001',
    'proof-intel-manifest-001',
    'proof-intel-post-001',
  ],
  publishedAt: '2026-04-25T09:04:20.000Z',
  createdAt: '2026-04-25T09:02:30.000Z',
  updatedAt: '2026-04-25T09:04:20.000Z',
};

const seededLatestPost = {
  id: 'post-intel-001',
  runId: seededIntelRun.id,
  signalId: null,
  intelId: seededIntel.id,
  target: 'x',
  kind: 'intel_summary',
  status: 'posted',
  payload: {
    text: 'Omen intel: AI infrastructure names kept absorbing mindshare while BTC stayed neutral. TAO / RNDR / AKT led the rotation.',
    thread: [
      'The swarm kept this as intel, not a signal, because BTC regime confirmation stayed incomplete and catalysts were mostly narrative-led.',
    ],
    metadata: { manifestRefId: 'proof-intel-manifest-001' },
  },
  provider: 'twitterapi',
  providerPostId: 'tweet-intel-001',
  publishedUrl: 'https://x.com/omen/status/1000000000000000002',
  lastError: null,
  createdAt: '2026-04-25T09:03:40.000Z',
  updatedAt: '2026-04-25T09:04:20.000Z',
  publishedAt: '2026-04-25T09:04:20.000Z',
};

const seededAnalytics = {
  id: 'analytics-snapshot-002',
  runId: seededIntelRun.id,
  generatedAt: '2026-04-25T09:04:25.000Z',
  totals: {
    totalRuns: 2,
    completedRuns: 2,
    publishedSignals: 1,
    publishedIntel: 1,
    activeSignals: 1,
    closedSignals: 0,
    winningSignals: 0,
    losingSignals: 0,
    totalPnlPercent: 0,
    averageR: null,
  },
  confidenceBands: [
    { label: '85-89', value: 1 },
    { label: '90-94', value: 1 },
  ],
  tokenFrequency: [
    { label: 'BTC', value: 1 },
    { label: 'TAO', value: 1 },
    { label: 'RNDR', value: 1 },
    { label: 'AKT', value: 1 },
  ],
  mindshare: [
    { label: 'AI Infrastructure', value: 48 },
    { label: 'BTC', value: 31 },
    { label: 'L1 majors', value: 21 },
  ],
  winRate: 100,
};

const seededEvents = [
  {
    id: 'event-signal-001',
    runId: seededSignalRun.id,
    agentId: 'agent-orchestrator-001',
    agentRole: 'orchestrator',
    eventType: 'run_created',
    status: 'success',
    summary: 'Hourly mocked signal run created.',
    payload: { runMode: 'mocked' },
    timestamp: DEMO_SIGNAL_RUN_STARTED_AT,
    correlationId: null,
    axlMessageId: null,
    proofRefId: null,
    signalId: null,
    intelId: null,
  },
  {
    id: 'event-signal-002',
    runId: seededSignalRun.id,
    agentId: 'agent-scanner-001',
    agentRole: 'scanner',
    eventType: 'candidate_found',
    status: 'success',
    summary: 'Scanner shortlisted BTC and ETH for deeper analysis.',
    payload: { candidates: ['BTC', 'ETH'] },
    timestamp: '2026-04-25T08:01:10.000Z',
    correlationId: 'corr-signal-001',
    axlMessageId: 'axl-signal-001',
    proofRefId: null,
    signalId: null,
    intelId: null,
  },
  {
    id: 'event-signal-003',
    runId: seededSignalRun.id,
    agentId: 'agent-critic-001',
    agentRole: 'critic',
    eventType: 'critic_decision',
    status: 'success',
    summary: 'Critic approved BTC long thesis for publishing.',
    payload: { decision: 'approved', riskReward: 2.8 },
    timestamp: '2026-04-25T08:05:30.000Z',
    correlationId: 'corr-signal-003',
    axlMessageId: 'axl-signal-003',
    proofRefId: 'proof-signal-compute-001',
    signalId: seededSignal.id,
    intelId: null,
  },
  {
    id: 'event-intel-001',
    runId: seededIntelRun.id,
    agentId: 'agent-orchestrator-001',
    agentRole: 'orchestrator',
    eventType: 'run_created',
    status: 'success',
    summary: 'Hourly mocked intel run created.',
    payload: { runMode: 'mocked' },
    timestamp: DEMO_INTEL_RUN_STARTED_AT,
    correlationId: null,
    axlMessageId: null,
    proofRefId: null,
    signalId: null,
    intelId: null,
  },
  {
    id: 'event-intel-002',
    runId: seededIntelRun.id,
    agentId: 'agent-analyst-001',
    agentRole: 'analyst',
    eventType: 'intel_ready',
    status: 'success',
    summary: 'Analyst converted the bundle into a publishable intel brief.',
    payload: { category: 'narrative_shift', confidence: 88 },
    timestamp: '2026-04-25T09:03:00.000Z',
    correlationId: 'corr-intel-002',
    axlMessageId: 'axl-intel-002',
    proofRefId: 'proof-intel-kv-001',
    signalId: null,
    intelId: seededIntel.id,
  },
  {
    id: 'event-intel-003',
    runId: seededIntelRun.id,
    agentId: 'agent-publisher-001',
    agentRole: 'publisher',
    eventType: 'report_published',
    status: 'success',
    summary: 'Intel summary posted to X and attached to the run manifest.',
    payload: { provider: 'twitterapi', threadCount: 1 },
    timestamp: '2026-04-25T09:04:20.000Z',
    correlationId: 'corr-intel-003',
    axlMessageId: 'axl-intel-003',
    proofRefId: 'proof-intel-post-001',
    signalId: null,
    intelId: seededIntel.id,
  },
];

export const withSeededFallback = async <TResponse>(
  liveQuery: () => Promise<TResponse>,
  fallback: () => TResponse,
): Promise<TResponse> => {
  try {
    return await liveQuery();
  } catch {
    return fallback();
  }
};

export const getSeededDashboardSummary = (): DashboardSummary =>
  dashboardSummarySchema.parse({
    activeRun: null,
    latestRun: seededIntelRun,
    latestSignalId: seededSignal.id,
    latestIntelId: seededIntel.id,
    scheduler: seededSchedulerStatus,
    latestPost: seededLatestPost,
    analytics: seededAnalytics,
  });

export const getSeededRuntimeStatus = () => ({
  scheduler: seededSchedulerStatus,
  activeRunId: null as string | null,
});

export const getSeededIntelFeed = (): IntelFeedResponse =>
  intelFeedResponseSchema.parse({
    items: [seededIntel],
    nextCursor: null,
  });

export const getSeededIntelDetail = (id: string): IntelDetailResponse => {
  if (id !== seededIntel.id && id !== seededIntel.slug) {
    throw new Error(`Seeded intel item not found: ${id}`);
  }

  return intelDetailResponseSchema.parse({ item: seededIntel });
};

export const getSeededSignals = (): SignalFeedResponse =>
  signalFeedResponseSchema.parse({
    items: [seededSignal],
    total: 1,
    nextCursor: null,
  });

export const getSeededSignalDetail = (id: string): SignalDetailResponse => {
  if (id !== seededSignal.id) {
    throw new Error(`Seeded signal item not found: ${id}`);
  }

  return signalDetailResponseSchema.parse({ item: seededSignal });
};

export const getSeededAnalyticsSnapshots = (): AnalyticsFeedResponse =>
  analyticsFeedResponseSchema.parse({
    items: [seededAnalytics],
    nextCursor: null,
  });

export const getSeededLatestAnalyticsSnapshot = (): AnalyticsLatestResponse =>
  analyticsLatestResponseSchema.parse({
    item: seededAnalytics,
  });

export const getSeededLogs = (options: {
  runId?: string | null;
  limit?: number;
} = {}): LogFeedResponse => {
  const limit = options.limit ?? 100;
  const items = seededEvents
    .filter((event) => (options.runId ? event.runId === options.runId : true))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(0, limit);

  return logFeedResponseSchema.parse({
    items,
    nextCursor: null,
  });
};
