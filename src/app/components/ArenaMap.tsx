import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

// ─── Terrain constants ───────────────────────────────────────────────────────

const BASE_TW = 96, BASE_TH = 48, BASE_EH = 28;

const BASE_ELEV: Record<string, number> = { WATER:0, PLAIN:2, SHELTER:2, RUINS:3, FOREST:3, DANGER:7, CORNUCOPIA:2 };
const NOISE_ELEV: Record<string, number> = { WATER:0, PLAIN:3, SHELTER:2, RUINS:3, FOREST:3, DANGER:5, CORNUCOPIA:0 };

const ARCHETYPE_COLORS: Record<string, string> = {
  AGGRESSIVE:'#e05548', STRATEGIC:'#4a8de0', COWARDLY:'#9a9a9a',
  DIPLOMATIC:'#4ae09c', BETRAYER:'#b04ae0', SURVIVALIST:'#e0c14a',
};
const EVENT_BURST_ICONS: Record<string, string> = {
  KILL:'⚔️', ALLIANCE:'🤝', BETRAYAL:'🗡️', FLEE:'💨',
  TRAP:'⚠️', ELIMINATION:'💀', SPONSOR:'🎁', COMBAT:'💥', PHASE:'📢',
};
const RESOURCE_ICONS: Record<string, string> = {
  FOOD:'🍖', WATER:'💧', MEDKIT:'🩹', WEAPON:'⚔️', ARMOR:'🛡️', INTEL:'📡', SMOKE:'💨', TRAP:'🪤',
};

// ─── Noise ───────────────────────────────────────────────────────────────────

