// Paper-cut scene: flat sheets of coloured paper stacked with soft shadows, like a paper theatre.
import {
  clamp, lerp, smooth, hash, rng, hex, mix, css, journey, layout, place, pose, kiteAt, kiteShape,
  drive, layer, poly, Rider, TRAVEL, KITE, RIDER,
  type RGB, type V2, type Lay, type Mount, type Pose, type G, type Layer,
} from './core';

const COAST = 0.7, FAR = 0.05, MID = 0.1;

// Buoys floating past while the work experience section is on screen, each carrying a logo.
// fx is where the buoy sits across the screen when that section is centred; strip is the wave it floats on;
// dy nudges it up or down (in % of screen height) so the three do not sit in a perfect row;
// grow adjusts how much of the plate the logo fills.
const BUOYS = [
  { logo: 'google.svg', fx: 0.62, strip: 7, dy: 0, grow: 1.14 },
  { logo: 'marine-nationale.svg', fx: 0.84, strip: 7, dy: 0.9, grow: 1.1 },
  { logo: 'polytechnique.png', fx: 0.97, strip: 7, dy: -0.8, grow: 1.2 },
];

// Hiking trail up the island: x from the island's left edge, y above the waterline, in island units.
// The last point lies behind the summit: on that final leg the hiker walks down the far side, out of sight.
const TRAIL: V2[] = [[57, 1.6], [64, 6.5], [55, 11.5], [63, 16.5], [54, 21.5], [60, 26.5], [54, 31], [53.6, 34.6], [48, 28]];
// The top of the volcano, in the same units, used to hide the hiker once he is over the crest.
const CREST: V2[] = [[10, 0], [47, 34.5], [51, 36], [54, 34.4], [57, 35.6], [92, 0]];
const TRAIL_LEN = TRAIL.slice(1).map((b, i) => Math.hypot(b[0] - TRAIL[i][0], b[1] - TRAIL[i][1]));
const TRAIL_TOTAL = TRAIL_LEN.reduce((a, b) => a + b, 0);

// Where someone is after walking `dist` along a path, which way they face, and whether they are on the
// last leg (behind the summit, since every path ends with the trail).
function along(path: V2[], dist: number): { at: V2; dir: number; over: boolean } {
  let d = Math.max(0, dist);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= len || i === path.length - 2) {
      const k = Math.min(1, d / len);
      return { at: [lerp(a[0], b[0], k), lerp(a[1], b[1], k)], dir: b[0] >= a[0] ? 1 : -1, over: i === path.length - 2 };
    }
    d -= len;
  }
  return { at: path[0], dir: -1, over: false };
}

interface Look { top: string; topHi: string; legs: string; legs2: string; pack: string; packHi: string; hair: string; hairStyle: 'curly' | 'short' | 'ponytail' }

const ME: Look = { top: RIDER.top, topHi: RIDER.topHi, legs: '#16253a', legs2: '#1d3555', pack: KITE.main, packHi: '#ff8358', hair: RIDER.hair, hairStyle: 'curly' };

// Two friends waiting for the rider. ahead is how far along the trail each walks in front of the rider (in island
// units; negative means behind), so both keep the rider's pace. The one in front waits a little way up the trail;
// the one behind waits on the beach, `wait` units right of the trail start, and falls into place in the first steps.
const FRIENDS: { ahead: number; wait?: number; height: number; look: Look }[] = [
  { ahead: 9, height: 1, look: { top: '#3d7fd1', topHi: '#5e98de', legs: '#2a2f3a', legs2: '#363c4a', pack: '#1d3555', packHi: '#f2c14e', hair: '#2b1d14', hairStyle: 'short' } },
  { ahead: -9, wait: 11, height: 0.9, look: { top: '#f2c14e', topHi: '#f6d277', legs: '#1d3555', legs2: '#26446a', pack: '#1f8fa3', packHi: '#4fb8c9', hair: '#6b4226', hairStyle: 'ponytail' } },
];

const shadow = (g: G, u: number, dpr: number, k = 1) => {
  g.shadowColor = 'rgba(6,30,56,0.34)';
  g.shadowBlur = 1.5 * u * dpr * k;
  g.shadowOffsetY = 0.7 * u * dpr * k;
};
const flat = (g: G) => { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; };

