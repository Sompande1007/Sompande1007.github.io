// Viewport helpers shared by every script, for steady layout on phones.
//  - stableVH(): the height of the small viewport (what CSS calls 100svh).
//    On phones window.innerHeight changes whenever the URL bar slides in or
//    out mid-scroll; anything that maps scroll to animation with it jumps.
//    Using the same height the CSS uses for the pinned sections keeps the
//    two in step.
//  - viewTop(el) / boxHeight(el): where an element is on screen, without
//    asking the browser for layout. Positions on the page are measured once
//    and re-measured only when the page changes size; per frame it's just
//    "page position minus scroll". Reading layout on every scroll frame
//    (getBoundingClientRect) forced the whole page to re-layout each frame,
//    and on phones that main-thread work made pinned scenes jitter.
//    Only for elements that move with the page (not sticky ones).
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

  // Page positions, measured lazily and dropped whenever the layout changes.
  let boxes = new WeakMap();
  const forget = () => {
    boxes = new WeakMap();
  };
  // Position on the page from the offset chain: unaffected by transforms
  // (a card mid-animation doesn't throw it off).
  function box(el) {
    let b = boxes.get(el);
    if (!b) {
      // SVG elements have no offset chain: measure their nearest HTML box.
      let html = el;
      while (html && !(html instanceof HTMLElement)) html = html.parentElement;
      let top = 0;
      for (let e = html; e; e = e.offsetParent) top += e.offsetTop;
      b = { top, height: html ? html.offsetHeight : 0 };
      boxes.set(el, b);
    }
    return b;
  }
  window.viewTop = (el) => box(el).top - window.scrollY;
  window.boxHeight = (el) => box(el).height;
  window.forgetLayout = forget;
  window.addEventListener("layoutresize", forget);
  window.addEventListener("load", forget);
  if (document.fonts) document.fonts.ready.then(forget);
  // The page grows or shrinks (images, sections pinning): positions moved.
  let pageH = 0; // the page's total height, kept current without per-frame reads
  window.pageHeight = () => pageH || (pageH = document.documentElement.scrollHeight);
  const watchPage = () => {
    new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (h !== pageH) {
        pageH = h;
        forget();
      }
    }).observe(document.body);
  };
  if (document.body) watchPage();
  else document.addEventListener("DOMContentLoaded", watchPage);

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

  /* ---------- track(): scroll-linked progress without layout reads ----------

     A stand-in for Motion's scroll(subject, { target, offset }). Motion
     re-measures every target's position on every scroll frame, which forces
     the whole (long) page to re-layout each frame; on phones that is what
     made pinned scenes jitter. This does the same job from cached page
     positions: one scroll listener, one pass per frame, no layout reads.

     subject: a function (progress, info) or a Motion animation (scrubbed).
     offset:  ["<target edge> <screen edge>", ...] like Motion, where an edge
              is start | center | end | a fraction (0.45).
     With no target, progress is the whole page's. */
  const EDGE = { start: 0, center: 0.5, end: 1 };
  const edge = (v) => (v in EDGE ? EDGE[v] : parseFloat(v));
  const parse = (o) => {
    const [a, b] = o.trim().split(/\s+/);
    return [edge(a), edge(b === undefined ? a : b)];
  };
  const trackers = [];
  let lastY = window.scrollY;
  let lastT = performance.now();
  let velocity = 0;

  function progressOf(t) {
    const vh = window.stableVH();
    const y = window.scrollY;
    if (!t.target) {
      const max = window.pageHeight() - vh;
      return max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    }
    const b = box(t.target);
    const y0 = b.top + t.from[0] * b.height - t.from[1] * vh;
    const y1 = b.top + t.to[0] * b.height - t.to[1] * vh;
    if (y1 === y0) return y >= y1 ? 1 : 0;
    return Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  }

  function apply(t, force) {
    const p = progressOf(t);
    if (!force && p === t.p && !t.wantsVelocity) return;
    t.p = p;
    if (typeof t.subject === "function") {
      t.subject(p, { y: { progress: p, velocity, current: window.scrollY } });
    } else {
      // A Motion animation: scrub it to the matching moment.
      const a = t.subject;
      const d = a.duration || 1;
      a.time = p * d;
    }
  }

  let frameQueued = false;
  function frame() {
    frameQueued = false;
    const now = performance.now();
    const y = window.scrollY;
    const dt = (now - lastT) / 1000;
    if (dt > 0) velocity = (y - lastY) / dt;
    lastY = y;
    lastT = now;
    for (let i = 0; i < trackers.length; i++) apply(trackers[i], false);
  }
  const onScroll = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(frame);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  // Positions changed: recompute everything once.
  const refresh = () => {
    for (let i = 0; i < trackers.length; i++) apply(trackers[i], true);
  };
  window.addEventListener("layoutresize", () => requestAnimationFrame(refresh));
  window.addEventListener("load", () => requestAnimationFrame(refresh));

  window.track = (subject, opts = {}) => {
    const offset = opts.offset || ["start end", "end start"];
    if (subject && typeof subject !== "function" && subject.pause) subject.pause();
    const t = {
      subject,
      target: opts.target || null,
      from: parse(offset[0]),
      to: parse(offset[1]),
      p: -1,
      wantsVelocity: typeof subject === "function" && subject.length > 1,
    };
    trackers.push(t);
    apply(t, true);
    return () => {
      const i = trackers.indexOf(t);
      if (i >= 0) trackers.splice(i, 1);
    };
  };
})();
