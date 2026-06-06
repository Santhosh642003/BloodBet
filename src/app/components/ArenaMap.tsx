import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ArenaTile { x: number; y: number; tileType: string; hasResource: boolean; resourceType?: string | null; }
interface RosterEntry { tf: any; fighter: any; }
interface LiveEventLite { id: number; hour: number; eventType: string; description: string; x?: number | null; y?: number | null; }
interface ArenaMapProps {
  width: number; height: number; tiles: ArenaTile[]; roster: RosterEntry[];
  events?: LiveEventLite[]; currentHour?: number;
  selectedFighterId?: number | null; onSelectFighter?: (id: number) => void;
}
interface Pt { x: number; y: number; }

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_TW = 96, BASE_TH = 48, BASE_EH = 24;
const CANVAS_W = 900, CANVAS_H = 540;

const ARCHETYPE_COLORS: Record<string, string> = {
  AGGRESSIVE: '#e05548', STRATEGIC: '#4a8de0', COWARDLY: '#9a9a9a',
  DIPLOMATIC: '#4ae09c', BETRAYER: '#b04ae0', SURVIVALIST: '#e0c14a',
};
const EVENT_BURST_ICONS: Record<string, string> = {
  KILL: '⚔️', ALLIANCE: '🤝', BETRAYAL: '🗡️', FLEE: '💨',
  TRAP: '⚠️', ELIMINATION: '💀', SPONSOR: '🎁', COMBAT: '💥', PHASE: '📢',
};
const RESOURCE_ICONS: Record<string, string> = {
  FOOD: '🍖', WATER: '💧', MEDKIT: '🩹', WEAPON: '⚔️', ARMOR: '🛡️', INTEL: '📡', SMOKE: '💨', TRAP: '🪤',
};

// Stylized flat colors per biome (cel-shaded palette)
const BIOME_TOP: Record<string, string> = {
  PLAIN:       '#5ecf3e',
  FOREST:      '#1d7428',
  WATER:       '#2362a8',
  RUINS:       '#a08b6e',
  SHELTER:     '#3d9454',
  DANGER:      '#7a2020',
  CORNUCOPIA:  '#d4a820',
};
const BIOME_SIDE_L: Record<string, string> = {
  PLAIN: '#3a8a28', FOREST: '#134d1c', WATER: '#163f70',
  RUINS: '#6e5e48', SHELTER: '#296638', DANGER: '#521414', CORNUCOPIA: '#9a7510',
};
const BIOME_SIDE_R: Record<string, string> = {
  PLAIN: '#4aaa34', FOREST: '#1a6022', WATER: '#1d4e88',
  RUINS: '#8a7458', SHELTER: '#32784a', DANGER: '#641818', CORNUCOPIA: '#b88c14',
};

// ─── Noise / hash ─────────────────────────────────────────────────────────────

function fract(n: number) { return n - Math.floor(n); }
function hash2(x: number, y: number) { return fract(Math.sin(x * 127.1 + y * 311.7 + x * y * 0.07) * 43758.5453); }
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(fract(x)), fy = smoothstep(fract(y));
  return (
    hash2(ix, iy) * (1 - fx) * (1 - fy) + hash2(ix + 1, iy) * fx * (1 - fy) +
    hash2(ix, iy + 1) * (1 - fx) * fy   + hash2(ix + 1, iy + 1) * fx * fy
  );
}
function fbm(x: number, y: number, octaves = 4): number {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, y * freq) * amp;
    max += amp; amp *= 0.5; freq *= 2.1;
  }
  return v / max;
}

// ─── Island mask ─────────────────────────────────────────────────────────────
// Returns 0..1 — 1 = solid land, 0 = ocean void. Organic blob shape.

function islandValue(tx: number, ty: number, W: number, H: number): number {
  const nx = (tx + 0.5) / W * 2 - 1; // -1..1
  const ny = (ty + 0.5) / H * 2 - 1;
  const dist = Math.sqrt(nx * nx * 1.1 + ny * ny * 0.9); // slight horizontal stretch
  const noise = fbm(tx * 0.38 + 5, ty * 0.38 + 3, 4); // organic edge wobble
  // Island radius varies with noise; anything > 1 is ocean
  const radius = 0.72 + (noise - 0.5) * 0.52;
  const val = 1 - dist / radius;
  return Math.max(0, val);
}