function fract(n: number) { return n - Math.floor(n); }
function hash2(x: number, y: number) { return fract(Math.sin(x * 127.1 + y * 311.7 + x * y * 0.07) * 43758.5453); }
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(fract(x)), fy = smoothstep(fract(y));
  return (
    hash2(ix,iy)*(1-fx)*(1-fy) + hash2(ix+1,iy)*fx*(1-fy) +
    hash2(ix,iy+1)*(1-fx)*fy   + hash2(ix+1,iy+1)*fx*fy
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

function tileCenterElev(tx: number, ty: number, tt: string): number {
  const n = fbm(tx * 0.55 + 0.3, ty * 0.55 + 0.7);
  return (BASE_ELEV[tt] ?? 2) + n * (NOISE_ELEV[tt] ?? 2);
}

function buildVertGrid(W: number, H: number, tileType: (tx: number, ty: number) => string): Float32Array {
  const verts = new Float32Array((W+1) * (H+1));
  // Compute raw vertex elevations
  for (let vy = 0; vy <= H; vy++) {
    for (let vx = 0; vx <= W; vx++) {
      const ns: [number,number][] = [[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]]
        .filter(([tx,ty]) => tx>=0&&tx<W&&ty>=0&&ty<H) as [number,number][];
      verts[vy*(W+1)+vx] = ns.length===0 ? 0
        : ns.reduce((s,[tx,ty]) => s + tileCenterElev(tx,ty,tileType(tx,ty)), 0) / ns.length;
    }
  }
  // Gaussian blur (3 passes) for smooth slopes
  const tmp = new Float32Array(verts.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let vy = 0; vy <= H; vy++) {
      for (let vx = 0; vx <= W; vx++) {
        let sum = 0, w = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = vx+dx, ny = vy+dy;
          if (nx<0||nx>W||ny<0||ny>H) continue;
          const weight = Math.exp(-(dx*dx+dy*dy)/2.5);
          sum += verts[ny*(W+1)+nx] * weight; w += weight;
        }
        tmp[vy*(W+1)+vx] = sum / w;
      }
    }
    verts.set(tmp);
  }
  return verts;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexRgb(h: string): [number,number,number] {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function rgbHex(r: number, g: number, b: number) {
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function lerpc(a: string, b: string, t: number): string {
  const [ar,ag,ab]=hexRgb(a), [br,bg,bb]=hexRgb(b);
  return rgbHex(ar+(br-ar)*t, ag+(bg-ag)*t, ab+(bb-ab)*t);
}
function darken(h: string, a: number) { const [r,g,b]=hexRgb(h); return rgbHex(r*(1-a),g*(1-a),b*(1-a)); }
function lighten(h: string, a: number) { const [r,g,b]=hexRgb(h); return rgbHex(r+(255-r)*a,g+(255-g)*a,b+(255-b)*a); }

// Elevation→color ramp (natural altitude colours)
function elevColor(e: number): string {
  const stops: [number,string][] = [
    [0,'#1e4870'], [0.8,'#2a5e90'], [1.5,'#3d7830'], [3,'#4e9c3c'],
    [4.5,'#5aaa44'], [5.5,'#6c8050'], [7,'#7e6a50'], [8.5,'#886a58'],
    [10,'#909090'], [11.5,'#b8bec2'], [13,'#dce8f0'],
  ];
  for (let i=0; i<stops.length-1; i++) {
    const [e0,c0]=stops[i],[e1,c1]=stops[i+1];
    if (e<=e1) return lerpc(c0,c1,Math.max(0,Math.min(1,(e-e0)/(e1-e0))));
  }
  return '#e8f0f8';
}
const BIOME_TINT: Record<string,[string,number]> = {
  PLAIN:['#5ab040',0.25], FOREST:['#1e5010',0.55], WATER:['#1e50a0',0.65],
  RUINS:['#907840',0.40], SHELTER:['#3c7030',0.28], DANGER:['#6c6860',0.22],
  CORNUCOPIA:['#c8a020',0.50],
};
function topColor(tx: number, ty: number, tt: string, elev: number): string {
  const base = elevColor(elev);
  const [tint,w] = BIOME_TINT[tt] ?? ['#808080',0.2];
  const v = (hash2(tx*5+2, ty*7+3) - 0.5) * 0.08;
  const c = lerpc(base, tint, w);
  const [r,g,b] = hexRgb(c);
  return rgbHex(r+(255-r)*Math.max(0,v), g+(255-g)*Math.max(0,v), b+(255-b)*Math.max(0,v));
}
function sideColor(elev: number, face: 'L'|'R'): string {
  const base = elev<1.2 ? '#1a3058' : elev<3 ? '#2c4020' : elev<6 ? '#4a3820' : elev<10 ? '#504840' : '#787478';
  return face==='L' ? darken(base,0.28) : darken(base,0.14);
}

// ─── Bilinear interpolation within a quad ────────────────────────────────────

function blerp(n: Pt, e: Pt, s: Pt, w: Pt, u: number, v: number): Pt {
  const top = {x: n.x+(e.x-n.x)*u, y: n.y+(e.y-n.y)*u};
  const bot = {x: w.x+(s.x-w.x)*u, y: w.y+(s.y-w.y)*u};
  return {x: top.x+(bot.x-top.x)*v, y: top.y+(bot.y-top.y)*v};
}

// ─── Texture painters (no clip needed — elements stay well inside quads) ─────

function drawGrass(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, color: string) {
  for (let i = 0; i < 10; i++) {
    const u = (i*0.618+0.08)%0.88 + 0.06;
    const v = (i*0.381+0.10)%0.80 + 0.10;
    const p = blerp(n,e,s,w,u,v);
    const dark = i%3===0;
    ctx.strokeStyle = dark ? darken(color,0.25) : lighten(color,0.18);
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(p.x, p.y+4); ctx.quadraticCurveTo(p.x-1,p.y+1,p.x-2,p.y-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x+1,p.y+4); ctx.quadraticCurveTo(p.x+3,p.y+1,p.x+3,p.y-2); ctx.stroke();
  }
  // Scattered small dots (wildflowers/pebbles)
  for (let i = 0; i < 4; i++) {
    const u = (i*0.29+0.15)%0.75 + 0.12;
    const v = (i*0.47+0.20)%0.70 + 0.15;
    const p = blerp(n,e,s,w,u,v);
    ctx.fillStyle = i%2===0 ? 'rgba(255,240,80,0.7)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(p.x,p.y,1.0,0,Math.PI*2); ctx.fill();
  }
}

function drawForest(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, color: string) {
  for (let i = 0; i < 5; i++) {
    const u = (i*0.618+0.12)%0.80 + 0.10;
    const v = (i*0.381+0.12)%0.76 + 0.12;
    const p = blerp(n,e,s,w,u,v);
    const r = 5 + hash2(p.x*0.1,p.y*0.1)*4;
    const g1 = ctx.createRadialGradient(p.x-1,p.y-1,0,p.x,p.y,r);
    g1.addColorStop(0, lighten(color,0.30));
    g1.addColorStop(0.6, color);
    g1.addColorStop(1, darken(color,0.40));
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    // Trunk dot
    ctx.fillStyle = 'rgba(40,20,10,0.55)';
    ctx.beginPath(); ctx.arc(p.x,p.y+r*0.5,1.2,0,Math.PI*2); ctx.fill();
  }
}

function drawWater(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, _color: string, frame: number) {
  ctx.strokeStyle = 'rgba(180,220,255,0.30)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const v = 0.15 + i * 0.16;
    const amp = 2.5;
    ctx.beginPath();
    for (let u = 0.05; u <= 0.95; u += 0.04) {
      const p = blerp(n,e,s,w,u,v);
      const wave = Math.sin(u * 8 + frame * 0.05 + i * 1.2) * amp;
      if (u <= 0.05) ctx.moveTo(p.x, p.y + wave);
      else ctx.lineTo(p.x, p.y + wave);
    }
    ctx.stroke();
  }
  // Specular highlight spot
  const cx = blerp(n,e,s,w,0.35,0.30);
  const g = ctx.createRadialGradient(cx.x,cx.y,1,cx.x,cx.y,10);
  g.addColorStop(0,'rgba(220,240,255,0.35)'); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx.x,cx.y,10,0,Math.PI*2); ctx.fill();
}