// A sheet of cut peaks, with a folded left face and glued-on snow caps.
function paintPeaks(g: G, w: number, h: number, u: number, dpr: number, view: number, o: {
  seed: number; color: string; spacing: number; low: number; high: number; snow: number; lower: number;
}) {
  const r = rng(o.seed), pts: V2[] = [];
  let x = -o.spacing;
  while (x < w + o.spacing) {
    const end = 1 - o.lower * smooth(w - view * 1.2, w - view * 0.3, x);
    pts.push([x, h - o.low * h * (0.5 + r() * 0.6) * end]);
    x += o.spacing * (0.4 + 0.35 * r());
    pts.push([x, h - lerp(o.low * 1.6, o.high, Math.pow(r(), 0.8)) * h * end]);
    x += o.spacing * (0.4 + 0.35 * r());
  }
  shadow(g, u, dpr);
  poly(g, [[-o.spacing, h + 2], ...pts, [x, h + 2]]); g.closePath(); g.fillStyle = o.color; g.fill();
  flat(g);
  for (let i = 1; i < pts.length - 1; i += 2) {
    const pk = pts[i], lv = pts[i - 1], rv = pts[i + 1], drop = h - pk[1];
    poly(g, [lv, pk, [pk[0] + drop * 0.16, h], [lv[0], h]]); g.closePath();
    g.fillStyle = 'rgba(8,38,74,0.13)'; g.fill();
    if (drop < o.snow * h) continue;
    const k = Math.min(0.5, (h * 0.075) / drop + 0.12);
    const a: V2 = [lerp(pk[0], lv[0], k), lerp(pk[1], lv[1], k)], b: V2 = [lerp(pk[0], rv[0], k), lerp(pk[1], rv[1], k)];
    const zig: V2[] = [];
    for (let s = 1; s < 5; s++) zig.push([lerp(b[0], a[0], s / 5), lerp(b[1], a[1], s / 5) + (s % 2 ? 1 : -0.7) * drop * 0.07]);
    shadow(g, u, dpr, 0.3);
    poly(g, [a, pk, b, ...zig]); g.closePath(); g.fillStyle = '#fbfdff'; g.fill();
    flat(g);
    poly(g, [a, pk, zig[1], zig[2], zig[3]]); g.closePath(); g.fillStyle = 'rgba(110,150,205,0.22)'; g.fill();
  }
}

function paintCloud(g: G, w: number, h: number, u: number, dpr: number, r: () => number) {
  const base = h * 0.78, n = 4 + Math.floor(r() * 2);
  // Cut the shape first, flat along its base, then lay it down with its shadow.
  const cut = layer(w, h, dpr, (t) => {
    t.beginPath(); t.rect(0, 0, w, base); t.clip();
    t.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const rad = h * (0.2 + 0.2 * Math.sin((Math.PI * (i + 0.5)) / n) + r() * 0.05);
      t.beginPath(); t.arc(w * (0.2 + (0.6 * (i + 0.5)) / n), base - rad * 0.55, rad, 0, 7); t.fill();
    }
    t.beginPath(); t.roundRect(w * 0.1, base - h * 0.22, w * 0.8, h * 0.3, h * 0.11); t.fill();
  });
  shadow(g, u, dpr, 0.8);
  g.drawImage(cut.c, 0, 0, w, h);
  flat(g);
}

function paintHeadland(g: G, u: number, dpr: number) {
  const P = (pts: V2[]) => poly(g, pts.map(([x, y]) => [x * u, y * u] as V2));
  const fill = (pts: V2[], col: string, sh = 0) => { sh ? shadow(g, u, dpr, sh) : flat(g); P(pts); g.closePath(); g.fillStyle = col; g.fill(); flat(g); };
  const lx = 14, by = 35.5, top = 13.5;
  // Lighthouse: white tower, two red bands, red cap.
  const hw = (y: number) => lerp(2.1, 1.5, (by - y) / (by - top));
  const slab = (y0: number, y1: number): V2[] => [[lx - hw(y0), y0], [lx + hw(y0), y0], [lx + hw(y1), y1], [lx - hw(y1), y1]];
  fill(slab(by, top), '#fdfaf2', 0.6);
  fill(slab(by - 6, by - 9.4), '#e0533c');
  fill(slab(by - 14, by - 17.4), '#e0533c');
  fill([[lx - hw(by), by], [lx - hw(by) * 0.2, by], [lx - hw(top) * 0.2, top], [lx - hw(top), top]], 'rgba(18,48,88,0.12)');
  fill([[lx - 2.6, top], [lx + 2.6, top], [lx + 2.6, top - 0.7], [lx - 2.6, top - 0.7]], '#1d3555', 0.4);
  fill([[lx - 1.2, top - 0.7], [lx + 1.2, top - 0.7], [lx + 1.2, top - 3.3], [lx - 1.2, top - 3.3]], '#ffe9a0');
  fill([[lx - 1.8, top - 3.3], [lx + 1.8, top - 3.3], [lx, top - 6]], '#e0533c', 0.4);
  // Cliff in two sheets, grass on top.
  fill([[1, 48], [4.5, 39.5], [7.5, 35.6], [20, 34.6], [36, 35.2], [46, 37.2], [52, 42], [55, 48]], '#d4ab9b', 1);
  fill([[7.5, 35.6], [20, 34.6], [36, 35.2], [46, 37.2], [47, 38.6], [36, 36.8], [20, 36.2], [7, 37.2]], '#86b866', 0.3);
  fill([[1, 48], [3.6, 42.5], [14, 41.4], [26, 43], [40, 41.8], [50, 44.6], [55, 48]], '#b88d86', 0.5);
  // Breton flag (Gwenn-ha-du): a small one someone stuck in the grass at an angle. It stands on the far
  // side of the headland, so it is off-screen on the landing view and appears once the page scrolls.
  const fw = 3.3, fh = 2.2, pole = 5.4;
  g.save();
  g.translate(40 * u, 36.4 * u); g.rotate(0.3);
  shadow(g, u, dpr, 0.25);
  g.fillStyle = '#1d3555'; g.fillRect(-0.1 * u, -pole * u, 0.2 * u, pole * u);
  g.fillStyle = '#ffffff'; g.fillRect(0.1 * u, -pole * u, fw * u, fh * u);
  flat(g);
  g.fillStyle = '#1b1f2a';
  for (let i = 0; i < 9; i += 2) g.fillRect(0.1 * u, (-pole + (fh * i) / 9) * u, fw * u, (fh / 9) * u);
  const cw = fw * 0.42, ch = (fh * 4) / 9;
  g.fillStyle = '#ffffff'; g.fillRect(0.1 * u, -pole * u, cw * u, ch * u);
  g.fillStyle = '#1b1f2a';
  for (const [ex, ey] of [[0.22, 0.3], [0.5, 0.3], [0.78, 0.3], [0.36, 0.72], [0.64, 0.72]]) {
    g.beginPath(); g.arc((0.1 + cw * ex) * u, (-pole + ch * ey) * u, 0.09 * u, 0, 7); g.fill();
  }
  g.restore();
  return { lampX: lx * u, lampY: (48 - (top - 2)) * u };
}

