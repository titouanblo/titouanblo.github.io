// Pixel-art scene: drawn pixel by pixel into a low-resolution buffer, then scaled up.
import {
  clamp, smooth, hash, hash2, noise1, ridged, rng, hex, mix, journey, layout, place, pose, kiteAt, kiteShape,
  drive, Rider, TRAVEL, KITE, RIDER,
  type RGB, type V2, type Lay, type Mount,
} from './core';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

// Colours are packed as 0xAABBGGRR so they can be written straight into ImageData.
const pack = (r: number, g: number, b: number) => ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
const pk = (c: RGB) => pack(c[0], c[1], c[2]);
const P = (h: string) => pk(hex(h));
const mixP = (a: number, b: number, t: number) => {
  const ar = a & 255, ag = (a >>> 8) & 255, ab = (a >>> 16) & 255;
  return pack(ar + ((b & 255) - ar) * t, ag + (((b >>> 8) & 255) - ag) * t, ab + (((b >>> 16) & 255) - ab) * t);
};

class Spr {
  d: Uint32Array;
  constructor(public w: number, public h: number) { this.d = new Uint32Array(w * h); }
  set(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  blend(x: number, y: number, c: number, t: number) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) { const i = y * this.w + x; this.d[i] = mixP(this.d[i], c, t); }
  }
  hline(x: number, y: number, n: number, c: number) { for (let i = 0; i < n; i++) this.set(x + i, y, c); }
  rect(x: number, y: number, w: number, h: number, c: number) { for (let j = 0; j < h; j++) this.hline(x, y + j, w, c); }
  disc(cx: number, cy: number, r: number, c: number, maxY = 1e9) {
    for (let y = Math.ceil(cy - r); y <= Math.min(maxY, Math.floor(cy + r)); y++)
      for (let x = Math.ceil(cx - r); x <= Math.floor(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    const o = -Math.floor((w - 1) / 2);
    for (;;) {
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) this.set(x0 + o + i, y0 + o + j, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  outline(c: number) {
    const src = this.d.slice();
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : 0);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!src[y * this.w + x] && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) this.d[y * this.w + x] = c;
  }
  clear() { this.d.fill(0); }
}

function blit(dst: Spr, src: Spr, dx: number, dy: number) {
  dx = Math.round(dx); dy = Math.round(dy);
  const x0 = Math.max(0, -dx), x1 = Math.min(src.w, dst.w - dx);
  const y0 = Math.max(0, -dy), y1 = Math.min(src.h, dst.h - dy);
  for (let y = y0; y < y1; y++) {
    const so = y * src.w, o = (y + dy) * dst.w + dx;
    for (let x = x0; x < x1; x++) { const c = src.d[so + x]; if (c) dst.d[o + x] = c; }
  }
}

// --- Mountains: an index map (1 lit rock, 2 shaded rock, 3 lit snow, 4 shaded snow, 5/6 texture, 7 haze) -----

interface Range { w: number; h: number; map: Uint8Array }

function makeRange(W: number, H: number, seed: number, freq: number, baseH: number, snowAt: number, hazeH: number, view: number, fade: number): Range {
  const pad = 80;
  const hs = new Float32Array(W + pad);
  for (let x = 0; x < W + pad; x++) {
    const r = clamp((ridged(x * freq, seed, 5) - 0.1) / 0.55);
    const env = (0.5 + 0.5 * noise1(x * freq * 0.4, seed + 99)) * (1 - fade * smooth(W - view * 1.2, W - view * 0.3, x));
    hs[x] = baseH * (1 - 0.5 * fade * smooth(W - view * 1.2, W - view * 0.3, x)) + (H - 1 - baseH) * Math.pow(r, 1.2) * env;
  }
  const sm = new Float32Array(W + pad);
  for (let x = 0; x < W + pad; x++) {
    let s = 0, n = 0;
    for (let k = -4; k <= 4; k++) { const i = x + k; if (i >= 0 && i < W + pad) { s += hs[i]; n++; } }
    sm[x] = s / n;
  }
  const map = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    const top = Math.round(hs[x]);
    const snowLine = snowAt + 9 * noise1(x * 0.3, seed + 5) + 5 * noise1(x * 0.05, seed + 6);
    for (let d = 0; d < top; d++) {
      const y = H - top + d, alt = top - d;
      // Sampling the slope further along as we go down gives slanted facets instead of vertical stripes.
      const xs = Math.min(W + pad - 4, x + Math.round(d * 0.65));
      const slope = sm[xs + 3] - sm[Math.max(0, xs - 3)];
      let lit = slope < 0;
      if (Math.abs(slope) < 0.6) lit = bay(x, y) > 0.5 + slope * 0.6;
      const snow = alt > snowLine + (lit ? 0 : 3);
      let idx = snow ? (lit ? 3 : 4) : lit ? 1 : 2;
      if (!snow && hash2(x * 3 + seed, y) < 0.07) idx = lit ? 5 : 6;
      if (alt < hazeH && bay(x, y) > alt / hazeH) idx = 7;
      map[y * W + x] = idx;
    }
  }
  return { w: W, h: H, map };
}

