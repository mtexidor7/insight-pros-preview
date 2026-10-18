// Insight Pros: scroll choreography, interactions and the WebGL core.
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileMQ = window.matchMedia("(max-width: 760px)");
const isMobile = () => mobileMQ.matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Wait for deferred libs (gsap, ScrollTrigger, Lenis)
function libsReady() {
  return new Promise((resolve) => {
    const check = () => (window.gsap && window.ScrollTrigger ? resolve() : setTimeout(check, 16));
    check();
  });
}

let core = null;
let lenis = null;

async function boot() {
  await libsReady();
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // ---------------------------------------------------------------- WebGL core
  if (!reduced) {
    try {
      const { createCore } = await import("./core.js");
      core = createCore($(".stage"), { mobile: isMobile() });
    } catch (e) {
      core = null;
    }
  }
  if (!core) document.documentElement.classList.add("no-webgl");

  // ---------------------------------------------------------------- Smooth scroll
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  setupNav(gsap);
  setupCursor(gsap);
  setupManifesto(ScrollTrigger);
  setupLeak(gsap, ScrollTrigger);
  setupVoice(gsap, ScrollTrigger);
  setupAnswer(gsap, ScrollTrigger);
  setupServices(gsap, ScrollTrigger);
  setupProof(gsap, ScrollTrigger);
  setupProcess(gsap, ScrollTrigger);
  setupLazyVideos();
  setupReveals(gsap, ScrollTrigger);
  setupScenes(gsap, ScrollTrigger);
  setupMarquee(gsap);

  await runLoader(gsap);
  heroIntro(gsap, ScrollTrigger);
  lenis && lenis.start();
  window.__insight = { lenis, core };
  ScrollTrigger.refresh();
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// ================================================================== Loader
function runLoader(gsap) {
  return new Promise((resolve) => {
    const loader = $(".loader");
    const out = $("[data-count]");
    const finish = () => {
      document.body.classList.remove("is-loading");
      loader.classList.add("is-done");
      gsap.to(loader, {
        clipPath: "inset(0 0 100% 0)",
        duration: reduced ? 0.01 : 1.1,
        ease: "expo.inOut",
        onComplete: () => { loader.remove(); },
      });
      setTimeout(resolve, reduced ? 0 : 450);
    };
    if (reduced) return finish();
    gsap.set(loader, { clipPath: "inset(0 0 0% 0)" });
    const counter = { v: 0 };
    const loaded = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
    const cap = new Promise((r) => setTimeout(r, 3500));
    gsap.to(counter, {
      v: 86, duration: 1.1, ease: "power2.out",
      onUpdate: () => (out.textContent = String(Math.round(counter.v)).padStart(3, "0")),
    });
    Promise.race([loaded, cap]).then(() => {
      gsap.to(counter, {
        v: 100, duration: 0.45, delay: 0.6, ease: "power2.inOut",
        onUpdate: () => (out.textContent = String(Math.round(counter.v)).padStart(3, "0")),
        onComplete: finish,
      });
    });
  });
}

function heroIntro(gsap, ScrollTrigger) {
  const lines = $$(".hero__title .line__in");
  const ups = $$(".hero .reveal-up");
  if (reduced) return;
  gsap.from(lines, { yPercent: 110, rotate: 3, duration: 1.3, ease: "expo.out", stagger: 0.09 });
  gsap.from(ups, { y: 26, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.08, delay: 0.35 });
  gsap.from(".nav > *", { y: -30, opacity: 0, duration: 1, ease: "expo.out", delay: 0.4 });
  if (core) gsap.from(core.state, { scale: 0.2, alpha: 0, duration: 2.2, ease: "expo.out" });

  // scroll-out: lines slide apart like a lens pulling focus
  const tl = gsap.timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } });
  lines.forEach((el, i) => tl.to(el, { xPercent: i % 2 ? 22 : -18, ease: "none" }, 0));
  tl.to(".hero__foot, .kicker", { y: -60, opacity: 0, ease: "none" }, 0);
}

