/* options.js — feature toggles + watched-page management. The three page features
   (scroll/notes/diff) need the optional <all_urls> grant, so enabling any of them
   triggers a permission request (must happen in this click gesture). Turning the
   last one off revokes the grant again, so the default footprint stays minimal. */

import { getFlags, setFlags, PAGE_FEATURES, getWatches, setWatches } from "../core/store.js";
import { siteUrl } from "../core/site.js";

// point "About TabLens" links at localhost when unpacked, prod once published
document.querySelectorAll(".js-about").forEach((a) => { a.href = siteUrl(); });

const HOST = { origins: ["<all_urls>"] };
const perm = document.getElementById("perm");
let flags = {};

const hasHost = () => chrome.permissions.contains(HOST);
const syncContent = () => chrome.runtime.sendMessage({ type: "tablens:syncContent" });

function paint() {
  for (const cb of document.querySelectorAll("input[data-flag]")) cb.checked = !!flags[cb.dataset.flag];
}

async function onToggle(key, want) {
  const isPage = PAGE_FEATURES.includes(key);
  perm.textContent = ""; perm.classList.remove("warn");

  if (isPage && want) {
    // Call request() directly — it resolves true immediately if already granted.
    // Do NOT await anything (e.g. permissions.contains) first: that drops the user
    // gesture and Chrome then rejects the request with "must be called during a
    // user gesture", so enabling a page feature would silently fail.
    let granted = false;
    try { granted = await chrome.permissions.request(HOST); } catch {}
    if (!granted) {
      perm.textContent = "Page features need access to the sites you visit. Permission was not granted.";
      perm.classList.add("warn");
      flags[key] = false; paint();
      return;
    }
  }

  flags[key] = want;
  await setFlags(flags);
  await syncContent();

  // if no page feature is left on, hand the broad host grant back
  if (!PAGE_FEATURES.some((k) => flags[k]) && (await hasHost())) {
    try { await chrome.permissions.remove(HOST); } catch {}
  }
  if (isPage && want) perm.textContent = "Granted — page features are active on the sites you visit.";
}

document.querySelectorAll("input[data-flag]").forEach((cb) => {
  cb.addEventListener("change", () => onToggle(cb.dataset.flag, cb.checked));
});

/* ---- watched pages (page diff monitor) ------------------------------------ */
const listEl = document.getElementById("watch-list");
const urlEl = document.getElementById("watch-url");
const errEl = document.getElementById("watch-err");

function ago(ts) {
  if (!ts) return "not checked yet";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

async function renderWatches() {
  const watches = await getWatches();
  listEl.replaceChildren();
  if (!watches.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "No pages watched yet."; listEl.append(li); return; }
  for (const w of watches) {
    const li = document.createElement("li");
    const url = document.createElement("span"); url.className = "url"; url.textContent = w.url;
    const meta = document.createElement("span"); meta.className = "meta";
    meta.textContent = w.error ? "error" : ago(w.lastChecked);
    if (w.changed) { meta.textContent = "changed!"; meta.classList.add("changed"); }
    const rm = document.createElement("button"); rm.className = "rm"; rm.textContent = "Remove";
    rm.addEventListener("click", async () => { await setWatches((await getWatches()).filter((x) => x.url !== w.url)); renderWatches(); });
    li.append(url, meta, rm);
    listEl.append(li);
  }
}

document.getElementById("watch-add").addEventListener("click", async () => {
  errEl.textContent = "";
  let v = urlEl.value.trim();
  if (!v) return;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try { new URL(v); } catch { errEl.textContent = "Enter a valid URL."; return; }
  const watches = await getWatches();
  if (watches.some((w) => w.url === v)) { errEl.textContent = "Already watching that page."; return; }
  watches.push({ url: v, hash: null, lastChecked: null, changed: false, error: null });
  await setWatches(watches);
  urlEl.value = "";
  renderWatches();
  if (flags.diff) chrome.runtime.sendMessage({ type: "tablens:checkNow" });
});

document.getElementById("check-now").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "tablens:checkNow" }, () => setTimeout(renderWatches, 800));
});

(async () => { flags = await getFlags(); paint(); renderWatches(); })();
