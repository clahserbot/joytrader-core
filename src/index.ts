/**
 * @joytrader/core - platform-agnostic domain logic shared by the JoyTrader
 * desktop (Tauri + Next.js) and mobile (React Native) clients.
 *
 * Everything exported here is free of DOM, React, Tauri and React Native
 * APIs so that both bundles can consume it unchanged. Platform-specific
 * concerns (storage backends, colour palettes, navigation) stay in the apps.
 */

export * from "./pnlStats";
export * from "./dateUtils";
export * from "./uid";
export * from "./protocol";
