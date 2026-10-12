// About section motion (Motion, from window.Motion).
// Only runs with the lens dive (html.has-dive, set by js/hero.js). Without it
// the section is a plain stacked intro and nothing here is needed.
// Everything here is scroll-linked: it plays forwards and backwards with the
// scrollbar.
//  - Hand-over: the pinned stage becomes visible the moment the dive finishes,
//    with the greeting in exactly the spot the dive left it.
//  - Beats: one line at a time. Each line zooms through — the outgoing one
//    grows and fades past you, the next grows in from smaller.
//  - Avatar: the video is cut into one clip per line, each ending on a resting
//    pose. When the line changes, the next clip plays on its own (not with the
//    scroll), easing out of one pose and into the next.
//  - Finale: ENGINEER / BUILDER / FOUNDER fall and stack like blocks.
(() => {
  const M = window.Motion;
  const section = document.querySelector("#about");
  if (!M || !section || !document.documentElement.classList.contains("has-dive")) return;

  const { scroll } = M;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIn = (t) => t * t * t;

  const beats = Array.from(section.querySelectorAll(".about__beat"));
  const cue = section.querySelector(".about__cue");
  const N = beats.length;
  const T = 0.55 / N; // share of the scroll each line change takes
  const change = (p, k) => easeInOut(clamp01((p - (k / N - T)) / T)); // line k-1 → k

  /* ---------- Hand-over from the lens dive ---------- */

  let live = false;
  scroll(() => {
    // Live once the section's top reaches the top of the screen: that is the
    // exact frame the dive ends on.
    const now = section.getBoundingClientRect().top <= 0.5;
    if (now === live) return;
    live = now;
    section.classList.toggle("is-live", live);
    // Leaving upwards resets the avatar, so the wave plays again next time.
    if (!live) resetClips();
  });

  /* ---------- Avatar: scroll-scrubbed performance ---------- */

  const canvas = section.querySelector(".about__canvas");
  const ctx = canvas.getContext("2d");
  const isPhone = Math.min(screen.width, screen.height) < 768;
  const DIR = isPhone ? "mobile" : "desktop";
  const count = Number(canvas.dataset.frames);
  const aspect = Number(canvas.dataset.aspect);
  // The resting pose each line's clip ends on (wave, tablet, tap, present,
  // think, idea, arms crossed).
  const restFrames = canvas.dataset.restFrames.split(",").map(Number);
  const frames = new Array(count);
  const ready = new Uint8Array(count);
  const src = (i) => `assets/about/${DIR}/${String(i + 1).padStart(3, "0")}.webp`;
  let width = 0;
  let height = 0;
  let drawn = -1;
  let wanted = 0;

  function load(i) {
    const img = new Image();
    img.src = src(i);
    frames[i] = img;
    return img
      .decode()
      .catch(() => (img.complete && img.naturalWidth ? undefined : new Promise((res, rej) => ((img.onload = res), (img.onerror = rej)))))
      .then(() => {
        ready[i] = 1;
        if (Math.abs(i - wanted) <= 1) draw(wanted, true);
      })
      .catch(() => {});
  }

  function nearestReady(i) {
    for (let d = 0; d < count; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < count && ready[i + d]) return i + d;
    }
    return -1;
  }

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    draw(wanted, true);
  }

  // Draws a frame fitted inside the canvas, anchored bottom-centre.
  function draw(i, force) {
    wanted = i;
    const f = nearestReady(i);
    if (f < 0 || (f === drawn && !force)) return;
    // Until a frame is ready, the static avatar stands in (css/about.css).
    // Swap to the canvas the first time there's something to draw.
    if (!section.classList.contains("has-frames")) {
      section.classList.add("has-frames");
      sizeCanvas();
      return;
    }
    const h = Math.min(height, width / aspect);
    const w = h * aspect;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(frames[f], (width - w) / 2, height - h, w, h);
    drawn = f;
  }

  /* Clip playback. Line k's clip runs from the previous line's resting pose
     to its own, so every clip starts where the last one settled. */
  const FPS = 24;
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutSine = (t) => Math.sin((t * Math.PI) / 2);
  let beat = -1; // line whose clip is playing
  let head = 0; // playhead, in frames
  let tween = null; // { from, to, start, duration, ease }
  let run = 0; // id of the current playback loop

  function playClip(k) {
    if (k === beat) return;
    beat = k;
    const to = restFrames[k];
    const dist = Math.abs(to - head);
    if (dist < 0.5) return;
    const back = to < head;
    // A touch slower than the video so the eased ends never rush; backwards
    // (scrolling up) retraces faster. Long jumps are capped.
    const duration = Math.min(back ? 1.2 : 2.6, (dist / FPS) * (back ? 0.6 : 1.25));
    // Already moving: keep going and just settle. From rest: ease both ends.
    const ease = tween ? easeOutSine : easeInOutSine;
    tween = { from: head, to, start: performance.now(), duration: duration * 1000, ease };
    const id = ++run;
    requestAnimationFrame((t) => tick(t, id));
  }

  function tick(now, id) {
    if (id !== run || !tween) return; // replaced or reset
    const t = clamp01((now - tween.start) / tween.duration);
    head = tween.from + (tween.to - tween.from) * tween.ease(t);
    draw(Math.round(head));
    if (t < 1) requestAnimationFrame((n) => tick(n, id));
    else tween = null;
  }

  function resetClips() {
    beat = -1;
    head = 0;
    tween = null;
    run++;
    draw(0);
  }

  // The line on screen: the one past the midpoint of its change.
  const lineAt = (p) => {
    let k = 0;
    while (k < N - 1 && p >= (k + 1) / N - T * 0.5) k++;
    return k;
  };

  // Load the frames well before the section arrives: the first frame, then
  // each line's resting pose, then everything else.
  let loading = false;
  function startLoading() {
    if (loading) return;
    loading = true;
    load(0).then(() => {
      for (const r of restFrames) if (!frames[r]) load(r);
      for (let i = 1; i < count; i++) if (!frames[i]) load(i);
    });
  }
  M.inView(section, startLoading, { margin: "300% 0px 300% 0px" });
  window.addEventListener("layoutresize", sizeCanvas);
  sizeCanvas();

  /* ---------- Finale: blocks fall and stack, scroll-linked ---------- */

  const blocks = Array.from(beats[N - 1].querySelectorAll("span"));
  // Bottom block first, so each one lands on the one below it.
  const order = blocks.slice().reverse();
  // Where the finale's scroll starts: as its line change begins.
  const finaleStart = (N - 1) / N - T * 0.6;
  // Each block's share of the finale: [start, end] as fractions of it.
  const SLOT = (n) => [n * 0.24, n * 0.24 + 0.4];

  // Distance from just above the screen to a block's resting place.
  // Measured against the pinned stage, so it holds wherever the page is.
  const stage = section.querySelector(".about__stage");
  let drop = [];
  function measureDrop() {
    const top = stage.getBoundingClientRect().top;
    drop = order.map((block) => {
      const prev = block.style.transform;
      block.style.transform = "none";
      const bottom = block.getBoundingClientRect().bottom - top;
      block.style.transform = prev;
      return -(bottom + 40);
    });
  }

  function renderBlocks(u) {
    // u: 0 → 1 across the finale's scroll.
    const squash = new Array(order.length).fill(0);
    order.forEach((block, n) => {
      const [a, b] = SLOT(n);
      const local = clamp01((u - a) / (b - a));
      const fall = clamp01(local / 0.65); // falling part
      const impact = clamp01((local - 0.65) / 0.35); // squash part
      // Squash and spring back: dips, overshoots slightly, settles.
      const s = impact > 0 && impact < 1 ? Math.sin(Math.PI * impact) * (1 - impact) : 0;
      squash[n] += s;
      // The blocks already stacked below give a little under the weight.
      for (let m = 0; m < n; m++) squash[m] += s * 0.25;
      const y = drop[n] * (1 - easeIn(fall));
      const tilt = (n % 2 ? 3 : -3) * (1 - fall);
      block.style.opacity = local > 0 ? "1" : "0";
      block.dataset.y = y.toFixed(1);
      block.dataset.r = tilt.toFixed(2);
    });
    order.forEach((block, n) => {
      const k = squash[n];
      block.style.transform = `translateY(${block.dataset.y}px) rotate(${block.dataset.r}deg) scale(${(1 + 0.07 * k).toFixed(3)}, ${(1 - 0.3 * k).toFixed(3)})`;
    });
  }

  measureDrop();
  window.addEventListener("layoutresize", measureDrop);

  /* ---------- One scroll track drives the lines, avatar and blocks ---------- */

  scroll(
    (p) => {
      for (let i = 0; i < N - 1; i++) {
        // The outgoing line uses the first 60% of a change, the incoming line
        // the last 60%, so they barely overlap.
        const tIn = i === 0 ? 1 : clamp01((change(p, i) - 0.4) / 0.6);
        const tOut = clamp01(change(p, i + 1) / 0.6);
        let opacity;
        let scale;
        if (tOut > 0) {
          // Leaving: grows and fades as if the camera passes through it.
          opacity = 1 - tOut;
          scale = 1 + 0.55 * tOut;
        } else {
          // Arriving: grows in from smaller.
          opacity = tIn;
          scale = 0.72 + 0.28 * tIn;
        }
        beats[i].style.opacity = opacity.toFixed(3);
        beats[i].style.transform = `translateY(-50%) scale(${scale.toFixed(4)})`;
      }

      // Finale: visible once its change starts; blocks fall with the scroll.
      const finale = beats[N - 1];
      const u = clamp01((p - finaleStart) / (1 - finaleStart) / 0.9);
      finale.style.opacity = p >= finaleStart ? "1" : "0";
      finale.style.transform = "translateY(-50%)";
      renderBlocks(u);

      if (live) playClip(lineAt(p));
      if (cue) cue.style.opacity = (1 - clamp01(p / (0.45 / N))).toFixed(3);
    },
    { target: section, offset: ["start start", "end end"] }
  );
})();
