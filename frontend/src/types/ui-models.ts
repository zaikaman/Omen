export type SignalDirectionLabel = 'LONG' | 'SHORT' | string;

export type SignalStatus =
  | 'pending'
  | 'active'
  | 'tp_hit'
  | 'sl_hit'
  | 'closed'
  | 'entry_hit'
  | string;

export interface SignalToken {
  symbol?: string;
  name?: string;
}

export interface SignalTradeSetup {
  asset?: string;
  direction?: SignalDirectionLabel;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
}

export interface SignalContent {
  token?: SignalToken;
  confidence?: number;
  confidence_score?: number;
  analysis?: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  status?: SignalStatus;
  pnl_percent?: number;
  current_price?: number;
  direction?: SignalDirectionLabel;
  trade_setup?: SignalTradeSetup;
  asset?: string;
}

export interface SignalCardItem {
  id: string;
  runId?: string;
  created_at: string;
  content: SignalContent;
  proofBadges?: ProofBadgeState;
}

export interface IntelContent {
  topic?: string;
  tweet_text?: string;
  formatted_thread?: string;
  image_url?: string | null;
}

export interface IntelCardItem {
  id: string;
  runId?: string;
  type?: string;
  created_at: string;
  content: IntelContent;
  proofBadges?: ProofBadgeState;
}

export interface ProofBadgeState {
  runId: string;
  hasManifest: boolean;
  hasComputeHash: boolean;
  hasAxlRoute: boolean;
  hasPostProof: boolean;
}

export type LogType = 'signal' | 'intel' | 'skip';

export interface TerminalLogContent {
  log_message?: string;
  token?: SignalToken;
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  type: LogType;
  created_at: string;
  content: TerminalLogContent;
  confidence_score?: number;
}

export interface MindsharePoint {
  time?: string;
  topic?: string;
  value?: number;
  volume?: number;
}

export interface ChartSignal {
  created_at: string;
  content: SignalContent;
}
