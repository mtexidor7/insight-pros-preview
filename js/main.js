// Insight Pros: scroll choreography, interactions, inquiry form, sound and the WebGL globe.
import { createSound } from "./sound.js?v=20261024";
import { SITE_CONFIG } from "./config.js?v=20261024";
import { setupVoiceOrb } from "./voice-orb.js?v=20261024";
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileMQ = window.matchMedia("(max-width: 760px)");
const isMobile = () => mobileMQ.matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const root = document.documentElement;

// Analytics hook: only reports when an approved analytics system (dataLayer) is present on the page.
function track(event, data = {}) {
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event, ...data });
}

function libsReady() {
  return new Promise((resolve) => {
    const check = () => (window.gsap && window.ScrollTrigger ? resolve() : setTimeout(check, 16));
    check();
  });
}

let core = null;
let lenis = null;
let marqueeLoop = null;
const motionListeners = [];
const motionPaused = () => root.classList.contains("motion-paused");

async function boot() {
  await libsReady();
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  if (!reduced) {
    try {
      const { createCore } = await import("./core.js?v=20261023c");
      core = createCore($(".stage"), { mobile: isMobile() });
    } catch (e) {
      core = null;
    }
  }
  if (!core) root.classList.add("no-webgl");

  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  setupNav(gsap, ScrollTrigger);
  setupCursor(gsap);
  setupServiceLinks();
  setupChatDemo();
  setupDashboard();
  setupVoice(gsap, ScrollTrigger);
  setupEstimate();
  setupSearch(gsap);
  setupProcess(gsap);
  setupLazyVideos();
  setupReveals(gsap);
  setupScenes(gsap, ScrollTrigger);
  setupMarquee(gsap);
  setupForm();
  setupMotionToggle();
  setupSound(ScrollTrigger);
  setupVoiceOrb({ track });
  setupPromo();
  $$("[data-track]").forEach((el) => el.addEventListener("click", () => track(el.dataset.track, { location: el.closest("section")?.id || "nav" })));

  await runLoader(gsap);
  heroIntro(gsap);
  lenis && lenis.start();
  window.__insight = { lenis, core };
  ScrollTrigger.refresh();
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// ================================================================== Loader
function runLoader(gsap) {
  return new Promise((resolve) => {
    const loader = $(".loader");
    const bar = $("[data-count-bar]");
    const finish = () => {
      document.body.classList.remove("is-loading");
      loader.classList.add("is-done");
      gsap.to(loader, { autoAlpha: 0, duration: reduced ? 0.01 : 0.6, ease: "power2.out", onComplete: () => loader.remove() });
      setTimeout(resolve, reduced ? 0 : 250);
    };
    if (reduced) return finish();
    const loaded = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
    const cap = new Promise((r) => setTimeout(r, 3000));
    gsap.to(bar, { scaleX: 0.85, duration: 1, ease: "power2.out" });
    Promise.race([loaded, cap]).then(() => gsap.to(bar, { scaleX: 1, duration: 0.35, ease: "power2.inOut", onComplete: finish }));
  });
}

function heroIntro(gsap) {
  if (reduced) return;
  const lines = $$(".hero__title .line__in");
  gsap.from(lines, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.08 });
  gsap.from(".hero .reveal-up", { y: 22, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.07, delay: 0.25 });
  gsap.from(".nav > *", { y: -24, opacity: 0, duration: 0.9, ease: "expo.out", delay: 0.3 });
  if (core) gsap.from(core.state, { scale: 0.2, alpha: 0, duration: 2, ease: "expo.out" });
}

