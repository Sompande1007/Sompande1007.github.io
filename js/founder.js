// 03 Founder, with Motion from window.Motion. (Its opener, FOUNDER filling
// up, is the end of Builder's hand-off in js/builder.js; HRX's motion lives
// in js/chapters.js.)
//  - What NuumX is: a cloud of AI buzzwords blurs, lifts and evaporates while
//    the one real sentence comes into focus.
//  - AI Employees: one founder grows into an organisation: branches draw, an
//    AI C-suite blooms, then their teams fill in. Beside it, the live page
//    scrolls itself in its browser frame.
// Everything is scroll-linked, so it plays backwards too and replays on every
// pass. Without Motion, or with reduced motion, it all rests in its final
// state (no buzzwords, a full org chart).
(() => {
  const M = window.Motion;
  const chapter = document.querySelector("#founder");
  if (!M || !chapter || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  // A soft spring-like settle (slight overshoot) for nodes blooming in.
  const bloom = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

  /* ---------- What NuumX is: the hype evaporates ---------- */

  const nuumx = chapter.querySelector("[data-nuumx]");
  const words = Array.from(nuumx.querySelectorAll(".nuumx__hype span"));
  const rot = words.map((w) => w.style.getPropertyValue("--r").trim());
  const main = nuumx.querySelector(".nuumx__main");
  // Each word drifts away from the centre as it evaporates (up if it sits
  // above the sentence, down if below), so none crosses the sentence.
  let away = words.map(() => -1);
  function measureHype() {
    const stage = nuumx.querySelector(".nuumx__stage").getBoundingClientRect();
    const mid = stage.top + stage.height / 2;
    away = words.map((w) => {
      const r = w.getBoundingClientRect();
      return r.top + r.height / 2 < mid ? -1 : 1;
    });
  }
  measureHype();
  window.addEventListener("resize", measureHype);

  M.scroll(
    (p) => {
      for (let i = 0; i < words.length; i++) {
        // The hype arrives with the stage, then each word drifts off in turn.
        const arrive = clamp01(p / 0.1);
        const gone = easeInOut(clamp01((p - 0.18 - i * 0.035) / 0.3));
        const w = words[i];
        w.style.opacity = (arrive * (1 - gone) * 0.85).toFixed(3);
        w.style.filter = `blur(${(1.2 + gone * 12).toFixed(1)}px)`;
        w.style.transform = `translate(-50%, calc(-50% + ${(away[i] * gone * 70).toFixed(1)}px)) rotate(${rot[i]}) scale(${(1 + gone * 0.15).toFixed(3)})`;
      }
      // The sentence starts soft behind the hype and comes into focus.
      const focus = easeOut(clamp01((p - 0.25) / 0.45));
      main.style.opacity = (0.2 + 0.8 * focus).toFixed(3);
      main.style.filter = focus >= 1 ? "" : `blur(${((1 - focus) * 7).toFixed(1)}px)`;
    },
    { target: nuumx, offset: ["start start", "end end"] }
  );

  /* ---------- AI Employees: one becomes an organisation ---------- */

  const aie = chapter.querySelector("[data-aie]");
  const stage = aie.querySelector(".aie__stage");
  const branches = Array.from(aie.querySelectorAll(".org__branch"));
  const stems = Array.from(aie.querySelectorAll(".org__stem"));
  const cxs = Array.from(aie.querySelectorAll(".org__cx"));
  const teams = Array.from(aie.querySelectorAll(".org__team")).map((t) => Array.from(t.querySelectorAll("i")));
  const teamLabels = Array.from(aie.querySelectorAll(".org__team small"));
  const to = aie.querySelector(".org__to");
  const now = aie.querySelector(".org__now");
  const view = aie.querySelector(".aie__view");
  const page = aie.querySelector(".aie__page");

  function grow(t) {
    for (let i = 0; i < cxs.length; i++) {
      // 1. The branch draws; 2. the AI leader blooms at its end.
      const c = clamp01((t - 0.22 - i * 0.06) / 0.2);
      branches[i].style.strokeDashoffset = (1 - easeInOut(c)).toFixed(3);
      const b = bloom(clamp01((c - 0.55) / 0.45));
      cxs[i].style.opacity = clamp01(b * 1.5).toFixed(3);
      cxs[i].style.transform = `translate(-50%, -50%) scale(${(0.4 + 0.6 * b).toFixed(3)})`;
      // 3. A stem drops and the team fills in, block by block.
      const tm = clamp01((t - 0.58 - i * 0.06) / 0.2);
      stems[i].style.strokeDashoffset = (1 - easeOut(clamp01(tm * 2))).toFixed(3);
      const cells = teams[i];
      for (let k = 0; k < cells.length; k++) {
        const v = clamp01(tm * 7 - 1 - k * 0.9);
        cells[k].style.opacity = v.toFixed(3);
        cells[k].style.transform = `scale(${(0.5 + 0.5 * easeOut(v)).toFixed(3)})`;
      }
      teamLabels[i].style.opacity = clamp01(tm * 2 - 1).toFixed(3);
    }
    // The count: 1 person → a C-suite → 1 organisation.
    to.style.opacity = t > 0.3 ? "1" : "0";
    const label = t >= 0.92 ? "1 organisation" : "a C-suite";
    if (now.textContent !== label) now.textContent = label;
  }

  // The live page scrolls itself inside the browser frame.
  function scrollPage(t) {
    const travel = page.offsetHeight - view.clientHeight;
    page.style.transform = `translateY(${(-Math.max(0, travel) * easeInOut(t)).toFixed(1)}px)`;
  }

  // Pin only where the whole stage fits on screen.
  let pinned = false;
  function layout() {
    aie.classList.remove("is-pinned");
    pinned = window.innerWidth >= 900 && stage.scrollHeight < window.innerHeight - 20;
    aie.classList.toggle("is-pinned", pinned);
  }
  layout();
  window.addEventListener("resize", layout);

  M.scroll(() => {
    const vh = window.innerHeight;
    let t;
    if (pinned) {
      const r = aie.getBoundingClientRect();
      t = clamp01(-r.top / Math.max(1, r.height - vh) / 0.85);
      grow(t);
      scrollPage(t);
    } else {
      // Stacked (phones): the chart grows as it rises; the page scrolls as
      // its frame passes through the screen.
      const o = aie.querySelector(".org").getBoundingClientRect();
      grow(clamp01((vh * 0.9 - o.top) / (vh * 0.6)));
      const b = view.getBoundingClientRect();
      scrollPage(clamp01((vh - b.top) / (vh + b.height)));
    }
  });
})();
