// Engineer chapter motion, built with Motion (window.Motion, loaded from CDN).
// Two kinds of motion:
//  - scroll-linked: values tied to scroll position (scroll + animate), so they
//    play forwards and backwards with the scrollbar;
//  - scroll-triggered: plays when something enters view (inView), resets once
//    it is fully off-screen, and plays again on the next visit.
// The markup and CSS already show every final state, so if Motion is missing
// or the visitor prefers reduced motion, nothing here needs to run.
(() => {
  const M = window.Motion;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 899px)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Odometers: digits in columns that roll into place ---------- */

  // Builds rolling columns for every [data-odo] and returns their animations
  // as functions, so callers decide when each one plays.
  function buildOdometer(el, { spins = 1 } = {}) {
    const text = el.dataset.odo;
    const down = el.dataset.odoDir === "down";
    el.setAttribute("aria-label", text);
    el.textContent = "";
    el.classList.add("odo");
    const columns = [];
    let digitIndex = 0;
    for (const ch of text) {
      if (!/\d/.test(ch)) {
        const s = document.createElement("span");
        s.textContent = ch;
        s.setAttribute("aria-hidden", "true");
        el.appendChild(s);
        continue;
      }
      const target = Number(ch);
      const turns = spins + digitIndex; // columns further right spin longer
      // Up: 0,1,2… ending on the target. Down: counts backwards to the target.
      const count = turns * 10 + (down ? 1 : target + 1);
      const values = Array.from({ length: count }, (_, i) => (down ? (target + i) % 10 : i % 10));
      const start = down ? count - 1 : 0;
      const end = down ? 0 : count - 1;

      const col = document.createElement("span");
      col.className = "odo__col";
      col.setAttribute("aria-hidden", "true");
      // An invisible copy of the final digit sizes the column, so a narrow
      // digit like 1 doesn't get the width of the widest one.
      const ghost = document.createElement("span");
      ghost.className = "odo__ghost";
      ghost.textContent = ch;
      col.appendChild(ghost);
      const stack = document.createElement("span");
      stack.className = "odo__stack";
      for (const v of values) {
        const d = document.createElement("span");
        d.textContent = v;
        stack.appendChild(d);
      }
      col.appendChild(stack);
      el.appendChild(col);
      // Rest on the final digit until (and unless) the roll plays.
      stack.style.transform = `translateY(-${end}em)`;
      columns.push({ stack, start, end, index: digitIndex });
      digitIndex++;
    }
    let running = [];
    return {
      // Back to the starting digits, stopping any roll in progress.
      prime() {
        for (const a of running) a.stop();
        running = [];
        for (const c of columns) c.stack.style.transform = `translateY(-${c.start}em)`;
      },
      play(delay = 0) {
        running = columns.map((c) =>
          M.animate(
            c.stack,
            { transform: [`translateY(-${c.start}em)`, `translateY(-${c.end}em)`] },
            { duration: 1.1 + c.index * 0.18, delay, ease: [0.16, 1, 0.3, 1] }
          )
        );
        return Promise.all(running);
      },
    };
  }

  const odometers = new Map();
  for (const el of document.querySelectorAll("[data-odo]")) odometers.set(el, buildOdometer(el));

  // Split text into spans for per-letter / per-word motion, keeping it readable
  // to screen readers through aria-label.
  function split(el, by) {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.textContent = "";
    const parts = by === "word" ? text.split(" ") : Array.from(text);
    return parts.map((part, i) => {
      const span = document.createElement("span");
      span.className = by;
      span.setAttribute("aria-hidden", "true");
      span.textContent = part;
      el.appendChild(span);
      if (by === "word" && i < parts.length - 1) el.appendChild(document.createTextNode(" "));
      return span;
    });
  }

  const opener = document.querySelector("[data-opener]");
  const scatterTitle = document.querySelector("[data-scatter]");
  const chars = scatterTitle ? split(scatterTitle, "char") : [];
  const wordsTitle = document.querySelector("[data-words]");
  const words = wordsTitle ? split(wordsTitle, "word") : [];

  if (!M || reduceMotion || !opener) return;
  document.documentElement.classList.add("has-motion");

  const { animate, scroll, inView, stagger } = M;
  const springy = (bounce, visualDuration) => ({ type: "spring", bounce, visualDuration });

  // Plays when `el` comes into view (by `amount`), and resets only once it is
  // completely off-screen, so the reset is never seen and the next visit, from
  // either direction, plays it again.
  function replay(el, { play, reset, amount }) {
    reset();
    let armed = true;
    inView(
      el,
      () => {
        if (armed) {
          armed = false;
          play();
        }
        // Returning a function keeps inView watching after the first entry
        // (without it, inView fires only once).
        return () => {};
      },
      { amount }
    );
    inView(el, () => () => {
      reset();
      armed = true;
    });
  }

  /* ---------- Opener ---------- */

  // Letters start scattered and assemble as the opener scrolls to the centre.
  // Offsets are fixed (not random) so the scatter looks the same every visit.
  const SCATTER = [
    [-95, -24],
    [70, 18],
    [-40, -32],
    [110, 26],
    [-105, 14],
    [55, -20],
    [-75, 30],
    [95, -16],
  ];
  const reach = small ? 0.45 : 1;
  chars.forEach((c, i) => {
    const [y, r] = SCATTER[i % SCATTER.length];
    const a = animate(
      c,
      {
        transform: [`translateY(${y * reach}%) rotate(${r * reach}deg)`, "translateY(0%) rotate(0deg)"],
        opacity: [0, 1],
        filter: ["blur(8px)", "blur(0px)"],
      },
      { ease: "linear" }
    );
    scroll(a, { target: opener, offset: ["start end", "center center"] });
  });

  // "01" rolls in the moment the word locks.
  const openerNum = odometers.get(opener.querySelector("[data-odo]"));
  if (openerNum) {
    openerNum.prime();
    let rolled = false;
    scroll(
      (p) => {
        if (!rolled && p > 0.97) {
          rolled = true;
          openerNum.play();
        } else if (rolled && p < 0.5) {
          rolled = false;
          openerNum.prime();
        }
      },
      { target: opener, offset: ["start end", "center center"] }
    );
  }

  // On the way out, the word drifts left and grows; the promise line drifts right.
  const lede = opener.querySelector(".opener__lede");
  // Explicit start values: Motion builds "none" from the target's shape with
  // zeroed numbers, which would mean scale(0).
  scroll(animate(scatterTitle, { transform: ["translateX(0vw) scale(1)", "translateX(-6vw) scale(1.06)"] }, { ease: "linear" }), {
    target: opener,
    offset: ["center center", "end start"],
  });
  scroll(animate(lede, { transform: ["translateX(0vw)", "translateX(6vw)"] }, { ease: "linear" }), {
    target: opener,
    offset: ["center center", "end start"],
  });

  /* ---------- HRX ---------- */

  // Headline words pop up one after another with a springy overshoot.
  if (words.length) {
    let pop;
    replay(wordsTitle, {
      amount: 0.6,
      play: () => {
        pop = animate(words, { opacity: [0, 1], y: [60, 0], rotate: [6, 0] }, { delay: stagger(0.07), ...springy(0.45, 0.6) });
      },
      reset: () => {
        if (pop) pop.stop();
        animate(words, { opacity: 0, y: 60, rotate: 6 }, { duration: 0 });
      },
    });
  }

  // Screenshot tips from laid-back to upright as it reaches the centre; the
  // glow brightens with it.
  const stage = document.querySelector("[data-tilt]");
  if (stage) {
    const shot = stage.querySelector(".hrx__shot");
    const glow = stage.querySelector(".hrx__glow-inner");
    const tilt = small ? 18 : 38;
    // Finish when the screenshot's bottom is near the bottom of the screen, so the
    // headline above it is in view too.
    const range = { target: stage, offset: ["start end", "end 0.94"] };
    scroll(
      animate(
        shot,
        { transform: [`rotateX(${tilt}deg) scale(0.82) translateY(60px)`, "rotateX(0deg) scale(1) translateY(0px)"] },
        { ease: "linear" }
      ),
      range
    );
    scroll(animate(glow, { opacity: [0.15, 1], transform: ["scale(0.7)", "scale(1)"] }, { ease: "linear" }), range);

    // Sticker: slaps on once the screenshot is nearly upright, then keeps
    // turning gently with scroll.
    const sticker = stage.querySelector(".sticker");
    const face = stage.querySelector(".sticker__face");
    scroll(animate(sticker, { transform: ["rotate(-10deg)", "rotate(14deg)"] }, { ease: "linear" }), {
      target: stage,
      offset: ["start end", "end start"],
    });
    face.style.transform = "rotate(-140deg) scale(0)";
    let slapped = false;
    scroll((p) => {
      if (!slapped && p > 0.85) {
        slapped = true;
        animate(face, { scale: [0, 1], rotate: [-140, -12] }, springy(0.5, 0.6));
      } else if (slapped && p < 0.55) {
        // Scrolling back: it peels off, ready to slap on again.
        slapped = false;
        animate(face, { scale: 0, rotate: -140 }, { duration: 0.3, ease: "easeIn" });
      }
    }, range);

    // "See HRX live" leans toward the cursor when it's close.
    const live = stage.querySelector("[data-magnetic]");
    if (live && canHover) {
      let pulled = false;
      stage.addEventListener("pointermove", (e) => {
        const r = live.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < 150) {
          pulled = true;
          animate(live, { x: dx * 0.28, y: dy * 0.28 }, springy(0.4, 0.3));
        } else if (pulled) {
          pulled = false;
          animate(live, { x: 0, y: 0 }, springy(0.5, 0.4));
        }
      });
      stage.addEventListener("pointerleave", () => {
        pulled = false;
        animate(live, { x: 0, y: 0 }, springy(0.5, 0.4));
      });
    }
  }

  // Cards deal in from below, flipping up; their numbers roll.
  const cardList = document.querySelector("[data-cards]");
  if (cardList) {
    const cards = Array.from(cardList.children);
    const nums = cards.map((c) => odometers.get(c.querySelector("[data-odo]")));
    let deal;
    replay(cardList, {
      // Stacked on phones, the list is tall, so start as soon as it appears.
      amount: small ? 0.05 : 0.3,
      play: () => {
        deal = animate(cards, { opacity: [0, 1], y: [80, 0], rotateX: [-35, 0] }, { delay: stagger(0.12), ...springy(0.35, 0.7) });
        nums.forEach((n, i) => n && n.play(0.15 + i * 0.12));
      },
      reset: () => {
        if (deal) deal.stop();
        animate(cards, { opacity: 0, y: 80, rotateX: -35 }, { duration: 0 });
        nums.forEach((n) => n && n.prime());
      },
    });
  }

  /* ---------- automation ---------- */

  const panel = document.querySelector("[data-panel]");
  if (panel) {
    // The panel opens up from a smaller rounded card as it scrolls in.
    scroll(
      animate(
        panel,
        {
          clipPath: ["inset(7% 9% 7% 9% round 44px)", "inset(0% 0% 0% 0% round 44px)"],
          transform: ["translateY(60px)", "translateY(0px)"],
        },
        { ease: "linear" }
      ),
      { target: panel, offset: ["start end", "start 0.3"] }
    );

    // Numbers spin like a slot machine; the dividers draw; the 0 pulses.
    const rows = panel.querySelector("[data-rows]");
    const rowNums = Array.from(rows.querySelectorAll("[data-odo]")).map((el) => ({ el, odo: odometers.get(el) }));
    const rules = Array.from(rows.querySelectorAll(".automation__rule"));
    let draw;
    let visit = 0; // ignores a finished roll from a visit that was reset
    replay(rows, {
      amount: 0.4,
      play: () => {
        const mine = ++visit;
        rowNums.forEach(({ el, odo }, i) => {
          odo.play(i * 0.25).then(() => {
            if (mine === visit && el.dataset.odoDir === "down") {
              animate(el.closest(".automation__num"), { scale: [1, 1.18, 1] }, { duration: 0.5, ease: "easeOut" });
            }
          });
        });
        draw = animate(rules, { transform: ["scaleX(0)", "scaleX(1)"] }, { delay: stagger(0.2, { startDelay: 0.3 }), duration: 0.8, ease: [0.65, 0, 0.15, 1] });
      },
      reset: () => {
        visit++;
        rowNums.forEach(({ odo }) => odo.prime());
        if (draw) draw.stop();
        animate(rules, { transform: "scaleX(0)" }, { duration: 0 });
      },
    });
  }

  /* ---------- Also shipped ---------- */

  const also = document.querySelector("[data-also]");
  if (also) {
    const cards = Array.from(also.children);
    const spread = small ? 5 : 12; // vw each card travels in from its side
    const meet = { target: also, offset: ["start end", "center center"] };

    // The two cards converge from opposite sides as the strip reaches centre.
    // Uses the CSS `translate` property so it combines with the hover tilt,
    // which drives `transform`.
    cards.forEach((card, i) => {
      const from = i === 0 ? -spread : spread;
      scroll(animate(card, { translate: [`${from}vw 0px`, "0vw 0px"], opacity: [0.2, 1] }, { ease: "linear" }), meet);
    });

    // The label starts widely spaced and tightens into place.
    const tracked = document.querySelector("[data-tracking]");
    if (tracked) {
      scroll(animate(tracked, { letterSpacing: ["0.6em", "0.08em"] }, { ease: "linear" }), meet);
    }

    /* Card 1: a scan line sweeps down; MILLIONS decodes from raw data
       characters; the text below sharpens as the scan passes it. */
    const scanCard = also.querySelector("[data-scan]");
    if (scanCard) {
      const scan = scanCard.querySelector(".mini__scan");
      const copy = scanCard.querySelector(".mini__copy");
      const word = scanCard.querySelector("[data-decode]");
      const dots = scanCard.querySelector(".mini__dots");

      // Letters as fixed-width slots so the word never jitters while decoding.
      const text = word.textContent;
      word.setAttribute("aria-label", text);
      word.textContent = "";
      const slots = Array.from(text, (ch) => {
        const slot = document.createElement("span");
        slot.className = "dec";
        slot.setAttribute("aria-hidden", "true");
        slot.textContent = ch;
        word.appendChild(slot);
        return slot;
      });

      // Narrow characters, so each fits its letter slot.
      const GLYPHS = "01#%/<>+";
      const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

      // Dots drift sideways with scroll: faster scrolling, faster stream.
      scroll(animate(dots, { transform: ["translateX(0px)", "translateX(-120px)"] }, { ease: "linear" }), {
        target: scanCard,
        offset: ["start end", "end start"],
      });

      let sweepAnim;
      let run = 0; // stops a flicker loop from an earlier visit
      replay(scanCard, {
        amount: small ? 0.25 : 0.45,
        reset: () => {
          run++;
          if (sweepAnim) sweepAnim.stop();
          for (const slot of slots) {
            slot.classList.add("is-scrambling");
            slot.dataset.glyph = pick();
          }
          word.classList.add("is-raw");
          animate(copy, { opacity: 0.25, filter: "blur(1.4px)" }, { duration: 0 });
          animate(scan, { opacity: 0, y: 0 }, { duration: 0 });
        },
        play: () => {
          const mine = ++run;
          const sweep = 1.4;
          const h = scanCard.offsetHeight;
          // When the line reaches the copy, the copy is "cleaned".
          const reachCopy = (copy.offsetTop / h) * sweep;
          sweepAnim = animate(
            [
              [scan, { opacity: [0, 1] }, { duration: 0.15 }],
              [scan, { y: [0, h] }, { duration: sweep, ease: "easeInOut", at: 0 }],
              [copy, { opacity: 1, filter: "blur(0px)" }, { duration: 0.5, ease: "easeOut", at: reachCopy }],
              [scan, { opacity: 0 }, { duration: 0.25, at: sweep - 0.1 }],
            ]
          );
          // Each letter flickers through glyphs, resolving left to right.
          word.classList.remove("is-raw");
          const start = performance.now();
          (function flicker(now) {
            if (mine !== run) return;
            const t = (now - start) / 1000;
            let pending = false;
            slots.forEach((slot, i) => {
              if (!slot.classList.contains("is-scrambling")) return;
              if (t > 0.25 + i * 0.09) {
                slot.classList.remove("is-scrambling");
              } else {
                pending = true;
                slot.dataset.glyph = pick();
              }
            });
            if (pending) setTimeout(() => requestAnimationFrame(flicker), 45);
          })(start);
        },
      });

      // Scrolling fast makes the word skew as if rushing past; it springs
      // back upright when scrolling stops. Pointer devices only.
      if (canHover) {
        let skew = 0;
        let target = 0;
        let running = false;
        const settle = () => {
          target *= 0.85; // velocity fades between scroll events
          skew += (target - skew) * 0.18;
          word.style.transform = `skewX(${skew.toFixed(2)}deg)`;
          if (Math.abs(skew) > 0.05 || Math.abs(target) > 0.05) {
            requestAnimationFrame(settle);
          } else {
            word.style.transform = "";
            running = false;
          }
        };
        scroll((_, info) => {
          target = Math.max(-8, Math.min(8, -info.y.velocity / 400));
          if (!running) {
            running = true;
            requestAnimationFrame(settle);
          }
        });
      }
    }

    /* Card 2: the ring draws to 90% while the number counts up and the
       test marks tick over, all in sync. */
    const testCard = also.querySelector("[data-tests]");
    if (testCard) {
      const num = testCard.querySelector("[data-count-to]");
      const ring = testCard.querySelector(".ring__fill");
      const ticks = Array.from(testCard.querySelectorAll(".tick"));
      const goal = Number(num.dataset.countTo);
      const passing = ticks.filter((t) => t.classList.contains("is-on")).length;
      let countAnim;
      replay(testCard, {
        amount: small ? 0.25 : 0.45,
        reset: () => {
          if (countAnim) countAnim.stop();
          num.textContent = "0%";
          ring.setAttribute("stroke-dasharray", "0 1");
          for (const t of ticks) t.classList.remove("is-on", "is-popping");
        },
        play: () => {
          const ease = [0.22, 1, 0.36, 1];
          let lit = 0;
          countAnim = animate(0, goal, {
            duration: 1.8,
            ease,
            onUpdate: (v) => {
              num.textContent = `${Math.round(v)}%`;
              ring.setAttribute("stroke-dasharray", `${(v / 100).toFixed(4)} 1`);
              const due = Math.min(passing, Math.floor((v / goal) * passing + 0.001));
              while (lit < due) {
                const t = ticks[lit++];
                t.classList.add("is-on", "is-popping");
                setTimeout(() => t.classList.remove("is-popping"), 180);
              }
            },
          });
        },
      });
    }

    // Hover: a spotlight follows the cursor and the card tilts toward it.
    if (canHover) {
      for (const card of cards) {
        M.hover(card, () => {
          card.classList.add("is-hovered");
          const move = (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width;
            const y = (e.clientY - r.top) / r.height;
            card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
            card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
            animate(card, { rotateY: (x - 0.5) * 7, rotateX: (0.5 - y) * 7 }, springy(0.3, 0.35));
          };
          card.addEventListener("pointermove", move);
          return () => {
            card.removeEventListener("pointermove", move);
            card.classList.remove("is-hovered");
            animate(card, { rotateX: 0, rotateY: 0 }, springy(0.4, 0.45));
          };
        });
      }
    }
  }

  /* ---------- Hand-off to Builder ---------- */

  const handoff = document.querySelector("[data-handoff]");
  if (handoff) {
    const lineA = handoff.querySelector(".handoff__a");
    const lineB = handoff.querySelector(".handoff__b");
    const next = handoff.querySelector(".handoff__next");
    const flood = handoff.querySelector(".handoff__flood");
    const label = handoff.querySelector(".handoff__label");
    const reveal = handoff.querySelector(".handoff__reveal");

    // The two lines wipe in, left to right, as the hand-off arrives.
    const wipe = ["inset(0 100% 0 0)", "inset(0 0% 0 0)"];
    scroll(animate(lineA, { clipPath: wipe }, { ease: "linear" }), { target: handoff, offset: ["start end", "start 0.45"] });
    scroll(animate(lineB, { clipPath: wipe }, { ease: "linear" }), { target: handoff, offset: ["start 0.55", "start start"] });

    // While pinned: the pill's dot grows into a circle that floods the screen,
    // then the next chapter's name appears on it.
    let cover = 1;
    function measure() {
      const s = next.getBoundingClientRect();
      const v = handoff.querySelector(".handoff__stage").getBoundingClientRect();
      const cx = s.left + s.width / 2 - v.left;
      const cy = s.top + s.height / 2 - v.top;
      const far = Math.max(Math.hypot(cx, cy), Math.hypot(v.width - cx, cy), Math.hypot(cx, v.height - cy), Math.hypot(v.width - cx, v.height - cy));
      cover = (far * 2.1) / 40;
    }
    measure();
    window.addEventListener("resize", measure);

    const clamp = (v) => Math.min(1, Math.max(0, v));
    const easeIn = (t) => t * t * t;
    scroll(
      (p) => {
        const grow = easeIn(clamp(p / 0.6));
        flood.style.transform = `scale(${grow * cover})`;
        label.style.opacity = String(1 - clamp((p - 0.5) / 0.12));
        const show = clamp((p - 0.62) / 0.2);
        reveal.style.opacity = String(show);
        reveal.style.transform = `scale(${0.92 + 0.08 * show})`;
      },
      { target: handoff, offset: ["start start", "end end"] }
    );
  }
})();