// ================================================================== Nav + menu
function setupNav(gsap, ScrollTrigger) {
  const nav = $(".nav");
  const btn = $(".menu-btn");
  const toggle = (open) => {
    const isOpen = open ?? !root.classList.contains("menu-open");
    root.classList.toggle("menu-open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
    btn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    if (lenis) isOpen ? lenis.stop() : lenis.start();
    if (isOpen) {
      if (!reduced) gsap.from(".menu__links li", { y: 30, opacity: 0, duration: 0.6, ease: "expo.out", stagger: 0.05, delay: 0.2 });
      setTimeout(() => $(".menu__links a")?.focus(), 250);
    } else {
      btn.focus();
    }
  };
  btn.addEventListener("click", () => toggle());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("menu-open")) toggle(false); });

  // in-page anchors through Lenis
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#") return;
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (root.classList.contains("menu-open")) toggle(false);
      if (target !== 0 && target.tagName === "DETAILS") target.open = true;
      if (lenis) lenis.scrollTo(target, { offset: target === 0 ? 0 : -10, duration: reduced ? 0 : 1.4 });
      else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - 60, behavior: reduced ? "auto" : "smooth" });
      history.replaceState(null, "", id === "#top" ? location.pathname : id);
    });
  });

  // hide on scroll down, reveal on scroll up; solid background once scrolled
  let last = 0;
  const onScroll = (y) => {
    nav.classList.toggle("is-scrolled", y > 40);
    if (root.classList.contains("menu-open")) return;
    last = y;
  };
  if (lenis) lenis.on("scroll", ({ scroll }) => onScroll(scroll));
  else window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });

  // active section in the desktop nav
  const links = $$(".nav__links a");
  links.forEach((link) => {
    const sec = $(link.getAttribute("href"));
    if (!sec) return;
    const ends = link.getAttribute("href") === "#work" ? $("#estimate") : sec;
    ScrollTrigger.create({
      trigger: sec, endTrigger: ends, start: "top 40%", end: "bottom 40%",
      onToggle: (self) => { link.classList.toggle("is-active", self.isActive); if (self.isActive) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current"); },
    });
  });
}

// ================================================================== Cursor + magnetic
function setupCursor(gsap) {
  if (!finePointer || reduced) return;
  root.classList.add("has-cursor");
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
      xTo((e.clientX - r.left - r.width / 2) * 0.2);
      yTo((e.clientY - r.top - r.height / 2) * 0.25);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

// ================================================================== Service CTAs pre-select the inquiry topic
function setupServiceLinks() {
  const select = $("#f-service");
  $$("[data-service]").forEach((a) => {
    a.addEventListener("click", () => {
      select.value = a.dataset.service;
      select.removeAttribute("aria-invalid");
      $("#f-service-err").textContent = "";
    });
  });
}

// ================================================================== Communication demo: one message and one caption at a time
function setupChatDemo() {
  const box = $("[data-chat]");
  if (!box) return;
  const msgs = $$(".chat__msg", box);
  const cap = $("[data-chat-caption]", box);
  const captions = ["A customer asks a question", "Details are requested", "The customer shares the details", "An appointment is requested", "The team takes over"];
  let i = -1, timer = null, inView = false;
  const show = (n) => {
    i = n % msgs.length;
    msgs.forEach((m, k) => m.classList.toggle("is-shown", k <= i));
    cap.textContent = captions[i];
  };
  if (reduced) { show(msgs.length - 1); cap.textContent = "Sample conversation"; return; }
  const run = () => {
    clearInterval(timer);
    if (!inView || motionPaused()) return;
    timer = setInterval(() => show(i + 1 >= msgs.length ? 0 : i + 1), 2200);
  };
  show(0);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; run(); }, { threshold: 0.4 }).observe(box);
  motionListeners.push((paused) => { if (paused) { clearInterval(timer); show(msgs.length - 1); } else run(); });
}

