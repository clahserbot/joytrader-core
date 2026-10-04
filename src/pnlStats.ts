/**
 * P&L aggregation + formatting shared by the desktop (Tauri/Next.js) and the
 * mobile (React Native) JoyTrader clients.
 *
 * Two raw websocket payloads feed everything here:
 *   - `a_t_info`       (request: all_trades_info, strategy_id "ALL") -> open strategy trades
 *   - `get_all_manual` -> manual / alert / strategy sourced entries
 *
 * The backend only ships raw per-trade fields (entry price, quantity, ltp,
 * previous close, entry timestamp and direction) - every total, percentage
 * and average below is derived here so the header and the tables can never
 * drift apart, on either client.
 *
 * NOTE: `pnlTextClass` deliberately does NOT live here. It returned Tailwind
 * class strings ("text-green-500"), which is web-specific. Each client now
 * derives its own colour from the sign of the number - see
 * `signOf()` below, which is the platform-agnostic part.
 */

export type PnlStats = {
  pnl: number;
  pnlPct: number;
  dayPnl: number;
  dayPct: number;
  invested: number;
  current: number;
  holdings: number;
  atd: number;
};

export type StrategyKey = "I" | "C" | "C52" | "C52B" | "OTHER";
export type ManualSource = "manual" | "alert" | "strategy";

/** Strategies that have a page in the app, in display order. */
export const STRATEGY_META: { key: Exclude<StrategyKey, "OTHER">; strategyId: string; label: string }[] = [
  { key: "I", strategyId: "1", label: "INVEST" },
  { key: "C", strategyId: "2", label: "CHOPPI" },
  { key: "C52", strategyId: "3", label: "CHOPPI52" },
  { key: "C52B", strategyId: "4", label: "CHOPPI52B" },
];

/** Sources a manual holding can originate from, in display order. */
export const MANUAL_SOURCES: ManualSource[] = ["manual", "alert", "strategy"];

const STRATEGY_KEY_BY_ID: Record<string, Exclude<StrategyKey, "OTHER">> = STRATEGY_META.reduce(
  (acc, meta) => {
    acc[meta.strategyId] = meta.key;
    return acc;
  },
  {} as Record<string, Exclude<StrategyKey, "OTHER">>
);

export const emptyPnlStats = (): PnlStats => ({
  pnl: 0,
  pnlPct: 0,
  dayPnl: 0,
  dayPct: 0,
  invested: 0,
  current: 0,
  holdings: 0,
  atd: 0,
});

type Acc = {
  pnl: number;
  dayPnl: number;
  invested: number;
  current: number;
  prevValue: number;
  holdings: number;
  daySum: number;
};

export type HeaderStats = {
  /** True once the first payload with at least one usable row has landed. */
  loaded: boolean;
  /** Every executed manual holding, regardless of source. */
  manual: PnlStats;
  manualBySource: Record<ManualSource, PnlStats>;
  /** All open strategy trades (I + C + C52 + C52B + anything unmapped). */
  strategyTotal: PnlStats;
  strategyByKey: Record<StrategyKey, PnlStats>;
};

const num = (value: any): number => {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? (n as number) : 0;
};

const newAcc = (): Acc => ({
  pnl: 0,
  dayPnl: 0,
  invested: 0,
  current: 0,
  prevValue: 0,
  holdings: 0,
  daySum: 0,
});

/** Entry timestamps arrive in seconds or milliseconds depending on the source. */
const toMs = (value: any): number => {
  const ts = num(value);
  if (!ts) return 0;
  return ts < 1e12 ? ts * 1000 : ts;
};

const daysHeld = (entryTs: any, now: number): number => {
  const ms = toMs(entryTs);
  if (!ms) return 0;
  return Math.max(0, Math.floor((now - ms) / 86400000));
};

/** Mirrors the bullish/bearish detection used by the info tables. */
const isBearishTrade = (trade: any): boolean =>
  trade?.type === false || trade?.type === 0 || trade?.type === "Bearish" || trade?.col5 === "Bearish";

/**
 * Folds one open position into an accumulator. A position is only counted
 * when entry, quantity and ltp are all usable - the same guard the info
 * tables use, so a row missing a live tick is never folded in at zero value.
 */
const addPosition = (acc: Acc, dir: number, entry: number, ltp: number, prev: number, qty: number, days: number) => {
  if (!(entry > 0) || !(qty > 0) || !(ltp > 0)) return;
  acc.pnl += dir * (ltp - entry) * qty;
  acc.invested += entry * qty;
  acc.current += ltp * qty;
  acc.dayPnl += dir * (ltp - prev) * qty;
  acc.prevValue += prev * qty;
  acc.holdings += 1;
  acc.daySum += days;
};

