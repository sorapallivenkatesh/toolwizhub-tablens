/* core/site.js — where the public TabLens site lives, dev vs prod. Same trick as
   NetLens: an unpacked build has no `update_url` in its manifest, so we point at
   the local dev server (npm run site → :8091); a published build points at prod.
   Used to set the "About TabLens" links at runtime (static HTML can't decide). */

export function siteUrl(path = "") {
  const dev = !("update_url" in chrome.runtime.getManifest());
  const base = dev ? "http://localhost:8091" : "https://tablens.toolwizhub.com";
  return base + path;
}
