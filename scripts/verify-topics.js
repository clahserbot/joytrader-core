/**
 * Assert the TypeScript topic catalogue and the Rust executor's list agree.
 *
 * The Rust crate cannot depend on this package, so the topic list is duplicated
 * in `src/handlers/notifications.rs`. A silent drift would show up in the app
 * as a permanently empty folder, which is easy to misread as "no notifications
 * yet". This turns that into an explicit failure.
 *
 * Run: node scripts/verify-topics.js
 */
const fs = require("fs");
const path = require("path");

const RUST = path.join(__dirname, "..", "..", "executor", "src", "handlers", "notifications.rs");

if (!fs.existsSync(RUST)) {
  console.log("  executor not checked out - skipping cross-check");
  process.exit(0);
}

const src = fs.readFileSync(RUST, "utf8");
const block = src.match(/pub fn all_topics\(\)[^{]*\{([\s\S]*?)\n\}/);
if (!block) {
  console.error("  could not find all_topics() in " + RUST);
  process.exit(1);
}
const rust = [...block[1].matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]);

// Read the compiled output, so this checks what the app actually ships.
const built = require(path.join(__dirname, "..", "dist", "index.js")).ALL_NTFY_TOPICS;

const a = [...new Set(rust)].sort();
const b = [...new Set(built)].sort();

const missing = a.filter((k) => !b.includes(k));
const extra = b.filter((k) => !a.includes(k));

if (missing.length || extra.length) {
  if (missing.length) console.error("  in Rust but not in core: " + missing.join(", "));
  if (extra.length) console.error("  in core but not in Rust: " + extra.join(", "));
  console.error("  update src/ntfyTopics.ts and the executor's notifications.rs together");
  process.exit(1);
}
console.log(`  OK - ${a.length} topics match on both sides`);
