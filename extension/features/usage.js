/* features/usage.js — Tier 1 (no host permission). Tracks active time per domain.

   MV3-resilient design: the "active session" { domain, since } is persisted to
   chrome.storage.session, NOT held in a module variable — the service worker is
   torn down after ~30s idle, which would wipe in-memory state and lose the time.
   Every tick() accrues real elapsed wall-clock time for the persisted session and
   re-points it at whatever should be accruing now, so time is recovered across
   worker restarts.

   "Active" means: a Chrome window is focused AND the user isn't idle — EXCEPT we
   keep counting an idle user if the tab is playing audio/video (tab.audible), so
   watching a movie (no mouse/keyboard input) still counts. */

import { getFlags, addUsage } from "../core/store.js";

const ACTIVE_KEY = "tablens:active";
const IDLE_SECONDS = 60;
// cap a single accrual: normal worker-restart gaps are ~1 alarm period; anything
// much larger means the machine slept (alarms paused) — don't credit hours to a tab.
const MAX_ACCRUAL_SECS = 180;

function host(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return /^https?:/.test(url) ? h : ""; // ignore chrome://, about:, file:, extensions
  } catch { return ""; }
}

async function getActive() {
  try { const s = await chrome.storage.session.get(ACTIVE_KEY); return s[ACTIVE_KEY] || null; }
  catch { return null; }
}
async function setActive(a) {
  try { a ? await chrome.storage.session.set({ [ACTIVE_KEY]: a }) : await chrome.storage.session.remove(ACTIVE_KEY); }
  catch {}
}

// Which domain should be accruing time right this moment? "" = nothing should.
async function currentDomain() {
  if (!(await getFlags()).usage) return "";

  let win;
  try { win = await chrome.windows.getLastFocused(); } catch {}
  if (!win || !win.focused) return ""; // no Chrome window has focus (user is in another app)

  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, windowId: win.id }); } catch {}
  const d = tab ? host(tab.url) : "";
  if (!d) return "";

  // idle (no input for IDLE_SECONDS)? still count if the tab is making sound —
  // that's a video/music tab the user is actively watching/listening to.
  let state = "active";
  try { state = await chrome.idle.queryState(IDLE_SECONDS); } catch {}
  if (state !== "active" && !tab.audible) return "";

  return d;
}

// Accrue elapsed time for the persisted session, then re-point at the current domain.
async function tick() {
  const now = Date.now();
  const prev = await getActive();
  const cur = await currentDomain();

  if (prev && prev.domain) {
    const secs = Math.round((now - prev.since) / 1000);
    if (secs > 0) await addUsage(prev.domain, Math.min(secs, MAX_ACCRUAL_SECS));
  }
  await setActive(cur ? { domain: cur, since: now } : null);
}

export function initUsage() {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);

  const onChange = () => { tick(); };
  chrome.tabs.onActivated.addListener(onChange);
  chrome.tabs.onUpdated.addListener((_id, info) => {
    // re-evaluate on navigation and when a tab starts/stops playing audio
    if (info.url || info.audible !== undefined) tick();
  });
  chrome.windows.onFocusChanged.addListener(onChange);
  chrome.idle.onStateChanged.addListener(onChange);

  chrome.alarms.create("tablens:flush", { periodInMinutes: 1 });
  tick(); // establish the session on load
}

export function onAlarm(name) { if (name === "tablens:flush") tick(); }
