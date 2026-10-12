// Viewport helpers shared by every script, for steady layout on phones.
//  - stableVH(): the height of the small viewport (what CSS calls 100svh).
//    On phones window.innerHeight changes whenever the URL bar slides in or
//    out mid-scroll; anything that maps scroll to animation with it jumps.
//    Using the same height the CSS uses for the pinned sections keeps the
//    two in step.
//  - "layoutresize": fired like "resize", except on touch screens a change
//    of height alone (the URL bar) is ignored: nothing needs re-measuring,
//    and re-measuring mid-scroll is what made things twitch.
(() => {
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  let probe = null;
  let cached = 0;

  function measure() {
    if (!probe) {
      probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
    }
    cached = probe.offsetHeight || window.innerHeight;
    return cached;
  }

  window.stableVH = () => cached || measure();

  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  let queued = false;
  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const widthChanged = w !== lastW;
    // On touch screens only a width change (rotation) or a height change
    // bigger than the URL bar (~150px) counts.
    const meaningful = widthChanged || !coarse || Math.abs(h - lastH) > 150;
    if (!meaningful) return;
    lastW = w;
    lastH = h;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (probe) measure();
      window.dispatchEvent(new Event("layoutresize"));
    });
  });
})();