// ================================================================== Dashboard demo: status tabs
function setupDashboard() {
  const tabs = $$(".dash__tabs [role=tab]");
  const rows = $$(".dash__rows li");
  const select = (tab) => {
    tabs.forEach((t) => { const on = t === tab; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    const f = tab.dataset.filter;
    rows.forEach((r) => (r.hidden = f !== "all" && r.dataset.status !== f));
  };
  tabs.forEach((t, k) => {
    t.tabIndex = k === 0 ? 0 : -1;
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const n = tabs[(k + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); select(n);
    });
  });
  $("[data-focus-dash]")?.addEventListener("click", () => setTimeout(() => tabs[1]?.focus({ preventScroll: true }), 600));
}

// ================================================================== Walkthrough film (scroll-scrubbed), one caption at a time
function setupVoice(gsap, ScrollTrigger) {
  const section = $(".voice");
  const video = $(".voice__video");
  const steps = $$(".step");
  const bar = $(".voice__progress i");
  video.src = isMobile() ? "assets/video/voice-m.mp4" : "assets/video/voice.mp4";
  video.load();
  const prime = () => { const p = video.play(); if (p && p.then) p.then(() => video.pause()).catch(() => {}); };
  window.addEventListener("touchstart", prime, { passive: true, once: true });
  if (reduced) return;

  let target = 0, current = 0, active = -1;
  const setStep = (i) => {
    if (i === active) return;
    steps.forEach((s, k) => {
      if (k === i) gsap.to(s, { opacity: 1, y: 0, duration: 0.5, delay: active === -1 ? 0 : 0.28, ease: "expo.out", overwrite: true });
      else gsap.to(s, { opacity: 0, y: k < i ? -20 : 20, duration: 0.25, ease: "power2.in", overwrite: true });
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
  gsap.ticker.add(() => {
    if (!video.duration) return;
    current += (target - current) * 0.12;
    const t = current * (video.duration - 0.05);
    if (Math.abs(video.currentTime - t) > 0.01) { try { video.currentTime = t; } catch (e) {} }
  });
}

// ================================================================== Illustrative estimate
function setupEstimate() {
  const calls = $("#est-calls"), qual = $("#est-qual"), conv = $("#est-conv"), sale = $("#est-sale");
  const out = $("[data-est-year]");
  const fill = (el) => el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%");
  const render = () => {
    [calls, qual, conv].forEach(fill);
    $("[data-out=calls]").textContent = calls.value;
    $("[data-out=qual]").textContent = qual.value + "%";
    $("[data-out=conv]").textContent = conv.value + "%";
    const value = Math.max(0, parseFloat(sale.value) || 0);
    const year = calls.value * 52 * (qual.value / 100) * (conv.value / 100) * value;
    out.textContent = Math.round(year).toLocaleString("en-US");
  };
  [calls, qual, conv, sale].forEach((el) => el.addEventListener("input", render));
  render();
}

// ================================================================== Search visibility: scattered queries resolve into one clear answer
function setupSearch(gsap) {
  const wrap = $(".queries");
  const chips = $$(".q", wrap);
  const card = $(".answer-card");
  const place = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const cols = isMobile() ? 1 : 2;
    const rows = Math.ceil(chips.length / cols);
    chips.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const free = Math.max(0, w - c.offsetWidth);
      const x = cols === 1 ? free * [0.05, 0.6, 0.25, 0.85, 0.1, 0.5, 0.3, 0.75][i % 8] : col * (w / 2) + (row % 2 ? w * 0.12 : 0) + ((i * 37) % 40);
      c.style.left = Math.min(Math.max(0, x), free) + "px";
      c.style.top = (row / rows) * (h - 40) + "px";
      if (!reduced) c.style.animation = `chipfloat ${5 + (i % 4)}s ease-in-out ${-i * 0.7}s infinite alternate`;
    });
  };
  place();
  window.addEventListener("resize", place);
  if (reduced) return;
  const tl = gsap.timeline({ scrollTrigger: { trigger: ".answer__stage", start: "top 70%", end: "bottom 30%", scrub: 1, invalidateOnRefresh: true } });
  tl.to({}, { duration: 0.3 });
  chips.forEach((c, i) => {
    tl.to(c, {
      x: () => { const cr = card.getBoundingClientRect(), r = c.getBoundingClientRect(); return cr.left + cr.width / 2 - (r.left - (gsap.getProperty(c, "x") || 0) + r.width / 2); },
      y: () => { const cr = card.getBoundingClientRect(), r = c.getBoundingClientRect(); return cr.top + cr.height / 2 - (r.top - (gsap.getProperty(c, "y") || 0) + r.height / 2); },
      scale: 0.3, opacity: 0, ease: "power2.in",
    }, 0.3 + i * 0.05);
  });
  tl.fromTo(card, { opacity: 0.25, scale: 0.95 }, { opacity: 1, scale: 1, ease: "power2.out", duration: 0.4 }, 0.6);
}

// ================================================================== Process: horizontal track on desktop
function setupProcess(gsap) {
  if (reduced) return;
  const mm = gsap.matchMedia();
  mm.add("(min-width: 761px)", () => {
    const track = $(".track");
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: ".process__pin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
  });
}

// ================================================================== Reveals: whole blocks, quickly reach full opacity
function setupReveals(gsap) {
  if (reduced) return;
  const blocks = ".problems .label, .problems .h2, .pcard, .problems__close, .services__head > *, .scard, .audience .label, .audience .h2, .acard, .audience__line, .work .label, .work .h2, .work__intro, .wcard, .estimate .label, .estimate .h2, .estimate__copy, .calc, .about .label, .about .h2, .about__copy, .quote, .process__head > *, .answer .label, .answer .h2, .answer__copy, .faq__head > *, details, .contact__intro > *, .inquiry";
  $$(blocks).forEach((el) => {
    gsap.from(el, { y: 28, opacity: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });
}

// ================================================================== Lazy loop videos
function setupLazyVideos() {
  const vids = $$("[data-lazy-video]");
  const load = (v) => {
    if (v.dataset.loaded) return;
    const srcs = $$("source", v);
    v.src = (isMobile() ? srcs[0] : srcs[1] || srcs[0]).dataset.src;
    v.dataset.loaded = "1";
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      v._inView = e.isIntersecting;
      if (e.isIntersecting) { load(v); if (!reduced && !motionPaused()) v.play().catch(() => {}); }
      else if (v.dataset.loaded) v.pause();
    });
  }, { rootMargin: "300px 0px" });
  vids.forEach((v) => io.observe(v));
  motionListeners.push((paused) => vids.forEach((v) => { if (paused) v.pause(); else if (v._inView && v.dataset.loaded) v.play().catch(() => {}); }));
}

