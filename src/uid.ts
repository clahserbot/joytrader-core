/**
 * Session UID derivation, shared by the desktop and mobile clients.
 *
 * WHY THIS EXISTS
 * ---------------
 * All Redis data (batches, trades, manual, alerts, history) is keyed under a
 * single real namespace, `global`. Every JoyTrader client must therefore send
 * a UID that begins with that prefix, or data lookups silently fail.
 *
 * A random suffix is appended so that two concurrently running clients do not
 * share a WebSocket channel. The backend's `extract_real_uid` strips the
 * suffix for data lookups, so both halves of the job happen automatically:
 *
 *   global            -> the data namespace
 *   global-<uuid>     -> one client's private WS channel
 *
 * The desktop app previously carried TWO independent copies of this logic
 * (src/constants/index.ts and an inline block in app/layout.tsx). They could
 * drift; there is now one.
 */

/** The real (data) UID that all per-instance sessions are anchored to. */
export const REAL_USER_UID = "global";

/** localStorage / AsyncStorage / SecureStore key holding the session UID. */
export const SESSION_UID_KEY = "jt_session_uid";

/** Minimal storage surface, satisfied by localStorage, AsyncStorage, etc. */
export type UidStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
};

/** True when `value` is a usable, correctly prefixed session UID. */
export const isValidSessionUid = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(REAL_USER_UID);

/**
 * Pure derivation: given whatever was previously stored, return the session
 * UID to use and whether it needs persisting.
 *
 * Anything that is not a properly prefixed UID is discarded and replaced.
 * This matters because an older per-user login page wrote bare usernames into
 * this key, which would break every data lookup.
 */
export const deriveSessionUid = (
  stored: string | null | undefined,
  randomSuffix: string
): { uid: string; shouldPersist: boolean } => {
  if (isValidSessionUid(stored)) {
    return { uid: stored, shouldPersist: false };
  }
  return { uid: `${REAL_USER_UID}-${randomSuffix}`, shouldPersist: true };
};

/**
 * RFC4122 v4 UUID when the runtime provides `crypto.randomUUID`, otherwise a
 * Math.random fallback. Kept dependency-free so React Native's incomplete
 * `crypto` polyfill is handled without pulling in a uuid package.
 */
export const randomSuffix = (): string => {
  const c: any = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return (
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  );
};

/**
 * Read-or-create the session UID against a platform storage adapter.
 * Safe to call on every app start; it is idempotent once a valid UID exists.
 */
export const loadOrCreateSessionUid = async (storage: UidStorage): Promise<string> => {
  const stored = await storage.getItem(SESSION_UID_KEY);
  const { uid, shouldPersist } = deriveSessionUid(stored, randomSuffix());
  if (shouldPersist) await storage.setItem(SESSION_UID_KEY, uid);
  return uid;
};