function isLand(tx: number, ty: number, W: number, H: number): boolean {
  return islandValue(tx, ty, W, H) > 0;
}

// ─── Elevation ────────────────────────────────────────────────────────────────

const BASE_ELEV: Record<string, number> = { WATER: 0, PLAIN: 2, SHELTER: 2, RUINS: 3, FOREST: 3, DANGER: 7, CORNUCOPIA: 2 };
const NOISE_ELEV: Record<string, number> = { WATER: 0, PLAIN: 3, SHELTER: 2, RUINS: 3, FOREST: 3, DANGER: 5, CORNUCOPIA: 0 };

function tileCenterElev(tx: number, ty: number, tt: string): number {
  const n = fbm(tx * 0.55 + 0.3, ty * 0.55 + 0.7);
  return (BASE_ELEV[tt] ?? 2) + n * (NOISE_ELEV[tt] ?? 2);
}

function buildVertGrid(W: number, H: number, tileType: (tx: number, ty: number) => string): Float32Array {
  const verts = new Float32Array((W + 1) * (H + 1));
  for (let vy = 0; vy <= H; vy++) {
    for (let vx = 0; vx <= W; vx++) {
      const ns: [number, number][] = ([[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]] as [number,number][])
        .filter(([tx, ty]) => tx >= 0 && tx < W && ty >= 0 && ty < H);
      verts[vy * (W + 1) + vx] = ns.length === 0 ? 0
        : ns.reduce((s, [tx, ty]) => s + tileCenterElev(tx, ty, tileType(tx, ty)), 0) / ns.length;
    }
  }
  // 3-pass Gaussian blur for smooth slopes
  const tmp = new Float32Array(verts.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let vy = 0; vy <= H; vy++) {
      for (let vx = 0; vx <= W; vx++) {
        let sum = 0, w = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = vx + dx, ny = vy + dy;
          if (nx < 0 || nx > W || ny < 0 || ny > H) continue;
          const weight = Math.exp(-(dx * dx + dy * dy) / 2.5);
          sum += verts[ny * (W + 1) + nx] * weight; w += weight;
        }
        tmp[vy * (W + 1) + vx] = sum / w;
      }
    }
    verts.set(tmp);
  }
  return verts;
}

// ─── Stylized texture painters ────────────────────────────────────────────────
// Simple geometric shapes — NO photorealism.

function blerp(n: Pt, e: Pt, s: Pt, w: Pt, u: number, v: number): Pt {
  const top = { x: n.x + (e.x - n.x) * u, y: n.y + (e.y - n.y) * u };
  const bot = { x: w.x + (s.x - w.x) * u, y: w.y + (s.y - w.y) * u };
  return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v };
}

// PLAIN — scattered small circles (map-style dots)
function drawPlain(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 7; i++) {
    const u = (i * 0.618 + 0.12) % 0.76 + 0.12;
    const v = (i * 0.381 + 0.14) % 0.72 + 0.14;
    const p = blerp(n, e, s, w, u, v);
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
}

// FOREST — stylized triangles (map-style tree symbols)
function drawForest(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt) {
  for (let i = 0; i < 4; i++) {
    const u = (i * 0.618 + 0.15) % 0.70 + 0.15;
    const v = (i * 0.381 + 0.18) % 0.64 + 0.18;
    const p = blerp(n, e, s, w, u, v);
    const sz = 5 + hash2(u * 9, v * 11) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - sz);
    ctx.lineTo(p.x + sz * 0.7, p.y + sz * 0.5);
    ctx.lineTo(p.x - sz * 0.7, p.y + sz * 0.5);
    ctx.closePath(); ctx.fill();
    // Second smaller layer
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - sz * 0.55);
    ctx.lineTo(p.x + sz * 0.55, p.y + sz * 0.9);
    ctx.lineTo(p.x - sz * 0.55, p.y + sz * 0.9);
    ctx.closePath(); ctx.fill();
  }
}