// ================================================================== Marquee
function setupMarquee(gsap) {
  if (reduced) return;
  marqueeLoop = gsap.to(".marquee__track", { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
  motionListeners.push((paused) => (paused ? marqueeLoop.pause() : marqueeLoop.play()));
}

// ================================================================== Globe choreography per section
function setupScenes(gsap, ScrollTrigger) {
  if (!core) return;
  const m = isMobile();
  const S = {
    hero: { morph: 0, x: m ? 0.4 : 2.6, y: m ? 1.4 : 0.2, scale: m ? 1.0 : 1, alpha: 1 },
    problems: { morph: 0, x: m ? 0 : 3.2, y: 0, scale: 1.3, alpha: 0.35 },
    services: { morph: 0, x: 0, y: 0, scale: 1, alpha: 0 },
    audience: { morph: 3, x: m ? 0 : -3.4, y: 0.4, scale: 0.8, alpha: 0.35 },
    work: { morph: 1, x: 0, y: m ? 2.4 : -1.6, scale: m ? 0.6 : 1, alpha: 0.4 },
    walkthrough: { morph: 1, x: 0, y: 0, scale: 1, alpha: 0 },
    estimate: { morph: 1, x: 0, y: m ? 2.6 : -0.4, scale: m ? 0.55 : 1, alpha: 0.5 },
    about: { morph: 0, x: m ? 0 : -3.2, y: 0, scale: 1.1, alpha: 0.3 },
    process: { morph: 3, x: m ? 0 : 3, y: m ? 2.2 : 0.4, scale: m ? 0.6 : 0.9, alpha: 0.5 },
    search: { morph: 2, x: 0, y: m ? -1 : -0.2, scale: m ? 0.7 : 1, alpha: 0.55 },
    faq: { morph: 3, x: m ? 0 : -3.6, y: 0, scale: 0.75, alpha: 0.28 },
    contact: { morph: 3, x: m ? 0 : 3.4, y: m ? 1 : 0, scale: m ? 0.8 : 1, alpha: 0.35 },
  };
  const map = [["#top", "hero"], ["#problems", "problems"], ["#services", "services"], ["#audience", "audience"], ["#work", "work"], ["#walkthrough", "walkthrough"], ["#estimate", "estimate"], ["#about", "about"], ["#process", "process"], ["#search", "search"], ["#faq", "faq"], ["#contact", "contact"]];
  const stage = $(".stage"), nav = $(".nav"), cursor = $(".cursor");
  let hideTimer, lastKey = "hero";
  const apply = (key) => {
    lastKey = key;
    const s = S[key];
    gsap.to(core.state, { morph: s.morph, x: s.x, y: s.y, scale: s.scale, alpha: s.alpha, duration: 1.6, ease: "expo.inOut", overwrite: "auto" });
    const hidden = s.alpha === 0 || motionPaused();
    stage.classList.toggle("is-hidden", s.alpha === 0);
    clearTimeout(hideTimer);
    if (hidden) hideTimer = setTimeout(() => core.setVisible(false), s.alpha === 0 ? 900 : 0);
    else core.setVisible(true);
    nav.classList.toggle("on-light", key === "services");
    cursor.classList.toggle("on-light", key === "services");
  };
  map.forEach(([sel, key]) => ScrollTrigger.create({ trigger: sel, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && apply(key) }));
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => (core.state.scroll = self.progress * 3) });
  motionListeners.push((paused) => {
    if (paused) { core.setVisible(false); }
    else apply(lastKey);
  });
}