// --- Clouds (1 highlight, 2 body, 3 shade) ----------------------------------

function makeCloud(r: () => number, w: number, h: number): Spr {
  const s = new Spr(w, h);
  const base = h - 1;
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = w * (0.16 + (0.68 * (i + r() * 0.5)) / n);
    const rad = h * (0.26 + 0.34 * Math.sin((Math.PI * (i + 0.5)) / n) + r() * 0.08);
    s.disc(cx, base - rad * 0.8, rad, 2, base);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!s.get(x, y)) continue;
      if (!s.get(x, y - 1) || !s.get(x + 1, y - 1)) s.d[y * w + x] = 1;
      else if (y >= base - 1 || (y >= base - 3 && bay(x, y) > 0.45) || (y >= base - 5 && bay(x, y) > 0.8)) s.d[y * w + x] = 3;
    }
  return s;
}

// --- Brittany: granite headland and lighthouse ------------------------------

function makeHeadland() {
  const W = 190, H = 92, s = new Spr(W, H), cx = 38;
  const gnd = (x: number) => {
    const rise = smooth(3, 17, x) * smooth(W - 1, W - 42, x);
    return Math.max(0, Math.round((22 + 4 * noise1(x * 0.06, 3) + 6 * smooth(40, 110, x) - 5 * smooth(110, 180, x)) * rise));
  };
  const lit = P('#cda594'), midc = P('#b08a82'), sh = P('#86676d'), dk = P('#4a3b48');
  const grass = P('#7fae5a'), grassD = P('#4f8249'), heather = P('#a56cb6');
  for (let x = 0; x < W; x++) {
    const h = gnd(x);
    const seaward = x < 19;
    for (let d = 0; d < h; d++) {
      const y = H - h + d;
      let c: number;
      if (d < 2 && h > 8) c = hash2(x, d) < 0.08 ? heather : grass;
      else if (d < 3 && h > 12) c = grassD;
      else {
        const n = noise1(x * 0.075 + d * 0.04, 11);
        c = seaward ? (n > 0.55 ? midc : sh) : n > 0.5 ? lit : midc;
        if (!seaward && hash2(x, 77) < 0.05 && d > 4 + hash2(x, 3) * 8 && d < h - 3 - hash2(x, 4) * 6) c = sh;
        if (h - d <= 2) c = dk;
      }
      s.set(x, y, c);
    }
  }
  // Lighthouse: white tower lit from the right, red lantern.
  const gy = H - gnd(cx);
  const white = P('#f7f4ed'), cream = P('#e4dfd3'), shade = P('#b3c0cd'), stone = P('#8c8790');
  const ink = P('#28323f'), red = P('#d4452f'), redD = P('#942e27'), glass = P('#cfeaf4'), lamp = P('#fff0a6');
  const TH = 44;
  for (let r = 0; r < TH; r++) {
    const y = gy - r, hw = r < 2 ? 5 : Math.round(4.4 - r * 0.036);
    for (let dx = -hw; dx < hw; dx++) {
      let c = dx < -hw * 0.25 || (dx < 0 && bay(cx + dx, y) > 0.65) ? shade : dx === hw - 1 ? cream : white;
      if (r < 3) c = dx < -1 ? sh : stone;
      s.set(cx + dx, y, c);
    }
  }
  for (const r of [11, 22, 33]) { s.set(cx, gy - r, ink); s.set(cx, gy - r - 1, ink); }
  s.rect(cx, gy - 5, 2, 3, ink);
  s.hline(cx - 6, gy - TH, 12, ink);
  for (const dx of [-6, -3, 0, 3, 5]) s.set(cx + dx, gy - TH - 1, ink);
  s.hline(cx - 6, gy - TH - 2, 12, shade);
  for (let r = 0; r < 6; r++)
    for (let dx = -3; dx < 3; dx++)
      s.set(cx + dx, gy - TH - 1 - r, dx === -3 || dx === 2 ? ink : dx === -1 || dx === 0 ? lamp : glass);
  [4, 4, 3, 2, 1].forEach((hw, i) => { for (let dx = -hw; dx < hw; dx++) s.set(cx + dx, gy - TH - 7 - i, dx < 0 ? redD : red); });
  s.set(cx, gy - TH - 12, ink); s.set(cx, gy - TH - 13, ink);
  return { s, lampX: cx, lampY: H - (gy - TH - 4) };
}