// ================================================================== Nav + menu
function setupNav(gsap) {
  const nav = $(".nav");
  const btn = $(".menu-btn");
  const root = document.documentElement;
  const toggle = (open) => {
    const isOpen = open ?? !root.classList.contains("menu-open");
    root.classList.toggle("menu-open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
    btn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    if (lenis) isOpen ? lenis.stop() : lenis.start();
    if (isOpen && !reduced) gsap.from(".menu__links li", { y: 40, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.05, delay: 0.25 });
  };
  btn.addEventListener("click", () => toggle());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("menu-open")) toggle(false); });

  // in-page anchors through Lenis
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (root.classList.contains("menu-open")) toggle(false);
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
      else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY, behavior: reduced ? "auto" : "smooth" });
    });
  });

  // hide on scroll down, reveal on scroll up
  let last = 0;
  const onScroll = (y) => {
    if (root.classList.contains("menu-open")) return;
    const down = y > last && y > 200;
    nav.classList.toggle("is-hidden", down);
    last = y;
  };
  if (lenis) lenis.on("scroll", ({ scroll }) => onScroll(scroll));
  else window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });
}

// ================================================================== Cursor + magnetic
function setupCursor(gsap) {
  if (!finePointer || reduced) return;
  document.documentElement.classList.add("has-cursor");
  const cur = $(".cursor");
  const label = $(".cursor__label");
  const dotX = gsap.quickTo(".cursor__dot", "x", { duration: 0.12, ease: "power3" });
  const dotY = gsap.quickTo(".cursor__dot", "y", { duration: 0.12, ease: "power3" });
  const ringX = gsap.quickTo(".cursor__ring", "x", { duration: 0.45, ease: "power3" });
  const ringY = gsap.quickTo(".cursor__ring", "y", { duration: 0.45, ease: "power3" });
  window.addEventListener("pointermove", (e) => { dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY); }, { passive: true });

  $$("[data-cursor]").forEach((el) => {
    el.addEventListener("pointerenter", () => { label.textContent = el.dataset.cursor; cur.classList.add("is-hover"); });
    el.addEventListener("pointerleave", () => cur.classList.remove("is-hover"));
  });

  $$(".magnetic").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.25);
      yTo((e.clientY - r.top - r.height / 2) * 0.3);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

// ================================================================== Manifesto word fill
function splitWords(root) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  walk(root);
  return $$(".w", root);
}

function setupManifesto(ScrollTrigger) {
  const el = $("[data-fill]");
  const words = splitWords(el);
  if (reduced) { words.forEach((w) => w.classList.add("is-on")); return; }
  ScrollTrigger.create({
    trigger: el, start: "top 80%", end: "bottom 45%", scrub: true,
    onUpdate: (self) => {
      const n = Math.round(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle("is-on", i < n));
    },
  });
}

// ================================================================== Missed-call calculator
function setupLeak(gsap, ScrollTrigger) {
  const input = $("#calls");
  const out = $("[data-calls-out]");
  const loss = $("[data-loss]");
  const val = { v: 0 };
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const render = (animate = true) => {
    const n = +input.value;
    out.textContent = n;
    input.style.setProperty("--p", ((n - +input.min) / (+input.max - +input.min)) * 100 + "%");
    const target = n * 100 * 52;
    gsap.to(val, { v: target, duration: animate && !reduced ? 0.8 : 0, ease: "power3.out", onUpdate: () => (loss.textContent = fmt(val.v)) });
    if (core) gsap.fromTo(core.state, { pulse: 1.2 }, { pulse: 0, duration: 1.2, ease: "power2.out" });
  };
  input.addEventListener("input", () => render());
  input.style.setProperty("--p", ((+input.value - 1) / 39) * 100 + "%");
  loss.textContent = "0";
  ScrollTrigger.create({ trigger: ".leak", start: "top 70%", once: true, onEnter: () => render() });
}

