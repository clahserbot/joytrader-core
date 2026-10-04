/**
 * Wire protocol types for the JoyTrader executor's Axum WebSocket.
 *
 * The backend speaks JSON with a `type` discriminator and a `data` payload
 * (see src/main.rs in the executor). Only the message types the v1 mobile
 * client needs are modelled here; add more as screens are ported rather than
 * porting the full 60+ type surface speculatively.
 */

export const WS_URLS = {
  /** Public hostname of the executor. Also the base for REST calls. */
  api: "https://callback.joycloud.io",
  ws: "wss://callback.joycloud.io",
} as const;

/**
 * Protocol revision, bumped when a change is not backward compatible.
 *
 * Sent in the `login` handshake as a proposal so the executor can warn when a
 * phone runs a newer core than the executor it is talking to. Without it,
 * skew shows up as randomly missing message types rather than a clear error.
 * See the plan's backend change requests.
 */
export const PROTOCOL_VERSION = 1;

/**
 * The `login` handshake. Sent as the first frame after the socket opens.
 *
 * `uid` and `session_uid` are both the `global-<uuid>` session UID - they
 * carry the same value. `client_type` is a proposed addition (see the plan's
 * backend requests) so the executor can tune payload verbosity per platform.
 */
export type LoginFrame = {
  type: "login";
  uid: string;
  session_uid: string;
  access: string;
  client_type?: "desktop" | "mobile";
  /** Lets the executor warn on skew between phone and executor. */
  protocol_version?: number;
};

/** The three frames sent immediately after a successful login. */
export const bootstrapFrames = (sessionUid: string): Record<string, unknown>[] => [
  { type: "get_strategy_pnls", uid: sessionUid },
  { type: "all_trades_info", uid: sessionUid, strategy_id: "ALL" },
  { type: "get_all_manual", uid: sessionUid },
];

/** Inbound message envelope. `data` shape varies by `type`. */
export type ServerMessage = {
  type: string;
  data?: any;
  algo?: any;
  quantity?: any;
  value?: any;
  message?: any;
  token?: string | number;
  timeframe?: string;
  error?: string;
};

/**
 * Inbound types the v1 mobile client handles. Anything else is ignored
 * rather than treated as an error.
 */
export const INBOUND_TYPES = {
  /** Open strategy positions. -> core/trade.rs */
  strategyTrades: "a_t_info",
  /** Per-strategy P&L totals, pushed on the heartbeat tick. */
  strategyPnls: "get_strategy_pnls",
  /** Manual / alert / strategy sourced entries. -> handlers/alert.rs */
  allManual: "get_all_manual",
  /** Alert definitions. -> handlers/alert.rs */
  allAlerts: "get_all_alerts",
  /** Live or historical candles. */
  candles: "get_candles",
  /** Live candle tick. -> handlers/ohlc.rs */
  ohlc: "ohlc",
  /** Bulk last-traded-price refresh for list screens. */
  bulkLtp: "get_bulk_ltp",
  /** Market status flag (which stock lists are loaded). */
  status: "get_status",
  /** Token / instrument universe. */
  tokens: "get_tokens",
  instruments: "s_ins",
  error: "error",
} as const;

export type InboundType = (typeof INBOUND_TYPES)[keyof typeof INBOUND_TYPES];

/**
 * Heartbeat interval, milliseconds.
 *
 * The desktop pings every 3s, which is tuned for a mains-powered desktop on
 * a wired connection. On a phone that keeps the cellular radio permanently
 * awake and drains the battery, so mobile uses a much longer interval.
 *
 * The executor answers `ping` on any interval, so this needs no server-side
 * change - but confirm there is no idle-timeout shorter than this before
 * relying on it (see the plan's backend change requests).
 */
export const MOBILE_PING_INTERVAL_MS = 15_000;

/** Reconnect cadence after an unexpected close. */
export const MOBILE_RECONNECT_INTERVAL_MS = 5_000;
