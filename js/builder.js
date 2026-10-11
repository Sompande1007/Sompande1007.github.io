// 02 Builder, with Motion from window.Motion.
//  - Opener: Engineer's hand-off floods the screen and reveals BUILDER. The
//    word first shows as tall vertical bars; as the page scrolls the gaps
//    close and the letters resolve, like sound becoming a word.
//  - VoiceAI: pinned. The page's lines flatten into one line, the line starts
//    to speak, and the waveform (the clip's real one) becomes a player. While
//    a clip plays, the spoken line lights up and the button breathes with the
//    voice's loudness. The waveform is also the seek bar; script lines jump
//    to where they're spoken; a button goes back ten seconds.
//  - Voice agents: one stream splits into ribbons sized to the real numbers;
//    each label rides its ribbon's tip.
//  - Hand-off: the page squeezes into the navbar island ("call ended"), which
//    hangs up, and 03 Founder opens: the word fills up inside its outline.
// Scroll-linked parts play backwards too and replay on every pass. The player
// works without Motion or with reduced motion; everything else then rests in
// its final state.
(() => {
  const chapter = document.querySelector("#builder");
  if (!chapter) return;

  const M = window.Motion;
  const motion = !!M && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  // While a full-screen reveal shows the next chapter's name, the navbar
  // shows it too (js/nav.js reads html[data-where-now]).
  const whereNow = new Map();
  function claimWhere(owner, label) {
    if (label) whereNow.set(owner, label);
    else whereNow.delete(owner);
    const next = whereNow.size ? Array.from(whereNow.values()).pop() : "";
    const root = document.documentElement;
    if ((root.dataset.whereNow || "") === next) return;
    if (next) root.dataset.whereNow = next;
    else delete root.dataset.whereNow;
    window.dispatchEvent(new Event("wherechange"));
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  /* ================= VoiceAI ================= */

  const voice = chapter.querySelector("[data-voice]");
  const card = voice.querySelector(".voice__card");
  const wave = voice.querySelector(".voice__wave");
  const docTitle = voice.querySelector(".voice__doc-title");
  const scriptBox = voice.querySelector(".voice__script");
  const player = voice.querySelector(".voice__player");
  const playBtn = voice.querySelector(".voice__play");
  const timeEl = voice.querySelector(".voice__time");
  const whoEl = voice.querySelector(".voice__who");
  const audio = voice.querySelector(".voice__audio");
  const chips = Array.from(voice.querySelectorAll(".voice__chip"));

  const N = 64; // bars in the waveform
  // The "page": eleven lines of text of varying length.
  const LINES = [0.92, 0.84, 0.97, 0.6, 0.88, 0.95, 0.8, 0.55, 0.9, 0.86, 0.48];
  const lineEls = LINES.map(() => {
    const el = document.createElement("span");
    el.className = "voice__bar";
    wave.appendChild(el);
    return el;
  });
  const barsA = [];
  const barsB = []; // second lane, for two-host clips
  for (let k = 0; k < N; k++) {
    for (const list of [barsA, barsB]) {
      const el = document.createElement("span");
      el.className = "voice__bar";
      wave.appendChild(el);
      list.push(el);
    }
  }
  const lanes = ["A", "B"].map((who) => {
    const el = document.createElement("p");
    el.className = "voice__lane";
    wave.appendChild(el);
    return el;
  });
  const head = document.createElement("span");
  head.className = "voice__head";
  wave.appendChild(head);
  const backBtn = voice.querySelector(".voice__back");
  const lineList = document.createElement("ul");
  lineList.className = "voice__lines";
  scriptBox.appendChild(lineList);

  let clips = null;
  let clip = null; // the selected clip's data
  let speakerAt = []; // per bar: "A" or "B" (two-host clips)
  let morph = motion ? 0 : 1; // 0 = page of text, 1 = waveform

  function layoutWave() {
    const W = wave.clientWidth;
    const H = wave.clientHeight;
    const t = morph;
    const f = easeInOut(clamp01(t / 0.5));
    const mid = H / 2;
    const podcast = Boolean(clip && clip.lines[0].who && t >= 1);

    // The page's lines slide together and flatten into one line.
    lineEls.forEach((el, i) => {
      const y = 6 + i * ((H - 12) / (LINES.length - 1));
      const w = W * LINES[i];
      const h = 7 - 4 * f;
      el.style.opacity = t >= 0.5 ? "0" : String(1 - 0.6 * f);
      el.style.width = `${lerp(w, W, f).toFixed(1)}px`;
      el.style.height = `${h.toFixed(1)}px`;
      el.style.transform = `translate(0px, ${lerp(y, mid, f) - h / 2}px)`;
    });

    // Then the line starts to speak: bars grow out of it, left to right.
    const step = W / N;
    // Two-host clips: each lane gets a label row of its own above its bars.
    const LABEL = 18;
    const laneArea = (H - 2 * LABEL) / 2;
    const laneH = laneArea - 6;
    const centreA = LABEL + laneArea / 2;
    const centreB = 2 * LABEL + laneArea * 1.5;
    for (let k = 0; k < N; k++) {
      const g = t < 0.5 ? 0 : easeInOut(clamp01(((t - 0.5) / 0.5) * 1.6 - (k / N) * 0.6));
      const peak = clip ? clip.peaks[Math.floor((k / N) * clip.peaks.length)] : 0.5;
      const a = barsA[k];
      const b = barsB[k];
      a.style.width = b.style.width = `${Math.max(1, step - 3).toFixed(1)}px`;
      a.style.opacity = t >= 0.5 ? "1" : "0";
      if (podcast) {
        // Two lanes: the voice speaking at that moment draws in its lane.
        const who = speakerAt[k];
        const hA = who === "A" ? 4 + peak * laneH : 3;
        const hB = who === "B" ? 4 + peak * laneH : 3;
        a.style.height = `${hA.toFixed(1)}px`;
        a.style.top = `${(centreA - hA / 2).toFixed(1)}px`;
        b.style.height = `${hB.toFixed(1)}px`;
        b.style.top = `${(centreB - hB / 2).toFixed(1)}px`;
        b.style.opacity = "1";
      } else {
        const h = 3 + (6 + peak * (H - 10) - 3) * g;
        a.style.height = `${h.toFixed(1)}px`;
        a.style.top = `${(mid - h / 2).toFixed(1)}px`;
        b.style.height = "3px";
        b.style.top = `${mid - 1.5}px`;
        b.style.opacity = "0";
      }
      a.style.left = b.style.left = `${(k * step).toFixed(1)}px`;
    }
    lanes[0].style.top = "0px";
    lanes[1].style.top = `${(LABEL + laneArea).toFixed(0)}px`;

    // The title of the page fades as it flattens; the player arrives last.
    docTitle.style.opacity = String(1 - clamp01(t * 2.5));
    const ready = clamp01((t - 0.85) / 0.15);
    scriptBox.style.opacity = player.style.opacity = String(ready);
    player.style.pointerEvents = ready > 0.5 ? "" : "none";
    voice.classList.toggle("is-ready", t >= 1);
    voice.classList.toggle("is-podcast", podcast);
  }

  function selectClip(key) {
    if (!clips) return;
    const was = !audio.paused;
    audio.pause();
    clip = clips[key];
    audio.src = clip.src;
    chips.forEach((c) => {
      const on = c.dataset.clip === key;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", String(on));
    });
    whoEl.textContent = `${clip.label} · ${clip.voice}`;
    playBtn.setAttribute("aria-label", `Play the ${clip.label} sample`);
    timeEl.textContent = `0:00 / ${fmt(clip.duration)}`;
    // Which host speaks at each bar.
    speakerAt = Array.from({ length: N }, (_, k) => {
      const at = ((k + 0.5) / N) * clip.duration;
      const line = clip.lines.find((l) => at >= l.start && at < l.end) || clip.lines[clip.lines.length - 1];
      return line.who || "";
    });
    if (clip.lines[0].who) {
      const [a, b] = clip.voice.split(" & ");
      lanes[0].textContent = `Host A · ${a}`;
      lanes[1].textContent = `Host B · ${b}`;
    }
    lineList.innerHTML = clip.lines.map((l, i) => `<li data-line="${i}">${l.who ? `<b>Host ${l.who}</b>` : ""}${l.text}</li>`).join("");
    wave.setAttribute("aria-valuemax", String(Math.round(clip.duration)));
    current = -1;
    paint(0);
    layoutWave();
    if (was) play();
  }

  // Lit bars, the playhead, the line being spoken and the clock.
  let current = -1;
  function paint(time) {
    if (!clip) return;
    const done = time / clip.duration;
    for (let k = 0; k < N; k++) {
      const lit = (k + 0.5) / N <= done;
      barsA[k].classList.toggle("is-lit", lit);
      barsB[k].classList.toggle("is-lit", lit);
    }
    head.style.transform = `translateX(${(done * wave.clientWidth).toFixed(1)}px)`;
    voice.classList.toggle("has-started", time > 0);
    timeEl.textContent = `${fmt(time)} / ${fmt(clip.duration)}`;
    wave.setAttribute("aria-valuenow", String(Math.round(time)));
    wave.setAttribute("aria-valuetext", `${fmt(time)} of ${fmt(clip.duration)}`);
    let i = clip.lines.findIndex((l) => time < l.end);
    if (i < 0) i = clip.lines.length - 1;
    if (i === current) return;
    current = i;
    const items = Array.from(lineList.children);
    items.forEach((li, k) => li.classList.toggle("is-now", k === i && time > 0));
    const li = items[i];
    if (li) {
      // Keep the spoken line on the second row, with the previous one above.
      const prev = items[i - 1];
      const offset = prev ? prev.offsetTop : 0;
      lineList.style.transform = `translateY(${-offset}px)`;
    }
  }

  function seek(time) {
    if (!clip) return;
    if (!audio.src) audio.src = clip.src;
    const t = Math.min(clip.duration - 0.05, Math.max(0, time));
    audio.currentTime = t;
    paint(t);
  }

  // Loudness, for the breathing button.
  let analyser = null;
  let samples = null;
  function listen() {
    if (analyser) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      samples = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      listen.ctx = ctx;
    } catch {
      analyser = null;
    }
  }

  let level = 0;
  function tick() {
    if (audio.paused) {
      level = 0;
      playBtn.style.setProperty("--level", "0");
      return;
    }
    if (analyser) {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / samples.length);
      level += (Math.min(1, rms * 4) - level) * 0.35;
      playBtn.style.setProperty("--level", level.toFixed(3));
    }
    paint(audio.currentTime);
    requestAnimationFrame(tick);
  }

  function play() {
    listen();
    if (listen.ctx && listen.ctx.state === "suspended") listen.ctx.resume();
    audio.play().catch(() => {});
  }

  playBtn.addEventListener("click", () => (audio.paused ? play() : audio.pause()));
  audio.addEventListener("play", () => {
    voice.classList.add("is-playing");
    playBtn.setAttribute("aria-label", `Pause the ${clip.label} sample`);
    requestAnimationFrame(tick);
  });
  audio.addEventListener("pause", () => {
    voice.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", `Play the ${clip.label} sample`);
  });
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    current = -1;
    paint(0);
  });
  audio.addEventListener("seeked", () => paint(audio.currentTime));
  chips.forEach((c) => c.addEventListener("click", () => selectClip(c.dataset.clip)));

  // The waveform is the seek bar: click or drag; arrow keys step 5 seconds.
  const timeAtPointer = (e) => {
    const r = wave.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / r.width) * clip.duration;
  };
  let dragging = false;
  wave.addEventListener("pointerdown", (e) => {
    if (!clip || morph < 1) return;
    dragging = true;
    wave.setPointerCapture(e.pointerId);
    seek(timeAtPointer(e));
  });
  wave.addEventListener("pointermove", (e) => dragging && seek(timeAtPointer(e)));
  wave.addEventListener("pointerup", () => (dragging = false));
  wave.addEventListener("pointercancel", () => (dragging = false));
  wave.addEventListener("keydown", (e) => {
    if (!clip) return;
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (step) {
      e.preventDefault();
      seek(audio.currentTime + step);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      seek(e.key === "Home" ? 0 : clip.duration);
    }
  });
  backBtn.addEventListener("click", () => seek(audio.currentTime - 10));
  // Click a line of the script to hear it.
  lineList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-line]");
    if (!li || !clip) return;
    seek(clip.lines[Number(li.dataset.line)].start + 0.01);
    if (audio.paused) play();
  });

  // Never keep talking once the visitor has scrolled away.
  new IntersectionObserver((entries) => {
    for (const e of entries) if (!e.isIntersecting) audio.pause();
  }).observe(voice);

  fetch("assets/builder/voice/clips.json")
    .then((r) => r.json())
    .then((data) => {
      clips = data;
      selectClip("documentary");
    })
    .catch(() => {});

  window.addEventListener("resize", layoutWave);
  layoutWave();

  /* ================= Voice agents: the split ================= */

  const fig = chapter.querySelector(".flowsplit");
  const pathA = fig.querySelector(".flowsplit__a");
  const pathB = fig.querySelector(".flowsplit__b");
  const reveal = fig.querySelector(".flowsplit__reveal");
  const labelA = fig.querySelector(".flowsplit__label--a");
  const labelB = fig.querySelector(".flowsplit__label--b");
  const inLabel = fig.querySelector(".flowsplit__in");

  // ViewBox units (400 × 340). The ribbons end at x = 300; labels sit right.
  const VW = 400;
  const VH = 340;
  const END = 300;
  const FORK = 110;
  const IN_H = 140;
  const aH = IN_H * 0.65;
  const bH = IN_H * 0.35;
  const yA0 = VH / 2 - IN_H / 2;
  const yB0 = yA0 + aH;
  const yA1 = 34;
  const yB1 = VH - 34 - bH;
  const band = (y0, h, y1) => {
    const c = (FORK + END) / 2;
    return `M0,${y0} L${FORK},${y0} C${c},${y0} ${c},${y1} ${END},${y1} L${END},${y1 + h} C${c},${y1 + h} ${c},${y0 + h} ${FORK},${y0 + h} L0,${y0 + h} Z`;
  };
  pathA.setAttribute("d", band(yA0, aH, yA1));
  pathB.setAttribute("d", band(yB0, bH, yB1));
  // Above the incoming stream; its width is capped (CSS) so it never meets
  // the labels riding the ribbons.
  inLabel.style.top = `${(yA0 / VH) * 100}%`;
  // Centre of a ribbon at x (follows the curve closely enough for a label).
  const centreAt = (x, y0, h, y1) => {
    if (x <= FORK) return y0 + h / 2;
    const u = clamp01((x - FORK) / (END - FORK));
    return lerp(y0, y1, u * u * (3 - 2 * u)) + h / 2;
  };

  function drawSplit(t) {
    const tip = lerp(8, END, easeInOut(t));
    reveal.setAttribute("width", String(tip));
    const show = clamp01((t - 0.4) / 0.2);
    const x = `${((tip + 12) / VW) * 100}%`;
    labelA.style.left = labelB.style.left = x;
    labelA.style.top = `${(centreAt(tip, yA0, aH, yA1) / VH) * 100}%`;
    labelB.style.top = `${(centreAt(tip, yB0, bH, yB1) / VH) * 100}%`;
    labelA.style.opacity = labelB.style.opacity = String(show);
  }
  drawSplit(1);

  /* ================= Motion ================= */

  if (!motion) return;

  /* ---------- Opener: BUILDER resolves out of bars ---------- */

  const handoff = document.querySelector("[data-handoff]");
  const word = handoff && handoff.querySelector(".handoff__word");
  if (word) {
    const line = handoff.querySelector(".handoff__tagline");
    const PERIOD = 16; // px between bars

    M.scroll(
      (p) => {
        // The flood reveals the word from p ≈ 0.62 (js/chapters.js).
        const q = easeInOut(clamp01((p - 0.62) / 0.28));
        // Each bar widens until the gaps close and the letters are whole.
        const bar = lerp(2, PERIOD, q);
        const mask = q >= 1 ? "none" : `repeating-linear-gradient(90deg, #000 0 ${bar.toFixed(2)}px, transparent ${bar.toFixed(2)}px ${PERIOD}px)`;
        word.style.webkitMaskImage = word.style.maskImage = mask;
        // Tall and thin as bars, settling to the word's own height.
        word.style.transform = `scaleY(${lerp(1.18, 1, q).toFixed(3)})`;
        line.style.opacity = String(clamp01((p - 0.86) / 0.1));
        claimWhere("builder", p > 0.62 && p < 1 ? "02 · Builder" : "");
      },
      { target: handoff, offset: ["start start", "end end"] }
    );
  }

  /* ---------- VoiceAI: pinned morph ---------- */

  let pinned = false;
  function pinVoice() {
    voice.classList.remove("is-pinned");
    const fits = window.innerWidth >= 900 && voice.querySelector(".voice__stage").scrollHeight < window.innerHeight - 40;
    pinned = fits;
    voice.classList.toggle("is-pinned", fits);
  }
  pinVoice();
  window.addEventListener("resize", pinVoice);

  M.scroll(() => {
    let t;
    if (pinned) {
      const r = voice.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      t = clamp01(-r.top / Math.max(1, travel) / 0.8);
    } else {
      const r = card.getBoundingClientRect();
      t = clamp01((window.innerHeight * 0.9 - r.top) / (window.innerHeight * 0.6));
    }
    if (t === morph) return;
    morph = t;
    layoutWave();
  });

  /* ---------- Voice agents: scroll-linked split ---------- */

  drawSplit(0);
  M.scroll(() => {
    const r = fig.getBoundingClientRect();
    drawSplit(clamp01((window.innerHeight * 0.9 - r.top) / (window.innerHeight * 0.6)));
  });

  /* ---------- Hand-off: call ended ---------- */

  const callend = chapter.querySelector("[data-callend]");
  const stage = callend.querySelector(".callend__stage");
  const page = callend.querySelector(".callend__page");
  const echo = callend.querySelector(".callend__echo");
  const pill = callend.querySelector(".callend__pill");
  const next = callend.querySelector(".callend__next");
  const founderWord = callend.querySelector(".callend__word");
  const headline = callend.querySelector(".callend__headline");
  const root = document.documentElement;

  M.scroll(
    (whole) => {
      // The first ~70% of the track is the hang-up; the rest opens Founder:
      // FOUNDER fills up inside its outline, then the headline lands.
      const p = clamp01(whole / 0.7);
      const fill = easeInOut(clamp01((whole - 0.66) / 0.24));
      founderWord.style.setProperty("--fill", `${(fill * 100).toFixed(1)}%`);
      headline.style.opacity = String(clamp01((whole - 0.88) / 0.08));
      claimWhere("founder", whole > 0.64 && whole < 1 ? "03 · Founder" : "");
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const pw = pill.offsetWidth || 190;
      const ph = pill.offsetHeight || 46;
      // 1. The page squeezes toward the island's spot.
      const s = easeInOut(clamp01((p - 0.06) / 0.44));
      const sx = lerp(1, pw / W, s);
      const sy = lerp(1, ph / H, s);
      const r = lerp(0, ph / 2, s);
      page.style.transform = `translateY(${lerp(0, 16, s).toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      page.style.borderRadius = `${(r / sx).toFixed(1)}px / ${(r / sy).toFixed(1)}px`;
      page.style.backgroundColor = s > 0.6 ? `color-mix(in srgb, var(--ink) ${Math.round(clamp01((s - 0.6) / 0.4) * 100)}%, var(--bg))` : "";
      page.style.opacity = p < 0.52 ? "1" : "0";
      // Edges appear only once it starts to shrink, so it never draws a line
      // across the page while it still fills the screen.
      const edge = clamp01(s / 0.08);
      page.style.borderColor = `color-mix(in srgb, var(--line) ${Math.round(edge * 100)}%, transparent)`;
      page.style.boxShadow = `0 30px 80px -30px rgba(0, 0, 0, ${(0.35 * edge).toFixed(2)})`;
      echo.style.opacity = String(1 - clamp01((s - 0.25) / 0.45));
      // 2. It becomes the island: "call ended". 3. It hangs up.
      const on = clamp01((p - 0.48) / 0.06);
      const off = clamp01((p - 0.72) / 0.08);
      pill.style.opacity = String(on * (1 - off));
      pill.style.transform = `translateX(-50%) scale(${(1 - 0.35 * off).toFixed(3)})`;
      // The real island steps aside while its stand-in is on screen.
      root.classList.toggle("is-calling", p > 0.04 && p < 0.8);
      // 4. The next chapter opens.
      const n = clamp01((p - 0.8) / 0.14);
      next.style.opacity = String(n);
      next.style.transform = `scale(${(0.92 + 0.08 * easeOut(n)).toFixed(3)})`;
    },
    { target: callend, offset: ["start start", "end end"] }
  );
})();
