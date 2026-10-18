// Insight Core: particle sculpture that morphs with scroll:
// 0 sphere (insight) → 1 waveform (voice) → 2 beam (answer) → 3 aperture/eye (contact)
import * as THREE from "three";

// Brand theme: Cornflower (#6AA6FF) → Cyan (#64D7EE) → Cornflower, on Midnight (#050B1B)
const ION = new THREE.Color("#64D7EE");
const CORN = new THREE.Color("#6AA6FF");
const BONE = new THREE.Color("#ecebe4");

export function createCore(canvas, { mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  const dprCap = mobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setClearColor(0x050b1b, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // ---------------------------------------------------------------- Topographic background
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 },
      uIon: { value: ION },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uScroll; uniform vec3 uIon;
      vec2 hash(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(dot(hash(i), f), dot(hash(i+vec2(1,0)), f-vec2(1,0)), u.x),
                   mix(dot(hash(i+vec2(0,1)), f-vec2(0,1)), dot(hash(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a*noise(p); p *= 2.02; a *= 0.5; } return v; }
      void main(){
        vec2 asp = vec2(uRes.x/uRes.y, 1.0);
        vec2 p = (vUv - 0.5) * asp * 2.2;
        p.y += uScroll * 0.9;
        float n = fbm(p*0.9 + vec2(uTime*0.012, -uTime*0.008));
        float h = n * 9.0;
        float d = abs(fract(h) - 0.5);
        float w = fwidth(h);
        float line = 1.0 - smoothstep(0.0, w*1.4, d);
        float major = 1.0 - smoothstep(0.0, w*1.6, abs(fract(h/5.0) - 0.5) * 5.0);
        vec2 m = (uMouse - 0.5) * asp * 2.2; m.y += uScroll * 0.9;
        float glow = smoothstep(0.75, 0.0, length(p - m));
        float vig = smoothstep(1.55, 0.25, length((vUv-0.5)*asp*1.4));
        vec3 base = vec3(0.0196, 0.0431, 0.1059);
        vec3 col = base;
        col += vec3(0.925, 0.92, 0.89) * line * 0.045 * vig;
        col += vec3(0.925, 0.92, 0.89) * major * 0.035 * vig;
        col += uIon * line * glow * 0.32;
        col += uIon * glow * 0.018;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // ---------------------------------------------------------------- Particles
  const N = mobile ? 20000 : 34000;
  const p0 = new Float32Array(N * 3); // sphere
  const p1 = new Float32Array(N * 3); // waveform
  const p2 = new Float32Array(N * 3); // beam
  const p3 = new Float32Array(N * 3); // aperture
  const rnd = new Float32Array(N * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < N; i++) {
    const t = i / N;
    const r1 = Math.random(), r2 = Math.random(), r3 = Math.random(), r4 = Math.random();
    rnd.set([r1, r2, r3, r4], i * 4);

    // sphere: fibonacci shell with a faint inner nebula
    {
      const y = 1 - 2 * t;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      const shell = r1 < 0.82 ? 1.6 + (r2 - 0.5) * 0.05 : 0.4 + r2 * 1.1;
      p0.set([Math.cos(th) * rad * shell, y * shell, Math.sin(th) * rad * shell], i * 3);
    }
    // waveform: 28 ribbons across the screen with a gaussian envelope
    {
      const lines = 28;
      const k = i % lines;
      const x = (Math.random() * 2 - 1) * 4.2;
      const env = Math.exp(-x * x * 0.32);
      const f = 2.2 + k * 0.05;
      const y = (Math.sin(x * f + k * 0.21) * 0.9 + Math.sin(x * f * 2.3 + k) * 0.25) * env * (0.35 + (k / lines) * 0.9);
      const z = (k / lines - 0.5) * 1.6;
      p1.set([x, y + (r3 - 0.5) * 0.02, z], i * 3);
    }
    // beam: scattered noise on the left, converging into one focused beam on the right
    {
      const x = -4.6 + Math.pow(Math.random(), 0.85) * 9.4;
      const spread = Math.max(0.025, 2.6 * (1 - THREE.MathUtils.smoothstep(x, -3.2, 0.4)));
      const a = Math.random() * Math.PI * 2;
      const rr = spread * Math.sqrt(Math.random());
      p2.set([x, Math.sin(a) * rr * 0.75 + x * 0.06, Math.cos(a) * rr], i * 3);
    }
    // aperture: iris ring + pupil cluster
    {
      const a = Math.random() * Math.PI * 2;
      let rr;
      if (r1 < 0.62) rr = 1.85 + (Math.random() - 0.5) * 0.12;
      else if (r1 < 0.8) rr = 1.2 + Math.random() * 0.62;
      else rr = Math.pow(Math.random(), 1.6) * 0.42;
      p3.set([Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - 0.5) * 0.12], i * 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(p0, 3));
  geo.setAttribute("aP1", new THREE.BufferAttribute(p1, 3));
  geo.setAttribute("aP2", new THREE.BufferAttribute(p2, 3));
  geo.setAttribute("aP3", new THREE.BufferAttribute(p3, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uSize: { value: (mobile ? 34 : 18) * renderer.getPixelRatio() },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
      uIon: { value: ION },
      uCorn: { value: CORN },
      uBone: { value: BONE },
      uAlpha: { value: 1 },
      uPulse: { value: 0 },
      uGain: { value: mobile ? 2.0 : 1.3 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aP3; attribute vec4 aRnd;
      uniform float uTime; uniform float uMorph; uniform float uSize; uniform vec3 uMouse; uniform float uPulse;
      varying float vMix; varying float vAlpha; varying float vGrad;
      // cheap 3D noise
      vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453)*2.0-1.0; }
      void main(){
        float w0 = max(0.0, 1.0 - abs(uMorph - 0.0));
        float w1 = max(0.0, 1.0 - abs(uMorph - 1.0));
        float w2 = max(0.0, 1.0 - abs(uMorph - 2.0));
        float w3 = max(0.0, 1.0 - abs(uMorph - 3.0));
        // stagger the morph per particle for an organic swarm
        vec3 pos = position*w0 + aP1*w1 + aP2*w2 + aP3*w3;

        float t = uTime;
        // sphere breathing + orbit drift
        vec3 sph = position;
        float ang = t*0.12 + aRnd.x*0.4;
        pos += (vec3(sin(ang + sph.y), cos(ang*0.8 + sph.x), sin(ang*1.1 + sph.z)) * 0.03) * w0;
        pos += normalize(position + 0.0001) * sin(t*1.4 + aRnd.y*6.283) * 0.025 * w0;
        // waveform animates like a voice
        float env = exp(-pos.x*pos.x*0.32);
        pos.y += sin(pos.x*3.2 - t*3.4 + aRnd.z*0.5) * 0.22 * env * w1 * (0.6 + uPulse);
        // beam particles stream toward the right
        float flow = fract(aRnd.w + t*0.05);
        pos.x += (flow - 0.5) * 0.35 * w2;
        // aperture slowly rotates
        float ca = cos(t*0.15*w3), sa = sin(t*0.15*w3);
        pos.xy = mat2(ca, -sa, sa, ca) * pos.xy;
        // transition turbulence (strongest between shapes)
        float between = 1.0 - max(max(w0, w1), max(w2, w3));
        pos += hash3(position*3.1 + aRnd.xyz) * between * 0.9;

        vec4 world = modelMatrix * vec4(pos, 1.0);
        // mouse repulsion in world space
        vec2 dm = world.xy - uMouse.xy;
        float md = length(dm);
        world.xy += normalize(dm + 0.0001) * smoothstep(1.4, 0.0, md) * 0.55;

        vec4 mv = viewMatrix * world;
        gl_Position = projectionMatrix * mv;
        float size = uSize * (0.35 + aRnd.y * 0.9);
        gl_PointSize = size / -mv.z;
        vMix = step(0.94, aRnd.x);
        // three-stop horizontal gradient across the screen: cornflower edges, cyan centre
        vGrad = 1.0 - abs(clamp(gl_Position.x / gl_Position.w, -1.0, 1.0));
        vAlpha = (0.35 + aRnd.z * 0.65) * smoothstep(14.0, 5.0, -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uIon; uniform vec3 uCorn; uniform vec3 uBone; uniform float uAlpha; uniform float uGain;
      varying float vMix; varying float vAlpha; varying float vGrad;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        vec3 col = mix(mix(uCorn, uIon, smoothstep(0.0, 1.0, vGrad)), uBone, vMix);
        gl_FragColor = vec4(col * a * vAlpha * uAlpha * uGain, 1.0);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // soft halo sprite behind the core
  const haloTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(100,215,238,0.35)");
    grd.addColorStop(0.4, "rgba(106,166,255,0.08)");
    grd.addColorStop(1, "rgba(106,166,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(7, 7, 1);
  group.add(halo);

  // ---------------------------------------------------------------- State
  const state = {
    morph: 0,
    x: 0,
    y: 0,
    scale: 1,
    alpha: 1,
    pulse: 0,
    scroll: 0,
  };
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let tilt = { x: 0, y: 0 };
  let spin = 0;
  let running = true;
  let visible = true;
  const clock = new THREE.Clock();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the core comfortably framed on tall phones
    camera.position.z = w / h < 0.8 ? 12.5 : 9;
    camera.updateProjectionMatrix();
    bgMat.uniforms.uRes.value.set(w, h);
  }
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("pointermove", (e) => {
    pointer.tx = e.clientX / window.innerWidth;
    pointer.ty = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  function onOrient(e) {
    if (e.gamma == null) return;
    tilt.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
    tilt.y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1);
    pointer.tx = 0.5 + tilt.x * 0.3;
    pointer.ty = 0.5 - tilt.y * 0.2;
  }
  if (mobile) window.addEventListener("deviceorientation", onOrient, { passive: true });

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) loop();
  });

  const mouseWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function loop() {
    if (!running || !visible) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // project pointer onto z=0 plane
    tmp.set(pointer.x * 2 - 1, pointer.y * 2 - 1, 0.5).unproject(camera);
    tmp.sub(camera.position).normalize();
    const dist = -camera.position.z / tmp.z;
    mouseWorld.copy(camera.position).add(tmp.multiplyScalar(dist));

    mat.uniforms.uTime.value = t;
    mat.uniforms.uMorph.value = state.morph;
    mat.uniforms.uAlpha.value = state.alpha;
    mat.uniforms.uPulse.value = state.pulse;
    mat.uniforms.uMouse.value.copy(mouseWorld);
    bgMat.uniforms.uTime.value = t;
    bgMat.uniforms.uMouse.value.set(pointer.x, pointer.y);
    bgMat.uniforms.uScroll.value = state.scroll;

    group.position.x += (state.x - group.position.x) * 0.08;
    group.position.y += (state.y - group.position.y) * 0.08;
    const s = group.scale.x + (state.scale - group.scale.x) * 0.08;
    group.scale.setScalar(s);
    const sphereW = Math.max(0, 1 - Math.abs(state.morph));
    // spin only while it's a sphere; settle back to front-facing for the flat shapes
    spin += dt * 0.12 * sphereW;
    if (sphereW < 0.6) {
      const target = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
      spin += (target - spin) * 0.05;
    }
    points.rotation.y = spin;
    group.rotation.x += ((pointer.y - 0.5) * -0.5 - group.rotation.x) * 0.05;
    group.rotation.z += ((pointer.x - 0.5) * -0.25 - group.rotation.z) * 0.05;
    halo.material.opacity = state.alpha * (0.6 + sphereW * 0.4);

    renderer.render(scene, camera);
  }
  loop();

  return {
    state,
    setVisible(v) {
      if (v === visible) return;
      visible = v;
      if (v) { clock.getDelta(); loop(); }
    },
    renderOnce() { renderer.render(scene, camera); },
  };
}
