// Live voice demo: browser conversation with the Insight Pros Retell agent.
// Uses the official retell-client-js-sdk with a domain-restricted PUBLIC key (no private keys in the browser).
// The SDK is loaded only after the visitor presses the orb. The microphone is never requested before that.
import { SITE_CONFIG } from "./config.js?v=20261024";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setupVoiceOrb({ track = () => {} } = {}) {
  const orb = document.querySelector("[data-orb]");
  if (!orb) return;
  const canvas = orb.querySelector(".orb__canvas");
  const label = orb.querySelector(".orb__label");
  const statusEl = document.getElementById("orb-status");
  const controls = document.querySelector(".orb__controls");
  const muteBtn = document.querySelector("[data-orb-mute]");
  const endBtn = document.querySelector("[data-orb-end]");

  let session = null;      // the one active WebCallSession
  let starting = false;    // guards against double clicks creating two sessions
  let muted = false;
  let level = 0;           // smoothed agent audio level 0..1
  let agentTalking = false;
  let state = "idle";      // idle | connecting | live | ended | error

  // ------------------------------------------------------------ status + state
  const setStatus = (text, isErr = false) => { statusEl.textContent = text; statusEl.classList.toggle("is-err", isErr); };
  const setState = (s) => {
    state = s;
    orb.dataset.state = s;
    controls.hidden = !(s === "live" || s === "connecting");
    orb.setAttribute("aria-label", s === "live" ? "Conversation in progress" : "Talk to our AI agent");
    if (s !== "live") { agentTalking = false; }
    kick();
  };

  // ------------------------------------------------------------ canvas orb (site gradient colors)
  const ctx = canvas.getContext("2d");
  let raf = 0, visible = false, t0 = performance.now();
  const resize = () => {
    const r = orb.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  };
  resize();
  window.addEventListener("resize", resize);

  function draw(now) {
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
    const t = (now - t0) / 1000;
    const live = state === "live";
    const pulse = reducedMotion ? 0 : (live ? level * 0.16 : 0.025 * Math.sin(t * 1.4));
    const base = Math.min(w, h) * 0.34 * (1 + pulse);
    ctx.clearRect(0, 0, w, h);

    // outer glow
    const glow = ctx.createRadialGradient(cx, cy, base * 0.6, cx, cy, base * 1.45);
    glow.addColorStop(0, `rgba(100,215,238,${live ? 0.28 + level * 0.3 : 0.18})`);
    glow.addColorStop(1, "rgba(100,215,238,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, base * 1.45, 0, Math.PI * 2); ctx.fill();

    // core sphere: cornflower to cyan
    const core = ctx.createRadialGradient(cx - base * 0.35, cy - base * 0.4, base * 0.1, cx, cy, base);
    core.addColorStop(0, "#c9f3ff");
    core.addColorStop(0.35, "#64D7EE");
    core.addColorStop(0.8, "#6AA6FF");
    core.addColorStop(1, "#1F5FE6");
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, base, 0, Math.PI * 2); ctx.fill();

    // inner dark lens so the label reads
    ctx.fillStyle = "rgba(5,11,27,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, base * 0.82, 0, Math.PI * 2); ctx.fill();

    // orbiting ring of dots, livelier while the agent talks
    const dots = 64;
    const speed = reducedMotion ? 0 : (live ? (agentTalking ? 1.1 : 0.45) : 0.18);
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2 + t * speed;
      const wobble = reducedMotion ? 0 : Math.sin(a * 6 + t * 3) * base * (live ? 0.04 + level * 0.12 : 0.02);
      const rr = base * 1.12 + wobble;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      ctx.fillStyle = i % 2 ? "rgba(106,166,255,0.85)" : "rgba(100,215,238,0.85)";
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, w * 0.004), 0, Math.PI * 2); ctx.fill();
    }
    level *= 0.9;
    if (visible && !reducedMotion) raf = requestAnimationFrame(draw);
  }
  function kick() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); else cancelAnimationFrame(raf); }).observe(orb);
  draw(performance.now());

  // ------------------------------------------------------------ call lifecycle
  function cleanup(finalText, isErr = false) {
    session = null; starting = false; muted = false;
    muteBtn.setAttribute("aria-pressed", "false"); muteBtn.textContent = "Mute microphone";
    setState(isErr ? "error" : "ended");
    setStatus(finalText, isErr);
    label.textContent = "Talk again";
    window.dispatchEvent(new Event("ip-voice-end"));
  }

  async function start() {
    if (session || starting) { // already connecting/live: a press resumes audio playback if the browser blocked it
      if (session) session.startAudioPlayback?.().catch(() => {});
      return;
    }
    const { publicKey, agentId, sdkUrl } = SITE_CONFIG.retell;
    if (!publicKey) {
      setState("error");
      setStatus("The live demo is not connected yet. Please book a free consultation and we will show it to you.", true);
      track("demo_unavailable");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setStatus("This browser cannot use a microphone here. Try a current version of Chrome, Safari or Edge.", true);
      return;
    }
    starting = true;
    setState("connecting");
    setStatus("Connecting. Allow microphone access when your browser asks.");
    window.dispatchEvent(new Event("ip-voice-start"));
    try {
      const { RetellClient } = await import(/* @vite-ignore */ sdkUrl);
      const client = new RetellClient({ key: publicKey });
      session = client.createWebCall({
        agent_id: agentId,
        metadata: { source: "insightpros_landing_orb", page: location.pathname },
        audio: { emitRawAudioSamples: true },
        hooks: {
          onStatus: (s) => {
            if (s === "live") { setState("live"); setStatus("Connected. Say hello."); track("demo_start"); }
            if (s === "ended") { /* onEnd handles cleanup */ }
          },
          onAgentStartTalking: () => { agentTalking = true; setStatus("Agent is speaking"); kick(); },
          onAgentStopTalking: () => { agentTalking = false; if (state === "live") setStatus(muted ? "Microphone muted" : "Listening"); },
          onAudio: (samples) => {
            let sum = 0; for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
            level = Math.max(level, Math.min(1, Math.sqrt(sum / samples.length) * 6));
          },
          onEnd: () => { track("demo_complete"); cleanup("Conversation ended. Thanks for trying the demo."); },
          onError: (err) => {
            const name = err?.name || "";
            const denied = /NotAllowed|Permission/i.test(name) || /permission|denied/i.test(err?.message || "");
            const msg = denied
              ? "Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again."
              : "The demo could not connect right now. Please try again in a moment or book a consultation.";
            track(denied ? "demo_mic_denied" : "demo_error");
            try { session?.end?.(); } catch (e) {}
            cleanup(msg, true);
          },
        },
      });
      starting = false;
    } catch (err) {
      cleanup("The demo could not load. Check your connection and try again.", true);
      track("demo_error");
    }
  }

  orb.addEventListener("click", start);
  muteBtn.addEventListener("click", () => {
    if (!session) return;
    muted = !muted;
    muted ? session.mute() : session.unmute();
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.textContent = muted ? "Unmute microphone" : "Mute microphone";
    setStatus(muted ? "Microphone muted" : "Listening");
  });
  endBtn.addEventListener("click", async () => {
    if (!session) { cleanup("Conversation ended."); return; }
    setStatus("Ending");
    try { await session.end(); } catch (e) { cleanup("Conversation ended."); }
  });
  // end the call if the visitor leaves the page
  window.addEventListener("pagehide", () => { try { session?.end(); } catch (e) {} });
}
