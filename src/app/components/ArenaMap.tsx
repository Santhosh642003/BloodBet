import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ArenaTile {
  x: number; y: number;
  tileType: string;
  hasResource: boolean;
  resourceType?: string | null;
}
interface RosterEntry { tf: any; fighter: any; }
interface LiveEventLite {
  id: number; hour: number; eventType: string; description: string;
  x?: number | null; y?: number | null;
}
interface ArenaMapProps {
  width: number; height: number;
  tiles: ArenaTile[];
  roster: RosterEntry[];
  events?: LiveEventLite[];
  currentHour?: number;
  selectedFighterId?: number | null;
  onSelectFighter?: (fighterId: number) => void;
}

// ─── Terrain visual config ──────────────────────────────────────────────────

const TILE_W  = 80;   // diamond width
const TILE_H  = 40;   // diamond height (TILE_W / 2 for standard iso)
const ELEV_H  = 18;   // pixels per elevation unit (the "height" of cube walls)

const BASE_ELEV: Record<string, number> = {
  WATER: 0, PLAIN: 1, SHELTER: 1, RUINS: 2, FOREST: 2, DANGER: 4, CORNUCOPIA: 1,
};
const ELEV_NOISE: Record<string, number> = {
  WATER: 0, PLAIN: 2, SHELTER: 1, RUINS: 2, FOREST: 2, DANGER: 3, CORNUCOPIA: 0,
};

function noiseHash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + x * y * 0.31) * 43758.5453123;
  return s - Math.floor(s);
}
function tileElevation(x: number, y: number, tt: string): number {
  const base  = BASE_ELEV[tt]  ?? 1;
  const noise = ELEV_NOISE[tt] ?? 1;
  return base + Math.floor(noiseHash(x, y) * (noise + 1));
}

// Color palette — top / left-face (shadow) / right-face (mid-shadow)
type FaceColors = { top: string; left: string; right: string };

function tileColors(x: number, y: number, tt: string, elev: number): FaceColors {
  // Snow cap on tall mountains
  if (tt === 'DANGER' && elev >= 6) return { top: '#dde8f0', left: '#a0b4bf', right: '#b8ccd6' };
  if (tt === 'DANGER' && elev >= 5) return { top: '#b8ccd6', left: '#7a9aaa', right: '#9ab2bc' };

  // Slight hue variation across same-type tiles
  const v = noiseHash(x * 3 + 5, y * 7 + 11);

  const palettes: Record<string, { top: [string, string]; left: string; right: string }> = {
    PLAIN:      { top: v > 0.5 ? ['#5ba040', '#6cb84e'] : ['#4e9236', '#58a042'], left: '#2e5c22', right: '#40782e' },
    FOREST:     { top: v > 0.5 ? ['#286020', '#326828'] : ['#1e5218', '#245820'], left: '#123612', right: '#1c4a18' },
    WATER:      { top: v > 0.5 ? ['#3d8fc4', '#4499cc'] : ['#3580b0', '#3d8abf'], left: '#1a4a70', right: '#26608e' },
    RUINS:      { top: v > 0.5 ? ['#9c8560', '#a89070'] : ['#8a7450', '#96806a'], left: '#584830', right: '#6e5c3c' },
    SHELTER:    { top: v > 0.5 ? ['#567548', '#5e8050'] : ['#4a6640', '#527048'], left: '#2c4024', right: '#3c5430' },
    DANGER:     { top: v > 0.5 ? ['#7a6448', '#8a7055'] : ['#6e5838', '#7a6448'], left: '#3e3020', right: '#5a4430' },
    CORNUCOPIA: { top: v > 0.5 ? ['#d4af37', '#e0bc44'] : ['#c8a030', '#d4aa3a'], left: '#806818', right: '#a07820' },
  };
  const p = palettes[tt] ?? palettes.PLAIN;
  return { top: p.top[0], left: p.left, right: p.right };
}

