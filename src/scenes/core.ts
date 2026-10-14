// Shared by the three scene styles: maths, the Brittany → Caribbean palette,
// the rider's pose and jump, and the render loop.

export type RGB = [number, number, number];
export type V2 = [number, number];

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a: number, b: number) =>
  hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));

export function noise1(x: number, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash2(i, seed), hash2(i + 1, seed), f * f * (3 - 2 * f));
}

export function fbm(x: number, seed = 0, oct = 4) {
  let a = 0.5, s = 0, n = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    s += noise1(x * f, seed + o * 17) * a;
    n += a;
    a *= 0.5;
    f *= 2.07;
  }
  return s / n;
}

// Sharp-crested noise, used for mountain skylines.
export function ridged(x: number, seed = 0, oct = 4) {
  let a = 0.5, s = 0, n = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    const v = 1 - Math.abs(2 * noise1(x * f, seed + o * 17) - 1);
    s += v * v * a;
    n += a;
    a *= 0.5;
    f *= 2.13;
  }
  return s / n;
}

export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// --- Palette: [Brittany, Caribbean] -----------------------------------------

const PAL = {
  skyTop: [hex('#3d82bb'), hex('#1c8fe0')],
  skyMid: [hex('#8dbcdc'), hex('#6ac6ef')],
  skyLow: [hex('#dbeaf1'), hex('#fdf1d4')],
  seaFar: [hex('#4b8fb7'), hex('#8fe8dc')],
  seaMid: [hex('#14568a'), hex('#21bfce')],
  seaNear: [hex('#0a3058'), hex('#0a8fb3')],
  sun: [hex('#fffbe8'), hex('#fff1ad')],
  cloud: [hex('#f3f7fa'), hex('#ffffff')],
  cloudShade: [hex('#a4b8cc'), hex('#bcd3ea')],
  farRock: [hex('#8fa9c9'), hex('#8ebfd6')],
  farShade: [hex('#6f8db3'), hex('#6aa5c4')],
  midRock: [hex('#587a9f'), hex('#4f9aa6')],
  midShade: [hex('#3f5f86'), hex('#377f8f')],
} satisfies Record<string, [RGB, RGB]>;

export type Journey = { [K in keyof typeof PAL]: RGB };

export function journey(p: number): Journey {
  const t = smooth(0.05, 0.95, p);
  const out = {} as Journey;
  for (const k in PAL) {
    const key = k as keyof typeof PAL;
    out[key] = mix(PAL[key][0], PAL[key][1], t);
  }
  return out;
}

export const KITE = { main: '#ff6b3d', dark: '#d94c26', light: '#fff3e4', edge: '#12283f' };
export const RIDER = { suit: '#141d2b', suitHi: '#2f4560', top: '#6fc260', topDark: '#4c9c4c', topHi: '#8bd47a', skin: '#f1c49c', hair: '#e2ba5c', hairHi: '#f6dd96', board: '#ffd23f', boardDark: '#c6902a' };

// Camera travel over the whole page, in screen heights.
export const TRAVEL = 9;

// --- Layout shared by every style -------------------------------------------

export interface Lay {
  w: number; h: number;
  hz: number;        // horizon
  rx: number; ry: number; S: number;   // rider: water contact point and height
  kdx: number; kdy: number; R: number; // kite offset from rider, and radius
}

export function layout(w: number, h: number): Lay {
  // On tall (phone) screens the horizon drops so the name has clear sky above the kite.
  const wide = w / h > 1.2;
  const hz = Math.round(h * (wide ? 0.6 : 0.7));
  const R = Math.min(0.1 * h, 0.2 * w);
  const kdx = Math.min(0.16 * h, 0.27 * w);
  return {
    w, h, hz,
    // Far enough right to clear the text panels, but never so far that the kite leaves the screen.
    rx: wide ? Math.min(w * 0.71, w - kdx - R - 0.07 * h) : w * 0.4,
    ry: hz + (h - hz) * 0.36,
    S: h * 0.12,
    kdx,
    kdy: (wide ? -0.5 : -0.29) * h,
    R,
  };
}

// Where a thing must sit in its layer to appear at screen fraction fx when the page is at progress p0.
export const place = (l: Lay, p0: number, fx: number, par: number) => fx * l.w + p0 * TRAVEL * l.h * par;

// --- Rider ------------------------------------------------------------------

export class Rider {
  y = 0;        // jump height, in rider heights
  vy = 0;
  air = false;
  airAmt = 0;
  cool = 0;
  speed = 0;    // 0..1, how hard the page is being scrolled
  landed = false;

  update(dt: number, vel: number) {
    const sp = Math.abs(vel);
    this.speed += (Math.min(1, sp * 5) - this.speed) * Math.min(1, dt * 4);
    this.cool -= dt;
    this.landed = false;
    if (!this.air && this.cool <= 0 && sp > 0.26) {
      this.air = true;
      this.vy = 1.5 + Math.min(1, sp * 1.4);
    }
    if (this.air) {
      this.vy -= 3.4 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.air = false; this.cool = 1.5; this.landed = true;
      }
    }
    this.airAmt += ((this.air ? 1 : 0) - this.airAmt) * Math.min(1, dt * 9);
  }
}

