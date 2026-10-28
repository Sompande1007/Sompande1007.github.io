// Experience: one timeline, told as "time flies, then stops".
// The stage pins. At the top is a time-dial, the visible rim of a large
// wheel with a tick per month. Scrolling spins it: between stops the year
// races and the ticks streak; approaching a stop it eases to a standstill and
// that stop's facts take the screen. The dial follows the scroll with a
// little inertia, so it glides. ← → (buttons or arrow keys) jump between stops.
// Scroll-linked, so it reverses and replays. Without Motion, or with reduced
// motion, the stops stay a plain list (css/experience.css).
(() => {
  const M = window.Motion;
  const section = document.querySelector("[data-exp]");
  if (!M || !section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const NS = "http://www.w3.org/2000/svg";

  const stage = section.querySelector(".exp__stage");
  const dialBox = section.querySelector(".exp__dial");
  const svg = section.querySelector(".exp__svg");
  const yearEl = section.querySelector(".exp__year");
  const stopEls = Array.from(section.querySelectorAll(".exp__stop"));
  const prevBtn = section.querySelector(".exp__prev");
  const nextBtn = section.querySelector(".exp__next");
  const dotsEl = section.querySelector(".exp__dots");

  const stops = stopEls.map((el) => ({
    el,
    y: Number(el.dataset.y),
    when: el.querySelector(".exp__when").textContent.trim(),
    short: el.dataset.short || el.querySelector(".exp__title").textContent.trim(),
  }));
  const N = stops.length;
  const Y0 = stops[0].y - 0.2; // first tick
  const Y1 = stops[N - 1].y + 0.1; // last tick

  // The section is exactly one screen: it holds still while the dial turns.
  section.style.setProperty("--exp-height", "100svh");

  /* ---------- Dots and buttons ---------- */

  const dots = stops.map(() => dotsEl.appendChild(document.createElement("i")));
  for (const btn of [prevBtn, nextBtn]) {
    const name = document.createElement("span");
    name.className = "exp__btn-name";
    if (btn === prevBtn) btn.appendChild(name);
    else btn.insertBefore(name, btn.firstChild);
  }
  const nameOf = (s) => (s.short === s.when ? s.when : `${s.when} · ${s.short}`);

  /* ---------- The dial ---------- */

  // The dial's arc is a warped time axis: each stretch between two stops
  // gets between 0.35 and 1 "year" of arc, however long it really was. So
  // 2019 → 2023 packs four years of ticks into one turn (time compressing),
  // the one month between PwC and the startup still gets room, and the
  // wheel never has to whip round.
  const SEG = stops.slice(1).map((s, k) => Math.max(0.35, Math.min(1, s.y - stops[k].y)));
  const ARC = [0];
  SEG.forEach((g) => ARC.push(ARC[ARC.length - 1] + g));
  function arcOf(y) {
    if (y <= stops[0].y) return y - stops[0].y;
    for (let k = 0; k < N - 1; k++) {
      if (y <= stops[k + 1].y) return ARC[k] + ((y - stops[k].y) / (stops[k + 1].y - stops[k].y)) * SEG[k];
    }
    return ARC[N - 1] + (y - stops[N - 1].y);
  }

  let W = 0;
  let cx = 0;
  let cy = 0;
  let R = 0;
  let peak = 0;
  let radPerYear = 0;
  let wheel; // the rotating group
  const near = []; // the two neighbour labels
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function build() {
    const box = dialBox.getBoundingClientRect();
    const H = stage.clientHeight;
    W = box.width;
    peak = H * (parseFloat(getComputedStyle(section).getPropertyValue("--dial-top")) / 100);
    R = W * 1.15;
    cx = W / 2;
    cy = peak + R;
    // About 40px per month on wide screens, tighter on phones.
    const pxPerMonth = Math.max(14, Math.min(44, W / 30));
    radPerYear = (pxPerMonth * 12) / R;

    svg.textContent = "";
    svg.setAttribute("viewBox", `0 0 ${W} ${box.height}`);
    el("circle", { class: "exp__rim", cx, cy, r: R }, svg);

    wheel = el("g", {}, svg);
    const deg = 180 / Math.PI;
    for (let m = Math.ceil(Y0 * 12); m <= Y1 * 12; m++) {
      const year = m % 12 === 0;
      const a = arcOf(m / 12) * radPerYear * deg;
      const g = el("g", { transform: `rotate(${a.toFixed(3)} ${cx} ${cy})` }, wheel);
      el("line", { class: year ? "exp__tick exp__tick--year" : "exp__tick", x1: cx, y1: peak, x2: cx, y2: peak + (year ? 16 : 7) }, g);
      if (year) {
        const t = el("text", { class: "exp__label", x: cx, y: peak + 34, "text-anchor": "middle" }, g);
        t.textContent = String(m / 12);
      }
    }

    near.length = 0;
    for (let i = 0; i < 2; i++) {
      const g = el("g", {}, svg);
      el("circle", { class: "exp__mark", cx, cy: peak, r: 5 }, g);
      const t = el("text", { class: "exp__near", x: cx, y: peak - 14, "text-anchor": "middle" }, g);
      near.push({ g, t });
    }
    el("circle", { class: "exp__peak", cx, cy: peak, r: 7 }, svg);
    render(lastPos);
  }

  /* ---------- Position → picture ---------- */

  // pos: where the dial is, in stops (0 = first, N-1 = Now); fractions while
  // it turns from one stop to the next.
  let lastPos = 0;
  let current = -1;
  function render(pos) {
    lastPos = pos;
    if (!wheel) return;
    const i = Math.min(N - 2, Math.floor(pos));
    const f = pos - i;
    const at = stops[i].y + (stops[i + 1].y - stops[i].y) * f;
    const nearest = Math.round(pos);
    const off = pos - nearest;

    // The wheel turns so that `at` sits at the peak.
    const turn = -arcOf(at) * radPerYear * (180 / Math.PI);
    wheel.setAttribute("transform", `rotate(${turn.toFixed(3)} ${cx} ${cy})`);

    // The year at the peak: the stop's own label when settled, racing between.
    const label = Math.abs(off) < 0.02 ? stops[nearest].when : String(Math.floor(at));
    if (yearEl.textContent !== label) yearEl.textContent = label;

    // Each stop's facts fade with distance, drifting the way the dial turns.
    for (let k = 0; k < N; k++) {
      const d = pos - k;
      const o = 1 - clamp01((Math.abs(d) - 0.08) / 0.3);
      const e = stops[k].el;
      e.style.opacity = o.toFixed(3);
      e.style.transform = `translate(-50%, ${(-d * 60).toFixed(1)}px)`;
      e.classList.toggle("is-current", o > 0.5);
    }

    // Neighbours on the curve, beside the nearest stop, fading mid-turn.
    const show = 1 - clamp01((Math.abs(off) - 0.05) / 0.2);
    [nearest - 1, nearest + 1].forEach((k, j) => {
      const n = near[j];
      if (!n) return;
      if (k < 0 || k >= N) {
        n.g.style.opacity = "0";
        return;
      }
      const side = j === 0 ? -1 : 1;
      // At its true spot on the dial, but never so far out that the label
      // (about 150px wide) leaves the screen.
      const maxA = Math.asin(Math.max(0.05, (W / 2 - 85) / R));
      const a = side * Math.min(Math.abs(ARC[k] - ARC[nearest]) * radPerYear, maxA) * (180 / Math.PI);
      n.g.setAttribute("transform", `rotate(${a.toFixed(3)} ${cx} ${cy})`);
      n.t.textContent = nameOf(stops[k]);
      n.g.style.opacity = show.toFixed(3);
    });

    if (nearest !== current) {
      current = nearest;
      dots.forEach((d, k) => {
        d.classList.toggle("is-on", k === current);
        d.classList.toggle("is-done", k < current);
      });
      const p = stops[current - 1];
      const n = stops[current + 1];
      prevBtn.disabled = !p;
      nextBtn.disabled = !n;
      prevBtn.querySelector(".exp__btn-name").textContent = p ? nameOf(p) : "";
      nextBtn.querySelector(".exp__btn-name").textContent = n ? nameOf(n) : "";
      prevBtn.setAttribute("aria-label", p ? `Previous: ${nameOf(p)}` : "Previous stop");
      nextBtn.setAttribute("aria-label", n ? `Next: ${nameOf(n)}` : "Next stop");
    }
  }

  /* ---------- One gesture, one stop ---------- */

  const DURATION = 0.9; // seconds per stop
  let index = 0; // the stop we're on (or heading to)
  let turning = null; // the running animation
  function goTo(k) {
    const to = Math.max(0, Math.min(N - 1, k));
    if (to === index && !turning) return;
    index = to;
    if (turning) turning.stop();
    turning = M.animate(lastPos, to, {
      duration: DURATION,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: render,
      onComplete: () => {
        turning = null;
        render(to);
      },
    });
  }

  /* ---------- Touch screens: scroll-stepped, never locked ---------- */

  // Locking the page fights a phone's momentum scrolling (the screen
  // shakes), so on touch screens the section gets a stretch of scroll per
  // stop instead: crossing into a stop's stretch turns the dial to it, with
  // the same fixed-length animation. The page itself is never moved.
  if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
    const PER_STOP = 70; // svh of scroll per stop
    section.style.setProperty("--exp-height", `${N * PER_STOP + 30}svh`);
    const stopAt = (p) => Math.max(0, Math.min(N - 1, Math.floor(p * N)));
    window.track((p) => {
      const k = stopAt(p);
      if (k !== index || (!turning && lastPos !== k)) goTo(k);
    }, { target: section, offset: ["start start", "end end"] });
    const scrollToStop = (k) => {
      const to = Math.max(0, Math.min(N - 1, k));
      const top = section.getBoundingClientRect().top + window.scrollY;
      const y = top + ((to + 0.5) / N) * (section.offsetHeight - window.stableVH());
      window.scrollTo({ top: y, behavior: "smooth" });
    };
    prevBtn.addEventListener("click", () => scrollToStop(current - 1));
    nextBtn.addEventListener("click", () => scrollToStop(current + 1));
    window.addEventListener("layoutresize", build);
    build();
    if (document.fonts) document.fonts.ready.then(build);
    return;
  }

  /* ---------- Locking the page while the dial is in charge ---------- */

  const lenis = () => window.lenis;
  const sectionTop = () => section.getBoundingClientRect().top + window.scrollY;
  let locked = false;
  let releasing = false;

  function lock(at) {
    locked = true;
    if (turning) turning.stop();
    turning = null;
    index = at;
    render(at);
    // Sit exactly on the section, then stop the page from scrolling.
    const y = sectionTop();
    if (lenis()) {
      lenis().scrollTo(y, { immediate: true, force: true });
      lenis().stop();
    } else {
      window.scrollTo(0, y);
    }
    // The scroll that brought us here mustn't also turn the dial: wait for a
    // pause or a clearly new push.
    armed = false;
    lastWheel = performance.now();
    lastMag = 400;
  }

  function release(dir) {
    locked = false;
    releasing = true;
    const y = dir > 0 ? sectionTop() + section.offsetHeight : sectionTop() - window.stableVH() * 0.6;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      releasing = false;
      prevTop = section.getBoundingClientRect().top;
    };
    // If the visitor keeps scrolling, the glide is interrupted and never
    // reports finishing, so don't wait for it forever.
    setTimeout(done, 1100);
    if (lenis()) {
      lenis().start();
      lenis().scrollTo(y, { duration: 1, onComplete: done });
    } else {
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function step(dir) {
    if (turning) return;
    if (dir < 0 && index === 0) return release(-1);
    if (dir > 0 && index === N - 1) {
      // Only let go if there's page below to go to.
      const room = document.documentElement.scrollHeight - (sectionTop() + section.offsetHeight);
      return room > 2 ? release(1) : undefined;
    }
    goTo(index + dir);
  }

  // Lock when the section's top reaches the top of the screen: coming down,
  // on the first stop; coming back up, on the last.
  let prevTop = section.getBoundingClientRect().top;
  // A jump to another section (a nav link, "Back to top") passes straight
  // through: don't catch it. Jumps to #experience itself still lock.
  let passingUntil = 0;
  let fromStart = false; // a nav click to #experience starts at the first stop
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    if (a.getAttribute("href") === "#experience") fromStart = true;
    else passingUntil = performance.now() + 2500;
  });
  function watch() {
    const top = window.viewTop(section);
    if (!locked && !releasing && performance.now() > passingUntil) {
      if (prevTop > 1 && top <= 1) lock(0);
      else if (prevTop < -1 && top >= -1) lock(fromStart ? 0 : N - 1);
      if (locked) fromStart = false;
    }
    prevTop = top;
  }
  if (lenis()) lenis().on("scroll", watch);
  window.addEventListener("scroll", watch, { passive: true });

  // Wheel and trackpad: one gesture moves one stop. A trackpad keeps sending
  // momentum events after a flick, so a new step needs either a pause in the
  // events or a fresh, stronger push.
  let armed = true;
  let lastWheel = 0;
  let lastMag = 0;
  window.addEventListener(
    "wheel",
    (e) => {
      if (!locked) return;
      e.preventDefault();
      const now = performance.now();
      const mag = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (now - lastWheel > 180 || Math.abs(mag) > lastMag * 1.6 + 8) armed = true;
      lastWheel = now;
      lastMag = Math.abs(mag);
      if (!armed || turning || Math.abs(mag) < 4) return;
      armed = false;
      step(mag > 0 ? 1 : -1);
    },
    { passive: false }
  );

  // Touch: a swipe moves one stop.
  let touchY = null;
  window.addEventListener("touchstart", (e) => { if (locked) touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (e) => { if (locked) e.preventDefault(); }, { passive: false });
  window.addEventListener("touchend", (e) => {
    if (!locked || touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 40) step(dy > 0 ? 1 : -1);
  });

  // Keys, while locked.
  document.addEventListener("keydown", (e) => {
    if (!locked || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const fwd = ["ArrowRight", "ArrowDown", "PageDown", " "];
    const back = ["ArrowLeft", "ArrowUp", "PageUp"];
    if (fwd.includes(e.key)) step(1);
    else if (back.includes(e.key)) step(-1);
    else return;
    e.preventDefault();
  });

  // The buttons: jump a stop (locking first if the page isn't locked yet).
  prevBtn.addEventListener("click", () => (locked ? step(-1) : (lock(current), goTo(current - 1))));
  nextBtn.addEventListener("click", () => (locked ? step(1) : (lock(current), goTo(current + 1))));

  window.addEventListener("layoutresize", build);
  build();
  if (document.fonts) document.fonts.ready.then(build);
})();