// ================================================================== Sound (off by default, toggle at the top)
function setupSound(ScrollTrigger) {
  const sound = createSound();
  const btns = $$("[data-sound-toggle]");
  const KEY = "ip-sound-on";
  const render = (on) => btns.forEach((b) => {
    b.setAttribute("aria-pressed", String(on));
    $(".sound-toggle__label", b).textContent = on ? "Sound on" : "Sound off";
    b.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
  });
  const save = (on) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {} };
  let autoStart = null;
  const clearAuto = () => { if (autoStart) { window.removeEventListener("pointerdown", autoStart); window.removeEventListener("keydown", autoStart); autoStart = null; } };
  const turnOn = async () => { clearAuto(); render(true); const ok = await sound.enable(); if (sound.enabled) { save(true); track("sound_on"); setTimeout(() => window.dispatchEvent(new Event("ip-sound-resync")), 50); } else render(false); };
  const turnOff = () => { clearAuto(); sound.disable(); render(false); save(false); track("sound_off"); };
  render(false);
  btns.forEach((b) => b.addEventListener("click", () => (sound.enabled ? turnOff() : turnOn())));

  // Returning visitors who left sound on: browsers need a click or key press before audio can start
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "1") {
    autoStart = (e) => {
      if (e.target.closest && e.target.closest("[data-sound-toggle]")) return;
      turnOn();
    };
    window.addEventListener("pointerdown", autoStart); window.addEventListener("keydown", autoStart);
  }

  // score follows the sections and the scroll speed
  [["#top", "hero"], ["#problems", "problems"], ["#services", "services"], ["#audience", "audience"], ["#work", "work"], ["#walkthrough", "walkthrough"], ["#estimate", "estimate"], ["#about", "about"], ["#process", "process"], ["#search", "search"], ["#faq", "faq"], ["#contact", "contact"]]
    .forEach(([sel, key]) => ScrollTrigger.create({ trigger: sel, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && sound.section(key) }));
  // live voice demo: switch the site sound off for the call, restore it afterwards
  let resumeAfterCall = false;
  window.addEventListener("ip-voice-start", () => { if (sound.enabled) { resumeAfterCall = true; sound.disable(); render(false); } });
  window.addEventListener("ip-voice-end", () => { if (resumeAfterCall) { resumeAfterCall = false; turnOn(); } });

  // phone walkthrough: ring as the section arrives, then follow the scroll-scrubbed steps
  let wtIn = false, wtP = 0;
  window.addEventListener("ip-sound-resync", () => wtUpdate());
  const wtUpdate = () => {
    const steps = 4;
    const step = Math.min(steps - 1, Math.floor(wtP * steps * 0.999));
    sound.walkthrough(wtIn, step, Math.min(1, (wtP * steps) % 1 || (wtP > 0 ? 1 : 0)));
  };
  ScrollTrigger.create({ trigger: "#walkthrough", start: "top 70%", end: "bottom 30%", onToggle: (self) => { wtIn = self.isActive; wtUpdate(); } });
  ScrollTrigger.create({ trigger: "#walkthrough", start: "top top", end: "bottom bottom", onUpdate: (self) => { wtP = self.progress; if (wtIn) wtUpdate(); } });
  if (lenis) lenis.on("scroll", ({ velocity }) => { sound.velocity(velocity); sound.walkthroughSpeed(velocity); });
  else { let lastY = window.scrollY; window.addEventListener("scroll", () => { sound.velocity((window.scrollY - lastY) / 4); lastY = window.scrollY; }, { passive: true }); }

  // quiet interface sounds
  const interactive = "a, button:not([role=tab]), summary, input[type=range]";
  const selectable = "[role=tab], details > summary, .pcard, .scard, .acard, .wcard, .quote, .card, .dash__rows li";
  if (finePointer) document.addEventListener("pointerover", (e) => {
    const el = e.target.closest(interactive);
    if (el) { if (!el.contains(e.relatedTarget)) sound.tick(); return; }
    const box = e.target.closest(selectable);
    if (box && !box.contains(e.relatedTarget)) sound.hum();
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-sound-toggle]")) return;
    if (e.target.closest(selectable)) { sound.select(); return; }
    if (e.target.closest(interactive)) sound.click();
  });
  // range sliders: a soft tick as the value changes
  $$("input[type=range]").forEach((r) => r.addEventListener("input", () => sound.tick()));
}

