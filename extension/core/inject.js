/* core/inject.js — dynamically (un)registers the page content script to match
   the current toggles + host grant. We DON'T declare content_scripts statically
   in the manifest: the <all_urls> grant is optional, so the script only exists
   when (a) a page feature is enabled and (b) the user has granted host access. */

import { getFlags } from "./store.js";

const SCRIPT_ID = "tablens-page";

export async function hasHostAccess() {
  try { return await chrome.permissions.contains({ origins: ["<all_urls>"] }); }
  catch { return false; }
}

export async function syncContentScripts() {
  const flags = await getFlags();
  const wantPage = flags.scroll || flags.notes;
  const granted = await hasHostAccess();

  // always clear first so toggling off truly stops injection on new navigations
  try { await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }); } catch {}

  if (wantPage && granted) {
    try {
      await chrome.scripting.registerContentScripts([{
        id: SCRIPT_ID,
        js: ["content/page.js"],
        matches: ["<all_urls>"],
        runAt: "document_idle",
        allFrames: false,
      }]);
    } catch (e) { console.warn("TabLens: content script register failed", e); }
  }
}
