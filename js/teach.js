// Teaching beat (end of 01 Engineer), with Motion from window.Motion.
// One spark beside the headline divides (1 → 2 → 4 … → 40), the sparks fly
// out to forty seats, each a curious "?", and a wave from the centre turns
// every seat into a builder while the curriculum runs. Scroll-linked, so it
// plays backwards too and replays on every pass.
// Without Motion, or with reduced motion, the seats are built in their final
// state (all builders) and nothing moves.
(() => {
  const section = document.querySelector("[data-teach]");
  if (!section) return;

  const field = section.querySelector(".teach__field");
  const seatsEl = section.querySelector(".teach__seats");
  const sparksEl = section.querySelector(".teach__sparks");
  const origin = section.querySelector(".teach__origin");
  const topic = section.querySelector(".teach__topic em");
  const now = section.querySelector(".teach__now");
  const stats = {
    minds: section.querySelector('[data-stat="minds"]'),
    programs: section.querySelector('[data-stat="programs"]'),
    path: section.querySelector('[data-stat="path"]'),
  };

  const COUNT = 40;
  const TOPICS = [
    "Python",
    "Machine learning",
    "Deep learning",
    "GenAI",
    "Prompt engineering",
    "Agentic AI",
    "Multi-agent systems",
    "Agentic products",
    "LLMOps",
    "Capstone + certification",
  ];

  const seats = [];
  for (let i = 0; i < COUNT; i++) {
    const seat = document.createElement("div");
    seat.className = "teach-seat";
    seat.innerHTML = "<span>?</span>";
    seatsEl.appendChild(seat);
    seats.push(seat);
  }

  const M = window.Motion;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!M || reduceMotion) return;

  section.classList.add("is-pinned");
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  const sparks = seats.map(() => {
    const s = document.createElement("span");
    s.className = "teach-spark";
    sparksEl.appendChild(s);
    return s;
  });

  /* ---------- Timeline (fractions of the pinned scroll) ---------- */

  // Division: generation g is born at BORN(g). Spark i belongs to generation
  // ceil(log2(i + 1)) and splits off from spark i - 2^(g-1), so the count
  // doubles each time: 1, 2, 4, 8, 16, 32, then the last 8 make 40.
  const BORN = (g) => 0.02 + g * 0.04;
  const SPLIT = 0.035; // how long a newborn takes to part from its parent
  const gen = (i) => (i === 0 ? 0 : Math.ceil(Math.log2(i + 1)));
  const parent = (i) => (i === 0 ? 0 : i - 2 ** (gen(i) - 1));
  // Flight to the seats, a little staggered.
  const FLY = (i) => 0.28 + (i / COUNT) * 0.07;
  const FLIGHT = 0.12;
  // The wave across the seats.
  const WAVE = [0.52, 0.94];

  /* ---------- Geometry ---------- */

  let home = []; // seat centres, relative to the field
  let start = { x: 0, y: 0 }; // where the spark is born
  let middle = { x: 0, y: 0 }; // where the cluster drifts to while dividing
  let dist = []; // each seat's distance from the grid centre, 0 → 1
  const CLUSTER = 11; // spacing of the sparks while they divide (px)

  function measure() {
    const f = field.getBoundingClientRect();
    home = seats.map((seat) => {
      const r = seat.getBoundingClientRect();
      return { x: r.left + r.width / 2 - f.left, y: r.top + r.height / 2 - f.top };
    });
    const o = origin.getBoundingClientRect();
    start = { x: o.left + o.width / 2 - f.left + 6, y: o.top + o.height * 0.55 - f.top };
    const cx = home.reduce((a, h) => a + h.x, 0) / COUNT;
    const cy = home.reduce((a, h) => a + h.y, 0) / COUNT;
    const d = home.map((h) => Math.hypot(h.x - cx, h.y - cy));
    const max = Math.max(...d);
    dist = d.map((v) => v / max);
    // Side by side: born after the headline's full stop, the cluster drifts
    // into the gap between the text and the seats. Stacked (phones): born
    // just above the seats and drifts onto them, clear of the text.
    const beside = Math.min(...home.map((h) => h.x)) > start.x;
    if (!beside) start = { x: cx, y: Math.min(...home.map((h) => h.y)) - 30 };
    middle = beside ? { x: lerp(start.x, cx, 0.5), y: lerp(start.y, cy, 0.5) } : { x: cx, y: cy };
    render(last);
  }

  // While dividing, the sparks sit on a sunflower spiral around the
  // cluster's centre, so it grows evenly as the count doubles. The centre
  // itself drifts away from the headline as the cluster grows.
  const DRIFT = [0.06, 0.26];
  const centreAt = (p) => {
    const t = easeInOut(clamp01((p - DRIFT[0]) / (DRIFT[1] - DRIFT[0])));
    return { x: lerp(start.x, middle.x, t), y: lerp(start.y, middle.y, t) };
  };
  const spiral = (i) => {
    const a = i * 2.39996;
    const r = CLUSTER * Math.sqrt(i);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  };
  // Spark i's offset from the centre: it rides with its parent until it is
  // born, then parts to its own spot.
  function offsetAt(i, p) {
    if (i === 0) return spiral(0);
    const from = offsetAt(parent(i), p);
    const to = spiral(i);
    const t = easeOut(clamp01((p - BORN(gen(i))) / SPLIT));
    return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
  }
  function clusterAt(i, p) {
    const c = centreAt(p);
    const o = offsetAt(i, p);
    return { x: c.x + o.x, y: c.y + o.y };
  }

  /* ---------- Render ---------- */

  let last = 0;
  function render(p) {
    last = p;
    if (!home.length) return;
    const w = clamp01((p - WAVE[0]) / (WAVE[1] - WAVE[0]));

    for (let i = 0; i < COUNT; i++) {
      const born = BORN(gen(i));
      const fly = clamp01((p - FLY(i)) / FLIGHT);
      const land = clamp01((p - (FLY(i) + FLIGHT - 0.03)) / 0.04);

      // Spark: visible from its birth until it lands in its seat.
      const c = clusterAt(i, p);
      const e = easeInOut(fly);
      const x = lerp(c.x, home[i].x, e);
      const y = lerp(c.y, home[i].y, e);
      const spark = sparks[i];
      spark.style.opacity = p >= born ? String(1 - land) : "0";
      spark.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

      // Seat: opens as its spark lands, then the wave fills it.
      const seat = seats[i];
      seat.style.opacity = String(land);
      seat.style.transform = `scale(${(0.4 + 0.6 * easeOut(land)).toFixed(3)})`;
      seat.style.setProperty("--f", clamp01((w * 1.15 - dist[i]) / 0.15).toFixed(3));
    }

    // Caption: follows the wave through the curriculum.
    const k = w >= 1 ? TOPICS.length - 1 : Math.min(TOPICS.length - 2, Math.floor(w * (TOPICS.length - 1)));
    if (topic.textContent !== TOPICS[k]) topic.textContent = TOPICS[k];
    now.hidden = k === TOPICS.length - 1;
    topic.parentElement.style.opacity = String(clamp01((p - 0.44) / 0.05));

    // Stats arrive as the story reaches them.
    stats.programs.classList.toggle("is-dim", p < BORN(1));
    stats.minds.classList.toggle("is-dim", p < 0.46);
    stats.path.classList.toggle("is-dim", w < 1);
  }

  window.track(render, { target: section, offset: ["start start", "end end"] });
  window.addEventListener("layoutresize", measure);
  measure();
  if (document.fonts) document.fonts.ready.then(measure);
})();