function paintIsland(g: G, u: number, dpr: number) {
  const B = 44;
  const P = (pts: V2[]) => poly(g, pts.map(([x, y]) => [x * u, y * u] as V2));
  const fill = (pts: V2[], col: string, sh = 0) => { sh ? shadow(g, u, dpr, sh) : flat(g); P(pts); g.closePath(); g.fillStyle = col; g.fill(); flat(g); };
  fill([[10, B], [47, 9.5], [51, 8], [54, 9.6], [57, 8.4], [92, B]], '#82c79d', 1);
  fill([[10, B], [47, 9.5], [51, 8], [49, B]], 'rgba(10,62,72,0.13)');
  fill([[43.8, 12.5], [47, 9.5], [51, 8], [54, 9.6], [57, 8.4], [60.6, 12.2], [56.5, 14], [52, 12.4], [48, 14.6]], '#c2b29b', 0.3);
  const hill = (c: number, w: number, h: number, col: string) => {
    const pts: V2[] = [[c - w, B]];
    for (let i = 0; i <= 28; i++) {
      const k = -1 + (i / 28) * 2;
      pts.push([c + k * w, B - h * (1 - k * k) - 0.5 * Math.abs(Math.sin(i * 1.6))]);
    }
    pts.push([c + w, B]);
    fill(pts, col, 0.7);
  };
  hill(70, 22, 10.5, '#4fb06b');
  hill(27, 23, 14, '#3fa462');
  hill(52, 34, 5.5, '#2f8f58');
  fill([[4, B], [8, B - 2], [94, B - 2], [98, B]], '#f8e7b6', 0.5);
  const palm = (x: number, hgt: number, lean: number) => {
    const y0 = B - 1.4, cx = x + lean, cy = y0 - hgt;
    shadow(g, u, dpr, 0.3);
    g.beginPath(); g.moveTo(x * u, y0 * u); g.quadraticCurveTo((x + lean * 0.1) * u, (y0 - hgt * 0.55) * u, cx * u, cy * u);
    g.strokeStyle = '#9a6a44'; g.lineWidth = 0.8 * u; g.lineCap = 'round'; g.stroke();
    [200, 160, 125, 90, 55, 20, -20].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180, len = 5.2;
      const tx = cx + Math.cos(a) * len, ty = cy - Math.sin(a) * len + len * 0.36;
      const mx = cx + Math.cos(a) * len * 0.5, my = cy - Math.sin(a) * len * 0.72;
      g.beginPath(); g.moveTo(cx * u, cy * u);
      g.quadraticCurveTo(mx * u, (my - 1.1) * u, tx * u, ty * u);
      g.quadraticCurveTo(mx * u, (my + 1.1) * u, cx * u, cy * u);
      g.fillStyle = i % 2 ? '#4cbb6c' : '#2c9a57'; g.fill();
    });
    flat(g);
  };
  // The trail, as a dashed line like a route on a map.
  g.beginPath();
  TRAIL.slice(0, -1).forEach(([x, up], i) => (i ? g.lineTo(x * u, (B - up) * u) : g.moveTo(x * u, (B - up) * u)));
  g.setLineDash([1.1 * u, 0.9 * u]); g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#f6e7bd'; g.lineWidth = 0.5 * u; g.stroke();
  g.setLineDash([]);
  palm(9, 11, -1.6); palm(14, 8.5, 1.4); palm(88, 11.5, 1.6); palm(93, 8.5, -1.2);
  return { summitX: 52 * u, summitY: 36 * u };
}