// WATER (inland pools) — concentric rings
function drawWater(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, frame: number) {
  const cx = blerp(n, e, s, w, 0.5, 0.5);
  for (let i = 0; i < 3; i++) {
    const phase = (frame * 0.04 + i * 1.1) % (Math.PI * 2);
    const r = 4 + i * 5 + Math.sin(phase) * 1.5;
    ctx.strokeStyle = `rgba(160,210,255,${0.30 - i * 0.08})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx.x, cx.y, r, 0, Math.PI * 2); ctx.stroke();
  }
  // Highlight glint
  ctx.fillStyle = 'rgba(200,235,255,0.4)';
  ctx.beginPath(); ctx.arc(cx.x - 3, cx.y - 3, 2, 0, Math.PI * 2); ctx.fill();
}

// RUINS — broken grid lines (ruins/structure outline)
function drawRuins(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt) {
  ctx.strokeStyle = 'rgba(255,245,220,0.28)';
  ctx.lineWidth = 1.0;
  // Horizontal line segment
  const a = blerp(n, e, s, w, 0.15, 0.45);
  const b = blerp(n, e, s, w, 0.85, 0.45);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  // Vertical line segment
  const c = blerp(n, e, s, w, 0.48, 0.15);
  const d = blerp(n, e, s, w, 0.48, 0.82);
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  // Corner debris dots
  ctx.fillStyle = 'rgba(255,245,220,0.22)';
  for (let i = 0; i < 4; i++) {
    const u = (i * 0.5 + 0.15) % 0.7 + 0.15;
    const v = (i * 0.37 + 0.2) % 0.6 + 0.2;
    const p = blerp(n, e, s, w, u, v);
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}

// SHELTER — small house outline
function drawShelter(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt) {
  const cx = blerp(n, e, s, w, 0.5, 0.5);
  const sz = 7;
  ctx.strokeStyle = 'rgba(255,255,220,0.35)';
  ctx.lineWidth = 1.3;
  // Roof
  ctx.beginPath();
  ctx.moveTo(cx.x, cx.y - sz);
  ctx.lineTo(cx.x + sz, cx.y);
  ctx.lineTo(cx.x - sz, cx.y);
  ctx.closePath(); ctx.stroke();
  // Walls
  ctx.beginPath();
  ctx.rect(cx.x - sz * 0.7, cx.y, sz * 1.4, sz * 0.9);
  ctx.stroke();
}

// DANGER — X marks the spot
function drawDanger(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt) {
  for (let i = 0; i < 3; i++) {
    const u = (i * 0.618 + 0.2) % 0.6 + 0.2;
    const v = (i * 0.381 + 0.2) % 0.6 + 0.2;
    const p = blerp(n, e, s, w, u, v);
    const sz = 4 + hash2(u * 7, v * 11) * 2.5;
    ctx.strokeStyle = `rgba(255,80,80,${0.40 - i * 0.08})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x - sz, p.y - sz * 0.5); ctx.lineTo(p.x + sz, p.y + sz * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x + sz, p.y - sz * 0.5); ctx.lineTo(p.x - sz, p.y + sz * 0.5); ctx.stroke();
  }
}

// CORNUCOPIA — star/sun rays
function drawCornucopia(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, frame: number) {
  const cx = blerp(n, e, s, w, 0.5, 0.5);
  const rays = 8;
  const innerR = 3, outerR = 9 + Math.sin(frame * 0.06) * 1.5;
  ctx.strokeStyle = 'rgba(255,235,100,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx.x + Math.cos(a) * innerR, cx.y + Math.sin(a) * innerR * 0.5);
    ctx.lineTo(cx.x + Math.cos(a) * outerR, cx.y + Math.sin(a) * outerR * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,235,100,0.5)';
  ctx.beginPath(); ctx.arc(cx.x, cx.y, 3.5, 0, Math.PI * 2); ctx.fill();
}

function drawTexture(ctx: CanvasRenderingContext2D, tt: string, n: Pt, e: Pt, s: Pt, w: Pt, frame: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(w.x, w.y);
  ctx.closePath(); ctx.clip();
  switch (tt) {
    case 'PLAIN':      drawPlain(ctx, n, e, s, w);              break;
    case 'FOREST':     drawForest(ctx, n, e, s, w);             break;
    case 'WATER':      drawWater(ctx, n, e, s, w, frame);       break;
    case 'RUINS':      drawRuins(ctx, n, e, s, w);              break;
    case 'SHELTER':    drawShelter(ctx, n, e, s, w);            break;
    case 'DANGER':     drawDanger(ctx, n, e, s, w);             break;
    case 'CORNUCOPIA': drawCornucopia(ctx, n, e, s, w, frame);  break;
  }
  ctx.restore();
}

// ─── Projection ───────────────────────────────────────────────────────────────