// --- Caribbean: volcanic island, beach and palms ----------------------------

function makeIsland() {
  const W = 250, H = 104, s = new Spr(W, H), SX = 150, VH = 80;
  const bump = (u: number) => Math.max(0, 1 - u * u);
  const taper = (x: number) => smooth(0, 22, x) * smooth(W - 1, W - 22, x);
  const vol = (x: number) => {
    const u = x < SX ? (SX - x) / 130 : (x - SX) / 98;
    let v = VH * 1.06 * Math.pow(Math.max(0, 1 - u), 1.2) + 2 * noise1(x * 0.08, 21);
    if (v > VH - 6) v = VH - 6 - (v - VH + 6) * 0.5;
    return v * taper(x);
  };
  const hillS = (x: number) => Math.max(22 * bump((x - 52) / 56), 17 * bump((x - 206) / 44), 9 * bump((x - 128) / 84));
  const hazeC = hex('#d6efe6');
  const hz = (h: string) => pk(mix(hex(h), hazeC, 0.34));
  const vLit = hz('#67b572'), vSh = hz('#458b68'), vRav = hz('#39795f'), rLit = hz('#aaa08c'), rSh = hz('#7d7a74');
  for (let x = 0; x < W; x++) {
    const top = Math.round(vol(x));
    for (let d = 0; d < top; d++) {
      const y = H - 3 - top + d, alt = top - d;
      const side = x - SX - d * 0.14;
      const lit = side > 1 ? true : side < -1 ? false : bay(x, y) > 0.5;
      const key = ((x - SX) / (VH - alt + 14)) * 1.5;
      const ravine = key - Math.floor(key) < 0.1 && alt < VH - 16 && bay(x, y) > 0.3;
      const rocky = alt > VH - 26 + 12 * bay(x, y);
      s.set(x, y, rocky ? (lit ? rLit : rSh) : ravine ? vRav : lit ? vLit : vSh);
    }
  }
  const hLit = P('#49b061'), hSh = P('#2f8753'), hTop = P('#8bd974'), hDk = P('#26724a');
  for (let x = 0; x < W; x++) {
    const tp = taper(x);
    if (tp < 0.05) continue;
    const top = Math.round((hillS(x) + 1.6 * Math.abs(Math.sin(x * 0.5))) * tp);
    const slope = hillS(x + 4) - hillS(x - 4);
    for (let d = 0; d < top; d++) {
      const y = H - 4 - top + d;
      const lit = slope < -0.4 ? true : slope > 0.4 ? false : bay(x, y) > 0.5;
      let c = lit ? hLit : hSh;
      if (d === 0) c = hTop;
      else if (hash2(x, y) < 0.07) c = hDk;
      s.set(x, y, c);
    }
  }
  const sand = P('#f6e4b3'), sandD = P('#dcc48f');
  for (let x = 0; x < W; x++) {
    if (taper(x) < 0.03) continue;
    for (let j = 0; j < 4; j++) s.set(x, H - 1 - j, j === 0 ? sandD : sand);
  }
  const tA = P('#8f5f3c'), tB = P('#734a2e'), fHi = P('#6fd07a'), fMid = P('#2f9a55'), fDk = P('#1e6f44');
  const palm = (x0: number, hgt: number, lean: number) => {
    const y0 = H - 3;
    let xc = x0, yc = y0;
    for (let i = 0; i <= hgt; i++) {
      xc = x0 + Math.round(lean * Math.pow(i / hgt, 2) * hgt * 0.35);
      yc = y0 - i;
      s.set(xc, yc, i % 3 === 0 ? tB : tA);
      if (i < 4) s.set(xc + 1, yc, tB);
    }
    for (const deg of [208, 172, 140, 108, 72, 40, 8, -28]) {
      const a = (deg * Math.PI) / 180, len = 8 + Math.round(hash(x0 + deg) * 2);
      for (let k = 1; k <= len; k++) {
        const fx = xc + Math.cos(a) * k, fy = yc - Math.sin(a) * k + 0.07 * k * k;
        s.set(fx, fy + 1, fDk);
        s.set(fx, fy, deg > 55 && deg < 150 ? fHi : fMid);
      }
    }
  };
  for (const [x, h, l] of [[16, 25, -0.9], [27, 20, 1], [104, 23, 0.8], [226, 26, 0.9], [236, 19, -0.8]]) palm(x, h, l);
  return { s, summitX: SX, summitY: VH };
}