function drawRider(g: G, x: number, y: number, S: number, ps: Pose, mono?: string) {
  const X = (v: V2) => x + v[0] * S, Y = (v: V2) => y - v[1] * S;
  const path = (pts: V2[], w: number, col: string) => {
    poly(g, pts.map((p) => [X(p), Y(p)] as V2));
    g.strokeStyle = mono ?? col; g.lineWidth = w * S; g.stroke();
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  path([ps.tail, ps.nose], 0.07, RIDER.board);
  path([ps.hip, ps.kneeB, ps.footB], 0.105, '#16253a');
  path([ps.hip, ps.kneeF, ps.footF], 0.11, '#1d3555');
  path([ps.hip, ps.shoulder], 0.18, RIDER.top);
  path([ps.shoulder, ps.elbow, ps.hand], 0.075, RIDER.topHi);
  path([ps.barA, ps.barB], 0.025, '#1d3555');
  const hx = X(ps.head), hy = Y(ps.head), hr = 0.082 * S;
  g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fillStyle = mono ?? RIDER.skin; g.fill();
  // Short curly hair: a cap with a scalloped edge.
  g.fillStyle = mono ?? RIDER.hair;
  g.beginPath(); g.arc(hx, hy, hr * 1.05, Math.PI * 0.92, Math.PI * 1.8); g.closePath(); g.fill();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.9 + (i / 6) * 0.92);
    g.beginPath(); g.arc(hx + Math.cos(a) * hr * 0.9, hy + Math.sin(a) * hr * 0.9, hr * 0.42, 0, 7); g.fill();
  }
}

// Someone on foot, with a backpack. (x, y) is where the feet touch the ground; dir is 1 facing right, -1 left.
function drawHiker(g: G, x: number, y: number, H: number, dir: number, phase: number, look: Look, mono?: string) {
  const sw = Math.sin(phase) * 0.17 * H;
  const c = (col: string) => mono ?? col;
  const line = (x0: number, y0: number, x1: number, y1: number, w: number, col: string) => {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = c(col); g.lineWidth = w * H; g.stroke();
  };
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.lineCap = 'round'; g.lineJoin = 'round';
  line(0, -0.46 * H, -sw, 0, 0.11, look.legs);
  line(0, -0.46 * H, sw, 0, 0.115, look.legs2);
  g.beginPath(); g.roundRect(-0.25 * H, -0.84 * H, 0.2 * H, 0.33 * H, 0.05 * H); g.fillStyle = c(look.pack); g.fill();
  if (!mono) { g.beginPath(); g.roundRect(-0.25 * H, -0.84 * H, 0.2 * H, 0.1 * H, 0.05 * H); g.fillStyle = look.packHi; g.fill(); }
  line(0, -0.46 * H, 0.05 * H, -0.78 * H, 0.19, look.top);
  line(0.05 * H, -0.76 * H, 0.04 * H - sw * 0.6, -0.5 * H, 0.07, look.topHi);
  const hx = 0.07 * H, hy = -0.93 * H, hr = 0.085 * H;
  if (look.hairStyle === 'ponytail') {
    g.save(); g.translate(hx - hr * 1.15, hy + hr * 0.45); g.rotate(-0.45);
    g.beginPath(); g.ellipse(0, 0, hr * 0.5, hr * 0.95, 0, 0, 7); g.fillStyle = c(look.hair); g.fill();
    g.restore();
  }
  g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fillStyle = c(RIDER.skin); g.fill();
  g.fillStyle = c(look.hair);
  g.beginPath(); g.arc(hx, hy, hr * 1.06, Math.PI * 0.92, Math.PI * 1.85); g.closePath(); g.fill();
  if (look.hairStyle === 'curly')
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.9 + (i / 6) * 0.92);
      g.beginPath(); g.arc(hx + Math.cos(a) * hr * 0.9, hy + Math.sin(a) * hr * 0.9, hr * 0.42, 0, 7); g.fill();
    }
  g.restore();
}

