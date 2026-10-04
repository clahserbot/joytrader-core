/**
 * NTFY topic catalogue.
 *
 * These are the exact keys the executor writes under `notifications:{topic}`
 * and pushes to `https://ntfy.joycloud.io/{topic}`. They are produced by
 * `telegram::get_ntfy_topic_name` in the Rust executor:
 *
 *   "Trending"      -> trending
 *   "ATH Wick"/"ATH"-> athwick
 *   "ATH Body"/high -> athbody
 *   "Manual Alert"  -> manualalert
 *   strategy topics -> choppi52* / choppi* / invest* by cadence
 *
 * Kept here, in the shared package, so the app's folders cannot drift from
 * what the executor actually writes. The Rust side keeps its own copy in
 * `handlers/notifications.rs::all_topics` - the crate cannot depend on this
 * TypeScript package - and the two are asserted to match by
 * `scripts/verify-topics.js`, which reads the Rust source and diffs it against
 * this list. Run it before publishing an executor change that touches topics.
 *
 * LABELS are deliberately short. The parenthetical descriptions from the
 * subscribe instructions ("Choppi52 Hourly") are noise in a list where the
 * folder already says "Choppi52 Strategies" - the key alone identifies it.
 */

export type NtfyTopic = {
  /** The key, as used in the ntfy URL and the Redis key suffix. */
  key: string;
  /** Short human label for the row. */
  label: string;
};

export type NtfyGroup = {
  /** Folder title. */
  title: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  topics: NtfyTopic[];
};

export const NTFY_TOPIC_GROUPS: NtfyGroup[] = [
  {
    title: "Choppi52 Strategies",
    icon: "chart-timeline-variant",
    topics: [
      { key: "choppi52hourly", label: "Hourly" },
      { key: "choppi52daily", label: "Daily" },
      { key: "choppi522day", label: "2 Day" },
      { key: "choppi52weekly", label: "Weekly" },
    ],
  },
  {
    title: "Choppi Strategies",
    icon: "chart-timeline-variant",
    topics: [
      { key: "choppihourly", label: "Hourly" },
      { key: "choppidaily", label: "Daily" },
      { key: "choppi2day", label: "2 Day" },
      { key: "choppiweekly", label: "Weekly" },
    ],
  },
  {
    title: "Invest Strategies",
    icon: "chart-line",
    topics: [
      { key: "investhourly", label: "Hourly" },
      { key: "investdaily", label: "Daily" },
      { key: "invest2day", label: "2 Day" },
      { key: "investweekly", label: "Weekly" },
    ],
  },
  {
    title: "Breakout & Special Alerts",
    icon: "bell-alert",
    topics: [
      { key: "athbody", label: "ATH Body" },
      { key: "athwick", label: "ATH Wick" },
      { key: "manualalert", label: "Manual Alert" },
      { key: "trending", label: "Trending" },
    ],
  },
];

/** Every topic key, flattened. */
export const ALL_NTFY_TOPICS: string[] = NTFY_TOPIC_GROUPS.flatMap((g) =>
  g.topics.map((t) => t.key)
);

/** Find the group and label for a topic key, for rendering a feed row. */
export const topicMeta = (
  key: string
): { group: string; icon: string; label: string } | null => {
  for (const g of NTFY_TOPIC_GROUPS) {
    const hit = g.topics.find((t) => t.key === key);
    if (hit) return { group: g.title, icon: g.icon, label: hit.label };
  }
  return null;
};

/** Base URL shown in the subscribe instructions. */
export const NTFY_BASE_URL = "https://ntfy.joycloud.io";
