/* popup.js — the dashboard. Asks the worker for the aggregated snapshot
   (usage + streak + flags + watches) and renders today's top sites and any
   changed pages. No data lives here; it's all from the shared store. */

const $ = (id) => document.getElementById(id);

function fmt(secs) {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const openOpts = () => chrome.runtime.openOptionsPage();
$("opts").addEventListener("click", openOpts);
$("opts2").addEventListener("click", (e) => { e.preventDefault(); openOpts(); });

function renderSites(usage, today) {
  const day = usage[today] || {};
  const rows = Object.entries(day).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = Object.values(day).reduce((a, b) => a + b, 0);
  $("today").textContent = total ? fmt(total) : "0m";

  const ul = $("sites");
  ul.replaceChildren();
  if (!rows.length) { ul.innerHTML = '<li class="empty">No browsing tracked yet.</li>'; return; }
  const max = rows[0][1] || 1;
  for (const [domain, secs] of rows) {
    const li = document.createElement("li");
    li.className = "site";
    const d = document.createElement("span"); d.className = "site__d"; d.textContent = domain;
    const bar = document.createElement("span"); bar.className = "site__bar"; bar.style.width = `${Math.max(8, (secs / max) * 90)}px`;
    const t = document.createElement("span"); t.className = "site__t"; t.textContent = fmt(secs);
    li.append(d, bar, t);
    ul.append(li);
  }
}

async function renderChanges() {
  const { [`tablens:watches`]: watches = [] } = await chrome.storage.local.get("tablens:watches");
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