const COAST = 0.7;

interface Drop { x: number; y: number; vx: number; vy: number; life: number; max: number }

export const mount: Mount = (canvas, opts) => {
  const ctx = canvas.getContext('2d')!;
  let vw = 0, vh = 0, cam = 0, L: Lay, fb: Spr, img: ImageData;
  let far: Range, mid: Range, tmpR: Spr, tmpK: Spr, wreath: Spr;
  let clouds: { s: Spr; x: number; y: number; par: number; drift: number }[] = [];
  const headland = makeHeadland(), island = makeIsland();
  const rider = new Rider();
  const drops: Drop[] = [];
  const rnd = rng(5);

  const WHITE = P('#ffffff'), INK = P('#0a1626');
  const kMain = P(KITE.main), kDark = P(KITE.dark), kLight = P(KITE.light), kLightD = P('#d8cbbd'), kEdge = P(KITE.edge);
  const cSuit = P(RIDER.suit), cSuitHi = P(RIDER.suitHi), cTop = P(RIDER.top), cTopD = P(RIDER.topDark);
  const cSkin = P(RIDER.skin), cHair = P(RIDER.hair), cHairHi = P(RIDER.hairHi), cBoard = P(RIDER.board), cBoardD = P(RIDER.boardDark);

  function resize(w: number, h: number) {
    const scale = Math.max(2, Math.round(h / 290));
    vw = Math.ceil(w / scale); vh = Math.ceil(h / scale);
    canvas.width = vw; canvas.height = vh;
    canvas.style.width = vw * scale + 'px'; canvas.style.height = vh * scale + 'px';
    fb = new Spr(vw, vh);
    img = new ImageData(new Uint8ClampedArray(fb.d.buffer), vw, vh);
    L = layout(vw, vh);
    cam = TRAVEL * vh;
    far = makeRange(vw + Math.ceil(cam * 0.05) + 4, Math.round(vh * 0.29), 8, 0.013, Math.round(vh * 0.07), vh * 0.118, 8, vw, 0.7);
    mid = makeRange(vw + Math.ceil(cam * 0.1) + 4, Math.round(vh * 0.13), 31, 0.021, Math.round(vh * 0.025), vh * 0.115, 5, vw, 0.5);
    tmpR = new Spr(Math.ceil(L.S * 2.4), Math.ceil(L.S * 2));
    tmpK = new Spr(Math.ceil(L.R * 2 + 8), Math.ceil(L.R * 2 + 8));
    const cr = rng(12);
    clouds = [];
    wreath = makeCloud(cr, 34, 11);
    for (let i = 0; i < 3; i++) {
      const big = true;
      const cw = Math.round((big ? 46 : 26) + cr() * (big ? 34 : 18));
      clouds.push({
        s: makeCloud(cr, cw, Math.round(cw * (big ? 0.3 : 0.24)) + 3),
        x: ((i + cr() * 0.6) / 3) * (vw + 120),
        y: Math.round(vh * (big ? 0.07 + cr() * 0.16 : 0.27 + cr() * 0.1)),
        par: big ? 0.09 : 0.05,
        drift: big ? 2.2 : 1.1,
      });
    }
  }

  function drawRange(r: Range, par: number, pal: number[]) {
    const off = Math.floor(cam0 * par), y0 = L.hz - r.h;
    for (let ly = 0; ly < r.h; ly++) {
      const y = y0 + ly;
      if (y < 0) continue;
      const ro = ly * r.w + off, o = y * vw;
      for (let x = 0; x < vw; x++) { const i = r.map[ro + x]; if (i) fb.d[o + x] = pal[i]; }
    }
  }

  // A coastal sprite plus its rippling reflection and a line of foam at the waterline.
  function coast(s: Spr, x: number, bottom: number, t: number) {
    x = Math.round(x);
    if (x > vw || x + s.w < 0) return;
    const rh = Math.min(vh - bottom, Math.round(s.h * 0.42));
    for (let ry = 0; ry < rh; ry++) {
      const sy = s.h - 1 - Math.round(ry * 2);
      if (sy < 0) break;
      const y = bottom + ry, wob = Math.round(Math.sin(t * 1.6 + ry * 0.9) * 1.3), keep = 0.5 + (0.45 * ry) / rh;
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.d[sy * s.w + sx], X = x + sx + wob;
        if (!c || X < 0 || X >= vw) continue;
        const i = y * vw + X;
        fb.d[i] = mixP(c, fb.d[i], keep);
      }
    }
    blit(fb, s, x, bottom - s.h);
    for (let sx = 0; sx < s.w; sx++) {
      if (s.d[(s.h - 1) * s.w + sx] && hash2(x + sx + Math.floor(t * 3) * 57, 3) < 0.45) fb.set(x + sx, bottom, WHITE);
    }
  }

  let cam0 = 0;

  function frame({ t, dt, p, vel }: { t: number; dt: number; p: number; vel: number }) {
    const J = journey(p);
    cam0 = p * cam;
    const hz = L.hz, d = fb.d;
    rider.update(dt, vel);

    // Sky: dithered bands.
    const NB = 9, sky: number[] = [];
    for (let i = 0; i < NB; i++) { const f = i / (NB - 1); sky.push(pk(f < 0.55 ? mix(J.skyTop, J.skyMid, f / 0.55) : mix(J.skyMid, J.skyLow, (f - 0.55) / 0.45))); }
    for (let y = 0; y < hz; y++) {
      const lev = (y / hz) * (NB - 1), i = Math.floor(lev), f = lev - i, o = y * vw;
      for (let x = 0; x < vw; x++) d[o + x] = sky[f > bay(x, y) ? i + 1 : i];
    }
    // Sun.
    const sunX = Math.round(vw * (0.47 + 0.05 * p)), sunY = Math.round(vh * (0.15 + 0.13 * p)), sunR = 8, glow = 40, sunC = pk(J.sun);
    for (let y = Math.max(0, sunY - glow); y < Math.min(hz, sunY + glow); y++)
      for (let x = Math.max(0, sunX - glow); x < Math.min(vw, sunX + glow); x++) {
        const dist = Math.hypot(x - sunX, y - sunY);
        if (dist <= sunR) d[y * vw + x] = dist < sunR - 2 ? WHITE : sunC;
        else if (dist < sunR + 24) d[y * vw + x] = mixP(d[y * vw + x], sunC, dist < sunR + 5 ? 0.42 : dist < sunR + 13 ? 0.2 : 0.09);
      }
    // Clouds.
    const cPal = [0, WHITE, pk(J.cloud), pk(J.cloudShade)];
    const span = vw + 140;
    for (const c of clouds) {
      const x = ((((c.x - cam0 * c.par - t * c.drift) % span) + span) % span) - 90;
      const s = c.s;
      for (let sy = 0; sy < s.h; sy++) for (let sx = 0; sx < s.w; sx++) { const i = s.d[sy * s.w + sx]; if (i) fb.set(x + sx, c.y + sy, cPal[i]); }
    }
    // Mountains: far range hazy and snow-capped, nearer range darker.
    const haze = pk(mix(J.skyLow, J.farRock, 0.6));
    const snow = pk(mix(hex('#ffffff'), J.skyLow, 0.1)), snowSh = pk(mix(hex('#bcd2ea'), J.farRock, 0.25));
    drawRange(far, 0.05, [0, pk(J.farRock), pk(J.farShade), snow, snowSh, pk(mix(J.farRock, J.farShade, 0.5)), pk(mix(J.farShade, J.midShade, 0.35)), haze]);
    drawRange(mid, 0.1, [0, pk(J.midRock), pk(J.midShade), snow, snowSh, pk(mix(J.midRock, J.midShade, 0.5)), pk(mix(J.midShade, hex('#1f3a5c'), 0.4)), pk(mix(J.midRock, J.skyLow, 0.18))]);

    // Sea: dithered depth bands.
    const SB = 8, sea: number[] = [];
    for (let i = 0; i < SB; i++) { const f = i / (SB - 1); sea.push(pk(f < 0.35 ? mix(J.seaFar, J.seaMid, f / 0.35) : mix(J.seaMid, J.seaNear, (f - 0.35) / 0.65))); }
    const seaH = vh - hz;
    for (let y = hz; y < vh; y++) {
      const lev = Math.pow((y - hz) / seaH, 0.8) * (SB - 1), i = Math.min(SB - 2, Math.floor(lev)), f = lev - i, o = y * vw;
      for (let x = 0; x < vw; x++) d[o + x] = sea[f > bay(x, y) ? i + 1 : i];
    }
    fb.hline(0, hz, vw, pk(mix(J.seaFar, J.skyLow, 0.55)));
    // Ripples: short dashes that grow and spread towards the viewer.
    const foam = hex('#ffffff'), deep = pk(mix(J.seaNear, hex('#041a33'), 0.35));
    for (let y = hz + 1; y < vh; y++) {
      const dd = (y - hz) / seaH;
      if (hash(y * 31 + 7) > 0.8 - 0.25 * (1 - dd)) continue;
      const par = 0.5 + 0.8 * Math.pow(dd, 1.2), sp = 15 + dd * 44, len = 1 + dd * 9;
      const off = cam0 * par + t * (3 + dd * 20) + hash(y) * sp * 3;
      const hi = mixP(d[y * vw], pk(foam), 0.22 + 0.3 * dd), lo = mixP(d[y * vw], deep, 0.45);
      for (let c = Math.floor(off / sp) - 1; c * sp - off < vw; c++) {
        const h1 = hash2(c, y);
        if (h1 > 0.6) continue;
        const tw = Math.sin(t * (1 + h1 * 2) + h1 * 40);
        if (tw < -0.3) continue;
        const x0 = Math.round(c * sp - off + hash2(c, y + 999) * sp * 0.6);
        fb.hline(x0, y, Math.max(1, Math.round(len * (0.5 + hash2(c, y + 55)) * (0.6 + 0.4 * tw))), h1 < 0.36 ? hi : lo);
      }
    }
    // Sun glitter.
    for (let y = hz + 1; y < vh; y++) {
      const dd = (y - hz) / seaH, hw = 3 + dd * 30;
      if (y % 2) continue;
      for (let x = Math.max(0, Math.floor(sunX - hw)); x < Math.min(vw - 2, sunX + hw); x += 3) {
        const prob = 0.5 * (1 - Math.abs(x - sunX) / hw) * (1 - dd * 0.75);
        if (hash2(x + Math.floor(t * 3 + y * 0.37) * 131, y) < prob) for (let i = 0; i < 2 + dd * 3; i++) fb.blend(x + i, y, sunC, 0.55);
      }
    }
    // Swell: a few broken crest lines in the foreground.
    for (let k = 0; k < 4; k++) {
      const by = hz + seaH * (0.3 + 0.19 * k), A = 1.4 + k * 0.9, wl = 70 + 36 * k;
      const off = cam0 * (0.5 + 0.22 * k) + t * (9 + 5 * k);
      for (let x = 0; x < vw; x++) {
        const ph = ((x + off) / wl) * Math.PI * 2, sn = Math.sin(ph);
        if (sn > -0.15) continue;
        const y = Math.round(by + A * sn + 0.6 * A * Math.sin((x + off) * 0.013 + k));
        if (y <= hz || y >= vh - 1) continue;
        const base = d[y * vw + x];
        fb.set(x, y, sn < -0.82 && hash2(x + Math.floor(off), k) < 0.75 ? WHITE : mixP(base, pk(foam), 0.3 + 0.12 * k));
        fb.set(x, y + 1, mixP(base, deep, 0.4));
      }
    }

    // Landmarks: the lighthouse at the start of the journey, the island at the end.
    const hx = place(L, 0, 0.972, COAST) - headland.lampX - cam0 * COAST;
    coast(headland.s, hx, hz + 5, t);
    const flash = Math.pow(Math.max(0, Math.sin(t * 1.7)), 10);
    if (flash > 0.25) {
      const lx = Math.round(hx + headland.lampX), ly = hz + 5 - headland.lampY;
      const lamp = P('#fff7c2');
      for (let j = -1; j <= 0; j++) for (let i = -2; i <= 1; i++) fb.set(lx + i, ly + j, lamp);
      for (let r = 2; r < 7; r++) for (const [ax, ay] of [[1, 0], [-1, 0], [0, -1]]) fb.blend(lx + ax * (r + 1), ly + ay * r, lamp, flash * (1 - r / 8));
    }
    const ix = place(L, 1, 0.87, COAST) - island.summitX - cam0 * COAST;
    if (ix < vw + 40) {
      // Shallow water around the island.
      const shallow = P('#aef4e3'), cx = ix + island.s.w / 2;
      for (let y = hz + 2; y < Math.min(vh, hz + 30); y++) {
        const dd = (y - hz - 2) / 28, hw = island.s.w * 0.66 - dd * 50;
        for (let x = Math.max(0, Math.floor(cx - hw)); x < Math.min(vw, cx + hw); x++) {
          const s = (1 - Math.abs(x - cx) / hw) * (1 - dd);
          if (s * 1.5 > bay(x, y)) d[y * vw + x] = mixP(d[y * vw + x], shallow, 0.5);
        }
      }
      coast(island.s, ix, hz + 4, t);
      const wx = Math.round(ix + island.summitX - wreath.w / 2 + 6), wy = hz + 4 - island.summitY - 3;
      for (let sy = 0; sy < wreath.h; sy++) for (let sx = 0; sx < wreath.w; sx++) { const i = wreath.d[sy * wreath.w + sx]; if (i) fb.set(wx + sx, wy + sy, cPal[i]); }
    }

    // Rider.
    const S = L.S, ps = pose(rider, t);
    const bob = Math.round(Math.sin(t * 2.1) * 1.2 * (1 - rider.airAmt));
    const rx = Math.round(L.rx), ry = Math.round(L.ry) + bob;
    const jy = Math.round(rider.y * S);
    const sx = (v: V2) => rx + v[0] * S, sy = (v: V2) => ry - jy - v[1] * S;
    if (rider.airAmt > 0.4) {
      for (let i = -9; i <= 9; i++) if ((i + 100) % 3) fb.blend(rx + i, Math.round(L.ry) + 1, deep, 0.5);
    } else {
      // Wake trailing behind the board.
      for (let i = 0; i < 46; i++) {
        const x = Math.round(sx(ps.tail)) - i;
        if (hash2(i + Math.floor(t * 10), 9) > i / 46) fb.set(x, ry + (i % 4 === 0 ? 1 : 0), WHITE);
        if (hash2(i + Math.floor(t * 7), 4) > 0.35 + i / 60) fb.blend(x, ry + 2, pk(foam), 0.45);
      }
      const rate = 26 + 90 * rider.speed;
      for (let n = rate * dt + rnd(); n >= 1; n--)
        drops.push({ x: sx(ps.tail) + 2, y: ry - 1, vx: -(14 + rnd() * 44), vy: -(14 + rnd() * 46), life: 0, max: 0.4 + rnd() * 0.5 });
    }
    if (rider.landed) for (let i = 0; i < 46; i++) drops.push({ x: rx + (rnd() - 0.5) * S * 0.9, y: ry, vx: (rnd() - 0.5) * 90, vy: -(20 + rnd() * 70), life: 0, max: 0.5 + rnd() * 0.5 });

    // Kite and lines.
    const [kx, ky] = kiteAt(L, rider, t);
    const hxp = sx(ps.hand), hyp = sy(ps.hand);
    const phi = Math.atan2(ky - hyp, kx - hxp);
    const ks = kiteShape(kx, ky, phi, L.R, 2);
    const lineC = P('#f2f6f8');
    const lineTo = (a: V2, b: V2) => {
      let x0 = Math.round(a[0]), y0 = Math.round(a[1]);
      const x1 = Math.round(b[0]), y1 = Math.round(b[1]);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), ix2 = x0 < x1 ? 1 : -1, iy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        fb.blend(x0, y0, lineC, 0.55);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += ix2; }
        if (e2 <= dx) { e += dx; y0 += iy; }
      }
    };
    lineTo([sx(ps.barA), sy(ps.barA)], ks.outer[0]);
    lineTo([sx(ps.barB), sy(ps.barB)], ks.outer[2]);

    tmpK.clear();
    const kox = Math.round(ks.cx - tmpK.w / 2), koy = Math.round(ks.cy - tmpK.h / 2);
    const R = L.R, segPx = (R * ks.span) / 7;
    for (let py = 0; py < tmpK.h; py++)
      for (let px = 0; px < tmpK.w; px++) {
        const ddx = px + kox - ks.cx, ddy = py + koy - ks.cy, r = Math.hypot(ddx, ddy);
        if (r > R + 0.4) continue;
        let a = Math.atan2(ddy, ddx) - phi;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        const u = a / ks.span + 0.5;
        if (u < 0 || u > 1) continue;
        const ri = R - ks.T * Math.pow(Math.sin(Math.PI * u), 0.55);
        if (r < ri) continue;
        const seg = u * 7, si = Math.floor(seg), white = si === 2 || si === 4;
        const depth = (r - ri) / (R - ri + 0.001);
        let c = white ? kLight : kMain;
        if (depth < 0.36 || (depth < 0.5 && bay(px, py) > 0.5)) c = white ? kLightD : kDark;
        if (si > 0 && (seg - si) * segPx < 1) c = kEdge;
        if (r > R - 2) c = kEdge;
        tmpK.d[py * tmpK.w + px] = c;
      }
    tmpK.outline(kEdge);
    blit(fb, tmpK, kox, koy);

    // The rider, drawn limb by limb from the shared pose, then outlined.
    tmpR.clear();
    const ox = Math.round(S * 1.25), oy = Math.round(S * 1.55);
    const tx = (v: V2) => ox + v[0] * S, ty = (v: V2) => oy - v[1] * S;
    const limb = (a: V2, b: V2, w: number, c: number, dx = 0, dy = 0) => tmpR.line(tx(a) + dx, ty(a) + dy, tx(b) + dx, ty(b) + dy, w, c);
    const lw = S >= 27 ? 3 : 2;
    limb(ps.tail, ps.nose, 3, cBoardD);
    limb(ps.tail, ps.nose, 2, cBoard, 0, -1);
    limb(ps.hip, ps.kneeB, lw, cSuit); limb(ps.kneeB, ps.footB, lw, cSuit);
    limb(ps.hip, ps.kneeF, lw, cSuit); limb(ps.kneeF, ps.footF, lw, cSuit);
    limb(ps.hip, ps.kneeF, 1, cSuitHi, 1, -1);
    limb(ps.hip, ps.shoulder, lw + 1, cTopD);
    limb(ps.hip, ps.shoulder, lw - 1, cTop, 1, 0);
    tmpR.rect(Math.round(tx(ps.hip)) - 2, Math.round(ty(ps.hip)) - 1, 4, 2, cSuit);
    limb(ps.shoulder, ps.elbow, 2, cTop); limb(ps.elbow, ps.hand, 2, cTop);
    tmpR.rect(Math.round(tx(ps.hand)) - 1, Math.round(ty(ps.hand)) - 1, 2, 2, cSkin);
    limb(ps.barA, ps.barB, 1, INK);
    const hr = S * 0.088, hcx = tx(ps.head), hcy = ty(ps.head);
    for (let y = Math.ceil(hcy - hr); y <= Math.floor(hcy + hr); y++)
      for (let x = Math.ceil(hcx - hr); x <= Math.floor(hcx + hr); x++) {
        const ddx = x - hcx, ddy = y - hcy;
        if (ddx * ddx + ddy * ddy > hr * hr) continue;
        tmpR.set(x, y, ddy < -hr * 0.2 || ddx < -hr * 0.6 ? ((x + y) & 1 ? cHair : cHairHi) : cSkin);
      }
    // Curls: a row of bumps over the top and back of the head.
    for (let i = -Math.round(hr); i <= Math.round(hr); i += 2) tmpR.set(hcx + i, hcy - hr - 1, cHair);
    tmpR.set(hcx - hr - 1, hcy - 2, cHairHi); tmpR.set(hcx - hr - 1, hcy, cHair);
    tmpR.outline(INK);
    blit(fb, tmpR, rx - ox, ry - jy - oy);

    // Spray.
    for (let i = drops.length - 1; i >= 0; i--) {
      const q = drops[i];
      q.life += dt;
      if (q.life > q.max || q.y > ry + 3) { drops.splice(i, 1); continue; }
      q.vy += 130 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const x = Math.round(q.x), y = Math.round(q.y);
      if (q.life < q.max * 0.6) fb.set(x, y, WHITE); else fb.blend(x, y, WHITE, 0.6);
    }

    ctx.putImageData(img, 0, 0);
  }

  drive(canvas, opts, { resize, frame });
};