function project(gx: number, gy: number, gz: number, rot: number, zoom: number, OX: number, OY: number, CX: number, CY: number): Pt {
  const dx = gx - CX, dy = gy - CY;
  const c = Math.cos(rot), s = Math.sin(rot);
  const rx = dx * c - dy * s, ry = dx * s + dy * c;
  return {
    x: (rx - ry) * (BASE_TW / 2) * zoom + OX,
    y: (rx + ry) * (BASE_TH / 2) * zoom - gz * BASE_EH * zoom + OY,
  };
}

function tileDepth(tx: number, ty: number, rot: number, CX: number, CY: number): number {
  const dx = tx + 0.5 - CX, dy = ty + 0.5 - CY;
  return dx * Math.cos(rot) - (-dy * Math.sin(rot)) + (dx * Math.sin(rot) + dy * Math.cos(rot));
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function rgbHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lighten(h: string, a: number) { const [r, g, b] = hexRgb(h); return rgbHex(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a); }
function darken(h: string, a: number) { const [r, g, b] = hexRgb(h); return rgbHex(r * (1 - a), g * (1 - a), b * (1 - a)); }

// Subtle per-tile noise variation so tiles aren't totally uniform
function tileTopColor(tx: number, ty: number, tt: string): string {
  const base = BIOME_TOP[tt] ?? '#808080';
  const v = (hash2(tx * 5 + 2, ty * 7 + 3) - 0.5) * 0.12;
  const [r, g, b] = hexRgb(base);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return rgbHex(clamp(r + v * 255), clamp(g + v * 255), clamp(b + v * 255));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArenaMap({ width: W, height: H, tiles, roster, events = [], currentHour, selectedFighterId, onSelectFighter }: ArenaMapProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const frameRef    = useRef(0);
  const rafRef      = useRef<number>(0);
  const vertRef     = useRef<Float32Array | null>(null);
  const isDragging  = useRef(false);
  const lastMouseX  = useRef(0);
  const lastMouseY  = useRef(0);

  const [rotation, setRotation] = useState(Math.PI * 0.25);
  const [zoom, setZoom]         = useState(0.9);
  const [hoveredFighter, setHoveredFighter] = useState<{ fighter: any; tf: any; sx: number; sy: number } | null>(null);
  const [burst, setBurst]       = useState<{ id: number; icon: string; sx: number; sy: number } | null>(null);

  const CX = W / 2, CY = H / 2;
  const OX = CANVAS_W / 2, OY = CANVAS_H * 0.52;

  const tileTypeAt = useCallback((tx: number, ty: number): string =>
    tiles.find(t => Number(t.x) === tx && Number(t.y) === ty)?.tileType ?? 'PLAIN',
  [tiles]);

  useEffect(() => {
    vertRef.current = buildVertGrid(W, H, tileTypeAt);
  }, [W, H, tileTypeAt]);

  const getVE = useCallback((vx: number, vy: number): number => {
    if (!vertRef.current) return 0;
    return vertRef.current[Math.max(0, Math.min(H, vy)) * (W + 1) + Math.max(0, Math.min(W, vx))];
  }, [W, H]);

  const proj = useCallback((gx: number, gy: number, gz: number) =>
    project(gx, gy, gz, rotation, zoom, OX, OY, CX, CY),
  [rotation, zoom, OX, OY, CX, CY]);

  const getVScreen = useCallback((vx: number, vy: number) => {
    return proj(vx, vy, getVE(vx, vy));
  }, [getVE, proj]);

  // ── Draw ──────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    if (!vertRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== CANVAS_W * dpr) {
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = `${CANVAS_W}px`;
      canvas.style.height = `${CANVAS_H}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background — deep void / abyss
    const sky = ctx.createRadialGradient(OX, OY, 0, OX, OY, CANVAS_W * 0.7);
    sky.addColorStop(0, '#0e1520'); sky.addColorStop(1, '#060810');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Painter's sort
    const order: [number, number][] = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (isLand(tx, ty, W, H)) order.push([tx, ty]);
    }
    order.sort(([ax, ay], [bx, by]) =>
      tileDepth(ax, ay, rotation, CX, CY) - tileDepth(bx, by, rotation, CX, CY)
    );

    for (const [tx, ty] of order) {
      const tt = tileTypeAt(tx, ty);
      const n = getVScreen(tx,     ty);
      const e = getVScreen(tx + 1, ty);
      const s = getVScreen(tx + 1, ty + 1);
      const w = getVScreen(tx,     ty + 1);

      const avgE = (getVE(tx, ty) + getVE(tx + 1, ty) + getVE(tx + 1, ty + 1) + getVE(tx, ty + 1)) / 4;
      const islandStr = Math.min(1, islandValue(tx, ty, W, H) * 4); // fade edges
      const color = tileTopColor(tx, ty, tt);

      // ── Side faces ──────────────────────────────────────────────────────
      const eh = BASE_EH * zoom;
      const baseOffset = eh * 1.6 + 10;
      const sideL = BIOME_SIDE_L[tt] ?? '#404040';
      const sideR = BIOME_SIDE_R[tt] ?? '#505050';

      // SW face
      {
        const bW = { x: w.x, y: w.y + baseOffset };
        const bS = { x: s.x, y: s.y + baseOffset };
        const gL = ctx.createLinearGradient(w.x, w.y, bW.x, bW.y);
        gL.addColorStop(0, sideL);
        gL.addColorStop(1, darken(sideL, 0.55));
        ctx.fillStyle = gL; ctx.globalAlpha = islandStr;
        ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(s.x, s.y); ctx.lineTo(bS.x, bS.y); ctx.lineTo(bW.x, bW.y); ctx.closePath(); ctx.fill();
      }
      // SE face
      {
        const bE = { x: e.x, y: e.y + baseOffset };
        const bS = { x: s.x, y: s.y + baseOffset };
        const gR = ctx.createLinearGradient(e.x, e.y, bE.x, bE.y);
        gR.addColorStop(0, sideR);
        gR.addColorStop(1, darken(sideR, 0.50));
        ctx.fillStyle = gR; ctx.globalAlpha = islandStr;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(bS.x, bS.y); ctx.lineTo(bE.x, bE.y); ctx.closePath(); ctx.fill();
      }

      // ── Top face ────────────────────────────────────────────────────────
      // Cel-shaded: single flat color + thin light rim at north edges
      ctx.globalAlpha = islandStr;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(w.x, w.y); ctx.closePath(); ctx.fill();

      // NW rim highlight
      ctx.strokeStyle = lighten(color, 0.35);
      ctx.lineWidth = 1.5; ctx.globalAlpha = islandStr * 0.55;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(w.x, w.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.stroke();

      // Thin dark outline for cel-shading grid
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.5; ctx.globalAlpha = islandStr;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(w.x, w.y); ctx.closePath(); ctx.stroke();

      ctx.globalAlpha = 1;

      // Stylized texture symbols
      if (zoom > 0.45) {
        ctx.globalAlpha = islandStr;
        drawTexture(ctx, tt, n, e, s, w, frameRef.current);
        ctx.globalAlpha = 1;
      }

      // Soft edge vignette for island boundary tiles
      if (islandStr < 0.85) {
        ctx.globalAlpha = (1 - islandStr) * 0.5;
        ctx.fillStyle = '#060810';
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(w.x, w.y); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Resource icon
      const tile = tiles.find(t => Number(t.x) === tx && Number(t.y) === ty);
      if (tile?.hasResource && tile.resourceType) {
        const cx2 = (n.x + e.x + s.x + w.x) / 4, cy2 = (n.y + e.y + s.y + w.y) / 4;
        ctx.globalAlpha = islandStr;
        ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(RESOURCE_ICONS[tile.resourceType] ?? '✦', cx2, cy2 - 8);
        ctx.globalAlpha = 1;
      }

      // Peak snow cap
      if (avgE >= 9) {
        ctx.fillStyle = `rgba(230,242,255,${Math.min(0.85, (avgE - 9) * 0.22)})`;
        ctx.globalAlpha = islandStr;
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(w.x, w.y); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── Fighters ────────────────────────────────────────────────────────────

    const sortedFighters = [...roster].sort((a, b) =>
      tileDepth(Number(a.tf.x), Number(a.tf.y), rotation, CX, CY) -
      tileDepth(Number(b.tf.x), Number(b.tf.y), rotation, CX, CY)
    );

    for (const { tf, fighter } of sortedFighters) {
      if (!isLand(Number(tf.x), Number(tf.y), W, H)) continue;
      const fx = Number(tf.x), fy = Number(tf.y);
      const { x: sx, y: sy } = proj(fx, fy, getVE(fx, fy));
      const isDead = !tf.isAlive, isSelected = selectedFighterId === Number(fighter.id);
      const color = isDead ? '#555' : (ARCHETYPE_COLORS[fighter.archetype] ?? '#d4af37');
      const r = 11, markerY = sy - r - 6;

      // Shadow
      ctx.beginPath(); ctx.ellipse(sx, sy + 1, r * 1.4, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      // Stem
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, markerY + r);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();

      if (isSelected) {
        ctx.beginPath(); ctx.arc(sx, markerY, r + 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212,175,55,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
      }

      // Marker — flat cel-shaded circle
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, markerY, r, 0, Math.PI * 2); ctx.fill();
      // Highlight top-left
      ctx.fillStyle = lighten(color, 0.45);
      ctx.beginPath(); ctx.arc(sx - r * 0.3, markerY - r * 0.3, r * 0.38, 0, Math.PI * 2); ctx.fill();
      // Outline
      ctx.strokeStyle = isSelected ? '#d4af37' : darken(color, 0.4);
      ctx.lineWidth = isSelected ? 2.5 : 1.5; ctx.stroke();

      if (isDead) {
        ctx.font = 'bold 10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText('☠', sx, markerY);
      }

      // Name tag
      const name = fighter.name?.split(' ')[0] ?? '?';
      ctx.font = 'bold 8.5px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const tagW = ctx.measureText(name).width + 8;
      const tagY = markerY - r - 4;
      ctx.fillStyle = 'rgba(0,0,0,0.70)'; ctx.fillRect(sx - tagW / 2, tagY - 12, tagW, 12);
      ctx.fillStyle = isSelected ? '#d4af37' : 'rgba(255,255,255,0.92)';
      ctx.fillText(name, sx, tagY - 1);
    }
  }, [tiles, roster, selectedFighterId, W, H, rotation, zoom, tileTypeAt, getVE, getVScreen, proj, CX, CY, OX, OY]);

  // Animation loop (always running for WATER ring animation)
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      frameRef.current += 1;
      const hasAnimated = tiles.some(t => t.tileType === 'WATER' || t.tileType === 'CORNUCOPIA');
      if (hasAnimated && zoom > 0.45) draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [draw, tiles, zoom]);

  useEffect(() => { draw(); }, [draw]);

  // Burst detection
  useEffect(() => {
    const located = events.filter(e => e.x != null && e.y != null);
    if (!located.length) return;
    const ev = located[0];
    const { x: sx, y: sy } = proj(Number(ev.x!), Number(ev.y!), getVE(Number(ev.x!), Number(ev.y!)));
    setBurst({ id: ev.id, icon: EVENT_BURST_ICONS[ev.eventType] ?? '✦', sx, sy });
  }, [events, proj, getVE]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouseX.current = e.clientX;
    lastMouseY.current = e.clientY;
  };
  const handleMouseUp = () => { isDragging.current = false; };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging.current) {
      const dx = e.clientX - lastMouseX.current;
      const dy = e.clientY - lastMouseY.current;
      lastMouseX.current = e.clientX;
      lastMouseY.current = e.clientY;
      setRotation(r => r + dx * 0.013);
      setZoom(z => Math.max(0.35, Math.min(3.0, z - dy * 0.008)));
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best: typeof hoveredFighter = null, bestD = 20;
    for (const { tf, fighter } of roster) {
      if (!tf.isAlive) continue;
      const { x: sx, y: sy } = proj(Number(tf.x), Number(tf.y), getVE(Number(tf.x), Number(tf.y)));
      const markerY = sy - 11 - 6;
      const d = Math.hypot(mx - sx, my - markerY);
      if (d < bestD) { bestD = d; best = { fighter, tf, sx, sy: markerY }; }
    }
    setHoveredFighter(best);
  }, [roster, proj, getVE]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.35, Math.min(3.0, z - e.deltaY * 0.0012)));
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredFighter) onSelectFighter?.(Number(hoveredFighter.fighter.id));
  }, [hoveredFighter, onSelectFighter]);

  const alive = roster.filter(r => r.tf.isAlive);
  const ticker = events.slice(0, 7);

  return (
    <div className="bg-[#060a12] border border-accent-crimson-end relative overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-separator/30">
        <div className="flex items-center gap-3">
          <h3 className="font-heading text-sm text-accent-gold uppercase tracking-wider">Live Arena</h3>
          <span className="flex items-center gap-1.5 bg-destructive/20 border border-destructive px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-[9px] tracking-widest text-destructive uppercase">On Air</span>
          </span>
          {currentHour !== undefined && (
            <span className="font-mono text-[10px] text-text-secondary">Hour {currentHour}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-text-secondary hidden sm:block">drag to rotate · scroll to zoom</span>
          <span className="font-mono text-[10px] text-text-secondary">{alive.length} alive</span>
        </div>
      </div>

      {/* Ticker */}
      {ticker.length > 0 && (
        <div className="overflow-hidden bg-black/40 border-b border-separator/20">
          <motion.div
            key={ticker[0]?.id}
            className="inline-flex gap-14 py-1.5 px-4 font-mono text-[10px] text-text-secondary whitespace-nowrap"
            initial={{ x: '100%' }} animate={{ x: '-100%' }}
            transition={{ duration: 32, ease: 'linear', repeat: Infinity }}
          >
            {ticker.map(ev => (
              <span key={ev.id}>
                <span className="text-accent-gold">[H{ev.hour}]</span>{' '}
                <span>{EVENT_BURST_ICONS[ev.eventType] ?? '•'}</span>{' '}
                <span className="text-text-primary">{ev.description}</span>
              </span>
            ))}
          </motion.div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative overflow-hidden" style={{ height: CANVAS_H }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            cursor: isDragging.current ? 'grabbing' : hoveredFighter ? 'pointer' : 'grab',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { isDragging.current = false; setHoveredFighter(null); }}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          onClick={handleClick}
        />

        <div className="absolute bottom-3 right-4 flex gap-3 font-mono text-[9px] text-text-secondary/40 pointer-events-none">
          <span>drag · rotate</span><span>scroll · zoom</span>
        </div>

        {/* Fighter tooltip */}
        <AnimatePresence>
          {hoveredFighter && (
            <motion.div
              key={Number(hoveredFighter.fighter.id)}
              initial={{ opacity: 0, scale: 0.95, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute pointer-events-none bg-bg-primary/96 border border-accent-gold shadow-2xl p-3 w-48 font-mono text-xs z-50"
              style={{ left: Math.min(hoveredFighter.sx + 14, CANVAS_W - 200), top: Math.max(4, hoveredFighter.sy - 60) }}
            >
              <div className="font-display text-sm text-accent-gold mb-0.5">{hoveredFighter.fighter.name}</div>
              <div className="text-[9px] uppercase text-text-secondary mb-2">{hoveredFighter.fighter.archetype}</div>
              {(([
                ['Status', hoveredFighter.tf.condition],
                ['Pos', `(${Number(hoveredFighter.tf.x)},${Number(hoveredFighter.tf.y)})`],
                ['Hunger', Number(hoveredFighter.tf.hunger)],
                ['Thirst', Number(hoveredFighter.tf.thirst)],
                ['Injury', `${Number(hoveredFighter.tf.injury)}%`],
                ['Kills', Number(hoveredFighter.tf.kills ?? 0)],
              ]) as [string, any][]).map(([l, v]) => (
                <div key={l} className="flex justify-between text-[10px]">
                  <span className="text-text-secondary">{l}</span>
                  <span className={l === 'Injury' && Number(hoveredFighter.tf.injury) > 60 ? 'text-red-400' : 'text-text-primary'}>{v}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event burst */}
        <AnimatePresence>
          {burst && (
            <motion.div
              key={burst.id}
              className="absolute pointer-events-none text-3xl z-60"
              style={{ left: Math.min(burst.sx - 20, CANVAS_W - 60), top: Math.max(0, burst.sy - 50) }}
              initial={{ scale: 0, opacity: 0, y: 0 }}
              animate={{ scale: [0, 2, 1.4], opacity: [0, 1, 0], y: -35 }}
              transition={{ duration: 2.8, ease: 'easeOut' }}
              onAnimationComplete={() => setBurst(null)}
            >
              <span style={{ filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.9))' }}>{burst.icon}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="px-5 py-2.5 border-t border-separator/20 flex flex-wrap gap-x-5 gap-y-1">
        {Object.entries(ARCHETYPE_COLORS).map(([arch, color]) => (
          <div key={arch} className="flex items-center gap-1.5 font-mono text-[9px] text-text-secondary uppercase">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />{arch}
          </div>
        ))}
      </div>
    </div>
  );
}
