# TabLens — your lens on every tab

A privacy-first MV3 browser extension that bundles five page/tab quality-of-life
features behind per-feature toggles. Everything runs **100% locally** — nothing is
uploaded.

| Feature | What it does | Needs page access? |
| --- | --- | --- |
| ⏱ Site usage timer | Active time spent per site, per day | No |
| 🔥 Streak dashboard | Consecutive days you've browsed | No |
| 📍 Scroll position memory | Returns you to where you left off | Yes |
| 🗒 Sticky notes | Draggable notes pinned to any page | Yes |
| 🔔 Page diff monitor | Alerts when a watched page's content changes | Yes |

The three page features share one optional `<all_urls>` grant that's only requested
when you enable one of them — so a default install asks for almost nothing.

## Layout

```
extension/   the MV3 extension (Chrome/Edge)
  background.js        service worker — wiring + message endpoint
  core/store.js        the single chrome.storage data layer
  core/inject.js       dynamic content-script (un)registration
  features/usage.js    site usage timer        (Tier 1)
  features/streak.js   streak aggregator       (Tier 1)
  features/diff.js     page diff monitor       (Tier 2)
  content/page.js      scroll memory + notes   (Tier 2)
  popup/               the dashboard
  options/             feature toggles + watched pages
site/        the landing page → tablens.toolwizhub.com
```

## Develop

```
npm run site    # serve the landing page on http://localhost:8091
npm run pack    # zip extension/ → tablens-extension.zip for the Web Store
```

Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** → pick `extension/`.

> Extension icons (`extension/icons/`) use the gold-wizard TabLens mark. Site art
> (`site/assets/`) is still placeholder — swap in branded WebP before publishing.

Part of [ToolWizHub](https://toolwizhub.com).
