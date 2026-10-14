// Painted scene: smooth gradients, soft light and atmospheric depth.
import {
  clamp, smooth, hash, noise1, ridged, rng, hex, mix, css, journey, layout, place, pose, kiteAt, kiteShape,
  drive, layer, poly, Rider, TRAVEL, KITE, RIDER,
  type V2, type Lay, type Mount, type Pose, type G, type Layer,
} from './core';

const COAST = 0.7, FAR = 0.05, MID = 0.1;

// A mountain range: gradient silhouette, snow above a jagged line, shaded left faces, base fading into haze.
function paintRange(g: G, w: number, h: number, view: number, o: {
  seed: number; freq: number; base: number; top: string; bottom: string; shade: string; snow: number; fade: number; lower: number;
}) {
  const step = 4, sky: V2[] = [];
  for (let x = 0; x <= w + step; x += step) {
    const r = clamp((ridged(x * o.freq, o.seed, 5) - 0.1) / 0.55);
    const end = 1 - o.lower * smooth(w - view * 1.2, w - view * 0.3, x);
    const env = (0.5 + 0.5 * noise1(x * o.freq * 0.4, o.seed + 99)) * end;
    sky.push([x, h - (o.base * h * (0.5 + 0.5 * end) + (1 - o.base) * h * 0.98 * Math.pow(r, 1.2) * env)]);
  }
  const outline = () => { poly(g, [[0, h], ...sky, [w + step, h]]); g.closePath(); };
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, o.top); grad.addColorStop(1, o.bottom);
  outline(); g.fillStyle = grad; g.fill();
  g.save(); outline(); g.clip();
  // Snow.
  const line: V2[] = [];
  for (let x = w + step; x >= 0; x -= step) {
    const tri = Math.abs(((x * 0.021 + noise1(x * 0.01, o.seed + 3) * 2) % 1) - 0.5) * 2;
    line.push([x, h * (o.snow + 0.1 * tri + 0.07 * noise1(x * 0.012, o.seed + 4))]);
  }
  const sg = g.createLinearGradient(0, 0, 0, h * (o.snow + 0.15));
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#e4eef9');
  poly(g, [[0, 0], [w + step, 0], ...line]); g.closePath(); g.fillStyle = sg; g.fill();
  // Shaded left faces: from each peak, a ridge runs down to the base.
  g.beginPath();
  const n = sky.length;
  for (let i = 6; i < n - 6; i++) {
    let peak = true;
    for (let k = 1; k <= 6 && peak; k++) if (sky[i - k][1] < sky[i][1] || sky[i + k][1] <= sky[i][1]) peak = false;
    if (!peak || h - sky[i][1] < h * 0.22) continue;
    let j = i;
    while (j > 0 && sky[j - 1][1] >= sky[j][1] - 0.5) j--;
    const [px, py] = sky[i], drop = h - py;
    g.moveTo(sky[j][0] - (h - sky[j][1]) * 0.45, h);
    for (let k = j; k <= i; k++) g.lineTo(sky[k][0], sky[k][1]);
    for (let s = 1; s <= 4; s++) { const t = s / 4; g.lineTo(px + drop * (0.3 * t + 0.07 * Math.sin(t * 8 + i)), py + drop * t); }
    g.closePath();
  }
  g.fillStyle = o.shade; g.fill();
  g.restore();
  g.globalCompositeOperation = 'destination-out';
  const fg = g.createLinearGradient(0, h * 0.55, 0, h);
  fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, `rgba(0,0,0,${o.fade})`);
  g.fillStyle = fg; g.fillRect(0, h * 0.55, w + step, h * 0.45);
  g.globalCompositeOperation = 'source-over';
}

