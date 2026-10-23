// Insight Pros sound design: a generated cinematic score (Web Audio API, no audio files).
// Off by default. Starts only after the visitor turns it on (browsers require a click to play sound).

// Chord per section: four voices that glide into each other, plus a sub drone on the root.
const CHORDS = {
  hero:        [110.0, 164.81, 246.94, 261.63],  // A minor add9
  problems:    [87.31, 130.81, 220.0, 329.63],   // F major 7
  services:    [130.81, 196.0, 293.66, 329.63],  // C add9
  audience:    [98.0, 146.83, 246.94, 329.63],   // G6
  work:        [110.0, 164.81, 261.63, 329.63],  // A minor
  walkthrough: [73.42, 146.83, 220.0, 349.23],   // D minor 6 (darker, tense)
  estimate:    [82.41, 123.47, 246.94, 392.0],   // E minor 7
  about:       [87.31, 130.81, 261.63, 329.63],  // F major 7
  process:     [130.81, 196.0, 329.63, 392.0],   // C major
  search:      [98.0, 146.83, 293.66, 369.99],   // G with raised fourth (open, curious)
  faq:         [110.0, 164.81, 246.94, 261.63],  // back home
  contact:     [130.81, 196.0, 293.66, 392.0],   // C add9 resolve
};