// ================================================================== Voice film (scroll-scrubbed video)
function setupVoice(gsap, ScrollTrigger) {
  const section = $(".voice");
  const video = $(".voice__video");
  const steps = $$(".step");
  const bar = $(".voice__progress i");
  video.src = isMobile() ? "assets/video/voice-m.mp4" : "assets/video/voice.mp4";
  video.load();

  // iOS needs a user gesture before seeking paints frames
  const prime = () => {
    const p = video.play();
    if (p && p.then) p.then(() => video.pause()).catch(() => {});
    window.removeEventListener("touchstart", prime);
  };
  window.addEventListener("touchstart", prime, { passive: true, once: true });

  if (reduced) return;

  let target = 0;
  let current = 0;
  let active = -1;
  const setStep = (i) => {
    if (i === active) return;
    steps.forEach((s, k) => {
      // outgoing caption clears first; incoming waits so the two never overlap
      if (k === i) gsap.to(s, { opacity: 1, y: 0, duration: 0.6, delay: active === -1 ? 0 : 0.28, ease: "expo.out", overwrite: true });
      else gsap.to(s, { opacity: 0, y: k < i ? -24 : 24, duration: 0.25, ease: "power2.in", overwrite: true });
    });
    active = i;
  };
  setStep(0);

  ScrollTrigger.create({
    trigger: section, start: "top top", end: "bottom bottom", scrub: true,
    onUpdate: (self) => {
      target = self.progress;
      bar.style.transform = `scaleY(${self.progress})`;
      setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999)));
    },
  });

  // smooth the seek on the ticker
  gsap.ticker.add(() => {
    if (!video.duration) return;
    current += (target - current) * 0.12;
    const t = current * (video.duration - 0.05);
    if (Math.abs(video.currentTime - t) > 0.01) {
      try { video.currentTime = t; } catch (e) {}
    }
  });

  gsap.from(".voice__head > *", {
    y: 40, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.1,
    scrollTrigger: { trigger: section, start: "top 60%" },
  });
}

// ================================================================== Answer engines: noise converging into one answer
function setupAnswer(gsap, ScrollTrigger) {
  const wrap = $(".queries");
  const chips = $$(".q", wrap);
  const card = $(".answer-card");
  const place = () => {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const cols = isMobile() ? 1 : 2;
    const rows = Math.ceil(chips.length / cols);
    chips.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const free = Math.max(0, w - c.offsetWidth);
      const x = cols === 1
        ? free * [0.05, 0.6, 0.25, 0.85, 0.1, 0.5, 0.3, 0.75][i % 8]
        : col * (w / 2) + ((row % 2) ? w * 0.12 : 0) + (i * 37 % 40);
      const y = (row / rows) * (h - 40) + (cols === 1 ? 0 : (i * 13) % 14);
      c.style.left = Math.min(Math.max(0, x), free) + "px";
      c.style.top = y + "px";
      c.style.animation = `chipfloat ${5 + (i % 4)}s ease-in-out ${-i * 0.7}s infinite alternate`;
    });
  };
  place();
  window.addEventListener("resize", place);

  if (reduced) return;

  const tl = gsap.timeline({ scrollTrigger: { trigger: ".answer__stage", start: "top 70%", end: "bottom 25%", scrub: 1, invalidateOnRefresh: true } });
  tl.to({}, { duration: 0.35 });
  chips.forEach((c, i) => {
    tl.to(c, {
      x: () => {
        const cr = card.getBoundingClientRect(), r = c.getBoundingClientRect();
        return cr.left + cr.width / 2 - (r.left - (gsap.getProperty(c, "x") || 0) + r.width / 2);
      },
      y: () => {
        const cr = card.getBoundingClientRect(), r = c.getBoundingClientRect();
        return cr.top + cr.height / 2 - (r.top - (gsap.getProperty(c, "y") || 0) + r.height / 2);
      },
      scale: 0.3, opacity: 0, ease: "power2.in",
    }, 0.35 + i * 0.06);
  });
  tl.fromTo(card, { opacity: 0.15, scale: 0.94, filter: "blur(6px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", ease: "power2.out", duration: 0.5 }, 0.75);

  gsap.from(".answer .display span", {
    yPercent: 60, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: ".answer", start: "top 70%" },
  });
}

