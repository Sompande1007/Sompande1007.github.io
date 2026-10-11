// Contact.
//  - The form: posts to Som's Apps Script web app (scripts/contact-form.gs),
//    which emails the message to his inbox with the sender as reply-to.
//    Works with or without motion.
//  - The arrival (Motion): the navbar island glides to the centre and grows
//    into the contact card; the card's content arrives once it has grown.
//    Scroll-linked, so scrolling back up shrinks it into the navbar again.
(() => {
  const section = document.querySelector("[data-contact]");
  if (!section) return;

  /* ---------- The form ---------- */

  const form = section.querySelector(".ct__form");
  const done = section.querySelector(".ct__done");
  const status = section.querySelector(".ct__status");
  const send = section.querySelector(".ct__send");
  const again = section.querySelector(".ct__again");
  const fields = Array.from(form.querySelectorAll(".ct__field"));
  const endpoint = form.dataset.endpoint;
  let startedAt = 0; // when the visitor started writing (bots are faster)

  form.addEventListener("focusin", () => {
    if (!startedAt) startedAt = performance.now();
  });

  function check() {
    let ok = true;
    for (const f of fields) {
      const input = f.querySelector("input, textarea");
      const value = input.value.trim();
      const bad = !value || (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      f.classList.toggle("is-invalid", bad);
      input.setAttribute("aria-invalid", String(bad));
      if (bad && ok) input.focus();
      ok = ok && !bad;
    }
    return ok;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    if (!check()) {
      status.textContent = "Please fill in your name, a valid email and a message.";
      return;
    }
    if (!endpoint) {
      status.textContent = "Messages can't be sent just yet. Please reach out on LinkedIn for now.";
      return;
    }
    const data = new URLSearchParams(new FormData(form));
    data.set("elapsed", String(Math.round(performance.now() - (startedAt || performance.now()))));
    send.disabled = true;
    const label = send.innerHTML;
    send.textContent = "Sending…";
    try {
      const res = await fetch(endpoint, { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "failed");
      form.hidden = true;
      done.hidden = false;
      done.querySelector(".ct__again").focus({ preventScroll: true });
    } catch (err) {
      status.textContent =
        String(err.message) === "busy"
          ? "Lots of messages right now. Please try again in a little while."
          : "That didn't go through. Please try again, or reach out on LinkedIn.";
    } finally {
      send.disabled = false;
      send.innerHTML = label;
    }
  });

  again.addEventListener("click", () => {
    form.reset();
    fields.forEach((f) => f.classList.remove("is-invalid"));
    status.textContent = "";
    startedAt = 0;
    done.hidden = true;
    form.hidden = false;
    form.querySelector("input").focus({ preventScroll: true });
  });

  /* ---------- The arrival ---------- */

  const M = window.Motion;
  if (!M || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const stage = section.querySelector(".ct__stage");
  const shell = section.querySelector(".ct__shell");
  const pill = section.querySelector(".ct__pill");
  const card = section.querySelector(".ct__card");
  const head = section.querySelector(".ct__head");
  const foot = section.querySelector(".ct__foot");
  const root = document.documentElement;

  // Pin only where the whole stage fits on one screen.
  let pinned = false;
  let from = { x: 0, y: 16, w: 160, h: 46 }; // the navbar island
  let to = { x: 0, y: 0, w: 0, h: 0 }; // the card
  function layout() {
    section.classList.add("is-pinned");
    const fits = card.offsetHeight + head.offsetHeight + 200 < window.innerHeight;
    pinned = fits;
    section.classList.toggle("is-pinned", fits);
    if (!pinned) {
      card.style.opacity = card.style.transform = card.style.pointerEvents = "";
      head.style.opacity = foot.style.opacity = "";
      return;
    }
    card.style.transform = "";
    const s = stage.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    to = { x: c.left - s.left, y: c.top - s.top, w: c.width, h: c.height };
    const bar = document.querySelector(".island__bar");
    const b = bar ? bar.getBoundingClientRect() : null;
    const w = b && b.width ? b.width : 160;
    const h = b && b.height ? b.height : 46;
    from = { x: (s.width - w) / 2, y: 16, w, h };
    shell.style.width = `${to.w}px`;
    shell.style.height = `${to.h}px`;
    render(last);
  }

  let last = 0;
  function render(p) {
    last = p;
    if (!pinned) return;
    // 1. The island drops and grows into the card's shape.
    const s = easeInOut(clamp01((p - 0.04) / 0.5));
    const x = lerp(from.x, to.x, s);
    const y = lerp(from.y, to.y, s);
    const sx = lerp(from.w, to.w, s) / to.w;
    const sy = lerp(from.h, to.h, s) / to.h;
    const r = lerp(from.h / 2, 36, s);
    shell.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    shell.style.borderRadius = `${(r / sx).toFixed(1)}px / ${(r / sy).toFixed(1)}px`;
    // The pill's face and label ride in the middle of it, fading as it grows.
    const cx = x + (to.w * sx) / 2;
    const cy = y + (to.h * sy) / 2;
    pill.style.transform = `translate(calc(${cx.toFixed(1)}px - 50%), calc(${cy.toFixed(1)}px - 50%)) scale(${(1 + s * 0.4).toFixed(3)})`;
    // Before the section reaches the top, the real navbar island is still in
    // charge: the stand-in (shell and pill) stays invisible until it sits
    // exactly over the island and can take its place.
    const arrived = p > 0;
    shell.style.opacity = arrived ? "1" : "0";
    pill.style.opacity = arrived ? String(1 - clamp01(s / 0.35)) : "0";
    // 2. The card's content arrives once the shape is there.
    const c = clamp01((p - 0.56) / 0.12);
    card.style.opacity = String(c);
    card.style.transform = `translateY(${((1 - c) * 14).toFixed(1)}px)`;
    card.style.pointerEvents = c > 0.9 ? "" : "none";
    head.style.opacity = String(clamp01((p - 0.1) / 0.3));
    foot.style.opacity = String(c);
    // The real island steps aside while its double is on the move.
    root.classList.toggle("is-contacting", p > 0 && s < 0.98);
  }

  M.scroll(render, { target: section, offset: ["start start", "end end"] });
  window.addEventListener("resize", layout);
  // The card changes height (sent / errors): keep the shape matched to it.
  let resizing = false;
  new ResizeObserver(() => {
    if (resizing) return;
    resizing = true;
    requestAnimationFrame(() => {
      resizing = false;
      layout();
    });
  }).observe(card);
  layout();
  if (document.fonts) document.fonts.ready.then(layout);
})();