// Terrain prop emojis drawn on canvas top-face center
const TERRAIN_PROPS: Record<string, string[]> = {
  PLAIN:      ['', '🌾', ''],
  FOREST:     ['🌲', '🌳', '🌲'],
  WATER:      ['〰️', '', '〰️'],
  RUINS:      ['🏛️', '🧱', '🪨'],
  SHELTER:    ['⛺', '', '🏚️'],
  DANGER:     ['🪨', '', '⛰️'],
  CORNUCOPIA: ['👑', '✨', '👑'],
};
const RESOURCE_ICONS: Record<string, string> = {
  FOOD: '🍖', WATER: '💧', MEDKIT: '🩹', WEAPON: '⚔️', ARMOR: '🛡️',
  INTEL: '📡', SMOKE: '💨', TRAP: '🪤',
};
const ARCHETYPE_COLORS: Record<string, string> = {
  AGGRESSIVE: '#e05548', STRATEGIC: '#4a8de0', COWARDLY: '#9a9a9a',
  DIPLOMATIC: '#4ae09c', BETRAYER: '#b04ae0', SURVIVALIST: '#e0c14a',
};
const EVENT_BURST_ICONS: Record<string, string> = {
  KILL: '⚔️', ALLIANCE: '🤝', BETRAYAL: '🗡️', FLEE: '💨',
  TRAP: '⚠️', ELIMINATION: '💀', SPONSOR: '🎁', COMBAT: '💥',
};

// ─── ISO coordinate helpers ─────────────────────────────────────────────────

function isoToScreen(gx: number, gy: number, elev: number, ox: number, oy: number) {
  const sx = (gx - gy) * (TILE_W / 2) + ox;
  const sy = (gx + gy) * (TILE_H / 2) + oy - elev * ELEV_H;
  return { sx, sy };
}

