/* content/page.js — Tier 2. Injected only when a page feature is enabled AND the
   user has granted <all_urls> (registered dynamically from core/inject.js). Reads
   the feature flags once at start and activates only what's on. Self-contained —
   no imports, since content scripts can't load ES modules here. */

(() => {
  const NS = "tablens";
  const KEY = location.origin + location.pathname; // stable per page, ignores ?query#hash

  const get = (k) => new Promise((r) => chrome.storage.local.get(k, (s) => r(s[k] || {})));
  const set = (k, v) => { if (chrome.runtime?.id) chrome.storage.local.set({ [k]: v }); };
  const alive = () => !!chrome.runtime?.id; // false after the extension reloads

  // ---- scroll position memory -------------------------------------------------
  async function initScroll() {
    const all = await get(`${NS}:scroll`);
    const saved = all[KEY];
    if (saved && saved.y) {
      const restore = () => window.scrollTo(0, saved.y);
      if (document.readyState === "complete") restore();
      else window.addEventListener("load", () => setTimeout(restore, 120), { once: true });
    }
    let t;
    window.addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (!alive()) return;
        const cur = await get(`${NS}:scroll`);
        if (window.scrollY < 4) delete cur[KEY];
        else cur[KEY] = { y: Math.round(window.scrollY), ts: Date.now() };
        set(`${NS}:scroll`, cur);
      }, 400);
    }, { passive: true });
  }

  // ---- sticky notes -----------------------------------------------------------
  async function initNotes() {
    const all = await get(`${NS}:notes`);
    let notes = all[KEY] || [];
    const save = async () => { if (!alive()) return; const cur = await get(`${NS}:notes`); cur[KEY] = notes; set(`${NS}:notes`, cur); };

    // paper colours — { face top, face bottom (for the folded-corner shading), tape }
    const PALETTE = [
      { a: "#fff7b0", b: "#ffe45e", tape: "rgba(255,255,255,.5)" }, // yellow
      { a: "#ffd1e3", b: "#ffa6c9", tape: "rgba(255,255,255,.5)" }, // pink
      { a: "#d4f8d4", b: "#a8e6a3", tape: "rgba(255,255,255,.5)" }, // green
      { a: "#cfe9ff", b: "#a6d4ff", tape: "rgba(255,255,255,.5)" }, // blue
      { a: "#ffe1c2", b: "#ffc187", tape: "rgba(255,255,255,.5)" }, // orange
    ];
    const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Comic Sans", cursive, system-ui, sans-serif';
    const lift = "0 2px 3px rgba(0,0,0,.14), 0 18px 34px rgba(0,0,0,.26)";
    const rest = "0 1px 1px rgba(0,0,0,.12), 0 12px 22px rgba(0,0,0,.20)";

    // floating add button
    const launcher = document.createElement("button");
    launcher.textContent = "+";
    launcher.title = "TabLens — add a sticky note to this page";
    Object.assign(launcher.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: 2147483647,
      width: "48px", height: "48px", borderRadius: "16px", border: "none", cursor: "pointer",
      background: "linear-gradient(135deg,#6366f1,#22d3ee)", color: "#fff",
      fontSize: "27px", fontWeight: "300", lineHeight: "46px",
      boxShadow: "0 6px 18px rgba(99,102,241,.45)", transition: "transform .15s ease",
    });
    launcher.addEventListener("mouseenter", () => { launcher.style.transform = "translateY(-2px) scale(1.06)"; });
    launcher.addEventListener("mouseleave", () => { launcher.style.transform = ""; });
    document.documentElement.appendChild(launcher);

    function render(n) {
      let color = PALETTE[(n.color || 0) % PALETTE.length];
      const rot = n.rot || 0;

      const card = document.createElement("div");
      Object.assign(card.style, {
        position: "fixed", left: n.x + "px", top: n.y + "px", zIndex: 2147483646,
        width: "228px", minHeight: "186px", borderRadius: "2px",
        background: `linear-gradient(160deg, ${color.a}, ${color.b})`,
        color: "#2a2a28", boxShadow: rest,
        transform: `rotate(${rot}deg)`, transformOrigin: "center",
        transition: "transform .18s ease, box-shadow .18s ease",
        display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: HAND,
      });
      // folded bottom-right corner for a paper feel
      const fold = document.createElement("div");
      Object.assign(fold.style, {
        position: "absolute", right: "0", bottom: "0", width: "0", height: "0",
        borderStyle: "solid", borderWidth: "0 0 20px 20px",
        borderColor: `transparent transparent rgba(0,0,0,.10) transparent`,
      });
      // tape strip across the top
      const tape = document.createElement("div");
      Object.assign(tape.style, {
        position: "absolute", top: "-9px", left: "50%", width: "82px", height: "22px",
        transform: "translateX(-50%) rotate(-3deg)", background: color.tape,
        boxShadow: "0 1px 2px rgba(0,0,0,.10)", borderRadius: "1px",
      });

      // drag handle (transparent top strip) + hover controls
      const head = document.createElement("div");
      Object.assign(head.style, { height: "28px", flex: "none", cursor: "move" });
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        position: "absolute", top: "6px", right: "8px", display: "flex", gap: "3px",
        opacity: "0", transition: "opacity .15s ease",
      });
      const mkBtn = (txt, title) => {
        const b = document.createElement("button");
        b.textContent = txt; b.title = title;
        Object.assign(b.style, {
          width: "21px", height: "21px", border: "none", borderRadius: "6px",
          background: "rgba(0,0,0,.07)", color: "#333", cursor: "pointer",
          font: "12px/21px system-ui, sans-serif", padding: "0",
        });
        b.addEventListener("mouseenter", () => { b.style.background = "rgba(0,0,0,.16)"; });
        b.addEventListener("mouseleave", () => { b.style.background = "rgba(0,0,0,.07)"; });
        return b;
      };
      const paint = mkBtn("◑", "Change colour");
      const collapse = mkBtn("–", "Collapse / expand");
      const del = mkBtn("×", "Delete note");
      controls.append(paint, collapse, del);

      const ta = document.createElement("textarea");
      ta.value = n.text || "";
      ta.placeholder = "Write a note…";
      Object.assign(ta.style, {
        flex: "1", border: "none", background: "transparent", resize: "none",
        padding: "0 16px 16px", outline: "none", color: "inherit",
        fontFamily: HAND, fontSize: "16px", lineHeight: "1.55",
      });

      card.append(fold, tape, head, controls, ta);
      document.documentElement.appendChild(card);

      card.addEventListener("mouseenter", () => {
        card.style.transform = `rotate(${rot}deg) translateY(-3px) scale(1.015)`;
        card.style.boxShadow = lift; controls.style.opacity = "1";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = `rotate(${rot}deg)`;
        card.style.boxShadow = rest; controls.style.opacity = "0";
      });

      ta.addEventListener("input", () => { n.text = ta.value; save(); });

      paint.addEventListener("click", () => {
        n.color = ((n.color || 0) + 1) % PALETTE.length;
        color = PALETTE[n.color];
        card.style.background = `linear-gradient(160deg, ${color.a}, ${color.b})`;
        tape.style.background = color.tape;
        save();
      });

      collapse.addEventListener("click", () => {
        const hidden = ta.style.display === "none";
        ta.style.display = hidden ? "" : "none";
        fold.style.display = hidden ? "" : "none";
        card.style.minHeight = hidden ? "186px" : "0";
        collapse.textContent = hidden ? "–" : "+";
      });

      // ✕ now confirms before discarding a note that has text — no more silent loss
      del.addEventListener("click", () => {
        if (n.text && n.text.trim() && !confirm("Delete this note?")) return;
        notes = notes.filter((x) => x.id !== n.id); card.remove(); save();
      });

      // drag by the top strip
      let dx = 0, dy = 0, dragging = false;
      head.addEventListener("mousedown", (e) => { dragging = true; dx = e.clientX - n.x; dy = e.clientY - n.y; card.style.transition = "none"; e.preventDefault(); });
      window.addEventListener("mousemove", (e) => { if (!dragging) return; n.x = e.clientX - dx; n.y = e.clientY - dy; card.style.left = n.x + "px"; card.style.top = n.y + "px"; });
      window.addEventListener("mouseup", () => { if (dragging) { dragging = false; card.style.transition = "transform .18s ease, box-shadow .18s ease"; save(); } });

      return card;
    }

    notes.forEach(render);

    launcher.addEventListener("click", () => {
      const k = notes.length;
      const n = {
        id: Date.now().toString(36),
        x: 96 + (k % 6) * 30, y: 100 + (k % 6) * 26,
        text: "", color: k % PALETTE.length, rot: [-4, 3, -2, 4, -3, 2][k % 6],
      };
      notes.push(n);
      const card = render(n);
      save();
      card.querySelector("textarea").focus();
    });
  }

  chrome.storage.local.get(`${NS}:flags`, (s) => {
    const flags = s[`${NS}:flags`] || {};
    if (flags.scroll) initScroll();
    if (flags.notes) initNotes();
  });
})();