// A red and white buoy with a round plate on top. (x, y) is where it meets the water.
function drawBuoy(g: G, x: number, y: number, u: number, tilt: number, logo: HTMLImageElement, grow: number) {
  const R = 3.9 * u, cy = -5.6 * u - R;
  const hw = (v: number) => 1.3 + ((v + 4.2) / 5.7) * 1.4;
  g.save(); g.translate(x, y); g.rotate(tilt);
  for (const mono of ['rgba(4,30,60,0.16)', null]) {
    g.save();
    if (mono) g.translate(0.3 * u, 0.5 * u);
    poly(g, [[-2.7 * u, 1.5 * u], [2.7 * u, 1.5 * u], [1.3 * u, -4.2 * u], [-1.3 * u, -4.2 * u]]); g.closePath();
    g.fillStyle = mono ?? '#e0533c'; g.fill();
    if (!mono) {
      poly(g, [[-hw(-1.3) * u, -1.3 * u], [hw(-1.3) * u, -1.3 * u], [hw(-2.7) * u, -2.7 * u], [-hw(-2.7) * u, -2.7 * u]]); g.closePath();
      g.fillStyle = '#fdfaf2'; g.fill();
    }
    g.fillStyle = mono ?? '#1d3555'; g.fillRect(-0.22 * u, -5.7 * u, 0.44 * u, 1.6 * u);
    g.beginPath(); g.arc(0, cy, R, 0, 7); g.fillStyle = mono ?? '#fdfaf2'; g.fill();
    g.restore();
  }
  if (logo.complete && logo.naturalWidth) {
    // Largest size at which the logo's rectangle still fits inside the plate, with a margin.
    const a = logo.naturalWidth / logo.naturalHeight, h = ((2 * R * 0.84) / Math.sqrt(1 + a * a)) * grow, w = a * h;
    g.drawImage(logo, -w / 2, cy - h / 2, w, h);
  }
  g.restore();
}

function drawKite(g: G, kx: number, ky: number, phi: number, R: number, mono?: string) {
  const n = 35, ks = kiteShape(kx, ky, phi, R, n);
  const band = (a: number, b: number, inner = 1) => {
    g.beginPath();
    for (let i = a; i <= b; i++) i === a ? g.moveTo(ks.outer[i][0], ks.outer[i][1]) : g.lineTo(ks.outer[i][0], ks.outer[i][1]);
    for (let i = b; i >= a; i--) g.lineTo(lerp(ks.outer[i][0], ks.inner[i][0], inner), lerp(ks.outer[i][1], ks.inner[i][1], inner));
    g.closePath();
  };
  if (mono) { band(0, n); g.fillStyle = mono; g.fill(); return; }
  const cols = [KITE.main, '#ff8358', KITE.light, KITE.main, KITE.light, '#ff8358', KITE.main];
  cols.forEach((c, i) => { band(i * 5, i * 5 + 5); g.fillStyle = c; g.fill(); });
  band(0, n, 0.16); g.fillStyle = KITE.edge; g.fill();
  // Fold: the inner half of the canopy sits in shade.
  g.beginPath();
  for (let i = 0; i <= n; i++) { const x = lerp(ks.outer[i][0], ks.inner[i][0], 0.6), y = lerp(ks.outer[i][1], ks.inner[i][1], 0.6); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  for (let i = n; i >= 0; i--) g.lineTo(ks.inner[i][0], ks.inner[i][1]);
  g.closePath(); g.fillStyle = 'rgba(60,20,30,0.13)'; g.fill();
}

interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; rot: number }

