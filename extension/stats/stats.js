/* stats.js — full-page dashboard. Reads the per-day usage already collected in
   chrome.storage (no new tracking) and renders: streak/summary KPIs, a calendar
   heatmap, a per-day bar chart, and top sites over a selectable range. */

import { getUsage, dayKey } from "../core/store.js";
import { getStreakStats } from "../features/streak.js";
import { siteUrl } from "../core/site.js";

// point "About TabLens" links at localhost when unpacked, prod once published
document.querySelectorAll(".js-about").forEach((a) => { a.href = siteUrl(); });

const $ = (id) => document.getElementById(id);
const fmt = (s) => { const m = Math.round(s / 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

// deterministic avatar tint per domain
function tint(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 52% 46%)`; }

const dayTotal = (usage, day) => { const o = usage[day]; return o ? Object.values(o).reduce((a, b) => a + b, 0) : 0; };

// last n day-keys ending today, chronological
function lastDays(n) {
  const out = [], d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(dayKey(x)); }
  return out;
}

// minutes → heat intensity bucket
function level(secs) {
  if (!secs) return 0;
  if (secs <= 900) return 1;       // ≤15m
  if (secs <= 3600) return 2;      // ≤1h
  if (secs <= 10800) return 3;     // ≤3h
  return 4;                        // >3h
}

$("opts").addEventListener("click", () => chrome.runtime.openOptionsPage());

function renderSummary(usage, stats) {
  $("cur").textContent = stats.current;
  $("best").textContent = stats.longest;
  $("active").textContent = stats.activeDays;
  let total = 0; for (const k in usage) total += dayTotal(usage, k);
  $("total").textContent = total ? fmt(total) : "0m";
}

function renderHeat(usage) {
  const WEEKS = 53;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7); // Sunday of the earliest week

  const heat = $("heat");
  const frag = document.createDocumentFragment();
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const cell = document.createElement("i");
    if (d > today) { cell.className = "blank"; }
    else {
      const t = dayTotal(usage, dayKey(d));
      cell.dataset.lv = level(t);
      cell.title = `${dayKey(d)} · ${t ? fmt(t) : "no activity"}`;
    }
    frag.append(cell);
  }
  heat.replaceChildren(frag);
}

function renderBars(usage) {
  const days = lastDays(30);
  const totals = days.map((k) => dayTotal(usage, k));
  const max = Math.max(1, ...totals);
  const bars = $("bars");
  bars.replaceChildren();
  days.forEach((k, i) => {
    const col = document.createElement("div"); col.className = "col";
    col.title = `${k} · ${totals[i] ? fmt(totals[i]) : "no activity"}`;
    const b = document.createElement("div"); b.className = "b";
    b.style.height = totals[i] ? `${Math.max(2, (totals[i] / max) * 100)}%` : "2px";
    const d = document.createElement("span"); d.className = "d"; d.textContent = k.slice(8); // day-of-month
    col.append(b, d);
    bars.append(col);
  });
}

const PAGE = 25;
let siteRows = [], sitePage = 0, siteMax = 1; // bar width uses the global #1, so pages stay comparable

// aggregate the selected range into a sorted list, then show page 0
function loadSites(usage, days) {
  const keys = days === 0 ? Object.keys(usage) : lastDays(days);
  const agg = {};
  for (const k of keys) { const o = usage[k]; if (!o) continue; for (const dom in o) agg[dom] = (agg[dom] || 0) + o[dom]; }
  siteRows = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  siteMax = siteRows.length ? siteRows[0][1] : 1;
  sitePage = 0;
  drawSites();
}

function drawSites() {
  const ul = $("sites");
  ul.replaceChildren();
  const pager = $("pager");

  if (!siteRows.length) {
    const li = document.createElement("li"); li.className = "empty";
    li.textContent = "No browsing in this range yet."; ul.append(li);
    pager.hidden = true; return;
  }

  const pages = Math.ceil(siteRows.length / PAGE);
  sitePage = Math.max(0, Math.min(sitePage, pages - 1));
  const start = sitePage * PAGE;

  for (const [dom, secs] of siteRows.slice(start, start + PAGE)) {
    const li = document.createElement("li"); li.className = "site";
    const av = document.createElement("span"); av.className = "site__av"; av.style.background = tint(dom); av.textContent = dom[0] || "?";
    const d = document.createElement("span"); d.className = "site__d"; d.textContent = dom;
    const track = document.createElement("span"); track.className = "site__track";
    const bar = document.createElement("span"); bar.className = "site__bar"; bar.style.width = `${Math.max(6, (secs / siteMax) * 100)}%`;
    track.append(bar);
    const t = document.createElement("span"); t.className = "site__t"; t.textContent = fmt(secs);
    li.append(av, d, track, t);
    ul.append(li);
  }

  if (siteRows.length > PAGE) {
    pager.hidden = false;
    $("pageinfo").textContent = `${start + 1}–${Math.min(start + PAGE, siteRows.length)} of ${siteRows.length}`;
    $("prev").disabled = sitePage === 0;
    $("next").disabled = sitePage >= pages - 1;
  } else {
    pager.hidden = true;
  }
}

(async () => {
  const usage = await getUsage();
  const stats = await getStreakStats();
  renderSummary(usage, stats);
  renderHeat(usage);
  renderBars(usage);
  loadSites(usage, 7);

  $("range").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    [...$("range").children].forEach((b) => b.classList.toggle("on", b === btn));
    loadSites(usage, +btn.dataset.days);
  });
  $("prev").addEventListener("click", () => { sitePage--; drawSites(); });
  $("next").addEventListener("click", () => { sitePage++; drawSites(); });
})();