function drawRubble(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, color: string) {
  for (let i = 0; i < 7; i++) {
    const u = (i*0.618+0.08)%0.86 + 0.07;
    const v = (i*0.381+0.10)%0.82 + 0.09;
    const p = blerp(n,e,s,w,u,v);
    const sz = 2 + hash2(p.x*0.2,p.y*0.3)*3;
    const angle = hash2(p.x*0.3,p.y*0.5)*Math.PI;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(angle);
    ctx.fillStyle = i%2===0 ? lighten(color,0.15) : darken(color,0.25);
    ctx.fillRect(-sz/2,-sz/3,sz,sz*0.65); ctx.restore();
  }
}

function drawRockCracks(ctx: CanvasRenderingContext2D, n: Pt, e: Pt, s: Pt, w: Pt, color: string) {
  for (let i = 0; i < 5; i++) {
    const u0 = (i*0.618+0.1)%0.8 + 0.1;
    const v0 = (i*0.381+0.1)%0.8 + 0.1;
    const p0 = blerp(n,e,s,w,u0,v0);
    const angle = hash2(u0*10,v0*10)*Math.PI*2;
    const len = 6 + hash2(u0*7,v0*9)*8;
    ctx.strokeStyle = i%2===0 ? darken(color,0.45) : darken(color,0.30);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(p0.x,p0.y);
    ctx.lineTo(p0.x+Math.cos(angle)*len, p0.y+Math.sin(angle)*len*0.5);
    ctx.stroke();
  }
  // Scattered pebbles
  for (let i = 0; i < 5; i++) {
    const u = (i*0.31+0.15)%0.80+0.10;
    const v = (i*0.57+0.15)%0.76+0.12;
    const p = blerp(n,e,s,w,u,v);
    ctx.fillStyle = lighten(color,0.10);
    ctx.beginPath(); ctx.ellipse(p.x,p.y,2.5,1.4,hash2(p.x,p.y)*Math.PI,0,Math.PI*2); ctx.fill();
  }
}