export interface Pose {
  tail: V2; nose: V2; footB: V2; footF: V2; kneeB: V2; kneeF: V2;
  hip: V2; shoulder: V2; elbow: V2; hand: V2; head: V2; barA: V2; barB: V2;
}

// Joints in rider heights, origin at the board centre, y up, travelling right.
export function pose(r: Rider, t: number): Pose {
  const a = r.airAmt;
  const ang = lerp(0.1 + 0.04 * Math.sin(t * 2.3), 0.5, a);
  const c = Math.cos(ang), s = Math.sin(ang);
  const on = (u: number, v: number): V2 => [u * c - v * s, u * s + v * c];
  const mid = (p: V2, q: V2, dx = 0, dy = 0): V2 => [(p[0] + q[0]) / 2 + dx, (p[1] + q[1]) / 2 + dy];
  const footB = on(-0.17, 0.03), footF = on(0.19, 0.03);
  const base = mid(footB, footF);
  const hip: V2 = [base[0] + lerp(-0.11, -0.05, a), base[1] + lerp(0.42, 0.29, a)];
  const lean = lerp(0.5 + 0.12 * r.speed + 0.03 * Math.sin(t * 1.7), 0.18, a);
  const shoulder: V2 = [hip[0] - Math.sin(lean) * 0.34, hip[1] + Math.cos(lean) * 0.34];
  const head: V2 = [shoulder[0] - Math.sin(lean * 0.5) * 0.125, shoulder[1] + Math.cos(lean * 0.5) * 0.125];
  const arm = lerp(0.3, 0.95, a);
  const hand: V2 = [shoulder[0] + Math.cos(arm) * 0.37, shoulder[1] + Math.sin(arm) * 0.37];
  const bx = Math.cos(arm + 1.35) * 0.075, by = Math.sin(arm + 1.35) * 0.075;
  return {
    tail: on(-0.44, 0), nose: on(0.44, 0), footB, footF,
    kneeB: mid(footB, hip, 0.05 + 0.05 * a, 0), kneeF: mid(footF, hip, 0.07 + 0.05 * a, 0.01),
    hip, shoulder, head, hand,
    elbow: mid(shoulder, hand, 0.01, -0.035),
    barA: [hand[0] + bx, hand[1] + by], barB: [hand[0] - bx, hand[1] - by],
  };
}

export function kiteAt(l: Lay, r: Rider, t: number): V2 {
  return [
    l.rx + l.kdx * (1 - 0.5 * r.airAmt) + Math.sin(t * 0.5) * l.h * 0.03 + r.speed * l.h * 0.02,
    l.ry + l.kdy - r.y * l.S * 0.35 + Math.sin(t * 1.0 + 1) * l.h * 0.018,
  ];
}

// The kite as a crescent: outer edge (leading edge) and inner edge, tip to tip.
export function kiteShape(kx: number, ky: number, phi: number, R: number, n = 28) {
  const span = 2.3, T = 0.5 * R;
  const cx = kx - Math.cos(phi) * R * 0.72, cy = ky - Math.sin(phi) * R * 0.72;
  const outer: V2[] = [], inner: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = phi + (u - 0.5) * span;
    const ri = R - T * Math.pow(Math.sin(Math.PI * u), 0.55);
    outer.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    inner.push([cx + Math.cos(a) * ri, cy + Math.sin(a) * ri]);
  }
  return { outer, inner, cx, cy, span, T };
}

// --- Canvas helpers ---------------------------------------------------------

export type G = CanvasRenderingContext2D;
export interface Layer { c: HTMLCanvasElement; w: number; h: number }

// Paints something once into its own canvas so it can be reused every frame.
export function layer(w: number, h: number, dpr: number, draw: (g: G) => void): Layer {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  draw(g);
  return { c, w, h };
}

export const poly = (g: G, pts: V2[]) => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
};

// --- Render loop ------------------------------------------------------------

export interface Frame { t: number; dt: number; p: number; vel: number }
export interface Scene { resize(w: number, h: number): void; frame(f: Frame): void }
export interface MountOpts {
  progress: () => number;
  // The progress value at which the section with this id sits in the middle of the screen.
  sectionAt?: (id: string) => number;
}
export type Mount = (canvas: HTMLCanvasElement, opts: MountOpts) => void;

export function drive(canvas: HTMLCanvasElement, opts: MountOpts, scene: Scene) {
  const host = canvas.parentElement!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, p = clamp(opts.progress()), last = performance.now(), t = 0, raf = 0;

  const size = () => {
    const r = host.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    if (nw !== w || nh !== h) { w = nw; h = nh; scene.resize(w, h); }
  };
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const target = clamp(opts.progress());
    const prev = p;
    p += (target - p) * (still ? 1 : 1 - Math.exp(-dt * 7));
    if (Math.abs(target - p) < 1e-5) p = target;
    if (!still) t += dt;
    scene.frame({ t, dt, p, vel: still ? 0 : (p - prev) / dt });
    if (!still && !document.hidden) raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  new ResizeObserver(() => { size(); kick(); }).observe(host);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  if (still) addEventListener('scroll', kick, { passive: true });
  size();
  kick();
}