function paintCloud(g: G, w: number, h: number, r: () => number) {
  const base = h * 0.8;
  g.save();
  g.beginPath();
  g.ellipse(w / 2, base, w / 2, h * 0.8, 0, Math.PI, Math.PI * 2);
  g.ellipse(w / 2, base, w / 2, h * 0.16, 0, 0, Math.PI);
  g.clip();
  const n = 7 + Math.floor(r() * 4), puffs: number[][] = [];
  for (let i = 0; i < n; i++) {
    const rad = h * (0.2 + 0.26 * Math.sin((Math.PI * (i + 0.5)) / n) + r() * 0.07);
    puffs.push([w * (0.24 + (0.52 * (i + r() * 0.6)) / n), base - rad * 0.72 - r() * h * 0.05, rad]);
  }
  g.fillStyle = '#fff';
  for (const [x, y, rad] of puffs) { g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, h * 0.3, 0, base + h * 0.1);
  sh.addColorStop(0, 'rgba(150,180,214,0)'); sh.addColorStop(1, 'rgba(138,170,208,0.8)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  for (const [x, y, rad] of puffs) {
    const hl = g.createRadialGradient(x + rad * 0.2, y - rad * 0.35, 0, x + rad * 0.2, y - rad * 0.35, rad);
    hl.addColorStop(0, 'rgba(255,255,255,0.95)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  g.restore();
}

// Brittany headland with its lighthouse. u = 1% of the screen height; the waterline is the bottom edge.
function paintHeadland(g: G, u: number) {
  g.translate(0, 12 * u);
  const top: V2[] = [];
  for (let x = 8; x <= 58; x += 2) top.push([x, 21 - 2.2 * smooth(8, 40, x) + 3 * smooth(40, 58, x) + 0.6 * noise1(x * 0.3, 5)]);
  const P = (pts: V2[]) => poly(g, pts.map(([x, y]) => [x * u, y * u] as V2));
  const cliff: V2[] = [[1.5, 34], [3.5, 30], [5, 26.5], [6.4, 23], ...top, [61, 26], [63, 30], [65, 34]];
  const cg = g.createLinearGradient(0, 18 * u, 0, 34 * u);
  cg.addColorStop(0, '#dcb19e'); cg.addColorStop(1, '#a37c80');
  P(cliff); g.closePath(); g.fillStyle = cg; g.fill();
  g.save(); P(cliff); g.closePath(); g.clip();
  P([[1.5, 34], [3.5, 30], [5, 26.5], [6.4, 23], [8, 21], [11.5, 24.5], [10.5, 29], [12.5, 34]]);
  g.closePath(); g.fillStyle = 'rgba(74,48,78,0.38)'; g.fill();
  for (let i = 0; i < 8; i++) {
    const x = 14 + i * 6.2 + hash(i) * 2;
    P([[x, 19], [x + 2.6, 19], [x + 3.4 + hash(i + 9), 34], [x - 1.2, 34]]);
    g.closePath(); g.fillStyle = i % 2 ? 'rgba(255,236,222,0.14)' : 'rgba(70,40,66,0.12)'; g.fill();
  }
  const wet = g.createLinearGradient(0, 30 * u, 0, 34 * u);
  wet.addColorStop(0, 'rgba(48,34,58,0)'); wet.addColorStop(1, 'rgba(48,34,58,0.5)');
  g.fillStyle = wet; g.fillRect(0, 30 * u, 66 * u, 4 * u);
  g.restore();
  // Grass along the top.
  const grass: V2[] = [[6, 23.4], ...top, [61, 26.4]];
  P([...grass, ...grass.slice().reverse().map(([x, y]) => [x, y + 1.5] as V2)]);
  g.closePath(); g.fillStyle = '#74ab58'; g.fill();
  P(grass); g.strokeStyle = '#a9d67a'; g.lineWidth = 0.35 * u; g.lineJoin = 'round'; g.stroke();
  // Lighthouse.
  const lx = 15, by = 20.8, th = 22, top2 = by - th;
  const tg = g.createLinearGradient((lx - 1.9) * u, 0, (lx + 1.9) * u, 0);
  tg.addColorStop(0, '#9db0c6'); tg.addColorStop(0.38, '#e6ecf1'); tg.addColorStop(0.72, '#ffffff'); tg.addColorStop(1, '#e3ded4');
  P([[lx - 1.9, by], [lx + 1.9, by], [lx + 1.3, top2], [lx - 1.3, top2]]); g.closePath(); g.fillStyle = tg; g.fill();
  g.fillStyle = '#8f868d'; g.fillRect((lx - 2.3) * u, (by - 1) * u, 4.6 * u, 1.2 * u);
  g.fillStyle = '#2b3a4c';
  for (const f of [0.28, 0.52, 0.76]) g.fillRect((lx - 0.1) * u, (by - th * f) * u, 0.5 * u, 1 * u);
  const ug = g.createLinearGradient(0, top2 * u, 0, (top2 + 2.4) * u);
  ug.addColorStop(0, 'rgba(40,60,90,0.35)'); ug.addColorStop(1, 'rgba(40,60,90,0)');
  g.fillStyle = ug; g.fillRect((lx - 1.4) * u, top2 * u, 2.8 * u, 2.4 * u);
  g.fillStyle = '#263240'; g.fillRect((lx - 2.5) * u, (top2 - 0.5) * u, 5 * u, 0.55 * u);
  g.strokeStyle = '#263240'; g.lineWidth = 0.14 * u;
  g.strokeRect((lx - 2.4) * u, (top2 - 1.5) * u, 4.8 * u, 1 * u);
  const lg = g.createLinearGradient((lx - 1.1) * u, 0, (lx + 1.1) * u, 0);
  lg.addColorStop(0, '#b5dcee'); lg.addColorStop(0.5, '#fff4b4'); lg.addColorStop(1, '#d9eff7');
  g.fillStyle = lg; g.fillRect((lx - 1.1) * u, (top2 - 3.1) * u, 2.2 * u, 2.6 * u);
  g.strokeRect((lx - 1.1) * u, (top2 - 3.1) * u, 2.2 * u, 2.6 * u);
  const rg = g.createLinearGradient((lx - 1.5) * u, 0, (lx + 1.5) * u, 0);
  rg.addColorStop(0, '#a2322a'); rg.addColorStop(0.65, '#e9583f'); rg.addColorStop(1, '#d24a35');
  g.beginPath(); g.moveTo((lx - 1.5) * u, (top2 - 3.1) * u);
  g.quadraticCurveTo(lx * u, (top2 - 6.4) * u, (lx + 1.5) * u, (top2 - 3.1) * u); g.closePath();
  g.fillStyle = rg; g.fill();
  g.fillStyle = '#263240'; g.fillRect((lx - 0.08) * u, (top2 - 6) * u, 0.16 * u, 1.3 * u);
  return { lampX: lx * u, lampY: (34 - (top2 - 1.8)) * u };
}

// Volcanic island. The waterline is the bottom edge.
function paintIsland(g: G, u: number) {
  const W = 120, B = 46, SX = 74, VH = 40;
  const taper = (x: number) => smooth(2, 16, x) * smooth(W - 2, W - 16, x);
  const vol = (x: number) => {
    const k = x < SX ? (SX - x) / 62 : (x - SX) / 46;
    let v = VH * 1.07 * Math.pow(Math.max(0, 1 - k), 1.25) + 0.7 * noise1(x * 0.4, 21);
    if (v > VH - 2.5) v = VH - 2.5 - (v - VH + 2.5) * 0.5;
    return v * taper(x);
  };
  const P = (pts: V2[]) => poly(g, pts.map(([x, y]) => [x * u, y * u] as V2));
  const sky: V2[] = [];
  for (let x = 4; x <= W - 2; x += 1) sky.push([x, B - 1.5 - vol(x)]);
  const vg = g.createLinearGradient(0, (B - VH) * u, 0, B * u);
  vg.addColorStop(0, '#a7c9b0'); vg.addColorStop(0.3, '#84c198'); vg.addColorStop(1, '#5bb07a');
  P([[4, B], ...sky, [W - 2, B]]); g.closePath(); g.fillStyle = vg; g.fill();
  g.save(); P([[4, B], ...sky, [W - 2, B]]); g.closePath(); g.clip();
  const rk = g.createLinearGradient(0, (B - VH) * u, 0, (B - VH + 13) * u);
  rk.addColorStop(0, 'rgba(176,160,140,0.95)'); rk.addColorStop(1, 'rgba(176,160,140,0)');
  g.fillStyle = rk; g.fillRect(0, 0, W * u, B * u);
  g.beginPath(); g.moveTo(0, B * u);
  for (const [x, y] of sky) if (x <= SX) g.lineTo(x * u, y * u);
  for (let s = 1; s <= 8; s++) { const t = s / 8; g.lineTo((SX + 7 * Math.sin(t * 2.4) - 9 * t) * u, (B - VH + VH * t) * u); }
  g.closePath(); g.fillStyle = 'rgba(22,84,86,0.17)'; g.fill();
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = -1 + (i / 5) * 2, len = VH * (0.55 + 0.3 * hash(i + 4));
    g.beginPath(); g.moveTo((SX + a * 3) * u, (B - VH + 7) * u);
    g.quadraticCurveTo((SX + a * 14) * u, (B - VH + len * 0.5) * u, (SX + a * (20 + len * 0.55)) * u, (B - VH + len + 6) * u);
    g.strokeStyle = a < 0 ? 'rgba(20,80,70,0.1)' : 'rgba(225,255,215,0.1)'; g.lineWidth = (0.5 + 0.5 * hash(i)) * u; g.stroke();
  }
  g.restore();
  // Forested hills in front.
  const hills: [number, number, number][] = [[26, 30, 12], [100, 20, 9.5], [62, 44, 5.5]];
  const bump = (k: number) => Math.max(0, 1 - k * k);
  const hill = (x: number) => Math.max(...hills.map(([c, w, h]) => h * bump((x - c) / w))) * taper(x);
  const canopy: V2[] = [];
  for (let x = 3; x <= W - 3; x += 0.5) canopy.push([x, B - 1.6 - hill(x) - 0.45 * Math.abs(Math.sin(x * 1.5)) * taper(x)]);
  const hg = g.createLinearGradient(0, (B - 14) * u, 0, B * u);
  hg.addColorStop(0, '#58c06c'); hg.addColorStop(1, '#2b8a55');
  P([[3, B], ...canopy, [W - 3, B]]); g.closePath(); g.fillStyle = hg; g.fill();
  g.save(); P([[3, B], ...canopy, [W - 3, B]]); g.closePath(); g.clip();
  for (const [c, w, h] of hills) {
    const hl = g.createRadialGradient((c + w * 0.35) * u, (B - h) * u, 0, (c + w * 0.35) * u, (B - h) * u, w * 0.8 * u);
    hl.addColorStop(0, 'rgba(196,246,150,0.5)'); hl.addColorStop(1, 'rgba(196,246,150,0)');
    g.fillStyle = hl; g.fillRect(0, 0, W * u, B * u);
    const sd = g.createRadialGradient((c - w * 0.6) * u, (B - 1) * u, 0, (c - w * 0.6) * u, (B - 1) * u, w * 0.7 * u);
    sd.addColorStop(0, 'rgba(14,74,62,0.45)'); sd.addColorStop(1, 'rgba(14,74,62,0)');
    g.fillStyle = sd; g.fillRect(0, 0, W * u, B * u);
  }
  g.restore();
  // Beach.
  const bg = g.createLinearGradient(0, (B - 2.2) * u, 0, B * u);
  bg.addColorStop(0, '#fff5d4'); bg.addColorStop(1, '#ecd39a');
  g.beginPath(); g.moveTo(4 * u, B * u);
  g.quadraticCurveTo(8 * u, (B - 2.3) * u, 18 * u, (B - 2.1) * u);
  g.lineTo((W - 18) * u, (B - 2.1) * u);
  g.quadraticCurveTo((W - 8) * u, (B - 2.3) * u, (W - 4) * u, B * u);
  g.closePath(); g.fillStyle = bg; g.fill();
  // Palms.
  const palm = (x: number, hgt: number, lean: number) => {
    const y0 = B - 1.2, cx = x + lean, cy = y0 - hgt;
    g.lineCap = 'round';
    for (const [col, wd, dx] of [['#7b5033', 0.75, 0], ['#b8875a', 0.22, 0.14]] as [string, number, number][]) {
      g.beginPath(); g.moveTo((x + dx) * u, y0 * u);
      g.quadraticCurveTo((x + dx + lean * 0.15) * u, (y0 - hgt * 0.55) * u, (cx + dx) * u, cy * u);
      g.strokeStyle = col; g.lineWidth = wd * u; g.stroke();
    }
    const greens = ['#237f49', '#2f9e58', '#46b868', '#2a9052'];
    [205, 165, 135, 100, 68, 35, 5, -30].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180, len = 4.6 + hash(x + deg) * 1.6;
      const tx = cx + Math.cos(a) * len, ty = cy - Math.sin(a) * len + len * 0.42;
      const mx = cx + Math.cos(a) * len * 0.55, my = cy - Math.sin(a) * len * 0.75;
      g.beginPath(); g.moveTo(cx * u, cy * u);
      g.quadraticCurveTo(mx * u, (my - 0.9) * u, tx * u, ty * u);
      g.quadraticCurveTo(mx * u, (my + 0.9) * u, cx * u, cy * u);
      g.fillStyle = greens[i % 4]; g.fill();
    });
  };
  ([[9, 10.5, -1.6], [13.5, 8, 1.4], [47, 9.5, 1.2], [108, 11, 1.6], [113, 8, -1.3]] as number[][]).forEach(([x, h, l]) => palm(x, h, l));
  return { w: W * u, h: B * u, summitX: SX * u, summitY: VH * u };
}