function drawTexture(ctx: CanvasRenderingContext2D, tt: string, n: Pt, e: Pt, s: Pt, w: Pt, color: string, frame: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(n.x,n.y); ctx.lineTo(e.x,e.y); ctx.lineTo(s.x,s.y); ctx.lineTo(w.x,w.y);
  ctx.closePath(); ctx.clip();
  switch (tt) {
    case 'PLAIN':  drawGrass(ctx,n,e,s,w,color); break;
    case 'FOREST': drawForest(ctx,n,e,s,w,color); break;
    case 'WATER':  drawWater(ctx,n,e,s,w,color,frame); break;
    case 'RUINS':  drawRubble(ctx,n,e,s,w,color); break;
    case 'DANGER': drawRockCracks(ctx,n,e,s,w,color); break;
    case 'SHELTER':drawGrass(ctx,n,e,s,w,color); break;
  }
  ctx.restore();
}

// ─── Projection with camera rotation & zoom ───────────────────────────────────

function project(gx: number, gy: number, gz: number, rot: number, zoom: number, OX: number, OY: number, CX: number, CY: number): Pt {
  const dx = gx - CX, dy = gy - CY;
  const c = Math.cos(rot), s = Math.sin(rot);
  const rx = dx*c - dy*s, ry = dx*s + dy*c;
  return {
    x: (rx - ry) * (BASE_TW/2) * zoom + OX,
    y: (rx + ry) * (BASE_TH/2) * zoom - gz * BASE_EH * zoom + OY,
  };
}

