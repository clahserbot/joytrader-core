/**
 * Parity check: the extracted @joytrader/core must produce byte-identical
 * output to the desktop's original src/lib/pnlStats.ts for the same inputs.
 *
 * Run: node scripts/parity-check.js
 */
const path = require("path");
const assert = require("assert");

const core = require(path.join(__dirname, "..", "dist", "index.js"));
const orig = require(path.join(__dirname, "orig-pnlStats.js"));
const origDates = require(path.join(__dirname, "orig-dateUtils.js"));

// Mixed fixture: long/short, bullish/bearish, queued, missing ltp, zero pdc,
// unmapped strategy id, alert/manual/strategy sources, unexecuted manual.
const trades = [
  { strategy_id: 1, price: 100, ltp: 110, quantity: 10, pdc: 105, type: true,  date: 1700000000 },
  { strategy_id: "2", price: 50,  ltp: 45,  quantity: 20, pdc: 52,  type: false, date: 1700086400 },
  { strategy_id: 3,    price: 200, ltp: 0,   quantity: 5,  pdc: 200, type: true,  date: 1700172800 }, // ltp 0 -> skipped
  { strategy_id: 4,    price: 300, ltp: 310, quantity: 2,  pdc: 0,   type: true,  date: 1700259200 },  // pdc 0 -> falls back to entry
  { strategy_id: 99,   price: 10,  ltp: 12,  quantity: 100, pdc: 11, type: false, col5: "Bearish", date: 1700345600 }, // OTHER
  { strategy_id: 1,    price: 400, ltp: 420, quantity: 1,  pdc: 410, type: true,  date: 1700432000, is_queue: true }, // queued -> skipped
  null,
];

const manual = [
  { status: true,  source: "manual",   limitPrice: 100, ltp: 110, quantity: 10, prevClose: 105, tvlink: "Bullish", created_at: 1700000000 },
  { status: true,  source: "alert",    limitPrice: 200, ltp: 190, quantity: 5,  prevClose: 195, tvlink: "Bearish", created_at: 1700086400 },
  { status: true,  source: "strategy", limitFrom: 300, ltp: 330, quantity: 2,  prevClose: 0,   tvlink: "Bullish", created_at: 1700172800 }, // no limitPrice, no prevClose
  { status: true,  source: "bogus",    limitPrice: 1,   ltp: 2,   quantity: 1,  prevClose: 1,   tvlink: "Bullish", created_at: 1700259200 }, // -> manual
  { status: false, source: "manual",   limitPrice: 999, ltp: 999, quantity: 9,  prevClose: 999, tvlink: "Bullish", created_at: 1700345600 }, // not executed -> skipped
  { status: true,  source: "manual",   limitPrice: 50,  ltp: 0,   quantity: 3,  prevClose: 50,  tvlink: "Bullish", created_at: 1700432000 }, // ltp 0 -> skipped
];

const NOW = 1700515200000; // fixed clock so day counts are deterministic
const cases = [
  ["populated", trades, manual],
  ["empty", [], []],
  ["null-ish", undefined, undefined],
  ["garbage", [1, "x", {}], [{}, null]],
];

let checks = 0;
for (const [name, t, m] of cases) {
  const a = orig.buildHeaderStats(t, m, NOW);
  const b = core.buildHeaderStats(t, m, NOW);
  assert.deepStrictEqual(b, a, `buildHeaderStats mismatch for case "${name}"`);
  checks++;
}

// Formatting helpers must match exactly.
for (const v of [0, 1, -1, 1234.56, -9876.54, NaN, Infinity, 1e9, -1e-9, 0.05]) {
  assert.strictEqual(core.formatInr(v), orig.formatInr(v), `formatInr(${v})`);
  assert.strictEqual(core.formatInrSigned(v), orig.formatInrSigned(v), `formatInrSigned(${v})`);
  assert.strictEqual(core.formatPct(v), orig.formatPct(v), `formatPct(${v})`);
  assert.strictEqual(core.formatAtd(v), orig.formatAtd(v), `formatAtd(${v})`);
  checks += 4;
}

for (const ts of [0, 1, 1700000000, 1700000000000, 20240518, "2024-05-18", "not-a-date", null, undefined, 4102444800]) {
  for (const withTime of [false, true]) {
    assert.strictEqual(core.formatDate(ts, withTime), origDates.formatDate(ts, withTime), `formatDate(${ts}, ${withTime})`);
    checks++;
  }
}

// The market-calendar helpers must not throw and must agree on open state.
assert.strictEqual(typeof core.isMarketOpen(), "boolean");
assert.strictEqual(core.isMarketOpen(), origDates.isMarketOpen());
assert.match(core.istToday(), /^\d{4}-\d{2}-\d{2}$/);
checks += 3;

console.log(`PASS - ${checks} assertions, core matches desktop implementation exactly`);