function drawRider(g: G, x: number, y: number, S: number, ps: Pose) {
  const X = (v: V2) => x + v[0] * S, Y = (v: V2) => y - v[1] * S;
  const path = (pts: V2[], w: number, col: string, dx = 0, dy = 0) => {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(X(p) + dx * S, Y(p) + dy * S) : g.moveTo(X(p) + dx * S, Y(p) + dy * S)));
    g.strokeStyle = col; g.lineWidth = w * S; g.stroke();
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  // Board.
  const ang = Math.atan2(Y(ps.nose) - Y(ps.tail), X(ps.nose) - X(ps.tail));
  g.save();
  g.translate((X(ps.tail) + X(ps.nose)) / 2, (Y(ps.tail) + Y(ps.nose)) / 2); g.rotate(ang);
  const bg = g.createLinearGradient(0, -0.035 * S, 0, 0.035 * S);
  bg.addColorStop(0, '#ffe680'); bg.addColorStop(0.5, RIDER.board); bg.addColorStop(1, RIDER.boardDark);
  g.beginPath(); g.roundRect(-0.46 * S, -0.032 * S, 0.92 * S, 0.064 * S, 0.032 * S); g.fillStyle = bg; g.fill();
  g.restore();
  path([ps.hip, ps.kneeB, ps.footB], 0.1, '#0f1722');
  path([ps.hip, ps.kneeF, ps.footF], 0.105, RIDER.suit);
  path([ps.hip, ps.kneeF, ps.footF], 0.025, RIDER.suitHi, 0.02, -0.012);
  path([ps.hip, ps.shoulder], 0.18, RIDER.topDark);
  path([ps.hip, ps.shoulder], 0.12, RIDER.top, 0.024, 0);
  path([ps.hip], 0.15, RIDER.suit);
  g.beginPath(); g.arc(X(ps.hip), Y(ps.hip), 0.075 * S, 0, 7); g.fillStyle = RIDER.suit; g.fill();
  path([ps.shoulder, ps.head], 0.05, '#d9a985');
  path([ps.shoulder, ps.elbow, ps.hand], 0.07, RIDER.top);
  g.beginPath(); g.arc(X(ps.hand), Y(ps.hand), 0.034 * S, 0, 7); g.fillStyle = RIDER.skin; g.fill();
  path([ps.barA, ps.barB], 0.022, '#18222f');
  // Head, with hair blown back.
  const hx = X(ps.head), hy = Y(ps.head), hr = 0.078 * S;
  g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fillStyle = RIDER.skin; g.fill();
  // Short curly hair: a cap, then a ring of curls over the top and back.
  g.beginPath(); g.arc(hx, hy, hr * 1.04, Math.PI * 0.92, Math.PI * 1.8); g.closePath(); g.fillStyle = RIDER.hair; g.fill();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.9 + (i / 7) * 0.92), d = hr * (0.86 + 0.1 * (i % 2));
    g.beginPath(); g.arc(hx + Math.cos(a) * d, hy + Math.sin(a) * d, hr * 0.4, 0, 7);
    g.fillStyle = i % 2 ? RIDER.hairHi : RIDER.hair; g.fill();
  }
  g.fillStyle = '#18222f'; g.fillRect(hx + hr * 0.25, hy - hr * 0.22, hr * 0.7, hr * 0.26);
}