function tileDepth(tx: number, ty: number, rot: number, CX: number, CY: number): number {
  const dx = tx+0.5-CX, dy = ty+0.5-CY;
  const c = Math.cos(rot), s = Math.sin(rot);
  const rx = dx*c-dy*s, ry = dx*s+dy*c;
  return rx + ry; // standard iso depth (ascending = back to front)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ArenaMap({ width: W, height: H, tiles, roster, events=[], currentHour, selectedFighterId, onSelectFighter }: ArenaMapProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const frameRef   = useRef(0);
  const rafRef     = useRef<number>(0);
  const vertRef    = useRef<Float32Array | null>(null);
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);

  const [rotation, setRotation] = useState(Math.PI * 0.25); // start standard iso
  const [zoom, setZoom]         = useState(1.0);
  const [hoveredFighter, setHoveredFighter] = useState<{fighter:any;tf:any;sx:number;sy:number}|null>(null);
  const [burst, setBurst]       = useState<{id:number;icon:string;sx:number;sy:number}|null>(null);
  const [animFrame, setAnimFrame] = useState(0); // drives water animation

  const CX = W / 2, CY = H / 2;

  // Canvas sizing — keep fixed, content inside pans/zooms
  const CANVAS_W = 900, CANVAS_H = 540;
  const OX = CANVAS_W / 2, OY = CANVAS_H * 0.55;

  const tileTypeAt = useCallback((tx: number, ty: number): string =>
    tiles.find(t => Number(t.x)===tx && Number(t.y)===ty)?.tileType ?? 'PLAIN',
  [tiles]);

  // Rebuild vertex elevation when tiles change
  useEffect(() => {
    vertRef.current = buildVertGrid(W, H, tileTypeAt);
  }, [W, H, tileTypeAt]);

  const getVE = useCallback((vx: number, vy: number): number => {
    if (!vertRef.current) return 0;
    const cx = Math.max(0, Math.min(W, vx)), cy = Math.max(0, Math.min(H, vy));
    return vertRef.current[cy*(W+1)+cx];
  }, [W, H]);

  const proj = useCallback((gx: number, gy: number, gz: number) =>
    project(gx, gy, gz, rotation, zoom, OX, OY, CX, CY),
  [rotation, zoom, OX, OY, CX, CY]);

  const getVScreen = useCallback((vx: number, vy: number) => {
    const e = getVE(vx, vy);
    return proj(vx, vy, e);
  }, [getVE, proj]);

  // ── Draw ────────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    if (!vertRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== CANVAS_W * dpr) {
      canvas.width  = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width  = `${CANVAS_W}px`;
      canvas.style.height = `${CANVAS_H}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#060810'); sky.addColorStop(0.6, '#0c1420'); sky.addColorStop(1, '#101828');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Painter's sort for current rotation
    const order: [number,number][] = [];
    for (let ty=0;ty<H;ty++) for (let tx=0;tx<W;tx++) order.push([tx,ty]);
    order.sort(([ax,ay],[bx,by]) => tileDepth(ax,ay,rotation,CX,CY)-tileDepth(bx,by,rotation,CX,CY));

    for (const [tx,ty] of order) {
      const tt = tileTypeAt(tx,ty);
      const n = getVScreen(tx,   ty);
      const e = getVScreen(tx+1, ty);
      const s = getVScreen(tx+1, ty+1);
      const w = getVScreen(tx,   ty+1);

      const avgE = (getVE(tx,ty)+getVE(tx+1,ty)+getVE(tx+1,ty+1)+getVE(tx,ty+1))/4;
      const color = topColor(tx,ty,tt,avgE);

      // Side faces — only draw where they'd be visible (south-facing edges of the terrain block)
      const groundBase = 12; // constant "cliff height" for edge tiles
      const eh = BASE_EH * zoom;

      // SW face (left)
      {
        const bW = {x:w.x, y:w.y + eh*1.4 + groundBase};
        const bS = {x:s.x, y:s.y + eh*1.4 + groundBase};
        const gc = ctx.createLinearGradient(w.x,w.y,bW.x,bW.y);
        gc.addColorStop(0,sideColor(avgE,'L')); gc.addColorStop(1,darken(sideColor(avgE,'L'),0.45));
        ctx.fillStyle = gc;
        ctx.beginPath(); ctx.moveTo(w.x,w.y); ctx.lineTo(s.x,s.y); ctx.lineTo(bS.x,bS.y); ctx.lineTo(bW.x,bW.y); ctx.closePath(); ctx.fill();
      }
      // SE face (right)
      {
        const bE = {x:e.x, y:e.y + eh*1.4 + groundBase};
        const bS = {x:s.x, y:s.y + eh*1.4 + groundBase};
        const gc = ctx.createLinearGradient(e.x,e.y,bE.x,bE.y);
        gc.addColorStop(0,sideColor(avgE,'R')); gc.addColorStop(1,darken(sideColor(avgE,'R'),0.40));
        ctx.fillStyle = gc;
        ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(s.x,s.y); ctx.lineTo(bS.x,bS.y); ctx.lineTo(bE.x,bE.y); ctx.closePath(); ctx.fill();
      }

      // Top face — gradient simulating sunlight from NW
      const topGrad = ctx.createLinearGradient(n.x,n.y,s.x,s.y);
      topGrad.addColorStop(0, lighten(color,0.22));
      topGrad.addColorStop(0.4, color);
      topGrad.addColorStop(1, darken(color,0.20));
      ctx.fillStyle = topGrad;
      ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(e.x,e.y); ctx.lineTo(s.x,s.y); ctx.lineTo(w.x,w.y); ctx.closePath(); ctx.fill();

      // Specular AO at tile edges
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(e.x,e.y); ctx.lineTo(s.x,s.y); ctx.lineTo(w.x,w.y); ctx.closePath(); ctx.stroke();

      // Texture detail
      if (zoom > 0.5) {
        drawTexture(ctx, tt, n, e, s, w, color, frameRef.current);
      }

      // Resource icon
      const tile = tiles.find(t=>Number(t.x)===tx&&Number(t.y)===ty);
      if (tile?.hasResource && tile.resourceType) {
        const cx = (n.x+e.x+s.x+w.x)/4, cy = (n.y+e.y+s.y+w.y)/4;
        ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(RESOURCE_ICONS[tile.resourceType]??'✦', cx, cy-10);
      }

      // Snow detail on peaks
      if (avgE >= 10) {
        ctx.fillStyle = `rgba(240,248,255,${Math.min(1,(avgE-10)*0.25)})`;
        ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(e.x,e.y); ctx.lineTo(s.x,s.y); ctx.lineTo(w.x,w.y); ctx.closePath(); ctx.fill();
        // Snow sparkle
        const cx2=(n.x+s.x)/2, cy2=(n.y+s.y)/2;
        ctx.fillStyle='rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(cx2,cy2,1.2,0,Math.PI*2); ctx.fill();
      }
    }

    // ── Fighters ───────────────────────────────────────────────────────────────
    const sortedFighters = [...roster].sort((a,b)=>{
      const da=tileDepth(Number(a.tf.x),Number(a.tf.y),rotation,CX,CY);
      const db=tileDepth(Number(b.tf.x),Number(b.tf.y),rotation,CX,CY);
      return da-db;
    });

    for (const {tf,fighter} of sortedFighters) {
      const fx=Number(tf.x),fy=Number(tf.y);
      const {x:sx,y:sy}=proj(fx,fy,getVE(fx,fy));
      const isDead=!tf.isAlive, isSelected=selectedFighterId===Number(fighter.id);
      const color=isDead?'#555':(ARCHETYPE_COLORS[fighter.archetype]??'#d4af37');
      const r=11, markerY=sy-r-6;

      // Shadow on terrain
      ctx.beginPath(); ctx.ellipse(sx,sy+1,r*1.5,r*0.42,0,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fill();
      // Stem
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx,markerY+r);
      ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1.5; ctx.stroke();

      if (isSelected) {
        ctx.beginPath(); ctx.arc(sx,markerY,r+8,0,Math.PI*2);
        ctx.strokeStyle='rgba(212,175,55,0.5)'; ctx.lineWidth=2.5; ctx.stroke();
      }
      const grad=ctx.createRadialGradient(sx-r*0.35,markerY-r*0.35,1,sx,markerY,r);
      grad.addColorStop(0,lighten(color,0.45)); grad.addColorStop(1,darken(color,0.30));
      ctx.beginPath(); ctx.arc(sx,markerY,r,0,Math.PI*2);
      ctx.fillStyle=grad; ctx.fill();
      ctx.strokeStyle=isSelected?'#d4af37':'rgba(0,0,0,0.5)';
      ctx.lineWidth=isSelected?2.5:1; ctx.stroke();

      if (isDead) {
        ctx.font='bold 10px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='#fff'; ctx.fillText('☠',sx,markerY);
      }

      // Name tag
      const name=fighter.name?.split(' ')[0]??'?';
      ctx.font=`bold 8.5px monospace`; ctx.textAlign='center'; ctx.textBaseline='bottom';
      const tagW=ctx.measureText(name).width+8;
      const tagY=markerY-r-4;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(sx-tagW/2,tagY-12,tagW,12);
      ctx.fillStyle=isSelected?'#d4af37':'rgba(255,255,255,0.92)';
      ctx.fillText(name,sx,tagY-1);
    }
  }, [tiles, roster, selectedFighterId, W, H, rotation, zoom, tileTypeAt, getVE, getVScreen, proj, CX, CY, CANVAS_W, CANVAS_H, OX, OY]);

  // Water animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      frameRef.current += 1;
      // Only re-draw canvas on animation tick when WATER tiles exist and zoom is large enough
      const hasWater = tiles.some(t => t.tileType === 'WATER');
      if (hasWater && zoom > 0.5) draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [draw, tiles, zoom]);

  // Redraw on rotation/zoom/tile/roster change
  useEffect(() => { draw(); }, [draw]);

  // ── Burst detection ──────────────────────────────────────────────────────────
  useEffect(() => {
    const located = events.filter(e=>e.x!=null&&e.y!=null);
    if (!located.length) return;
    const ev=located[0];
    const {x:sx,y:sy}=proj(Number(ev.x!),Number(ev.y!),getVE(Number(ev.x!),Number(ev.y!)));
    setBurst({id:ev.id,icon:EVENT_BURST_ICONS[ev.eventType]??'✦',sx,sy});
  }, [events, proj, getVE]);

  // ── Mouse / wheel handlers ──────────────────────────────────────────────────

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
    // Hover detection for fighter tooltip
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    let best: typeof hoveredFighter=null, bestD=20;
    for (const {tf,fighter} of roster) {
      if (!tf.isAlive) continue;
      const {x:sx,y:sy}=proj(Number(tf.x),Number(tf.y),getVE(Number(tf.x),Number(tf.y)));
      const markerY=sy-11-6;
      const d=Math.hypot(mx-sx,my-markerY);
      if (d<bestD){bestD=d;best={fighter,tf,sx,sy:markerY};}
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

  const alive = roster.filter(r=>r.tf.isAlive);
  const ticker = events.slice(0,7);

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
          {currentHour !== undefined && <span className="font-mono text-[10px] text-text-secondary">Hour {currentHour}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-text-secondary hidden sm:block">drag to rotate · scroll to zoom</span>
          <span className="font-mono text-[10px] text-text-secondary">{alive.length} alive</span>
        </div>
      </div>

      {/* Live ticker */}
      {ticker.length > 0 && (
        <div className="overflow-hidden bg-black/40 border-b border-separator/20">
          <motion.div
            key={ticker[0]?.id}
            className="inline-flex gap-14 py-1.5 px-4 font-mono text-[10px] text-text-secondary whitespace-nowrap"
            initial={{ x: '100%' }} animate={{ x: '-100%' }}
            transition={{ duration: 32, ease: 'linear', repeat: Infinity }}
          >
            {ticker.map(ev=>(
              <span key={ev.id}>
                <span className="text-accent-gold">[H{ev.hour}]</span>{' '}
                <span>{EVENT_BURST_ICONS[ev.eventType]??'•'}</span>{' '}
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
          style={{ display: 'block', cursor: isDragging.current ? 'grabbing' : hoveredFighter ? 'pointer' : 'grab', touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { isDragging.current=false; setHoveredFighter(null); }}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          onClick={handleClick}
        />

        {/* Controls hint overlay */}
        <div className="absolute bottom-3 right-4 flex gap-3 font-mono text-[9px] text-text-secondary/50 pointer-events-none">
          <span>🖱️ drag: rotate + zoom</span>
          <span>⚙️ scroll: zoom</span>
        </div>

        {/* Fighter tooltip */}
        <AnimatePresence>
          {hoveredFighter && (
            <motion.div
              key={Number(hoveredFighter.fighter.id)}
              initial={{opacity:0,scale:0.95,y:4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0}}
              transition={{duration:0.1}}
              className="absolute pointer-events-none bg-bg-primary/96 border border-accent-gold shadow-2xl p-3 w-48 font-mono text-xs z-50"
              style={{left:Math.min(hoveredFighter.sx+14,CANVAS_W-200), top:Math.max(4,hoveredFighter.sy-60)}}
            >
              <div className="font-display text-sm text-accent-gold mb-0.5">{hoveredFighter.fighter.name}</div>
              <div className="text-[9px] uppercase text-text-secondary mb-2">{hoveredFighter.fighter.archetype}</div>
              {(([['Status',hoveredFighter.tf.condition],['Position',`(${Number(hoveredFighter.tf.x)},${Number(hoveredFighter.tf.y)})`],
                 ['Hunger',Number(hoveredFighter.tf.hunger)],['Thirst',Number(hoveredFighter.tf.thirst)],
                 ['Injury',`${Number(hoveredFighter.tf.injury)}%`],['Kills',Number(hoveredFighter.tf.kills??0)]]
                ) as [string,any][]).map(([l,v])=>(
                <div key={l} className="flex justify-between text-[10px]">
                  <span className="text-text-secondary">{l}</span>
                  <span className={l==='Injury'&&Number(hoveredFighter.tf.injury)>60?'text-red-400':'text-text-primary'}>{v}</span>
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
              style={{left:Math.min(burst.sx-20,CANVAS_W-60),top:Math.max(0,burst.sy-50)}}
              initial={{scale:0,opacity:0,y:0}} animate={{scale:[0,2,1.4],opacity:[0,1,0],y:-35}}
              transition={{duration:2.8,ease:'easeOut'}} onAnimationComplete={()=>setBurst(null)}
            >
              <span style={{filter:'drop-shadow(0 0 8px rgba(212,175,55,0.9))'}}>{burst.icon}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="px-5 py-2.5 border-t border-separator/20 flex flex-wrap gap-x-5 gap-y-1">
        {Object.entries(ARCHETYPE_COLORS).map(([arch,color])=>(
          <div key={arch} className="flex items-center gap-1.5 font-mono text-[9px] text-text-secondary uppercase">
            <span className="w-2 h-2 rounded-full" style={{background:color}}/>{arch}
          </div>
        ))}
      </div>
    </div>
  );
}
