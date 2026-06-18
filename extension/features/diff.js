/* features/diff.js — Tier 2 (needs the <all_urls> grant to fetch arbitrary URLs).
   Periodically fetches each watched page, reduces it to visible text, hashes it,
   and flags the watch when the hash changes since last check. Surfaced as a "!"
   action badge; the popup lists which pages changed. */

import { getFlags, getWatches, setWatches } from "../core/store.js";

async function hashText(t) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// crude but dependency-free: drop scripts/styles/tags, collapse whitespace. Good
// enough to notice real content changes while ignoring most markup churn.
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function checkWatches() {
  if (!(await getFlags()).diff) return;
  const watches = await getWatches();
  if (!watches.length) return;

  let anyChanged = false;
  for (const w of watches) {
    try {
      const res = await fetch(w.url, { cache: "no-store", credentials: "omit" });
      const h = await hashText(visibleText(await res.text()));
      w.lastChecked = Date.now();
      w.error = null;
      if (w.hash && w.hash !== h) { w.changed = true; anyChanged = true; }
      w.hash = h;
    } catch (e) {
      w.error = String(e && e.message || e);
      w.lastChecked = Date.now();
    }
  }
  await setWatches(watches);
  if (anyChanged) chrome.action.setBadgeText({ text: "!" }).catch(() => {});
}

export function initDiff() {
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" }).catch(() => {});
  chrome.alarms.create("tablens:diff", { periodInMinutes: 30 });
}

export function onAlarm(name) { if (name === "tablens:diff") checkWatches(); }
