# @joytrader/core

Platform-agnostic domain logic shared by the two JoyTrader clients:

| Client | Repo | Stack |
|---|---|---|
| Desktop | [`clahserbot/joytrader`](https://github.com/clahserbot/joytrader) | Tauri v2 + Next.js 15 + React 19 |
| Mobile | [`clahserbot/joytron`](https://github.com/clahserbot/joytron) | Expo / React Native |

## Why this exists

Both clients talk to the same Axum WebSocket executor and must agree on how
P&L is derived, what "today" means, and how a session is identified. When
that logic is duplicated, the two clients drift and a number on the phone
quietly disagrees with the same number on the desktop.

The desktop previously carried **two** independent copies of the session-UID
logic (`src/constants/index.ts` and an inline block in `app/layout.tsx`).
There is now one.

## What lives here

| Module | Contents |
|---|---|
| `pnlStats.ts` | `buildHeaderStats`, per-strategy / per-source P&L aggregation, INR and percentage formatting |
| `dateUtils.ts` | `formatDate`, `isMarketOpen`, `istToday`, NSE holiday calendar |
| `uid.ts` | `REAL_USER_UID`, `deriveSessionUid`, `loadOrCreateSessionUid` |
| `protocol.ts` | Wire-protocol constants, `LoginFrame`, `bootstrapFrames`, `INBOUND_TYPES`, heartbeat intervals |

## What deliberately does NOT live here

Anything platform-specific. Both bundles import this package unchanged, so a
single DOM, React, Tauri or React Native reference would break one of them.

- **Storage backends** — `uid.ts` takes a `UidStorage` adapter; the desktop
  passes `localStorage`, mobile passes AsyncStorage or SecureStore.
- **Styling** — the old `pnlTextClass()` returned Tailwind class strings
  (`"text-green-500"`). It is replaced by `signOf()`, which returns
  `"gain" | "loss" | "flat"`; each client maps that to its own palette.
- **Charts, tables, navigation, the socket lifecycle itself** — all app-side.

## Invariants worth knowing

- **All Redis data is keyed under `global`.** Every client must send a UID
  beginning with that prefix or data lookups silently fail. A random suffix
  is appended so concurrent clients get separate WebSocket channels; the
  executor's `extract_real_uid` strips it for data lookups.
- **Times are UTC- or IST-based, never device-local.** A phone outside India
  must still see the exchange's trading day.
- **Entry timestamps arrive in seconds or milliseconds** depending on the
  source payload; `daysHeld()` normalises both.

## Consuming it

Pinned to a tag, never to a branch — a TestFlight build must not change under
you:

```bash
yarn add @joytrader/core@git+ssh://git@github.com:clahserbot/joytrader-core.git#v0.1.0
```

Tags are immutable and timestamped (`v<YYYYMMDD-HHMMSS>-<sha>`). That is
deliberate: Yarn 1 caches git dependencies by resolved URL, so a unique URL per
release means the cache can never serve stale code. **Never move or re-create
an existing tag.**

To move both consumers onto a new core version, run `core-release` from the
executor repo rather than editing `package.json` by hand — it retags core,
re-points both consumers, reinstalls and pushes in one step.

## Development

```bash
yarn install
yarn build          # tsc -> dist/
yarn typecheck

# Behavioural parity against the desktop's original implementation.
# Compiles the current desktop sources, then asserts the two agree.
npx tsc /home/akhi/executor/joytrader/src/lib/pnlStats.ts \
         /home/akhi/executor/joytrader/src/utils/dateUtils.ts \
         --module commonjs --target ES2020 --outDir scripts
mv scripts/lib/pnlStats.js scripts/orig-pnlStats.js
mv scripts/utils/dateUtils.js scripts/orig-dateUtils.js
rmdir scripts/lib scripts/utils
node scripts/parity-check.js
```

`parity-check.js` covers 67 assertions across populated, empty, null-ish and
malformed inputs, plus every formatter over edge values (`NaN`, `Infinity`,
`±1e-9`, `YYYYMMDD` numbers, unparseable strings). Run it after any change to
the aggregation or formatting logic.