function drawKite(g: G, kx: number, ky: number, phi: number, R: number) {
  const n = 35, ks = kiteShape(kx, ky, phi, R, n);
  const band = (a: number, b: number) => {
    g.beginPath();
    for (let i = a; i <= b; i++) i === a ? g.moveTo(ks.outer[i][0], ks.outer[i][1]) : g.lineTo(ks.outer[i][0], ks.outer[i][1]);
    for (let i = b; i >= a; i--) g.lineTo(ks.inner[i][0], ks.inner[i][1]);
    g.closePath();
  };
  const body = g.createRadialGradient(ks.cx, ks.cy, R - ks.T, ks.cx, ks.cy, R);
  body.addColorStop(0, '#c7421f'); body.addColorStop(0.55, KITE.main); body.addColorStop(1, '#ff8a5c');
  band(0, n); g.fillStyle = body; g.fill();
  const light = g.createRadialGradient(ks.cx, ks.cy, R - ks.T, ks.cx, ks.cy, R);
  light.addColorStop(0, '#d3c5b5'); light.addColorStop(0.55, KITE.light); light.addColorStop(1, '#ffffff');
  g.fillStyle = light;
  band(10, 15); g.fill(); band(20, 25); g.fill();
  g.strokeStyle = 'rgba(18,40,63,0.5)'; g.lineWidth = R * 0.028;
  for (let i = 5; i < n; i += 5) { g.beginPath(); g.moveTo(ks.outer[i][0], ks.outer[i][1]); g.lineTo(ks.inner[i][0], ks.inner[i][1]); g.stroke(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const edge = (w: number, col: string, inset: number) => {
    g.beginPath();
    ks.outer.forEach((p, i) => {
      const x = p[0] + (ks.cx - p[0]) * inset, y = p[1] + (ks.cy - p[1]) * inset;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  };
  edge(R * 0.1, KITE.edge, 0.035);
  edge(R * 0.025, 'rgba(140,180,220,0.7)', 0.012);
  return ks;
}

interface Drop { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }

export const mount: Mount = (canvas, opts) => {
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, dpr = 1, cam = 0, u = 1, L: Lay;
  let far: Layer, mid: Layer, headland: Layer, island: Layer, cloudArt: Layer[] = [];
  let lamp = { lampX: 0, lampY: 0 }, isl = { w: 0, h: 0, summitX: 0, summitY: 0 };
  let clouds: { art: Layer; x: number; y: number; s: number; par: number; drift: number; a: number }[] = [];
  const rider = new Rider(), drops: Drop[] = [], rnd = rng(3);
  const glints = Array.from({ length: 70 }, (_, i) => ({ a: hash(i * 3 + 1), d: Math.pow(hash(i * 3 + 2), 1.6), ph: hash(i * 3 + 3) * 6.28 }));

  function resize(w: number, h: number) {
    W = w; H = h; u = h / 100;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (w * h));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    L = layout(w, h);
    cam = TRAVEL * h;
    far = layer(w + cam * FAR + 8, h * 0.31, dpr, (g) => paintRange(g, w + cam * FAR, h * 0.31, w, {
      seed: 8, freq: 0.0034 * (900 / h), base: 0.24, top: '#7d9cc4', bottom: '#b4cbe2', shade: 'rgba(36,62,118,0.3)', snow: 0.42, fade: 0.75, lower: 0.7 }));
    mid = layer(w + cam * MID + 8, h * 0.15, dpr, (g) => paintRange(g, w + cam * MID, h * 0.15, w, {
      seed: 31, freq: 0.0056 * (900 / h), base: 0.2, top: '#4a6d97', bottom: '#86a5c2', shade: 'rgba(16,40,86,0.3)', snow: 0.02, fade: 0.35, lower: 0.5 }));
    headland = layer(66 * u, 46 * u, dpr, (g) => { lamp = paintHeadland(g, u); });
    island = layer(120 * u * 0.8, 46 * u * 0.8, dpr, (g) => { isl = paintIsland(g, u * 0.8); });
    const cr = rng(12);
    cloudArt = [0, 1, 2, 3].map(() => layer(46 * u, 15 * u, dpr, (g) => paintCloud(g, 46 * u, 15 * u, cr)));
    clouds = [];
    for (let i = 0; i < 3; i++) {
      const big = true;
      clouds.push({ art: cloudArt[i % 4], x: ((i + cr() * 0.5) / 3) * (w + 60 * u), y: h * (big ? 0.06 + cr() * 0.14 : 0.3 + cr() * 0.1),
        s: big ? 0.7 + cr() * 0.4 : 0.34 + cr() * 0.14, par: big ? 0.09 : 0.05, drift: big ? 0.9 : 0.45, a: big ? 0.96 : 0.7 });
    }
  }

  const strip = (l: Layer, par: number, y: number, p: number) => {
    const off = Math.round(p * cam * par * dpr);
    ctx.drawImage(l.c, off, 0, Math.min(W * dpr, l.c.width - off), l.c.height, 0, y, Math.min(W * dpr, l.c.width - off) / dpr, l.h);
  };

  // A coastal layer with a soft reflection under it.
  const coast = (l: Layer, x: number, bottom: number, t: number) => {
    if (x > W || x + l.w < 0) return;
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.translate(x + Math.sin(t * 1.3) * 0.15 * u, bottom); ctx.scale(1, -0.55);
    ctx.drawImage(l.c, 0, -l.h, l.w, l.h);
    ctx.restore();
    ctx.drawImage(l.c, x, bottom - l.h, l.w, l.h);
  };

  function frame({ t, dt, p, vel }: { t: number; dt: number; p: number; vel: number }) {
    const J = journey(p), hz = L.hz, cam0 = p * cam, seaH = H - hz;
    rider.update(dt, vel);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky and sun.
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, css(J.skyTop)); sky.addColorStop(0.55, css(J.skyMid)); sky.addColorStop(1, css(J.skyLow));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
    const sunX = W * (0.47 + 0.05 * p), sunY = H * (0.15 + 0.13 * p);
    for (const [r, a] of [[46 * u, 0.5], [16 * u, 0.75]]) {
      const gl = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r);
      gl.addColorStop(0, css(J.sun, a)); gl.addColorStop(1, css(J.sun, 0));
      ctx.fillStyle = gl; ctx.fillRect(sunX - r, sunY - r, r * 2, r * 2);
    }
    ctx.beginPath(); ctx.arc(sunX, sunY, 3.4 * u, 0, 7); ctx.fillStyle = '#fffdf2'; ctx.fill();

    const span = W + 70 * u;
    for (const c of clouds) {
      const x = ((((c.x - cam0 * c.par - t * c.drift * u) % span) + span) % span) - 50 * u;
      ctx.globalAlpha = c.a;
      ctx.drawImage(c.art.c, x, c.y, c.art.w * c.s, c.art.h * c.s);
    }
    ctx.globalAlpha = 1;

    strip(far, FAR, hz - far.h + 1, p);
    const mist = ctx.createLinearGradient(0, hz - 12 * u, 0, hz);
    mist.addColorStop(0, css(J.skyLow, 0)); mist.addColorStop(1, css(J.skyLow, 0.7));
    ctx.fillStyle = mist; ctx.fillRect(0, hz - 12 * u, W, 12 * u);
    strip(mid, MID, hz - mid.h + 1, p);
    const mist2 = ctx.createLinearGradient(0, hz - 4 * u, 0, hz);
    mist2.addColorStop(0, css(J.skyLow, 0)); mist2.addColorStop(1, css(J.skyLow, 0.55));
    ctx.fillStyle = mist2; ctx.fillRect(0, hz - 4 * u, W, 4 * u);

    // Sea.
    const sea = ctx.createLinearGradient(0, hz, 0, H);
    sea.addColorStop(0, css(mix(J.seaFar, J.skyLow, 0.45))); sea.addColorStop(0.07, css(J.seaFar));
    sea.addColorStop(0.42, css(J.seaMid)); sea.addColorStop(1, css(J.seaNear));
    ctx.fillStyle = sea; ctx.fillRect(0, hz, W, seaH);
    ctx.save(); ctx.beginPath(); ctx.rect(0, hz, W, seaH); ctx.clip();
    ctx.translate(sunX, hz); ctx.scale(1, 2.6);
    const sunPath = ctx.createRadialGradient(0, 0, 0, 0, 0, 17 * u);
    sunPath.addColorStop(0, css(J.sun, 0.34)); sunPath.addColorStop(1, css(J.sun, 0));
    ctx.fillStyle = sunPath; ctx.fillRect(-17 * u, 0, 34 * u, 17 * u);
    ctx.restore();

    const deep = mix(J.seaNear, hex('#03203f'), 0.4), lightC = mix(J.seaFar, hex('#ffffff'), 0.35);
    const NW = 13, riderBand = 6;
    const waves = (from: number, to: number) => {
      for (let i = from; i < to; i++) {
        const f = i / (NW - 1), y = hz + seaH * (0.025 + 0.975 * Math.pow(f, 1.7));
        const amp = u * (0.1 + 1.25 * f * f), wl = u * (9 + 46 * f);
        const off = cam0 * (0.5 + 0.8 * f) + t * u * (1.4 + 6 * f) * (i % 2 ? 1 : 0.72);
        const pts: V2[] = [];
        for (let x = -12; x <= W + 12; x += 12) {
          const a = ((x + off) / wl) * 6.2832;
          pts.push([x, y + amp * (Math.sin(a + i * 1.7) + 0.4 * Math.sin(a * 2.3 + i + t * 0.6))]);
        }
        poly(ctx, [[-12, H], ...pts, [W + 12, H]]); ctx.closePath();
        ctx.fillStyle = i % 2 ? css(deep, 0.1 + 0.1 * f) : css(lightC, 0.06 + 0.05 * f); ctx.fill();
        // Light catching each crest.
        const d = wl * 0.36, crest = wl * ((-Math.PI / 2 - i * 1.7) / 6.2832) - off;
        ctx.setLineDash([d, wl - d]);
        ctx.lineDashOffset = -(((crest - d / 2 + 12) % wl) + wl) % wl;
        poly(ctx, pts); ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.34 * f})`; ctx.lineWidth = 0.8 + f * 1.8; ctx.lineCap = 'round'; ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    waves(0, riderBand);

    // Glints on the sun's path.
    ctx.globalCompositeOperation = 'lighter';
    for (const gl of glints) {
      const a = Math.sin(t * (1.6 + gl.a * 2.4) + gl.ph);
      if (a < 0.2) continue;
      const y = hz + 1.5 * u + gl.d * seaH * 0.95, hw = 2 * u + gl.d * 22 * u;
      ctx.fillStyle = css(J.sun, (a - 0.2) * 0.75 * (1 - gl.d * 0.5));
      ctx.beginPath(); ctx.ellipse(sunX + (gl.a - 0.5) * 2 * hw, y, (0.5 + gl.d * 2.6) * u, (0.1 + gl.d * 0.22) * u, 0, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Landmarks.
    const hx = place(L, 0, 0.972, COAST) - lamp.lampX - cam0 * COAST;
    coast(headland, hx, hz + 1.6 * u, t);
    if (hx + headland.w > 0) {
      const flash = Math.pow(Math.max(0, Math.sin(t * 1.7)), 8), lx = hx + lamp.lampX, ly = hz + 1.6 * u - lamp.lampY;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 7 * u);
      lg.addColorStop(0, `rgba(255,246,190,${0.9 * flash})`); lg.addColorStop(1, 'rgba(255,246,190,0)');
      ctx.fillStyle = lg; ctx.fillRect(lx - 7 * u, ly - 7 * u, 14 * u, 14 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(Math.max(0, hx), hz + 1.4 * u, headland.w, 0.3 * u);
    }
    const ix = place(L, 1, 0.87, COAST) - isl.summitX - cam0 * COAST;
    if (ix < W + 30 * u) {
      const by = hz + 1.4 * u, cx = ix + island.w / 2;
      ctx.save(); ctx.translate(cx, by + 2 * u); ctx.scale(1, 0.13);
      const sh = ctx.createRadialGradient(0, 0, island.w * 0.2, 0, 0, island.w * 0.78);
      sh.addColorStop(0, 'rgba(190,255,236,0.75)'); sh.addColorStop(1, 'rgba(190,255,236,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, island.w * 0.78, 0, 7); ctx.fill();
      ctx.restore();
      coast(island, ix, by, t);
      const wr = cloudArt[1];
      ctx.globalAlpha = 0.92;
      ctx.drawImage(wr.c, ix + isl.summitX - wr.w * 0.26, by - isl.summitY - 1 * u, wr.w * 0.55, wr.h * 0.55);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(ix + 4 * u, by - 0.15 * u, island.w - 8 * u, 0.3 * u);
    }

    // Kite, lines, rider.
    const S = L.S, ps = pose(rider, t);
    const bob = Math.sin(t * 2.1) * 0.35 * u * (1 - rider.airAmt);
    const rx = L.rx, ry = L.ry + bob - rider.y * S;
    const hand: V2 = [rx + ps.hand[0] * S, ry - ps.hand[1] * S];
    const [kx, ky] = kiteAt(L, rider, t);
    const phi = Math.atan2(ky - hand[1], kx - hand[0]);
    const ks = kiteShape(kx, ky, phi, L.R, 35);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)'; ctx.lineWidth = Math.max(1, 0.09 * u); ctx.lineCap = 'round';
    for (const [b, k] of [[ps.barA, 0], [ps.barB, 35], [ps.barA, 6], [ps.barB, 29]] as [V2, number][]) {
      ctx.beginPath(); ctx.moveTo(rx + b[0] * S, ry - b[1] * S); ctx.lineTo(ks.outer[k][0], ks.outer[k][1]); ctx.stroke();
    }
    drawKite(ctx, kx, ky, phi, L.R);

    const tailX = rx + ps.tail[0] * S, water = L.ry + bob;
    if (rider.airAmt < 0.4) {
      // Wake and foam under the board.
      const wk = ctx.createLinearGradient(tailX, 0, tailX - 2.6 * S, 0);
      wk.addColorStop(0, 'rgba(255,255,255,0.85)'); wk.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.moveTo(tailX + 0.3 * S, water - 0.01 * S);
      ctx.quadraticCurveTo(tailX - 1.2 * S, water - 0.1 * S + Math.sin(t * 5) * 0.01 * S, tailX - 2.6 * S, water + 0.02 * S);
      ctx.quadraticCurveTo(tailX - 1.2 * S, water + 0.09 * S, tailX + 0.5 * S, water + 0.05 * S);
      ctx.closePath(); ctx.fillStyle = wk; ctx.fill();
      for (let n = (40 + 120 * rider.speed) * dt + rnd(); n >= 1; n--)
        drops.push({ x: tailX + 0.1 * S, y: water, vx: -(0.5 + rnd() * 1.6) * S, vy: -(0.5 + rnd() * 1.7) * S, life: 0, max: 0.4 + rnd() * 0.5, r: (0.012 + rnd() * 0.022) * S });
    } else {
      ctx.fillStyle = 'rgba(3,30,60,0.22)';
      ctx.beginPath(); ctx.ellipse(rx, L.ry + 0.03 * S, 0.42 * S, 0.035 * S, 0, 0, 7); ctx.fill();
    }
    if (rider.landed) for (let i = 0; i < 50; i++) drops.push({ x: rx + (rnd() - 0.5) * S, y: water, vx: (rnd() - 0.5) * 3.4 * S, vy: -(0.6 + rnd() * 2.4) * S, life: 0, max: 0.5 + rnd() * 0.5, r: (0.014 + rnd() * 0.026) * S });
    drawRider(ctx, rx, ry, S, ps);
    for (let i = drops.length - 1; i >= 0; i--) {
      const q = drops[i];
      q.life += dt;
      if (q.life > q.max) { drops.splice(i, 1); continue; }
      q.vy += 4.4 * S * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - q.life / q.max)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill();
    }

    waves(riderBand, NW);

    // Soft vignette to settle the edges.
    const vg = ctx.createRadialGradient(W * 0.55, H * 0.45, H * 0.45, W * 0.55, H * 0.45, Math.hypot(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(4,24,48,0)'); vg.addColorStop(1, 'rgba(4,24,48,0.3)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  drive(canvas, opts, { resize, frame });
};
