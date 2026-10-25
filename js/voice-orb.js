// Live voice demo: browser conversation with Ashley, the Insight Pros Retell agent.
// Uses the official retell-client-js-sdk v3 (RetellClient + createWebCall) with a domain-restricted PUBLIC key.
// No private keys in the browser. The SDK loads only after the visitor presses the orb, and the
// microphone is never requested before that. Nothing starts on page load.
import { SITE_CONFIG } from "./config.js?v=20261027";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setupVoiceOrb({ track = () => {} } = {}) {
  const orb = document.querySelector("[data-orb]");
  if (!orb) return;
  const canvas = orb.querySelector(".orb__canvas");
  const label = document.querySelector(".orb__title");
  const statusEl = document.getElementById("orb-status");
  const controls = document.querySelector(".orb__controls");
  const muteBtn = document.querySelector("[data-orb-mute]");
  const endBtn = document.querySelector("[data-orb-end]");
  const cfg = SITE_CONFIG.retell;
  const name = cfg.agentName || "our AI agent";

  let session = null;      // the one active WebCallSession
  let attempt = 0;         // id of the current attempt; stale hooks from an older session are ignored
  let busy = false;        // guards against double clicks creating two sessions
  let muted = false;
  let level = 0;           // smoothed agent audio level 0..1 (from the agent's real audio track)
  let agentTalking = false;
  let lastError = null;    // last error the SDK reported; used for the final message when the call ends
  let connectTimer = 0;
  let state = "idle";      // idle | connecting | live | ended | error

  label.textContent = `Talk to ${name}`;
  orb.dataset.state = state;

  // ------------------------------------------------------------ status + state
  const setStatus = (text, isErr = false) => { statusEl.textContent = text; statusEl.classList.toggle("is-err", isErr); };
  const setState = (s) => {
    state = s;
    orb.dataset.state = s;
    controls.hidden = !(s === "live" || s === "connecting");
    muteBtn.hidden = s !== "live"; // muting means nothing until the call is live
    orb.setAttribute("aria-label", s === "live" ? `Conversation with ${name} in progress` : `Talk to ${name}, our AI assistant`);
    if (s !== "live") { agentTalking = false; }
    kick();
  };
  // the status line inside a live call: Listening / Ashley is responding / Microphone muted
  const liveStatus = () => setStatus(muted ? "Microphone muted" : agentTalking ? `${name} is responding` : "Listening");

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

  // glossy sphere with a thin halo ring; size, glow and ring react to the agent's real audio level
  function draw(now) {
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
    const t = (now - t0) / 1000;
    const live = state === "live", connecting = state === "connecting";
    const pulse = reducedMotion ? 0 : (live ? level * 0.12 : 0.018 * Math.sin(t * 1.4));
    const base = Math.min(w, h) * 0.3 * (1 + pulse);
    const ringR = Math.min(w, h) * 0.39;
    const lw = Math.max(1, w * 0.004);
    ctx.clearRect(0, 0, w, h);

    // soft outer glow
    const glow = ctx.createRadialGradient(cx, cy, base * 0.8, cx, cy, ringR * 1.25);
    glow.addColorStop(0, `rgba(70,140,255,${live ? 0.3 + level * 0.35 : 0.2})`);
    glow.addColorStop(1, "rgba(70,140,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, ringR * 1.25, 0, Math.PI * 2); ctx.fill();

    // thin halo ring (brighter while the agent talks)
    ctx.lineWidth = lw;
    ctx.strokeStyle = `rgba(100,215,238,${live ? 0.35 + level * 0.55 : 0.3})`;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    // connecting: a bright arc sweeps around the ring
    if (connecting) {
      const a0 = reducedMotion ? 0 : t * 3.2;
      ctx.lineWidth = lw * 2.2; ctx.strokeStyle = "rgba(100,215,238,0.95)"; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, ringR, a0, a0 + Math.PI * 0.45); ctx.stroke();
    }
    // live: a ripple ring that swells with the agent's voice
    if (live && level > 0.02 && !reducedMotion) {
      ctx.lineWidth = lw; ctx.strokeStyle = `rgba(106,166,255,${Math.min(0.6, level * 0.8)})`;
      ctx.beginPath(); ctx.arc(cx, cy, base + (ringR - base) * (0.35 + level * 0.6), 0, Math.PI * 2); ctx.stroke();
    }

    // sphere body: lit from the upper left
    const body = ctx.createRadialGradient(cx - base * 0.38, cy - base * 0.42, base * 0.05, cx, cy, base);
    body.addColorStop(0, "#d8f4ff");
    body.addColorStop(0.22, "#7cc4ff");
    body.addColorStop(0.55, "#2f72ff");
    body.addColorStop(0.88, "#1640b8");
    body.addColorStop(1, "#0c2470");
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, base, 0, Math.PI * 2); ctx.fill();

    // cyan rim light
    const rim = ctx.createRadialGradient(cx, cy, base * 0.82, cx, cy, base);
    rim.addColorStop(0, "rgba(100,215,238,0)");
    rim.addColorStop(1, `rgba(100,215,238,${0.35 + (live ? level * 0.4 : 0)})`);
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, base, 0, Math.PI * 2); ctx.fill();

    // specular highlight
    const sx = cx - base * 0.36, sy = cy - base * 0.44;
    const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, base * 0.42);
    spec.addColorStop(0, "rgba(255,255,255,0.85)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec; ctx.beginPath(); ctx.ellipse(sx, sy, base * 0.42, base * 0.3, -0.6, 0, Math.PI * 2); ctx.fill();

    // reflected arc on the lower right
    ctx.lineWidth = lw * 1.3; ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(190,235,255,${0.35 + (live && agentTalking ? level * 0.5 : 0)})`;
    ctx.beginPath(); ctx.arc(cx - base * 0.05, cy - base * 0.1, base * 0.66, Math.PI * 0.08, Math.PI * 0.62); ctx.stroke();

    level *= 0.9;
    if (visible && !reducedMotion) raf = requestAnimationFrame(draw);
  }
  function kick() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); else cancelAnimationFrame(raf); }).observe(orb);
  draw(performance.now());

  // ------------------------------------------------------------ messages
  const MSG = {
    unavailable: "The live demo is not connected yet. Please book a free consultation and we will show it to you.",
    noMic: "This browser cannot use a microphone here. Try a current version of Chrome, Safari or Edge.",
    micDenied: "Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.",
    micMissing: "No microphone was found. Connect one, or try on your phone.",
    micBusy: "Your microphone is in use by another app. Close it, then try again.",
    key: "The live demo is not available on this page address. Please book a consultation and we will show it to you.",
    busy: `${name} is busy with other callers right now. Please try again in a minute.`,
    network: "We could not reach the voice service. Check your connection and try again.",
    timeout: "The connection is taking too long. Please try again.",
    dropped: "The conversation was disconnected. Press the orb to talk again.",
    generic: "The demo could not connect right now. Please try again in a moment or book a consultation.",
    ended: "Conversation ended. Thanks for talking with us.",
  };
  function describe(err) {
    const n = err?.name || "", m = String(err?.message || ""), st = err?.status;
    // service answers first (a rejected key can also say "not allowed")
    if (st === 401 || st === 403 || /domain|unauthori[sz]ed|forbidden|api key|public key|recaptcha/i.test(m)) return ["key", MSG.key];
    if (st === 429 || /concurrency|rate limit|too many/i.test(m)) return ["busy", MSG.busy];
    if (st === 402 || /payment/i.test(m)) return ["unavailable", MSG.unavailable];
    if (/NotAllowed|Security/i.test(n) || /permission denied|microphone.*(denied|blocked)/i.test(m)) return ["micDenied", MSG.micDenied];
    if (/NotFound|Overconstrained/i.test(n) || /requested device not found|no microphone/i.test(m)) return ["micMissing", MSG.micMissing];
    if (/NotReadable|Abort/i.test(n) || /could not start audio source/i.test(m)) return ["micBusy", MSG.micBusy];
    if (/failed to fetch|network|load failed|websocket|timed? ?out/i.test(m)) return ["network", MSG.network];
    return ["error", MSG.generic];
  }

  // ------------------------------------------------------------ helpers
  // Ask for the microphone first, before any (billable) call is created, then release it: the SDK opens its own.
  async function checkMicrophone() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((tr) => tr.stop());
  }
  // optional reCAPTCHA v3 token (only when a site key is configured); Google's script loads on first use only
  let recaptchaLoad = null;
  async function recaptchaToken() {
    const key = cfg.recaptchaSiteKey;
    if (!key) return undefined;
    recaptchaLoad ||= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      s.async = true; s.onload = resolve; s.onerror = () => { recaptchaLoad = null; reject(new Error("network: recaptcha failed to load")); };
      document.head.appendChild(s);
    });
    await recaptchaLoad;
    await new Promise((r) => window.grecaptcha.ready(r));
    return window.grecaptcha.execute(key, { action: "web_call" });
  }

  // ------------------------------------------------------------ call lifecycle
  function finish(finalText, isErr = false, id = attempt) {
    if (id !== attempt) return; // a later attempt already took over
    clearTimeout(connectTimer);
    const wasActive = busy || session;
    session = null; busy = false; muted = false; lastError = null;
    muteBtn.setAttribute("aria-pressed", "false"); muteBtn.textContent = "Mute microphone";
    setState(isErr ? "error" : "ended");
    setStatus(finalText, isErr);
    label.textContent = `Talk to ${name} again`;
    if (wasActive) window.dispatchEvent(new Event("ip-voice-end")); // restores the site sound if it was on
  }

  async function start() {
    if (busy) { // already connecting/live: a press resumes audio playback if the browser blocked it
      session?.startAudioPlayback?.().catch(() => {});
      return;
    }
    if (!cfg.publicKey) {
      setState("error"); setStatus(MSG.unavailable, true);
      track("demo_unavailable");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error"); setStatus(MSG.noMic, true);
      return;
    }
    busy = true;
    const id = ++attempt;
    setState("connecting");
    setStatus("Connecting. Allow microphone access when your browser asks.");
    window.dispatchEvent(new Event("ip-voice-start")); // pauses the site sound

    // load the SDK while the microphone prompt is open
    const sdk = import(/* @vite-ignore */ cfg.sdkUrl);
    sdk.catch(() => {});
    try {
      await checkMicrophone();
    } catch (err) {
      const [kind, msg] = describe(err);
      track(kind === "micDenied" ? "demo_mic_denied" : "demo_mic_error");
      return finish(msg, true, id);
    }
    if (id !== attempt) return;

    let RetellClient, token;
    try {
      ({ RetellClient } = await sdk);
      token = await recaptchaToken();
    } catch (err) {
      track("demo_error");
      return finish(MSG.network, true, id);
    }
    if (id !== attempt) return;
    setStatus("Connecting");

    const mine = () => id === attempt;
    connectTimer = setTimeout(() => {
      if (!mine() || state !== "connecting") return;
      track("demo_timeout");
      try { session?.end(); } catch (e) {}
      finish(MSG.timeout, true, id);
    }, cfg.connectTimeoutMs || 25000);

    const request = { agent_id: cfg.agentId };
    if (cfg.agentVersion !== undefined && cfg.agentVersion !== "") request.agent_version = cfg.agentVersion;
    try {
      const client = new RetellClient({ key: cfg.publicKey });
      session = client.createWebCall({
        ...request,
        metadata: { source: "insightpros_landing_orb", page: location.pathname },
        recaptchaToken: token,
        audio: { emitRawAudioSamples: true },
        hooks: {
          onStatus: (s) => {
            if (!mine() || s !== "live") return; // "ended" is handled by onEnd
            clearTimeout(connectTimer);
            setState("live");
            setStatus(`Connected. Say hello to ${name}.`);
            session?.startAudioPlayback?.().catch(() => {});
            track("demo_start");
          },
          onAgentStartTalking: () => { if (!mine()) return; agentTalking = true; liveStatus(); kick(); },
          onAgentStopTalking: () => { if (!mine()) return; agentTalking = false; if (state === "live") liveStatus(); },
          onAudio: (samples) => {
            if (!mine()) return;
            let sum = 0; for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
            level = Math.max(level, Math.min(1, Math.sqrt(sum / samples.length) * 6));
          },
          // non-fatal errors arrive here too; the session's status says whether the call survived, and onEnd follows a fatal one
          onError: (err) => {
            if (!mine()) return;
            lastError = err;
            console.warn("Voice demo:", err?.status || err?.name || "", err?.message || err); // the service's reason, no keys
            track("demo_error_" + describe(err)[0]);
          },
          onEnd: () => {
            if (!mine()) return;
            if (lastError) {
              const [, msg] = describe(lastError);
              return finish(state === "live" && describe(lastError)[0] === "error" ? MSG.dropped : msg, true, id);
            }
            track("demo_complete");
            finish(MSG.ended, false, id);
          },
        },
      });
    } catch (err) {
      track("demo_error");
      finish(describe(err)[1], true, id);
    }
  }

  async function end() {
    if (!busy) return;
    const s = session, id = attempt;
    setStatus("Ending");
    try { await s?.end(); } catch (e) {}
    finish(MSG.ended, false, id); // no-op if onEnd already ran
  }

  orb.addEventListener("click", start);
  muteBtn.addEventListener("click", () => {
    if (!session || state !== "live") return;
    muted = !muted;
    muted ? session.mute() : session.unmute();
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.textContent = muted ? "Unmute microphone" : "Mute microphone";
    liveStatus();
  });
  endBtn.addEventListener("click", end);
  // release the microphone and end the call if the visitor leaves the page
  window.addEventListener("pagehide", () => { try { session?.end(); } catch (e) {} });
}