export const mount: Mount = (canvas, opts) => {
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, dpr = 1, cam = 0, u = 1, L: Lay;
  let far: Layer, mid: Layer, headland: Layer, island: Layer, cloudArt: Layer[] = [], grain: CanvasPattern | null = null;
  let lamp = { lampX: 0, lampY: 0 }, isl = { summitX: 0, summitY: 0 };
  let clouds: { art: Layer; x: number; y: number; s: number; par: number; drift: number }[] = [];
  const rider = new Rider(), bits: Bit[] = [], rnd = rng(3);
  const logos = BUOYS.map((b) => { const im = new Image(); im.src = `${import.meta.env.BASE_URL}logos/${b.logo}`; return im; });
  let auto = 0; // seconds spent at the end of the page, during which the hiker keeps walking

  function resize(w: number, h: number) {
    W = w; H = h; u = h / 100;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (w * h));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    L = layout(w, h);
    cam = TRAVEL * h;
    far = layer(w + cam * FAR + 8, h * 0.34, dpr, (g) => paintPeaks(g, w + cam * FAR + 8, h * 0.34, u, dpr, w, {
      seed: 21, color: '#a9c4dd', spacing: 30 * u, low: 0.18, high: 0.86, snow: 0.2, lower: 0.65 }));
    mid = layer(w + cam * MID + 8, h * 0.2, dpr, (g) => paintPeaks(g, w + cam * MID + 8, h * 0.2, u, dpr, w, {
      seed: 5, color: '#6c93b8', spacing: 21 * u, low: 0.14, high: 0.72, snow: 0.125, lower: 0.5 }));
    headland = layer(58 * u, 50 * u, dpr, (g) => { lamp = paintHeadland(g, u, dpr); });
    island = layer(102 * u * 0.85, 46 * u * 0.85, dpr, (g) => { isl = paintIsland(g, u * 0.85, dpr); });
    const cr = rng(12);
    cloudArt = [0, 1, 2].map(() => layer(34 * u, 13 * u, dpr, (g) => paintCloud(g, 34 * u, 11 * u, u, dpr, cr)));
    clouds = [];
    for (let i = 0; i < 3; i++) {
      const big = true;
      clouds.push({ art: cloudArt[i % 3], x: ((i + cr() * 0.5) / 3) * (w + 50 * u), y: h * (big ? 0.07 + cr() * 0.13 : 0.3 + cr() * 0.08),
        s: big ? 0.8 + cr() * 0.3 : 0.45, par: big ? 0.09 : 0.05, drift: big ? 0.8 : 0.4 });
    }
    // Paper grain.
    const tile = document.createElement('canvas');
    tile.width = tile.height = 180;
    const tg = tile.getContext('2d')!, id = tg.createImageData(180, 180), gr = rng(77);
    for (let i = 0; i < id.data.length; i += 4) { const v = 232 + gr() * 23; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    tg.putImageData(id, 0, 0);
    grain = ctx.createPattern(tile, 'repeat');
  }

  const strip = (l: Layer, par: number, y: number, p: number) => {
    const off = Math.round(p * cam * par * dpr), sw = Math.min(W * dpr, l.c.width - off);
    ctx.drawImage(l.c, off, 0, sw, l.c.height, 0, y, sw / dpr, l.h);
  };

  // A dynamic sheet: two faint offset copies stand in for the shadow it casts on the sheet behind.
  const sheet = (pts: V2[], col: string, lift = 1) => {
    for (const [dy, a] of [[-0.95, 0.06], [-0.45, 0.1]]) {
      ctx.save(); ctx.translate(0, dy * u * lift); poly(ctx, pts); ctx.closePath(); ctx.fillStyle = `rgba(4,30,60,${a})`; ctx.fill(); ctx.restore();
    }
    poly(ctx, pts); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };

  function frame({ t, dt, p, vel }: { t: number; dt: number; p: number; vel: number }) {
    const J = journey(p), hz = L.hz, cam0 = p * cam, seaH = H - hz;
    rider.update(dt, vel);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky: three sheets, darkest on top.
    ctx.fillStyle = css(J.skyLow); ctx.fillRect(0, 0, W, hz + 2);
    const sunX = W * (0.47 + 0.05 * p), sunY = H * (0.15 + 0.13 * p);
    const bands: [number, RGB][] = [[0.8, mix(J.skyMid, J.skyLow, 0.45)], [0.56, J.skyMid], [0.3, mix(J.skyTop, J.skyMid, 0.35)]];
    bands.forEach(([f, col], k) => {
      const pts: V2[] = [[-10, -10]];
      for (let x = -10; x <= W + 10; x += 24) pts.push([x, hz * f + 1.3 * u * Math.sin(x / (26 * u) + k * 2.1 + cam0 * 0.0006)]);
      pts.push([W + 10, -10]);
      ctx.save(); ctx.scale(1, 1);
      for (const [dy, a] of [[0.9, 0.05], [0.4, 0.08]]) { ctx.save(); ctx.translate(0, dy * u); poly(ctx, pts); ctx.closePath(); ctx.fillStyle = `rgba(4,30,60,${a})`; ctx.fill(); ctx.restore(); }
      poly(ctx, pts); ctx.closePath(); ctx.fillStyle = css(col); ctx.fill();
      ctx.restore();
    });
    // Sun: stacked paper discs.
    for (const [r, a] of [[12.5, 0.16], [8.6, 0.24], [5.6, 0.4]]) { ctx.beginPath(); ctx.arc(sunX, sunY, r * u, 0, 7); ctx.fillStyle = css(J.sun, a); ctx.fill(); }
    ctx.beginPath(); ctx.arc(sunX, sunY + 0.4 * u, 3.5 * u, 0, 7); ctx.fillStyle = 'rgba(4,30,60,0.12)'; ctx.fill();
    ctx.beginPath(); ctx.arc(sunX, sunY, 3.5 * u, 0, 7); ctx.fillStyle = '#fff9e0'; ctx.fill();

    const span = W + 60 * u;
    for (const c of clouds) {
      const x = ((((c.x - cam0 * c.par - t * c.drift * u) % span) + span) % span) - 40 * u;
      ctx.drawImage(c.art.c, x, c.y, c.art.w * c.s, c.art.h * c.s);
    }
    strip(far, FAR, hz - far.h + 1, p);
    strip(mid, MID, hz - mid.h + 1, p);

    // Sea: the far water is a flat sheet, then scalloped strips sliding side to side.
    const seaCol = (f: number) => (f < 0.4 ? mix(J.seaFar, J.seaMid, f / 0.4) : mix(J.seaMid, J.seaNear, (f - 0.4) / 0.6));
    ctx.fillStyle = css(seaCol(0)); ctx.fillRect(0, hz, W, seaH);
    const NS = 8;
    const base = (i: number) => hz + seaH * Math.pow(i / NS, 1.3);
    const ampOf = (i: number) => u * (0.6 + 2.3 * (i / NS));
    const wave = (i: number) => {
      const f = i / NS, y = base(i) + Math.sin(t * 1.1 + i * 1.3) * 0.3 * u, A = ampOf(i), wl = u * (7 + 22 * f);
      const off = cam0 * (0.5 + 0.8 * f) + (i % 2 ? 1 : -1) * Math.sin(t * 0.8 + i) * wl * 0.28 + t * u * (0.6 + f * 2);
      const pts: V2[] = [[-20, H + 20]];
      for (let x = -20; x <= W + 20; x += 6) pts.push([x, y - A * (1 - Math.abs(Math.sin((Math.PI * (x + off)) / wl)))]);
      pts.push([W + 20, H + 20]);
      if (i % 2) { ctx.save(); ctx.translate(0, -0.38 * u); poly(ctx, pts); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); ctx.restore(); }
      const c = seaCol(f);
      sheet(pts, css(i % 2 ? c : mix(c, hex('#ffffff'), 0.05)), i % 2 ? 0 : 1);
    };

    // Buoys ride the same strips as the waves, so the strip in front hides their base. They come in from
    // the right as the work section arrives and leave on the left once it has passed.
    const workAt = opts.sectionAt?.('work') ?? 0.25;
    const seaStrip = (i: number) => {
      BUOYS.forEach((b, n) => {
        if (b.strip !== i) return;
        const x = b.fx * W + (workAt - p) * cam * (0.5 + 0.8 * (i / NS));
        if (x < -10 * u || x > W + 10 * u) return;
        drawBuoy(ctx, x, base(i) - ampOf(i) * 0.5 + Math.sin(t * 1.1 + i * 1.3) * 0.3 * u + b.dy * u, u, Math.sin(t * 0.9 + n * 2.1) * 0.06, logos[n], b.grow);
      });
      wave(i);
    };

    // Landmarks stand behind the first strip.
    const hx = place(L, 0, 0.972, COAST) - lamp.lampX - cam0 * COAST;
    if (hx + headland.w > 0) ctx.drawImage(headland.c, hx, hz + 2.2 * u - headland.h, headland.w, headland.h);
    // The ending, driven by the last stretch of the page: sail to the beach, land the kite, set off on foot
    // with two friends who were waiting there, one leading and one behind. Once at the bottom, the group keeps
    // walking over the summit.
    const E = clamp((p - 0.88) / 0.12);
    const land = smooth(0, 0.42, E), drop = smooth(0.42, 0.6, E), hike = clamp((E - 0.6) / 0.4);
    auto = E >= 1 ? auto + dt : 0;
    const walked = (hike * 0.27 + Math.min(1, auto / 30) * 0.73) * (TRAIL_TOTAL + 14);

    // The island comes into view from mid-journey and grows as we approach; it has settled for the last stretch.
    const ui = u * 0.85, near = smooth(0.46, 0.88, p), isc = lerp(0.5, 1, near);
    const summitX = lerp(W + island.w * 0.34, W * (W / H > 1.2 ? 0.86 : 0.6), near);
    const ix = summitX - isl.summitX * isc, shore = hz + 0.5 * u;
    const onIsland = (v: V2): V2 => [ix + v[0] * ui * isc, shore - v[1] * ui * isc];
    const Sb = 7.4 * ui;
    const crest = CREST.map(onIsland);
    // Draws a hiker, hidden below the crest once they are past the summit.
    const hiker = (spot: { at: V2; dir: number; over: boolean }, size: number, phase: number, look: Look) => {
      const at = onIsland(spot.at);
      ctx.save();
      if (spot.over) { poly(ctx, [[crest[0][0], -H], ...crest, [crest[crest.length - 1][0], -H]]); ctx.closePath(); ctx.clip(); }
      drawHiker(ctx, at[0] + 0.12 * u * isc, at[1] + 0.2 * u * isc, size, spot.dir, phase, look, 'rgba(4,30,60,0.16)');
      drawHiker(ctx, at[0], at[1], size, spot.dir, phase, look);
      ctx.restore();
    };
    if (ix < W + 4 * u) {
      ctx.drawImage(island.c, ix, shore + 2 * ui * isc - island.h * isc, island.w * isc, island.h * isc);
      const wr = cloudArt[1];
      ctx.drawImage(wr.c, summitX - wr.w * 0.2 * isc, shore - (isl.summitY + 4.5 * u) * isc, wr.w * 0.5 * isc, wr.h * 0.5 * isc);
      for (const f of FRIENDS) {
        const onTrail = walked + f.ahead;
        let spot;
        if (f.ahead > 0) {
          spot = along(TRAIL, onTrail);
          if (walked === 0) spot.dir = -1; // waiting, looking down towards the beach
        } else {
          const wait = f.wait ?? -f.ahead, catchUp = (wait + f.ahead) * smooth(0, 6, walked);
          spot = along([[TRAIL[0][0] + wait, TRAIL[0][1]], ...TRAIL], walked + catchUp);
        }
        hiker(spot, Sb * isc * f.height * (1 - 0.2 * clamp(Math.max(0, onTrail) / TRAIL_TOTAL)), onTrail * 1.3, f.look);
      }
    }

    let j0 = 1;
    while (j0 < NS && base(j0) < L.ry) j0++;
    const ride = base(j0) - ampOf(j0) * 0.95 + Math.sin(t * 1.1 + j0 * 1.3) * 0.3 * u;
    const beach = onIsland(TRAIL[0]);
    const k = lerp(1, Sb / L.S, land), S = L.S * k;
    const rx = lerp(L.rx, beach[0], land), water = lerp(ride, beach[1], land);
    let j = 1;
    while (j < NS && base(j) < water) j++;
    for (let i = 1; i < j; i++) seaStrip(i);

    // Kite, lines and rider sit between two strips of sea, or on the sand once ashore.
    const ps = pose(rider, t), ry = water - rider.y * S * (1 - land);
    const hand: V2 = [rx + ps.hand[0] * S, ry - ps.hand[1] * S];
    const [k0x, k0y] = kiteAt(L, rider, t), R = L.R * k;
    const flyX = rx + (k0x - L.rx) * k, flyY = ry + (k0y - L.ry) * k;
    // Landed, the kite rests on its tips on the sand, arching upwards.
    const kx = lerp(flyX, beach[0] - 2.2 * Sb, drop), ky = lerp(flyY, beach[1] - R * 0.31, drop);
    const phi = lerp(Math.atan2(flyY - hand[1], flyX - hand[0]), -Math.PI / 2, drop);
    const ks = kiteShape(kx, ky, phi, R, 35);
    if (drop < 1) {
      ctx.strokeStyle = `rgba(255,252,240,${0.85 * (1 - drop)})`; ctx.lineWidth = Math.max(1, 0.1 * u * Math.sqrt(k)); ctx.lineCap = 'round';
      for (const [b, n] of [[ps.barA, 0], [ps.barB, 35]] as [V2, number][]) {
        ctx.beginPath(); ctx.moveTo(rx + b[0] * S, ry - b[1] * S); ctx.lineTo(ks.outer[n][0], ks.outer[n][1]); ctx.stroke();
      }
    }
    drawKite(ctx, kx + 0.35 * u * k, ky + 0.7 * u * k, phi, R, 'rgba(4,30,60,0.16)');
    drawKite(ctx, kx, ky, phi, R);
    if (drop < 0.5) {
      drawRider(ctx, rx + 0.25 * u * k, ry + 0.45 * u * k, S, ps, 'rgba(4,30,60,0.16)');
      drawRider(ctx, rx, ry, S, ps);
    } else {
      // Board left on the sand; the hiker follows the trail with the scroll, then keeps walking to the summit.
      ctx.beginPath(); ctx.moveTo(beach[0] - 1.25 * Sb, beach[1] + 0.02 * Sb); ctx.lineTo(beach[0] - 0.4 * Sb, beach[1] - 0.03 * Sb);
      ctx.strokeStyle = RIDER.board; ctx.lineWidth = 0.07 * Sb; ctx.lineCap = 'round'; ctx.stroke();
      hiker(along(TRAIL, walked), Sb * (1 - 0.2 * clamp(walked / TRAIL_TOTAL)), walked * 1.3, ME);
    }

    // Spray as paper confetti, while riding.
    if (rider.airAmt < 0.4 && land < 0.15)
      for (let n = (12 + 26 * rider.speed) * dt + rnd(); n >= 1; n--)
        bits.push({ x: rx + ps.tail[0] * S, y: water, vx: -(0.5 + rnd() * 1.5) * S, vy: -(0.6 + rnd() * 1.6) * S, life: 0, max: 0.5 + rnd() * 0.5, r: (0.016 + rnd() * 0.02) * S, rot: rnd() * 6 });
    if (rider.landed && land < 0.15) for (let i = 0; i < 26; i++) bits.push({ x: rx + (rnd() - 0.5) * S, y: water, vx: (rnd() - 0.5) * 3 * S, vy: -(0.8 + rnd() * 2.2) * S, life: 0, max: 0.6 + rnd() * 0.4, r: (0.03 + rnd() * 0.03) * S, rot: rnd() * 6 });
    for (let i = bits.length - 1; i >= 0; i--) {
      const q = bits[i];
      q.life += dt;
      if (q.life > q.max) { bits.splice(i, 1); continue; }
      q.vy += 4.2 * S * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * 6;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.globalAlpha = Math.min(1, (1 - q.life / q.max) * 2.5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-q.r, -q.r * 0.7, q.r * 2, q.r * 1.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (let i = j; i <= NS; i++) seaStrip(i);

    if (grain) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = grain; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  drive(canvas, opts, { resize, frame });
};
