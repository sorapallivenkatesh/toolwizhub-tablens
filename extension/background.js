/* background.js — MV3 service worker. Wires the feature modules together and is
   the single message endpoint for the popup/options. Feature state lives in
   chrome.storage (via core/store.js) so it survives the worker being torn down. */

import { initUsage, onAlarm as usageAlarm } from "./features/usage.js";
import { initDiff, onAlarm as diffAlarm, checkWatches } from "./features/diff.js";
import { getStreak } from "./features/streak.js";
import { getUsage, getFlags, dayKey } from "./core/store.js";
import { syncContentScripts } from "./core/inject.js";

initUsage();
initDiff();

chrome.alarms.onAlarm.addListener((a) => { usageAlarm(a.name); diffAlarm(a.name); });

chrome.runtime.onInstalled.addListener(() => { syncContentScripts(); });
chrome.runtime.onStartup.addListener(() => { syncContentScripts(); });

// keep injection in sync if the user revokes the host grant from chrome://settings
chrome.permissions.onRemoved.addListener(() => { syncContentScripts(); });
chrome.permissions.onAdded.addListener(() => { syncContentScripts(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "tablens:dashboard") {
    (async () => {
      sendResponse({
        usage: await getUsage(),
        streak: await getStreak(),
        today: dayKey(),
        flags: await getFlags(),
      });
    })();
    return true; // async
  }
  if (msg?.type === "tablens:syncContent") {
    syncContentScripts().then(() => sendResponse(true));
    return true;
  }
  if (msg?.type === "tablens:checkNow") {
    checkWatches().then(() => sendResponse(true));
    return true;
  }
  if (msg?.type === "tablens:clearBadge") {
    chrome.action.setBadgeText({ text: "" }).catch(() => {});
    return false;
  }
});
