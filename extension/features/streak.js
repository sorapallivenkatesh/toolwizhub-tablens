/* features/streak.js — Tier 1 aggregator. The streak is the count of consecutive
   days (ending today) on which the usage timer recorded any browsing. Today is
   given grace: if there's no data yet today, we count back from yesterday so the
   streak doesn't read 0 first thing in the morning. */

import { getUsage, dayKey } from "../core/store.js";

export async function getStreak() {
  const usage = await getUsage();
  const wasActive = (k) => usage[k] && Object.values(usage[k]).some((s) => s > 0);

  const d = new Date();
  if (!wasActive(dayKey(d))) d.setDate(d.getDate() - 1); // grace for an empty today

  let streak = 0;
  while (wasActive(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