// ─── Canvas drawing primitives ─────────────────────────────────────────────

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const hw = TILE_W / 2, hh = TILE_H / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLeftFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, elev: number, color: string) {
  if (elev <= 0) return;
  const hw = TILE_W / 2, hh = TILE_H / 2, eh = elev * ELEV_H;
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);              // left point of top face
  ctx.lineTo(cx, cy + hh);              // bottom point of top face
  ctx.lineTo(cx, cy + hh + eh);         // bottom-right at ground
  ctx.lineTo(cx - hw, cy + eh);         // bottom-left at ground
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawRightFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, elev: number, color: string) {
  if (elev <= 0) return;
  const hw = TILE_W / 2, hh = TILE_H / 2, eh = elev * ELEV_H;
  ctx.beginPath();
  ctx.moveTo(cx, cy + hh);              // bottom point of top face
  ctx.lineTo(cx + hw, cy);              // right point of top face
  ctx.lineTo(cx + hw, cy + eh);         // bottom-right at ground
  ctx.lineTo(cx, cy + hh + eh);         // bottom at ground
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

// Very thin edge line on top face for separation
function strokeTopEdge(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const hw = TILE_W / 2, hh = TILE_H / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ArenaMap({
  width, height, tiles, roster, events = [], currentHour, selectedFighterId, onSelectFighter,
}: ArenaMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredFighter, setHoveredFighter] = useState<{
    fighter: any; tf: any; sx: number; sy: number;
  } | null>(null);
  const [latestBurst, setLatestBurst] = useState<{ id: number; icon: string; sx: number; sy: number } | null>(null);

  // Build elevation map
  const elevMap = useCallback((x: number, y: number, tt: string) => {
    return tileElevation(x, y, tt);
  }, []);

  // Compute canvas dimensions — add generous padding for tallest mountains
  const maxElev = 6 * ELEV_H + TILE_H * 2;
  const mapW    = (width + height) * (TILE_W / 2) + TILE_W * 2;
  const mapH    = (width + height) * (TILE_H / 2) + maxElev + TILE_H * 2;
  const originX = mapW / 2;
  const originY = maxElev + TILE_H; // push down to show mountain sides

  const tileAt = (x: number, y: number) =>
    tiles.find(t => Number(t.x) === x && Number(t.y) === y);

  // Draw the map onto canvas whenever anything changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = mapW * dpr;
    canvas.height = mapH * dpr;
    canvas.style.width  = `${mapW}px`;
    canvas.style.height = `${mapH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, mapW, mapH);

    // Draw sky gradient background
    const sky = ctx.createLinearGradient(0, 0, 0, mapH * 0.4);
    sky.addColorStop(0,   '#0a0e14');
    sky.addColorStop(0.5, '#0f1520');
    sky.addColorStop(1,   '#141c28');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, mapW, mapH);

    // Painter's algorithm: draw back→front (increasing y+x for standard iso)
    const drawOrder: { x: number; y: number }[] = [];
    for (let gx = 0; gx < width; gx++) {
      for (let gy = 0; gy < height; gy++) {
        drawOrder.push({ x: gx, y: gy });
      }
    }
    // Sort by x+y so tiles further from viewer render first
    drawOrder.sort((a, b) => {
      const da = a.x + a.y;
      const db = b.x + b.y;
      if (da !== db) return da - db;
      return a.x - b.x;
    });

    for (const { x, y } of drawOrder) {
      const tile = tileAt(x, y);
      const tt   = tile?.tileType ?? 'PLAIN';
      const elev = elevMap(x, y, tt);
      const c    = tileColors(x, y, tt, elev);
      const { sx, sy } = isoToScreen(x, y, elev, originX, originY);

      // Gradient on top face (light from top-left)
      const g = ctx.createLinearGradient(sx - TILE_W / 2, sy - TILE_H / 2, sx + TILE_W / 2, sy + TILE_H / 2);
      g.addColorStop(0, lighten(c.top, 0.15));
      g.addColorStop(0.5, c.top);
      g.addColorStop(1, darken(c.top, 0.12));

      // Draw left then right face (back faces render before top)
      drawLeftFace(ctx, sx, sy, elev, c.left);
      drawRightFace(ctx, sx, sy, elev, c.right);
      drawDiamond(ctx, sx, sy, g as any);
      strokeTopEdge(ctx, sx, sy);

      // Water shimmer overlay
      if (tt === 'WATER') {
        const shimmer = ctx.createLinearGradient(sx - TILE_W / 2, sy - TILE_H / 2, sx + TILE_W / 2, sy);
        shimmer.addColorStop(0, 'rgba(120,200,255,0.18)');
        shimmer.addColorStop(0.5, 'rgba(80,160,220,0.06)');
        shimmer.addColorStop(1, 'rgba(20,80,140,0.1)');
        drawDiamond(ctx, sx, sy, shimmer as any);
      }

      // Terrain prop emoji
      const props = TERRAIN_PROPS[tt] ?? [];
      const propChar = props[(x * 19 + y * 23) % (props.length || 1)];
      if (propChar) {
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.85;
        ctx.fillText(propChar, sx, sy - 4);
        ctx.globalAlpha = 1;
      }

      // Resource icon
      if (tile?.hasResource && tile.resourceType) {
        const icon = RESOURCE_ICONS[tile.resourceType] ?? '✦';
        ctx.font = '12px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, sx, sy - 16);
      }
    }

    // Draw fighters
    for (const { tf, fighter } of roster) {
      const fx = Number(tf.x);
      const fy = Number(tf.y);
      const tile = tileAt(fx, fy);
      const tt   = tile?.tileType ?? 'PLAIN';
      const elev = elevMap(fx, fy, tt);
      const { sx, sy } = isoToScreen(fx, fy, elev, originX, originY);

      const isDead   = !tf.isAlive;
      const isSelected = selectedFighterId === Number(fighter.id);
      const color = isDead ? '#666' : (ARCHETYPE_COLORS[fighter.archetype] ?? '#d4af37');
      const radius = 10;

      // Shadow beneath fighter
      ctx.beginPath();
      ctx.ellipse(sx, sy + 4, radius * 1.2, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      // Fighter circle
      ctx.beginPath();
      ctx.arc(sx, sy - radius - 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Glow ring
        ctx.beginPath();
        ctx.arc(sx, sy - radius - 2, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212,175,55,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isDead) {
        ctx.font = 'bold 10px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText('☠', sx, sy - radius - 2);
      }

      // Fighter name tag
      const name = fighter.name?.split(' ')[0] ?? '?';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isDead ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.92)';
      ctx.fillText(name, sx, sy - radius * 2 - 6);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, roster, selectedFighterId, width, height, mapW, mapH, originX, originY]);

  // Track latest burst when events change
  useEffect(() => {
    const located = events.filter(e => e.x != null && e.y != null);
    if (!located.length) return;
    const ev = located[0];
    const tile = tileAt(Number(ev.x), Number(ev.y));
    const tt   = tile?.tileType ?? 'PLAIN';
    const elev = elevMap(Number(ev.x!), Number(ev.y!), tt);
    const { sx, sy } = isoToScreen(Number(ev.x!), Number(ev.y!), elev, originX, originY);
    setLatestBurst({ id: ev.id, icon: EVENT_BURST_ICONS[ev.eventType] ?? '✦', sx, sy });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Mouse move → detect hovered fighter
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find closest fighter within 16px
    let best: typeof hoveredFighter = null;
    let bestDist = 16;
    for (const { tf, fighter } of roster) {
      if (!tf.isAlive) continue;
      const fx = Number(tf.x);
      const fy = Number(tf.y);
      const tile = tileAt(fx, fy);
      const tt   = tile?.tileType ?? 'PLAIN';
      const elev = elevMap(fx, fy, tt);
      const { sx, sy } = isoToScreen(fx, fy, elev, originX, originY);
      const radius = 10;
      const fsy = sy - radius - 2;
      const d = Math.hypot(mx - sx, my - fsy);
      if (d < bestDist) {
        bestDist = d;
        best = { fighter, tf, sx, sy: fsy };
      }
    }
    setHoveredFighter(best);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, tiles, originX, originY, width, height]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredFighter) {
      onSelectFighter?.(Number(hoveredFighter.fighter.id));
    }
  }, [hoveredFighter, onSelectFighter]);

  const alive = roster.filter(r => r.tf.isAlive);
  const tickerEvents = events.slice(0, 6);

  return (
    <div className="bg-[#060b12] border border-accent-crimson-end relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-separator/40">
        <div className="flex items-center gap-3">
          <h3 className="font-heading text-base text-accent-gold uppercase tracking-wider">Live Arena</h3>
          <div className="flex items-center gap-1.5 bg-destructive/20 border border-destructive px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-[9px] tracking-widest text-destructive uppercase">On Air</span>
          </div>
          {currentHour !== undefined && (
            <span className="font-mono text-xs text-text-secondary">Hour {currentHour}</span>
          )}
        </div>
        <span className="font-mono text-xs text-text-secondary">{alive.length} fighters alive</span>
      </div>

      {/* Live ticker */}
      {tickerEvents.length > 0 && (
        <div className="border-b border-separator/30 overflow-hidden bg-black/30">
          <motion.div
            key={tickerEvents[0]?.id}
            className="inline-flex gap-12 py-1.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap"
            initial={{ x: '100%' }}
            animate={{ x: '-100%' }}
            transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
          >
            {tickerEvents.map(ev => (
              <span key={ev.id}>
                <span className="text-accent-gold">[H{ev.hour}]</span>{' '}
                <span>{EVENT_BURST_ICONS[ev.eventType] ?? '•'}</span>{' '}
                <span className="text-text-primary">{ev.description}</span>
              </span>
            ))}
          </motion.div>
        </div>
      )}

      {/* Canvas wrapper */}
      <div className="overflow-auto relative" style={{ maxHeight: 520 }}>
        <div className="relative inline-block" style={{ minWidth: mapW }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', cursor: hoveredFighter ? 'pointer' : 'default' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredFighter(null)}
            onClick={handleClick}
          />

          {/* Fighter tooltip */}
          <AnimatePresence>
            {hoveredFighter && (
              <motion.div
                key={Number(hoveredFighter.fighter.id)}
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.1 }}
                className="absolute pointer-events-none bg-bg-primary/95 border border-accent-gold shadow-xl p-3 w-44 font-mono text-xs z-50"
                style={{
                  left: hoveredFighter.sx + 14,
                  top: hoveredFighter.sy - 40,
                }}
              >
                <div className="font-display text-sm text-accent-gold mb-1">{hoveredFighter.fighter.name}</div>
                <div className="text-text-secondary uppercase mb-2 text-[9px]">{hoveredFighter.fighter.archetype}</div>
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Position</span>
                    <span>({Number(hoveredFighter.tf.x)}, {Number(hoveredFighter.tf.y)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Status</span>
                    <span className="text-accent-ice-blue">{hoveredFighter.tf.condition}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Hunger/Thirst</span>
                    <span>{Number(hoveredFighter.tf.hunger)}/{Number(hoveredFighter.tf.thirst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Injury</span>
                    <span className={Number(hoveredFighter.tf.injury) > 50 ? 'text-red-400' : 'text-text-primary'}>
                      {Number(hoveredFighter.tf.injury)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Kills</span>
                    <span>{Number(hoveredFighter.tf.kills ?? 0)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Event burst overlay */}
          <AnimatePresence>
            {latestBurst && (
              <motion.div
                key={latestBurst.id}
                className="absolute pointer-events-none text-2xl"
                style={{ left: latestBurst.sx - 16, top: latestBurst.sy - 36, zIndex: 60 }}
                initial={{ scale: 0.2, opacity: 0, y: 0 }}
                animate={{ scale: [0.2, 1.6, 1.2], opacity: [0, 1, 0], y: -20 }}
                transition={{ duration: 2.5, ease: 'easeOut' }}
                onAnimationComplete={() => setLatestBurst(null)}
              >
                <span className="drop-shadow-[0_0_8px_rgba(212,175,55,0.9)]">{latestBurst.icon}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-separator/30 flex flex-wrap gap-x-5 gap-y-1.5">
        {Object.entries(ARCHETYPE_COLORS).map(([arch, color]) => (
          <div key={arch} className="flex items-center gap-1.5 font-mono text-[9px] text-text-secondary uppercase">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
            {arch}
          </div>
        ))}
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-text-secondary uppercase">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#666]" />
          Eliminated
        </div>
      </div>
    </div>
  );
}

// ─── Color utilities ────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}