export function createSound() {
  let ctx = null;
  const MULT = [1, 2, 2, 2];
  const MASTER = 0.45; // overall volume (0 to 1)
  let token = 0;     // guards against an 'off' click while sound is still starting
  let shimmerGain, shimmer = [];
  let master, padFilter, padGain, airGain, airFilter, reverbSend, voices = [], sub;
  let enabled = false;
  let section = "hero";
  let lastTick = 0;

  function noiseBuffer(seconds = 2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function impulse(seconds = 3.2, decay = 2.6) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function build() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);

    // reverb bus
    const reverb = ctx.createConvolver(); reverb.buffer = impulse();
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.55;
    reverbSend.connect(reverb).connect(master);

    // pad
    padFilter = ctx.createBiquadFilter(); padFilter.type = "lowpass"; padFilter.frequency.value = 1400; padFilter.Q.value = 0.7;
    padGain = ctx.createGain(); padGain.gain.value = 0.2;
    padFilter.connect(padGain);
    padGain.connect(master);
    padGain.connect(reverbSend);

    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 500;
    lfo.connect(lfoDepth).connect(padFilter.frequency); lfo.start();

    CHORDS.hero.forEach((f0, i) => {
      let f = f0;
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.3 : 0.24;
      f = f * MULT[i];
      const a = ctx.createOscillator(); a.type = "sawtooth"; a.frequency.value = f; a.detune.value = -7;
      const b = ctx.createOscillator(); b.type = "triangle"; b.frequency.value = f; b.detune.value = 6;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      a.connect(g); b.connect(g);
      if (pan) { pan.pan.value = [-0.5, 0.4, -0.2, 0.55][i]; g.connect(pan).connect(padFilter); } else g.connect(padFilter);
      a.start(); b.start();
      voices.push({ a, b });
    });

    shimmerGain = ctx.createGain(); shimmerGain.gain.value = 0.022;
    const trem = ctx.createOscillator(); trem.frequency.value = 0.18;
    const tremDepth = ctx.createGain(); tremDepth.gain.value = 0.012;
    trem.connect(tremDepth).connect(shimmerGain.gain); trem.start();
    shimmerGain.connect(master); shimmerGain.connect(reverbSend);
    CHORDS.hero.slice(1).forEach((f) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * 4;
      o.connect(shimmerGain); o.start(); shimmer.push(o);
    });

    sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = CHORDS.hero[0];
    const subGain = ctx.createGain(); subGain.gain.value = 0.045;
    sub.connect(subGain).connect(master); sub.start();

    // air: soft filtered noise that rises with scroll speed
    const air = ctx.createBufferSource(); air.buffer = noiseBuffer(3); air.loop = true;
    airFilter = ctx.createBiquadFilter(); airFilter.type = "bandpass"; airFilter.frequency.value = 2600; airFilter.Q.value = 0.5;
    airGain = ctx.createGain(); airGain.gain.value = 0.012;
    air.connect(airFilter).connect(airGain).connect(reverbSend);
    air.start();

    document.addEventListener("visibilitychange", () => {
      if (!ctx || !enabled) return;
      document.hidden ? ctx.suspend() : ctx.resume();
    });
    return true;
  }

  function setChord(key, glide = 1.2) {
    const chord = CHORDS[key];
    if (!ctx || !chord) return;
    const t = ctx.currentTime;
    voices.forEach((v, i) => {
      v.a.frequency.setTargetAtTime(chord[i] * MULT[i], t, glide / 3);
      v.b.frequency.setTargetAtTime(chord[i] * MULT[i], t, glide / 3);
    });
    shimmer.forEach((o, i) => o.frequency.setTargetAtTime(chord[i + 1] * 4, t, glide / 3));
    sub.frequency.setTargetAtTime(chord[0], t, glide / 3);
  }

  // filtered-noise sweep for section transitions
  function whoosh(strength = 1) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.6);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.55);
    bp.frequency.exponentialRampToValueAtTime(900, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 * strength, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(bp).connect(g);
    g.connect(master); g.connect(reverbSend);
    src.start(t); src.stop(t + 1.6);
  }

  // rapid rising digital arpeggio, like a HUD scanning in
  function scan(chord) {
    if (!ctx || !enabled || !chord) return;
    const t = ctx.currentTime;
    [chord[1] * 4, chord[2] * 4, chord[3] * 4, chord[1] * 8].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ctx.createGain(); const s0 = t + i * 0.055;
      g.gain.setValueAtTime(0.0001, s0); g.gain.exponentialRampToValueAtTime(0.03, s0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.16);
      o.connect(g); g.connect(master); g.connect(reverbSend);
      o.start(s0); o.stop(s0 + 0.2);
    });
  }

  // soft bell for arrivals
  function chime(freq = 880, vol = 0.05) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    [1, 2.01, 3.02].forEach((h, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq * h;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 / (i + 1));
      o.connect(g); g.connect(reverbSend); g.connect(master);
      o.start(t); o.stop(t + 2.5);
    });
  }

  return {
    get enabled() { return enabled; },
    get state() { return ctx ? ctx.state : "not started"; },

    async enable() {
      const my = ++token;
      if (!ctx && !build()) return false;
      await ctx.resume();
      if (my !== token) return false; // turned off while starting
      enabled = true;
      setChord(section, 0.1);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(MASTER, t + 1.5);
      whoosh(1);
      chime(CHORDS[section][3] * 2, 0.06);
      scan(CHORDS[section]);
      return true;
    },

    disable() {
      token++;
      enabled = false;
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.6);
      setTimeout(() => { if (!enabled) ctx.suspend(); }, 650);
    },

    section(key) {
      if (key === section) return;
      section = key;
      if (!enabled) return;
      setChord(key);
      whoosh(key === "walkthrough" ? 1.1 : 0.8);
      scan(CHORDS[key]);
      if (key === "contact" || key === "services") chime(CHORDS[key][3] * 2, 0.04);
    },

    velocity(v) {
      if (!enabled) return;
      const s = Math.min(Math.abs(v), 60);
      const t = ctx.currentTime;
      padFilter.frequency.setTargetAtTime(1400 + s * 45, t, 0.25);
      airGain.gain.setTargetAtTime(0.012 + s * 0.0015, t, 0.3);
      airFilter.frequency.setTargetAtTime(2600 + s * 50, t, 0.3);
    },

    tick() {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastTick < 70) return;
      lastTick = now;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(2600, t + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.08);
    },

    // boxes and tabs: quick futuristic "select" chirp
    select() {
      if (!enabled) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(2200, t + 0.09);
      const o2 = ctx.createOscillator(); o2.type = "triangle";
      o2.frequency.setValueAtTime(1800, t + 0.07); o2.frequency.exponentialRampToValueAtTime(2700, t + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); o2.connect(g); g.connect(master); g.connect(reverbSend);
      o.start(t); o.stop(t + 0.24); o2.start(t + 0.07); o2.stop(t + 0.24);
    },

    // hovering a box: very soft low "glass" tone
    hum() {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastTick < 120) return;
      lastTick = now;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 1320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(reverbSend); g.connect(master);
      o.start(t); o.stop(t + 0.4);
    },

    click() {
      if (!enabled) return;
      const t = ctx.currentTime;
      [660, 990].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        const g = ctx.createGain();
        const s = t + i * 0.06;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.07, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
        o.connect(g); g.connect(master); g.connect(reverbSend);
        o.start(s); o.stop(s + 0.25);
      });
    },
  };
}
