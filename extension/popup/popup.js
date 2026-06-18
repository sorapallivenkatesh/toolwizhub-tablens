/* popup.js — the dashboard. Asks the worker for the aggregated snapshot
   (usage + streak + flags + watches) and renders today's top sites and any
   changed pages. No data lives here; it's all from the shared store. */

import { siteUrl } from "../core/site.js";

const $ = (id) => document.getElementById(id);

// point "About TabLens" links at localhost when unpacked, prod once published
document.querySelectorAll(".js-about").forEach((a) => { a.href = siteUrl(); });

function fmt(secs) {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// deterministic colour per domain, so a site always gets the same avatar tint
function tint(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 52% 46%)`;
}

$("opts").addEventListener("click", () => chrome.runtime.openOptionsPage());

// open the full stats dashboard — from the streak card or the link
const openStats = () => chrome.tabs.create({ url: chrome.runtime.getURL("stats/stats.html") });
$("streakCard").addEventListener("click", openStats);
$("streakCard").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStats(); } });
$("allstats").addEventListener("click", (e) => { e.preventDefault(); openStats(); });

function renderSites(usage, today) {
  const day = usage[today] || {};
  const rows = Object.entries(day).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = Object.values(day).reduce((a, b) => a + b, 0);
  $("today").textContent = total ? fmt(total) : "0m";

  const ul = $("sites");
  ul.replaceChildren();
  if (!rows.length) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = "No browsing tracked yet."; ul.append(li); return;
  }
  const max = rows[0][1] || 1;
  for (const [domain, secs] of rows) {
    const li = document.createElement("li");
    li.className = "site";

    const av = document.createElement("span");
    av.className = "site__av";
    av.style.background = tint(domain);
    av.textContent = domain[0] || "?";

    const d = document.createElement("span");
    d.className = "site__d"; d.textContent = domain;

    const track = document.createElement("span");
    track.className = "site__track";
    const bar = document.createElement("span");
    bar.className = "site__bar";
    bar.style.width = `${Math.max(10, (secs / max) * 100)}%`;
    track.append(bar);

    const t = document.createElement("span");
    t.className = "site__t"; t.textContent = fmt(secs);

    li.append(av, d, track, t);
    ul.append(li);
  }
}

async function renderChanges() {
  const { ["tablens:watches"]: watches = [] } = await chrome.storage.local.get("tablens:watches");
  const changed = watches.filter((w) => w.changed);
  if (!changed.length) return;
  $("changes-block").hidden = false;
  const ul = $("changes");
  ul.replaceChildren();
  for (const w of changed) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = w.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = w.url.replace(/^https?:\/\//, "");
    li.append(a);
    ul.append(li);
  }
  // Acknowledge: opening the popup has now shown these, so clear the changed flags
  // and the badge. Otherwise they'd stay "changed" forever with no way to dismiss.
  for (const w of watches) w.changed = false;
  await chrome.storage.local.set({ "tablens:watches": watches });
  chrome.runtime.sendMessage({ type: "tablens:clearBadge" });
}

chrome.runtime.sendMessage({ type: "tablens:dashboard" }, (res) => {
  if (!res) return;
  $("streak").textContent = res.streak;
  renderSites(res.usage, res.today);
});
renderChanges();
