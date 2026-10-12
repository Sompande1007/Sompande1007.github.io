(() => {
  const section = document.querySelector(".hero");
  const stage = section.querySelector(".hero__stage");
  const canvas = stage.querySelector(".hero__canvas");
  const echoRows = Array.from(stage.querySelectorAll(".hero__echo-row"));
  const wordsEl = stage.querySelector(".hero__words");
  const words = Array.from(wordsEl.querySelectorAll(".hero__word"));
  const intro = stage.querySelector(".hero__intro");
  const slot = intro.querySelector(".hero__slot");
  const reveals = Array.from(intro.querySelectorAll("[data-reveal]"));
  const echoEl = stage.querySelector(".hero__echo");
  const diveEl = stage.querySelector(".dive");
  const glass = stage.querySelector(".dive__glass");
  const pageLayer = stage.querySelector(".dive__page");
  const greet = stage.querySelector(".dive__greet");
  const ctx = canvas.getContext("2d");

  // Phones get the half-size set. Decided by screen size, not window size,
  // so a narrow desktop window still gets the sharp frames.
  const isPhone = Math.min(screen.width, screen.height) < 768;
  const DIR = isPhone ? "mobile" : "desktop";
  const src = (i) => `assets/hero/${DIR}/${String(i + 1).padStart(3, "0")}.webp`;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lens dive: after the hero sequence, extra scroll zooms into the left lens
  // of the sunglasses, and the glass becomes the doorway to About. The hero's
  // extra height comes from the .has-dive class (css/hero.css).
  const dive = !reduceMotion && !!diveEl;
  if (dive) document.documentElement.classList.add("has-dive");
  // Where the left lens sits in the final frame, as fractions of the figure box.
  const LENS = { x: 0.51, y: 0.41 };
  const DIVE_ZOOM = 16; // how far the camera pushes in

  // Anton's capitals are 0.86em tall; with this line-height the box hugs them.
  const CAP = 0.86;
  // Time constant (seconds) for the drawn state catching up with the scroll.
  // Lenis already smooths the scroll, so this only takes the edge off.
  const SMOOTHING = 0.04;

  // Scroll choreography, as fractions of the hero's scroll (0–1).
  // Each word gets ~22% of the scroll (about 1.2 screen-heights), with a short
  // hold on SOM PANDE after the morph and on FOUNDER before the hero releases.
  const MORPH = [0.03, 0.28]; // start layout -> end layout
  const REVEAL = { start: 0.15, stagger: 0.03, length: 0.1 }; // intro items fade in
  const WORD_AT = [0, 0.38, 0.6, 0.82]; // SOM PANDE, ENGINEER, BUILDER, FOUNDER
  // Background rows: starting offset and total drift over the scroll, as
  // fractions of the stage width. Alternating signs move rows in opposite ways.
  const ECHO = { start: [-0.14, -0.6, -0.04], drift: [-0.35, 0.3, -0.4] };

  let count = 0;
  let aspect = 1;
  let frames = [];
  let ready = null;

  let width = 0;
  let height = 0;
  let laidOut = false;
  // Start and end boxes for the figure, and start/end placement of the word.
  const fig0 = { x: 0, y: 0, w: 0, h: 0 };
  const fig1 = { x: 0, y: 0, w: 0, h: 0 };
  const word0 = { x: 0, y: 0, scale: 1 };
  const word1 = { x: 0, y: 0 };
  let tall = false;

  let target = 0; // scroll progress (0–1)
  let current = 0; // progress currently drawn
  let lastTime = 0;
  let running = false;
  let activeWord = -1;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Frames ---------- */

  function load(i) {
    const img = new Image();
    img.src = src(i);
    frames[i] = img;
    // decode() keeps scrubbing smooth; if a browser rejects it (Safari can,
    // under load), fall back to the plain load event.
    return img
      .decode()
      .catch(() =>
        img.complete && img.naturalWidth
          ? undefined
          : new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            })
      )
      .then(() => {
        ready[i] = 1;
      })
      .catch(() => {});
  }

  // Closest frame that has finished loading, so scrubbing never shows a blank.
  function nearestReady(i) {
    for (let d = 0; d < count; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < count && ready[i + d]) return i + d;
    }
    return -1;
  }

  /* ---------- Words ---------- */

  // Split each word into letters so they can roll in one after another.
  for (const w of words) {
    const text = w.textContent;
    w.textContent = "";
    for (let i = 0; i < text.length; i++) {
      const ch = document.createElement("span");
      ch.className = "hero__char";
      ch.style.setProperty("--i", i);
      ch.textContent = text[i] === " " ? " " : text[i];
      w.appendChild(ch);
    }
  }

  // Words before the active one wait above the line, words after wait below,
  // so scrolling down rolls letters upward and scrolling back reverses it.
  function setWord(n) {
    if (n === activeWord) return;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      w.classList.toggle("is-before", i < n);
      w.classList.toggle("is-after", i > n);
      // Only the outgoing and incoming words animate; the rest move instantly.
      w.classList.toggle("is-moving", i === n || i === activeWord);
    }
    activeWord = n;
  }

  function wordAt(p) {
    let n = 0;
    while (n < WORD_AT.length - 1 && p >= WORD_AT[n + 1]) n++;
    return n;
  }

  /* ---------- Layout ---------- */

  function layout() {
    measureShare();
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    tall = width < height || width < 760;
    stage.dataset.layout = tall ? "tall" : "wide";

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Word widths at 100px, to size the line for any word list.
    wordsEl.style.transform = "none";
    wordsEl.style.fontSize = "100px";
    let widest = 0;
    for (const w of words) widest = Math.max(widest, w.offsetWidth);
    const nameWidth = words[0].offsetWidth;

    // End layout: the intro column, with a slot the widest word just fills.
    const pad = Math.max(20, width * 0.055);
    const colWidth = tall ? width - pad * 2 : width * 0.5 - pad;
    const endSize = (100 * colWidth) / widest;
    wordsEl.style.fontSize = `${endSize}px`;
    stage.style.setProperty("--word-size", `${endSize}px`);
    intro.style.width = `${colWidth}px`;
    slot.style.height = `${endSize * CAP}px`;
    // Room kept clear at the top for the navbar island.
    const navBottom = 88;
    const introHeight = intro.offsetHeight;
    const introTop = tall
      ? navBottom + 4
      : navBottom + Math.max(0, (height - navBottom - introHeight) / 2);
    intro.style.top = `${introTop}px`;
    word1.x = intro.offsetLeft + slot.offsetLeft;
    word1.y = introTop + slot.offsetTop;

    // End figure: large on the right (wide), or below the text (tall).
    if (tall) {
      const room = height - (introTop + introHeight);
      fig1.h = Math.min(Math.max(room, height * 0.36), height * 0.5, (width * 1.3) / aspect);
      fig1.w = fig1.h * aspect;
      fig1.x = (width - fig1.w) / 2;
    } else {
      fig1.h = Math.min(height * 0.84, (width * 0.9) / aspect);
      fig1.w = fig1.h * aspect;
      fig1.x = width * 0.76 - fig1.w / 2;
    }
    fig1.y = height - fig1.h;


    // Start layout: figure centred, the name spanning the stage above the head
    // so every letter stays at least partly visible.
    fig0.h = Math.min(height * 0.62, (width * (tall ? 1.45 : 0.96)) / aspect);
    fig0.w = fig0.h * aspect;
    fig0.x = (width - fig0.w) / 2;
    fig0.y = height - fig0.h;
    const gutter = Math.max(16, width * 0.02);
    const startSize = (100 * (width - gutter * 2)) / widest;
    word0.scale = startSize / endSize;
    word0.x = (width - (nameWidth * startSize) / 100) / 2;
    word0.y = fig0.y - startSize * CAP * (tall ? 0.55 : 0.4);

    laidOut = true;
    render(current);
  }

  /* ---------- Render ---------- */

  // The hero's own sequence and the dive share one scroll track. `share` is
  // the part of the track that belongs to the hero sequence.
  let share = 1;
  function measureShare() {
    if (!dive) return (share = 1);
    const css = getComputedStyle(document.documentElement);
    const heroScroll = parseFloat(css.getPropertyValue("--hero-scroll")) || 560;
    const diveScroll = parseFloat(css.getPropertyValue("--dive-scroll")) || 0;
    share = (heroScroll - 100) / (heroScroll + diveScroll - 100);
    // Tell the navbar where the dive begins (it turns solid there).
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.heroSolidAt = top + share * (section.offsetHeight - window.stableVH());
  }

  function render(q) {
    if (!laidOut) return;
    const p = clamp01(q / share);
    renderDive(share < 1 ? clamp01((q - share) / (1 - share)) : 0);
    const m = easeInOut(clamp01((p - MORPH[0]) / (MORPH[1] - MORPH[0])));

    // Character.
    const i = count ? nearestReady(Math.round(p * (count - 1))) : -1;
    ctx.clearRect(0, 0, width, height);
    if (i >= 0) {
      ctx.drawImage(
        frames[i],
        lerp(fig0.x, fig1.x, m),
        lerp(fig0.y, fig1.y, m),
        lerp(fig0.w, fig1.w, m),
        lerp(fig0.h, fig1.h, m)
      );
    }

    // Giant word travels from across the stage into the intro slot.
    const s = lerp(word0.scale, 1, m);
    wordsEl.style.transform = `translate(${lerp(word0.x, word1.x, m)}px, ${lerp(word0.y, word1.y, m)}px) scale(${s})`;

    // Background rows drift sideways, alternating direction.
    for (let k = 0; k < echoRows.length; k++) {
      const x = width * (ECHO.start[k] + ECHO.drift[k] * p);
      echoRows[k].style.transform = `translate3d(${x}px, 0, 0)`;
    }

    // Intro items fade up one after another.
    for (let k = 0; k < reveals.length; k++) {
      const t = clamp01((p - REVEAL.start - k * REVEAL.stagger) / REVEAL.length);
      const el = reveals[k];
      el.style.opacity = t;
      el.style.transform = t < 1 ? `translateY(${(1 - t) * 24}px)` : "";
      el.style.pointerEvents = t > 0.9 ? "" : "none";
    }

    setWord(wordAt(p));
  }

  // d: 0 → 1 across the dive.
  function renderDive(d) {
    if (!dive) return;
    const fade = 1 - clamp01(d / 0.15);
    wordsEl.style.opacity = fade;
    intro.style.opacity = fade;
    echoEl.style.opacity = fade;

    // Nav steps aside from the moment the glass starts taking over.
    // "Diving" hides the navbar. Count the dive as finished just short of 1:
    // landing exactly on About (a nav link) can leave d at 0.9999…, which
    // would keep the navbar hidden and untappable.
    document.documentElement.classList.toggle("is-diving", d > 0.45 && d < 0.995);

    if (d <= 0) {
      canvas.style.transform = "";
      diveEl.style.visibility = "hidden";
      return;
    }
    diveEl.style.visibility = "visible";

    // Camera: accelerates toward the lens while easing it to the screen centre.
    const lx = fig1.x + fig1.w * LENS.x;
    const ly = fig1.y + fig1.h * LENS.y;
    const zoom = Math.pow(clamp01((d - 0.05) / 0.7), 2.4);
    const centre = easeInOut(clamp01((d - 0.05) / 0.45));
    canvas.style.transformOrigin = `${lx}px ${ly}px`;
    canvas.style.transform = `translate(${(width / 2 - lx) * centre}px, ${(height / 2 - ly) * centre}px) scale(${1 + (DIVE_ZOOM - 1) * zoom})`;

    // The dark glass takes over and the greeting appears on it; then the
    // page sweeps across the lens along the glare's angle.
    glass.style.opacity = clamp01((d - 0.5) / 0.18);
    const g = clamp01((d - 0.6) / 0.15);
    greet.style.opacity = g;
    greet.style.transform = `translateY(-50%) scale(${0.86 + 0.14 * easeInOut(g)})`;
    pageLayer.style.setProperty("--sweep", easeInOut(clamp01((d - 0.8) / 0.19)).toFixed(4));
  }

  /* ---------- Scroll ---------- */

  function progress() {
    if (reduceMotion) return 1;
    const span = window.boxHeight(section) - window.stableVH();
    if (span <= 0) return 0;
    return clamp01(-window.viewTop(section) / span);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    current += (target - current) * (1 - Math.exp(-dt / SMOOTHING));
    if (Math.abs(target - current) < 0.0001) current = target;
    render(current);
    if (current !== target) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  function onScroll() {
    target = progress();
    if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function smoothScroll() {
    if (reduceMotion || typeof window.Lenis !== "function") return;
    // anchors: nav links glide to their section instead of jumping.
    window.lenis = new window.Lenis({ autoRaf: true, lerp: 0.12, anchors: true });
  }

  /* ---------- Start ---------- */

  window.addEventListener("layoutresize", layout);

  // Frame count and aspect live on the canvas, so the page needs no fetch and
  // also works when index.html is opened straight from disk.
  count = Number(canvas.dataset.frames);
  aspect = Number(canvas.dataset.aspect);
  frames = new Array(count);
  ready = new Uint8Array(count);
  current = target = progress();

  // Lay out as soon as the fonts are in, before any frame arrives.
  document.fonts.ready.then(() => {
    layout();
    wordsEl.classList.add("is-ready");
  });

  if (reduceMotion) {
    // Skip the sequence: show the end layout with the final pose.
    load(count - 1).then(() => render(current));
  } else {
    window.addEventListener("scroll", onScroll, { passive: true });
    smoothScroll();

    // First frame right away, then the rest in order.
    load(0).then(() => {
      render(current);
      for (let i = 1; i < count; i++) {
        load(i).then(() => {
          // Repaint if this frame is one the current position needs.
          if (!running && Math.abs(i - clamp01(current / share) * (count - 1)) < 1.5) render(current);
        });
      }
    });
  }
})();
