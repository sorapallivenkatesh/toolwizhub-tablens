/* features/streak.js — Tier 1 aggregator over the usage timer's days.
   A "streak" is consecutive days (ending today) with any recorded browsing.
   Today is given grace: if there's no data yet today, we count back from
   yesterday so the streak doesn't read 0 first thing in the morning. */

import { getUsage, dayKey } from "../core/store.js";

// set of "YYYY-MM-DD" keys that had any active time
function activeDays(usage) {
  const s = new Set();
  for (const k in usage) if (Object.values(usage[k]).some((v) => v > 0)) s.add(k);
  return s;
}

// is `b` ("YYYY-MM-DD") exactly the day after `a`?
function isNextDay(a, b) {
  const d = new Date(a + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return dayKey(d) === b;
}

function streaks(days) {
  // current streak — consecutive days ending today (grace for an empty today)
  let d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(d))) { current++; d.setDate(d.getDate() - 1); }

  // longest streak anywhere in history
  let longest = 0, run = 0, prev = null;
  for (const k of [...days].sort()) {
    run = prev && isNextDay(prev, k) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = k;
  }

  return { current, longest, activeDays: days.size };
}

export async function getStreak() {
  return streaks(activeDays(await getUsage())).current;
}

// full summary for the stats dashboard
export async function getStreakStats() {
  return streaks(activeDays(await getUsage()));
}
