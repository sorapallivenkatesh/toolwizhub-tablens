/* core/store.js — the shared chrome.storage data layer every feature reads and
   writes through. Keeping all keys + accessors here is what lets the streak
   dashboard aggregate across features without each one knowing the others.
   Pure-ish: only touches chrome.storage.local, no DOM. */

export const NS = "tablens";

export const FLAGS_KEY = `${NS}:flags`;
export const USAGE_KEY = `${NS}:usage`;
export const WATCH_KEY = `${NS}:watches`;
export const SCROLL_KEY = `${NS}:scroll`;
export const NOTES_KEY = `${NS}:notes`;

// Two tiers. usage + streak need no host access; scroll/notes/diff inject into /
// fetch arbitrary pages and so gate behind the optional <all_urls> grant.
export const PAGE_FEATURES = ["scroll", "notes", "diff"];
export const DEFAULT_FLAGS = { usage: true, streak: true, scroll: false, notes: false, diff: false };

const read = async (k, fallback) => {
  try { const s = await chrome.storage.local.get(k); return s[k] ?? fallback; }
  catch { return fallback; }
};
const write = (k, v) => chrome.storage.local.set({ [k]: v }).catch(() => {});

export async function getFlags() { return { ...DEFAULT_FLAGS, ...(await read(FLAGS_KEY, {})) }; }
export async function setFlags(flags) { await write(FLAGS_KEY, flags); }

// local-date day key "YYYY-MM-DD" — the unit the timer and streak both bucket by
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// usage: { "YYYY-MM-DD": { "example.com": seconds, ... }, ... }
export async function getUsage() { return read(USAGE_KEY, {}); }
export async function addUsage(domain, secs) {
  if (!domain || secs <= 0) return;
  const all = await getUsage();
  const day = dayKey();
  (all[day] ||= {});
  all[day][domain] = (all[day][domain] || 0) + secs;
  await write(USAGE_KEY, all);
}

// page-diff watches: [{ url, hash, lastChecked, changed, error }]
export async function getWatches() { return read(WATCH_KEY, []); }
export async function setWatches(w) { await write(WATCH_KEY, w); }
