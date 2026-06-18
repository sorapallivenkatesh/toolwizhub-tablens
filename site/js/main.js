/* main.js — splash dismissal + theme toggle for the TabLens landing page.
   Same conventions as the other ToolWizHub sites. */
(() => {
  // remember the splash was shown so reloads skip it this session
  try { sessionStorage.setItem("tablens:splashed", "1"); } catch (e) {}

  const root = document.documentElement;
  const btn = document.getElementById("theme");
  const setIcon = () => { if (btn) btn.textContent = root.dataset.theme === "light" ? "☀" : "☾"; };
  setIcon();
  btn?.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "" : "light";
    try { localStorage.setItem("tablens:theme", root.dataset.theme); } catch (e) {}
    setIcon();
  });

  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