// ================================================================== Services
function setupServices(gsap, ScrollTrigger) {
  const items = $$(".svc__item");
  const float = $(".svc__float");
  const img = $("img", float);
  items.forEach((item) => {
    const btn = $(".svc__row", item);
    btn.addEventListener("click", () => {
      const open = !item.classList.contains("is-open");
      items.forEach((o) => { o.classList.remove("is-open"); $(".svc__row", o).setAttribute("aria-expanded", "false"); });
      item.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      setTimeout(() => ScrollTrigger.refresh(), 600);
    });
    if (finePointer) {
      btn.addEventListener("pointerenter", () => { img.src = item.dataset.img; float.classList.add("is-on"); });
      btn.addEventListener("pointerleave", () => float.classList.remove("is-on"));
    }
  });
  if (finePointer) {
    const xTo = gsap.quickTo(float, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(float, "y", { duration: 0.6, ease: "power3" });
    // preview lives in a fixed lane on the right (left of the +/- buttons) and only tracks vertically
    const laneX = () => window.innerWidth - 260 - 44 - Math.max(16, Math.min(56, window.innerWidth * 0.04)) - 24;
    window.addEventListener("pointermove", (e) => {
      xTo(laneX());
      yTo(Math.min(Math.max(e.clientY - 160, 90), window.innerHeight - 350));
    }, { passive: true });
  }
  // preload the preview images once services are near
  ScrollTrigger.create({ trigger: ".services", start: "top bottom", once: true, onEnter: () => items.forEach((i) => { const im = new Image(); im.src = i.dataset.img; }) });

  if (!reduced) {
    gsap.from(".svc__item", {
      y: 50, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.07,
      scrollTrigger: { trigger: ".svc", start: "top 80%" },
    });
  }
}

// ================================================================== Proof field + testimonials
function setupProof(gsap, ScrollTrigger) {
  if (!reduced) {
    $$(".ph").forEach((ph) => {
      const speed = parseFloat(ph.dataset.speed || 0);
      gsap.fromTo(ph, { y: () => -speed * 300 }, {
        y: () => speed * 300, ease: "none",
        scrollTrigger: { trigger: ".proof", start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
      gsap.from($("img", ph), { scale: 1.25, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ph, start: "top 95%" } });
    });
  }

  const quotes = $$(".quote");
  const idx = $("[data-qi]");
  let i = 0;
  let timer;
  const show = (n) => {
    i = (n + quotes.length) % quotes.length;
    quotes.forEach((q, k) => q.classList.toggle("is-active", k === i));
    idx.textContent = String(i + 1).padStart(2, "0");
  };
  const auto = () => { clearInterval(timer); if (!reduced) timer = setInterval(() => show(i + 1), 8000); };
  $$(".qbtn").forEach((b) => b.addEventListener("click", () => { show(i + +b.dataset.dir); auto(); }));
  const box = $(".quotes");
  box.addEventListener("pointerenter", () => clearInterval(timer));
  box.addEventListener("pointerleave", auto);
  box.addEventListener("focusin", () => clearInterval(timer));
  auto();
}

// ================================================================== Process: horizontal track on desktop
function setupProcess(gsap, ScrollTrigger) {
  if (reduced) return;
  const mm = gsap.matchMedia();
  mm.add("(min-width: 761px)", () => {
    const track = $(".track");
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: { trigger: ".process__pin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true },
    });
  });
  mm.add("(max-width: 760px)", () => {
    $$(".card").forEach((c) => gsap.from(c, { y: 60, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: c, start: "top 88%" } }));
  });
}

// ================================================================== Generic reveals
function setupReveals(gsap, ScrollTrigger) {
  if (reduced) return;
  $$(".leak .label, .leak__big, .leak__copy > *, .services__head > *, .process__head > *, .faq__head > *, .proof__inner > .label, .proof__lede, .defs .def, .principles").forEach((el) => {
    gsap.from(el, { y: 44, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
  });
  gsap.from("details", { y: 30, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.06, scrollTrigger: { trigger: ".faq__list", start: "top 85%" } });
  gsap.from(".proof .display span", { yPercent: 50, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".proof .display", start: "top 85%" } });
  gsap.from(".quotes", { y: 60, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".quotes", start: "top 90%" } });

  // CTA lines rise
  gsap.from(".cta__title .line__in", { yPercent: 110, duration: 1.3, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: ".cta", start: "top 55%" } });
  gsap.from(".cta__btn, .cta__contact a, .cta .label", { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: ".cta", start: "top 45%" } });

  // footer wordmark draws in
  gsap.from(".footer__big", { yPercent: 40, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".footer", start: "top 95%" } });
}

