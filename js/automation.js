// Automation showcase (01 Engineer), with Motion from window.Motion.
// The paid platform's tangle of workflow steps sorts itself into one clean
// left-to-right graph as the page scrolls, and the LLM calls (accent dots)
// thin out from 10 to 6: the −40% counts along with them.
// On wide screens the panel pins while this plays; on phones it plays as the
// graph scrolls up the screen. Without Motion, or with reduced motion, the
// clean graph is drawn and nothing moves.
(() => {
  const panel = document.querySelector("[data-panel]");
  const svg = panel && panel.querySelector(".flow__svg");
  if (!svg) return;
  const article = panel.closest(".automation");
  const callsEl = panel.querySelector("[data-calls]");
  const pctEl = panel.querySelector("[data-calls-pct]");

  const NS = "http://www.w3.org/2000/svg";
  const W = 560;
  const H = 250;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- The workflow ---------- */

  // Twelve steps in five stages: trigger → … → output.
  const LAYERS = [[0], [1, 2, 3], [4, 5, 6, 7], [8, 9, 10], [11]];
  const EDGES = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6], [3, 7], [4, 8], [5, 8], [5, 9], [6, 9], [7, 10], [6, 10], [8, 11], [9, 11], [10, 11]];
  // Edges carrying an LLM call: ten in the tangle, six in the clean graph
  // (four of the old ones are dropped, the rest stay).
  const CALLS_BEFORE = [0, 2, 4, 6, 8, 10, 12, 14, 16, 17];
  const CALLS_AFTER = [2, 6, 10, 12, 16, 17];

  const clean = [];
  LAYERS.forEach((layer, li) =>
    layer.forEach((n, k) => {
      clean[n] = { x: 36 + li * ((W - 72) / (LAYERS.length - 1)), y: H / 2 + (k - (layer.length - 1) / 2) * 60 };
    })
  );
  // The tangle: fixed pseudo-random spots, the same on every visit.
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const messy = clean.map(() => ({ x: 36 + rnd() * (W - 72), y: 22 + rnd() * (H - 44) }));

  /* ---------- SVG ---------- */

  const make = (tag, cls) => {
    const el = document.createElementNS(NS, tag);
    el.setAttribute("class", cls);
    return el;
  };
  const edges = EDGES.map(() => svg.appendChild(make("path", "flow__edge")));
  const calls = EDGES.map(() => {
    const c = svg.appendChild(make("circle", "flow__call"));
    c.setAttribute("r", "4.5");
    return c;
  });
  const nodes = clean.map((_, i) => {
    const r = svg.appendChild(make("rect", i === 0 || i === 11 ? "flow__node flow__node--end" : "flow__node"));
    r.setAttribute("width", "28");
    r.setAttribute("height", "19");
    r.setAttribute("rx", "5.5");
    return r;
  });

  // t: 0 = tangle, 1 = clean graph.
  function draw(t) {
    const e = easeInOut(t);
    const pos = clean.map((c, i) => ({ x: lerp(messy[i].x, c.x, e), y: lerp(messy[i].y, c.y, e) }));
    EDGES.forEach(([a, b], i) => {
      const pa = pos[a];
      const pb = pos[b];
      // Curved and crossing while tangled, straight once clean.
      const bend = (1 - e) * (i % 2 ? 64 : -64);
      const mx = (pa.x + pb.x) / 2 + bend;
      const my = (pa.y + pb.y) / 2 - bend;
      edges[i].setAttribute("d", `M${pa.x.toFixed(1)},${pa.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`);
      edges[i].style.strokeOpacity = (0.2 + 0.25 * e).toFixed(3);
      // The call sits on the curve's midpoint.
      const before = CALLS_BEFORE.includes(i);
      const after = CALLS_AFTER.includes(i);
      const o = before && after ? 1 : before ? 1 - e : after ? e : 0;
      calls[i].setAttribute("cx", (0.25 * pa.x + 0.5 * mx + 0.25 * pb.x).toFixed(1));
      calls[i].setAttribute("cy", (0.25 * pa.y + 0.5 * my + 0.25 * pb.y).toFixed(1));
      calls[i].style.opacity = o.toFixed(3);
    });
    pos.forEach((p, i) => {
      nodes[i].setAttribute("x", (p.x - 14).toFixed(1));
      nodes[i].setAttribute("y", (p.y - 9.5).toFixed(1));
    });
    callsEl.textContent = String(Math.round(10 - 4 * e));
    const pct = Math.round(40 * e);
    pctEl.textContent = pct ? `−${pct}%` : "0%";
  }

  draw(1);
  const M = window.Motion;
  if (!M || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ---------- Scroll ---------- */

  // Pin only on wide screens where the whole panel fits.
  let pinned = false;
  let panelH = 0;
  let pinTop = 0;
  function layout() {
    const fits = window.innerWidth >= 900 && panel.offsetHeight < window.stableVH() - 120;
    pinned = fits;
    article.classList.toggle("is-pinned", fits);
    article.style.setProperty("--panel-h", `${panel.offsetHeight}px`);
    // Measured here, once, rather than on every scroll frame.
    panelH = panel.offsetHeight;
    pinTop = parseFloat(getComputedStyle(panel).top) || 0;
    window.forgetLayout();
  }

  function progress() {
    const vh = window.stableVH();
    if (pinned) {
      // From the moment the panel pins until the pin lets go.
      const travel = window.boxHeight(article) - panelH;
      // Finishes a little before the pin ends, so the clean graph holds.
      return clamp01((pinTop - window.viewTop(article)) / Math.max(1, travel) / 0.85);
    }
    // While the graph rises from low on the screen to above the middle.
    return clamp01((vh * 0.85 - window.viewTop(svg)) / (vh * 0.5));
  }

  layout();
  window.addEventListener("layoutresize", layout);
  window.track(() => draw(progress()));
})();