const finalize = (acc: Acc): PnlStats => ({
  pnl: acc.pnl,
  pnlPct: acc.invested > 0 ? (acc.pnl / acc.invested) * 100 : 0,
  dayPnl: acc.dayPnl,
  dayPct: acc.prevValue > 0 ? (acc.dayPnl / acc.prevValue) * 100 : 0,
  invested: acc.invested,
  current: acc.current,
  holdings: acc.holdings,
  atd: acc.holdings > 0 ? acc.daySum / acc.holdings : 0,
});

/**
 * Folds the `a_t_info` payload into per-strategy + combined totals.
 * Queued (not yet executed) entries are skipped; strategies without a known
 * id land in "OTHER" so they still count towards the strategy total.
 */
export const aggregateStrategyTrades = (trades: any[], now: number = Date.now()) => {
  const byKey: Record<string, Acc> = {};
  const total = newAcc();

  (Array.isArray(trades) ? trades : []).forEach((trade) => {
    if (!trade || trade.is_queue === true) return;

    const rawId = trade.strategy_id != null ? String(trade.strategy_id) : "";
    const key: StrategyKey = STRATEGY_KEY_BY_ID[rawId] || "OTHER";
    if (!byKey[key]) byKey[key] = newAcc();

    const entry = num(trade.price);
    const ltp = num(trade.ltp);
    const qty = num(trade.quantity);
    // Previous close is 0 before the first tick of the day - fall back to the
    // entry price so "Day's P&L" degrades to "change since entry" instead of
    // reporting a bogus full-notional move.
    const prev = num(trade.pdc) || entry;
    const dir = isBearishTrade(trade) ? -1 : 1;
    const days = daysHeld(trade.date, now);

    addPosition(byKey[key], dir, entry, ltp, prev, qty, days);
    addPosition(total, dir, entry, ltp, prev, qty, days);
  });

  return { total: finalize(total), byKey };
};

/**
 * Folds the `get_all_manual` payload into per-source + combined totals.
 * Only executed entries (status === true) are open holdings; the rest are
 * planned alerts that have not been taken yet.
 */
export const aggregateManualEntries = (entries: any[], now: number = Date.now()) => {
  const bySource: Record<string, Acc> = {};
  const total = newAcc();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry || entry.status !== true) return;

    const rawSource = String(entry.source || "manual");
    const source: ManualSource = (MANUAL_SOURCES as string[]).includes(rawSource)
      ? (entry.source as ManualSource)
      : "manual";
    if (!bySource[source]) bySource[source] = newAcc();

    const price = num(entry.limitPrice) || num(entry.limitFrom);
    const ltp = num(entry.ltp);
    const qty = num(entry.quantity);
    const prev = num(entry.prevClose) || price;
    const dir = entry.tvlink === "Bearish" ? -1 : 1;
    const days = daysHeld(entry.created_at, now);

    addPosition(bySource[source], dir, price, ltp, prev, qty, days);
    addPosition(total, dir, price, ltp, prev, qty, days);
  });

  return { total: finalize(total), bySource };
};

/** Single entry point used by both app shells to populate their context. */
export const buildHeaderStats = (
  strategyTrades: any[],
  manualEntries: any[],
  now: number = Date.now()
): HeaderStats => {
  const strategies = aggregateStrategyTrades(strategyTrades, now);
  const manual = aggregateManualEntries(manualEntries, now);

  const strategyByKey = {
    I: emptyPnlStats(),
    C: emptyPnlStats(),
    C52: emptyPnlStats(),
    C52B: emptyPnlStats(),
    OTHER: emptyPnlStats(),
  } as Record<StrategyKey, PnlStats>;
  Object.entries(strategies.byKey).forEach(([key, acc]) => {
    strategyByKey[key as StrategyKey] = finalize(acc);
  });

  const manualBySource = {
    manual: emptyPnlStats(),
    alert: emptyPnlStats(),
    strategy: emptyPnlStats(),
  } as Record<ManualSource, PnlStats>;
  Object.entries(manual.bySource).forEach(([source, acc]) => {
    manualBySource[source as ManualSource] = finalize(acc);
  });

  return {
    loaded: manual.total.holdings + strategies.total.holdings > 0,
    manual: manual.total,
    manualBySource,
    strategyTotal: strategies.total,
    strategyByKey,
  };
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const round = (value: number) => {
  const n = Number.isFinite(value) ? value : 0;
  return Math.round(Math.abs(n)).toLocaleString("en-IN");
};

export const formatInr = (value: number): string => `Rs ${round(value)}`;

export const formatInrSigned = (value: number): string => {
  const n = Number.isFinite(value) ? value : 0;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}Rs ${round(n)}`;
};

export const formatPct = (value: number): string => {
  const n = Number.isFinite(value) ? value : 0;
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
};

export const formatAtd = (value: number): string => (Number.isFinite(value) ? value : 0).toFixed(1);

/**
 * Platform-agnostic replacement for the old Tailwind-only `pnlTextClass`.
 * Each client maps this to its own styling vocabulary.
 */
export type PnlSign = "gain" | "loss" | "flat";

export const signOf = (value: number): PnlSign => {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "flat";
};
