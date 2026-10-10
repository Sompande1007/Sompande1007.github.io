// Light (Paper & Ember) / dark (Midnight & Lime) theme.
// Loaded in <head> so the right theme is set before the first paint.
(() => {
  const root = document.documentElement;
  const KEY = "theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0f1012" : "#f7f5f0";
    const next = theme === "dark" ? "light" : "dark";
    for (const button of document.querySelectorAll(".theme-toggle")) {
      button.setAttribute("aria-label", `Switch to ${next} theme`);
    }
  }

  // A saved choice wins; otherwise follow the system and keep following it.
  apply(stored() || (system.matches ? "dark" : "light"));
  system.addEventListener("change", (e) => {
    if (!stored()) apply(e.matches ? "dark" : "light");
  });

  document.addEventListener("DOMContentLoaded", () => {
    apply(root.dataset.theme);
    for (const button of document.querySelectorAll(".theme-toggle")) {
      button.addEventListener("click", () => {
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(KEY, next);
        } catch {}
        apply(next);
      });
    }
  });
})();