// ================================================================== Lazy loop videos
function setupLazyVideos() {
  const vids = $$("[data-lazy-video]");
  const load = (v) => {
    if (v.dataset.loaded) return;
    const srcs = $$("source", v);
    const pick = isMobile() ? srcs[0] : srcs[1] || srcs[0];
    v.src = pick.dataset.src;
    v.dataset.loaded = "1";
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) {
        load(v);
        if (!reduced) v.play().catch(() => {});
      } else if (v.dataset.loaded) v.pause();
    });
  }, { rootMargin: "300px 0px" });
  vids.forEach((v) => io.observe(v));
}

// ================================================================== Marquee
function setupMarquee(gsap) {
  const track = $(".marquee__track");
  if (reduced) return;
  const loop = gsap.to(track, { xPercent: -50, duration: 22, ease: "none", repeat: -1 });
  if (lenis) {
    lenis.on("scroll", ({ velocity }) => {
      const v = Math.min(4, Math.abs(velocity) * 0.18);
      gsap.to(loop, { timeScale: (velocity < 0 ? -1 : 1) * (1 + v), duration: 0.3, overwrite: true });
    });
  }
}

// ================================================================== Core choreography per section
function setupScenes(gsap, ScrollTrigger) {
  if (!core) return;
  const m = isMobile();
  const S = {
    hero: { morph: 0, x: m ? 0.4 : 2.4, y: m ? 1.3 : 0.15, scale: m ? 1.05 : 1, alpha: 1 },
    manifesto: { morph: 0, x: 0, y: 0, scale: 1.75, alpha: 0.32 },
    leak: { morph: 1, x: 0, y: m ? 2.6 : -0.4, scale: m ? 0.55 : 1, alpha: 0.6 },
    voice: { morph: 1, x: 0, y: 0, scale: 1, alpha: 0 },
    answer: { morph: 2, x: 0, y: m ? -1 : -0.2, scale: m ? 0.7 : 1, alpha: 0.6 },
    services: { morph: 2, x: 0, y: 0, scale: 1, alpha: 0 },
    proof: { morph: 0, x: 0, y: 0, scale: m ? 1 : 1.25, alpha: 0.32 },
    process: { morph: 3, x: m ? 0 : 3, y: m ? 2.2 : 0.4, scale: m ? 0.6 : 0.9, alpha: 0.5 },
    faq: { morph: 3, x: m ? 0 : -3.6, y: 0, scale: 0.75, alpha: 0.28 },
    contact: { morph: 3, x: 0, y: m ? 1 : 0, scale: m ? 0.85 : 1.25, alpha: 0.4 },
  };
  const map = [
    [".hero", "hero"], [".manifesto", "manifesto"], [".leak", "leak"], [".voice", "voice"],
    [".answer", "answer"], [".services", "services"], [".proof", "proof"], [".process", "process"],
    [".faq", "faq"], [".cta", "contact"],
  ];
  const stage = $(".stage");
  const nav = $(".nav");
  const cursor = $(".cursor");
  let hideTimer;
  const go = (key) => {
    const s = S[key];
    gsap.to(core.state, { morph: s.morph, x: s.x, y: s.y, scale: s.scale, alpha: s.alpha, duration: 1.8, ease: "expo.inOut", overwrite: "auto" });
    const hidden = s.alpha === 0;
    stage.classList.toggle("is-hidden", hidden);
    clearTimeout(hideTimer);
    if (hidden) hideTimer = setTimeout(() => core.setVisible(false), 900);
    else core.setVisible(true);
    const light = key === "services";
    nav.classList.toggle("on-light", light);
    cursor.classList.toggle("on-light", light);
  };
  map.forEach(([sel, key]) => {
    ScrollTrigger.create({
      trigger: sel, start: "top 55%", end: "bottom 55%",
      onToggle: (self) => self.isActive && go(key),
    });
  });
  // background contour drift with scroll
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => (core.state.scroll = self.progress * 3) });
}

boot();
