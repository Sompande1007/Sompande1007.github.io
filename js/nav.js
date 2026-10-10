// Navbar island.
//  - Shows where you are: the label of the section on screen (data-where),
//    morphing to the next one as you scroll into it.
//  - Highlights the matching link in the menu.
//  - On touch screens, its menu button opens a full-screen menu.
(() => {
  const island = document.querySelector("[data-nav-bar]");
  if (!island) return;
  const label = island.querySelector("[data-where]");
  const menu = document.getElementById("menu");
  const openBtn = island.querySelector(".island__menu-btn");
  const closeBtn = menu && menu.querySelector(".menu__close");
  const M = window.Motion;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sections = Array.from(document.querySelectorAll("[data-where]")).filter((el) => el !== label);
  // Which menu link belongs to which section (all chapters count as "Work").
  const NAV_FOR = { about: "about", engineer: "work", builder: "work", founder: "work", experience: "experience", contact: "contact" };
  const links = Array.from(document.querySelectorAll("[data-nav]"));

  /* ---------- Current section ---------- */

  let current = null;
  function update() {
    // The last section whose top has passed the middle of the screen.
    const middle = window.innerHeight / 2;
    let active = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= middle) active = s;
    }
    if (active === current) return;
    current = active;
    setLabel(active.dataset.where);
    const key = NAV_FOR[active.id] || null;
    for (const link of links) {
      const on = link.dataset.nav === key;
      link.classList.toggle("is-current", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }

  // The label slides out and the new one slides in.
  let swap = 0;
  function setLabel(text) {
    if (label.textContent === text) return;
    if (!M || reduceMotion) {
      label.textContent = text;
      return;
    }
    const mine = ++swap;
    M.animate(label, { opacity: 0, y: -8 }, { duration: 0.14, ease: "easeIn" }).then(() => {
      if (mine !== swap) return;
      label.textContent = text;
      M.animate(label, { opacity: [0, 1], y: [8, 0] }, { type: "spring", bounce: 0.35, visualDuration: 0.3 });
    });
  }

  let queued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    },
    { passive: true }
  );
  window.addEventListener("resize", update);
  update();

  /* ---------- Full-screen menu (touch screens) ---------- */

  if (!menu || !openBtn) return;
  const menuLinks = Array.from(menu.querySelectorAll(".menu__links li"));
  const wave = menu.querySelector(".menu__wave");

  function open() {
    menu.hidden = false;
    openBtn.setAttribute("aria-expanded", "true");
    document.documentElement.style.overflow = "hidden";
    if (window.lenis) window.lenis.stop();
    if (M && !reduceMotion) {
      M.animate(menu, { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"] }, { duration: 0.5, ease: [0.65, 0, 0.15, 1] });
      menuLinks.forEach((li, i) =>
        M.animate(li, { opacity: [0, 1], y: [40, 0] }, { delay: 0.18 + i * 0.06, type: "spring", bounce: 0.3, visualDuration: 0.45 })
      );
      if (wave) M.animate(wave, { y: [120, 0], rotate: [-16, -6] }, { delay: 0.35, type: "spring", bounce: 0.4, visualDuration: 0.5 });
    }
    closeBtn.focus();
  }

  function close() {
    openBtn.setAttribute("aria-expanded", "false");
    document.documentElement.style.overflow = "";
    if (window.lenis) window.lenis.start();
    const done = () => {
      menu.hidden = true;
      openBtn.focus({ preventScroll: true });
    };
    if (M && !reduceMotion) {
      M.animate(menu, { clipPath: ["inset(0 0 0% 0)", "inset(0 0 100% 0)"] }, { duration: 0.35, ease: [0.65, 0, 0.35, 1] }).then(done);
    } else {
      done();
    }
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) close();
  });
  // Choosing a section closes the menu; the link's normal scroll carries on.
  for (const a of menu.querySelectorAll(".menu__links a")) {
    a.addEventListener("click", () => close());
  }
})();