// ================================================================== Pause / play decorative motion
function setupMotionToggle() {
  const btns = $$("[data-motion-toggle]");
  const set = (paused) => {
    root.classList.toggle("motion-paused", paused);
    btns.forEach((b) => { b.setAttribute("aria-pressed", String(paused)); $(".motion-toggle__label", b).textContent = paused ? "Play animation" : "Pause animation"; });
    motionListeners.forEach((fn) => fn(paused));
    try { localStorage.setItem("ip-motion-paused", paused ? "1" : "0"); } catch (e) {}
  };
  btns.forEach((b) => b.addEventListener("click", () => set(!motionPaused())));
  let saved = null;
  try { saved = localStorage.getItem("ip-motion-paused"); } catch (e) {}
  if (saved === "1") set(true);
}

// ================================================================== Project inquiry form
// US/E.164 phone normalization (same rules as the Worker): returns "+1XXXXXXXXXX" or "".
function toE164(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (v.startsWith("+")) { const d = "+" + v.slice(1).replace(/\D/g, ""); return /^\+[1-9]\d{7,14}$/.test(d) ? d : ""; }
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? "+1" + d : "";
}

function setupForm() {
  const form = $("#inquiry");
  const submit = $(".inquiry__submit", form);
  const label = $(".inquiry__label", form);
  const status = $(".inquiry__status", form);
  const callbackBox = $("#f-callback");
  const phoneOpt = $("[data-phone-opt]");
  let sending = false;
  let requestId = null; // reused for retries of the same submission so the server can de-duplicate

  const rules = {
    name: (v) => (v.trim().length >= 2 ? "" : "Please enter your name."),
    business: (v) => (v.trim().length >= 2 ? "" : "Please enter your business name."),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Please enter a valid email address, like name@business.com."),
    service: (v) => (v ? "" : "Please choose what you would like help with."),
    phone: (v) => {
      if (!callbackBox.checked) return v.trim() && !toE164(v) ? "Please enter a valid phone number, or leave it blank." : "";
      if (!v.trim()) return "Please enter the phone number we should call.";
      return toE164(v) ? "" : "Please enter a valid US phone number, like 863-259-3434.";
    },
  };
  const check = (name) => {
    const el = form.elements[name];
    const msg = rules[name](el.value);
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    $(`#${el.id}-err`).textContent = msg;
    return !msg;
  };
  Object.keys(rules).forEach((n) => {
    const el = form.elements[n];
    el.addEventListener("blur", () => { if (el.value) check(n); });
    el.addEventListener("input", () => { requestId = null; if (el.getAttribute("aria-invalid") === "true") check(n); });
    el.addEventListener("change", () => { requestId = null; if (el.getAttribute("aria-invalid") === "true") check(n); });
  });
  callbackBox.addEventListener("change", () => {
    requestId = null;
    phoneOpt.textContent = callbackBox.checked ? "(required for the call)" : "(optional)";
    form.elements.phone.required = callbackBox.checked;
    if (form.elements.phone.getAttribute("aria-invalid") === "true" || callbackBox.checked) { if (form.elements.phone.value || !callbackBox.checked) check("phone"); }
  });

  // campaign context captured once per visit
  const params = new URLSearchParams(location.search);
  const context = { page: location.pathname, referrer: document.referrer ? new URL(document.referrer).hostname : "" };
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((k) => { if (params.get(k)) context[k] = params.get(k).slice(0, 200); });

  const setStatus = (html, kind) => { status.className = "inquiry__status" + (kind ? " is-" + kind : ""); status.innerHTML = html; };
  const fallback = 'Please <a href="https://calendly.com/jemst-consulting-info/30min" target="_blank" rel="noopener">book a free consultation</a>, call <a href="tel:+18632593434">863-259-3434</a> or email <a href="mailto:info@jemst-consulting.com">info@jemst-consulting.com</a>.';
  const callbackMessages = {
    queued: " You asked for a call, so our AI assistant will call you shortly at the number you provided.",
    scheduled: " You asked for a call. It is outside our calling hours right now, so our AI assistant will call during the next calling window.",
    not_placed: " We could not schedule the automated call, so a member of our team will follow up instead.",
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    const ok = Object.keys(rules).map(check).every(Boolean);
    if (!ok) {
      const first = $('[aria-invalid="true"]', form);
      first && first.focus();
      setStatus("Please fix the highlighted fields.", "err");
      return;
    }
    if (form.elements.company_website.value) return; // spam trap filled: drop silently
    const endpoint = (SITE_CONFIG.leadEndpoint || form.dataset.endpoint || "").trim();
    if (!endpoint) {
      // No approved delivery destination is connected yet. Never show success without a real submission.
      setStatus("Online inquiries are not connected yet, so this message was not sent. " + fallback, "err");
      track("inquiry_not_connected");
      return;
    }

    sending = true;
    submit.disabled = true;
    submit.classList.add("is-loading");
    label.textContent = "Sending";
    setStatus("", "");
    requestId = requestId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const wantsCall = callbackBox.checked;
    const data = {
      request_id: requestId,
      name: form.elements.name.value.trim(),
      business: form.elements.business.value.trim(),
      email: form.elements.email.value.trim(),
      service: form.elements.service.value,
      phone: toE164(form.elements.phone.value),
      website: form.elements.website.value.trim(),
      callback_requested: wantsCall,
      callback_consent: wantsCall ? { given: true, version: SITE_CONFIG.callbackConsent.version, text: $("#f-callback-desc").textContent.trim(), at: new Date().toISOString() } : null,
      context,
      turnstile_token: form.elements["cf-turnstile-response"]?.value || "",
    };
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data), signal: ctrl.signal });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "HTTP " + res.status);
      form.reset();
      requestId = null;
      phoneOpt.textContent = "(optional)";
      Object.keys(rules).forEach((n) => form.elements[n].removeAttribute("aria-invalid"));
      const cb = wantsCall ? (callbackMessages[body.callback] || callbackMessages.not_placed) : "";
      setStatus("Thank you. Your inquiry was received and we will reply by email." + cb, "ok");
      track("inquiry_accepted", { service: data.service });
      if (wantsCall) track(body.callback === "queued" || body.callback === "scheduled" ? "callback_request" : "callback_not_placed");
    } catch (err) {
      setStatus("Your inquiry could not be sent. Please try again in a moment. " + fallback, "err");
      track("inquiry_failed");
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.classList.remove("is-loading");
      label.textContent = "Send my inquiry";
      status.focus?.();
    }
  });
}

// Approved promotion only: shows when enabled AND today is inside the configured dates.
function setupPromo() {
  const el = $("[data-promo]");
  const p = SITE_CONFIG.promo;
  if (!el || !p || !p.enabled || !p.text || !p.start || !p.end) return;
  const now = Date.now(), s = Date.parse(p.start), e = Date.parse(p.end);
  if (!(now >= s && now <= e)) return;
  el.textContent = p.text;
  el.hidden = false;
}

boot();
