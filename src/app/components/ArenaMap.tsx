import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TerrainType = 'water' | 'sand' | 'grass' | 'rock' | 'snow';
export type Biome = 'highlands' | 'island' | 'plains' | 'volcanic';

export interface ArenaMapHandle {
  getTerrainTypeAt: (x: number, z: number) => TerrainType;
}

interface RosterEntry { tf: any; fighter: any; }
interface LiveEventLite { id: number; hour: number; eventType: string; description: string; x?: number | null; y?: number | null; }

interface ArenaMapProps {
  seed?: number;
  biome?: Biome;
  waterLevel?: number;
  gridSize?: number;
  // Legacy / SpacetimeDB props
  width?: number;
  height?: number;
  tiles?: any[];
  roster?: RosterEntry[];
  events?: LiveEventLite[];
  currentHour?: number;
  selectedFighterId?: number | null;
  onSelectFighter?: (id: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGS      = 180;  // geometry subdivisions
const WORLD_SZ  = 22;   // three.js world units across the terrain
const MAP_H     = 500;  // canvas pixel height

const ARCHETYPE_HEX: Record<string, number> = {
  AGGRESSIVE: 0xe05548, STRATEGIC: 0x4a8de0, COWARDLY:   0x9a9a9a,
  DIPLOMATIC: 0x4ae09c, BETRAYER:  0xb04ae0, SURVIVALIST: 0xe0c14a,
};

const EVENT_ICONS: Record<string, string> = {
  KILL:'⚔️', ALLIANCE:'🤝', BETRAYAL:'🗡️', FLEE:'💨',
  TRAP:'⚠️', ELIMINATION:'💀', SPONSOR:'🎁', COMBAT:'💥', PHASE:'📢',
};

// ─── Biome definitions ────────────────────────────────────────────────────────

interface BiomeDef {
  label: string;
  fogColor: string; skyTop: string; skyBot: string;
  sunColor: number; sunIntensity: number;
  // noise
  scale: number; octaves: number; persistence: number; lacunarity: number;
  heightMult: number;
  shapeMode: 'island' | 'highlands' | 'plains' | 'volcanic';
}

const BIOMES: Record<Biome, BiomeDef> = {
  island: {
    label: 'Island', fogColor: '#9dc8e8', skyTop: '#1a3a6a', skyBot: '#4888c8',
    sunColor: 0xffe8c0, sunIntensity: 1.8,
    scale: 1.8, octaves: 5, persistence: 0.48, lacunarity: 2.0, heightMult: 9,
    shapeMode: 'island',
  },
  highlands: {
    label: 'Highlands', fogColor: '#c0d0d8', skyTop: '#1e2e40', skyBot: '#3c5870',
    sunColor: 0xfff0d0, sunIntensity: 1.6,
    scale: 2.0, octaves: 7, persistence: 0.52, lacunarity: 2.1, heightMult: 14,
    shapeMode: 'highlands',
  },
  plains: {
    label: 'Plains', fogColor: '#c8d8b8', skyTop: '#1e2c10', skyBot: '#507840',
    sunColor: 0xfff8e0, sunIntensity: 1.7,
    scale: 3.0, octaves: 4, persistence: 0.36, lacunarity: 2.2, heightMult: 5,
    shapeMode: 'plains',
  },
  volcanic: {
    label: 'Volcanic', fogColor: '#281008', skyTop: '#0e0404', skyBot: '#3a0a08',
    sunColor: 0xff5020, sunIntensity: 2.0,
    scale: 1.6, octaves: 8, persistence: 0.60, lacunarity: 2.3, heightMult: 16,
    shapeMode: 'volcanic',
  },
};

// ─── Color ramps ──────────────────────────────────────────────────────────────

interface Stop { t: number; c: THREE.Color; type: TerrainType; }

function rampIsland(wl: number): Stop[] {
  const w = wl;
  return [
    { t: 0,        c: new THREE.Color('#082040'), type: 'water' },
    { t: w * 0.5,  c: new THREE.Color('#1a5898'), type: 'water' },
    { t: w,        c: new THREE.Color('#2870b8'), type: 'water' },
    { t: w + .03,  c: new THREE.Color('#e0d090'), type: 'sand'  },
    { t: w + .08,  c: new THREE.Color('#c8b860'), type: 'sand'  },
    { t: w + .18,  c: new THREE.Color('#58b040'), type: 'grass' },
    { t: w + .40,  c: new THREE.Color('#3a8828'), type: 'grass' },
    { t: w + .58,  c: new THREE.Color('#7a7060'), type: 'rock'  },
    { t: w + .78,  c: new THREE.Color('#a09898'), type: 'rock'  },
    { t: 1,        c: new THREE.Color('#eef4fc'), type: 'snow'  },
  ];
}
function rampHighlands(wl: number): Stop[] {
  const w = wl;
  return [
    { t: 0,        c: new THREE.Color('#0a1828'), type: 'water' },
    { t: w * .6,   c: new THREE.Color('#183860'), type: 'water' },
    { t: w,        c: new THREE.Color('#285898'), type: 'water' },
    { t: w + .03,  c: new THREE.Color('#c8b870'), type: 'sand'  },
    { t: w + .09,  c: new THREE.Color('#b0a050'), type: 'sand'  },
    { t: w + .20,  c: new THREE.Color('#50a038'), type: 'grass' },
    { t: w + .40,  c: new THREE.Color('#387028'), type: 'grass' },
    { t: w + .58,  c: new THREE.Color('#686058'), type: 'rock'  },
    { t: w + .76,  c: new THREE.Color('#888080'), type: 'rock'  },
    { t: 1,        c: new THREE.Color('#e8f0fc'), type: 'snow'  },
  ];
}
function rampPlains(wl: number): Stop[] {
  const w = wl;
  return [
    { t: 0,        c: new THREE.Color('#1a3858'), type: 'water' },
    { t: w,        c: new THREE.Color('#3070a8'), type: 'water' },
    { t: w + .04,  c: new THREE.Color('#d8c878'), type: 'sand'  },
    { t: w + .12,  c: new THREE.Color('#68b848'), type: 'grass' },
    { t: w + .50,  c: new THREE.Color('#509038'), type: 'grass' },
    { t: w + .72,  c: new THREE.Color('#788068'), type: 'rock'  },
    { t: 1,        c: new THREE.Color('#a8a098'), type: 'rock'  },
  ];
}
function rampVolcanic(wl: number): Stop[] {
  const w = wl;
  return [
    { t: 0,        c: new THREE.Color('#200808'), type: 'water' },
    { t: w * .6,   c: new THREE.Color('#501010'), type: 'water' },
    { t: w,        c: new THREE.Color('#801818'), type: 'water' },
    { t: w + .05,  c: new THREE.Color('#904020'), type: 'sand'  },
    { t: w + .18,  c: new THREE.Color('#583020'), type: 'grass' },
    { t: w + .42,  c: new THREE.Color('#382018'), type: 'rock'  },
    { t: w + .68,  c: new THREE.Color('#201010'), type: 'rock'  },
    { t: 1,        c: new THREE.Color('#ff5010'), type: 'snow'  },
  ];
}

function getRamp(biome: Biome, wl: number): Stop[] {
  if (biome === 'island')    return rampIsland(wl);
  if (biome === 'highlands') return rampHighlands(wl);
  if (biome === 'plains')    return rampPlains(wl);
  return rampVolcanic(wl);
}

function sampleRamp(ramp: Stop[], t: number): { color: THREE.Color; type: TerrainType } {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < ramp.length - 1; i++) {
    if (t <= ramp[i + 1].t) {
      const f = (t - ramp[i].t) / (ramp[i + 1].t - ramp[i].t || 0.001);
      return { color: ramp[i].c.clone().lerp(ramp[i + 1].c, f), type: f < 0.5 ? ramp[i].type : ramp[i + 1].type };
    }
  }
  const last = ramp[ramp.length - 1];
  return { color: last.c.clone(), type: last.type };
}

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Heightmap builder ────────────────────────────────────────────────────────

function buildHeightmap(seed: number, biome: Biome, waterLevel: number): Float32Array {
  const def    = BIOMES[biome];
  const rng    = mulberry32(seed);
  const noise  = createNoise2D(rng);
  const noise2 = createNoise2D(mulberry32(seed + 9999)); // second noise for shape variety
  const V      = SEGS + 1;
  const raw    = new Float32Array(V * V);

  for (let vy = 0; vy < V; vy++) {
    for (let vx = 0; vx < V; vx++) {
      // Normalised coords -1..1
      const nx = (vx / SEGS - 0.5) * def.scale;
      const ny = (vy / SEGS - 0.5) * def.scale;
      const ux = vx / SEGS - 0.5; // -0.5..0.5
      const uy = vy / SEGS - 0.5;

      // ── FBM base
      let h = 0, amp = 1, freq = 1, tot = 0;
      for (let o = 0; o < def.octaves; o++) {
        h   += noise(nx * freq, ny * freq) * amp;
        tot += amp;
        amp *= def.persistence;
        freq *= def.lacunarity;
      }
      h = (h / tot + 1) * 0.5; // 0..1

      // ── Shape mask per biome
      if (biome === 'island') {
        // Elliptical distance + low-freq noise warp for organic coastline
        const warpX = noise2(ux * 1.2, uy * 1.2) * 0.18;
        const warpY = noise2(ux * 1.2 + 5, uy * 1.2 + 5) * 0.18;
        const dx = ux + warpX, dy = uy + warpY;
        const dist = Math.sqrt(dx * dx * 1.1 + dy * dy * 0.9); // slight oval
        // Smooth falloff: centre=1, edge=0 — ensures island surrounded by ocean
        const falloff = Math.max(0, 1 - (dist / 0.46) * (dist / 0.46));
        h = h * falloff * falloff;
        // Ensure centre is elevated (mountain peak)
        const centreBump = Math.max(0, 1 - dist / 0.22) * 0.35;
        h += centreBump;
        h = Math.min(1, h);
      } else if (biome === 'volcanic') {
        // Caldera: ring of high terrain around hollow centre
        const dist = Math.sqrt(ux * ux + uy * uy);
        // Ring ridge at ~35% radius
        const ring = Math.exp(-((dist - 0.28) ** 2) / 0.012) * 0.9;
        // Outer falloff
        const outer = Math.max(0, 1 - (dist / 0.48) ** 2);
        // Sunken caldera centre
        const caldera = Math.max(0, 1 - (dist / 0.10) ** 2) * 0.5;
        h = (h * 0.35 + ring + outer * 0.25 - caldera) * outer;
        h = Math.max(0, h);
      } else if (biome === 'highlands') {
        // Ridge noise: fold FBM for mountain ridges
        let r = 0, amp2 = 1, freq2 = 1, tot2 = 0;
        for (let o = 0; o < 4; o++) {
          r    += (1 - Math.abs(noise2(nx * freq2, ny * freq2))) * amp2;
          tot2 += amp2; amp2 *= 0.5; freq2 *= 2.1;
        }
        r /= tot2;
        h  = h * 0.4 + r * 0.6;
        // Soft border falloff so edges don't cliff-drop
        const dx = ux, dy = uy;
        const edgeDist = Math.max(0, 1 - (Math.sqrt(dx * dx + dy * dy) / 0.5) * 1.4);
        h  = h * (0.5 + edgeDist * 0.5);
        h  = Math.max(0, h);
      } else {
        // plains — minimal height variation, gentle hills, soft edges
        const dx = ux, dy = uy;
        const edgeMask = Math.max(0, 1 - (Math.max(Math.abs(dx), Math.abs(dy)) / 0.45) ** 3);
        h = h * edgeMask;
      }

      raw[vy * V + vx] = h;
    }
  }

  // Normalise 0..1
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < raw.length; i++) { if (raw[i] < mn) mn = raw[i]; if (raw[i] > mx) mx = raw[i]; }
  const rng2 = mx - mn || 1;
  for (let i = 0; i < raw.length; i++) raw[i] = (raw[i] - mn) / rng2;

  return raw;
}

// ─── Terrain height lookup (world-space Y) ────────────────────────────────────

function sampleHeight(heights: Float32Array, wx: number, wz: number, heightMult: number): number {
  // wx,wz in [-WORLD_SZ/2, WORLD_SZ/2]
  const V  = SEGS + 1;
  const tx = ((wx + WORLD_SZ / 2) / WORLD_SZ) * SEGS;
  const tz = ((wz + WORLD_SZ / 2) / WORLD_SZ) * SEGS;
  const x0 = Math.max(0, Math.min(SEGS - 1, Math.floor(tx)));
  const z0 = Math.max(0, Math.min(SEGS - 1, Math.floor(tz)));
  const fx = tx - x0, fz = tz - z0;
  const h00 = heights[z0 * V + x0], h10 = heights[z0 * V + x0 + 1];
  const h01 = heights[(z0 + 1) * V + x0], h11 = heights[(z0 + 1) * V + x0 + 1];
  const h = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz)
           + h01 * (1 - fx) * fz       + h11 * fx * fz;
  return h * heightMult;
}

// ─── Player marker factory ────────────────────────────────────────────────────

function makePinMesh(color: number, isDead: boolean): THREE.Group {
  const g = new THREE.Group();
  const col = new THREE.Color(color);

  // Pin body (cylinder)
  const bodyGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.28;
  body.castShadow = true;
  g.add(body);

  // Pin head (sphere)
  const headGeo = new THREE.SphereGeometry(0.2, 12, 8);
  const headMat = new THREE.MeshStandardMaterial({
    color: isDead ? 0x444444 : col,
    roughness: 0.35, metalness: 0.2,
    emissive: isDead ? new THREE.Color(0x000000) : col,
    emissiveIntensity: 0.25,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.72;
  head.castShadow = true;
  g.add(head);

  if (isDead) {
    // Add a ghostly ring for dead fighters
    const ringGeo = new THREE.TorusGeometry(0.25, 0.04, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.72;
    g.add(ring);
  }

  return g;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ArenaMap = forwardRef<ArenaMapHandle, ArenaMapProps>(function ArenaMap(
  {
    seed: seedProp, biome: biomeProp = 'island', waterLevel = 0.32,
    gridSize = 12,
    roster = [], events = [], currentHour, selectedFighterId, onSelectFighter,
  },
  ref,
) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const rendRef     = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const camRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const ctrlRef     = useRef<OrbitControls | null>(null);
  const rafRef      = useRef<number>(0);
  const heightsRef  = useRef<Float32Array | null>(null);
  const pinsRef     = useRef<Map<number, THREE.Group>>(new Map());
  const terrainMRef = useRef<THREE.Mesh | null>(null);
  const builtRef    = useRef(false);

  const [seed, setSeed]   = useState(seedProp ?? Math.floor(Math.random() * 999999));
  const [biome, setBiome] = useState<Biome>(biomeProp);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; z: number } | null>(null);
  const [isBuilding, setIsBuilding]   = useState(false);

  useImperativeHandle(ref, () => ({
    getTerrainTypeAt(x: number, z: number): TerrainType {
      if (!heightsRef.current) return 'grass';
      const V  = SEGS + 1;
      const vx = Math.round((x / gridSize) * SEGS);
      const vz = Math.round((z / gridSize) * SEGS);
      const h  = heightsRef.current[Math.max(0, Math.min(SEGS, vz)) * V + Math.max(0, Math.min(SEGS, vx))];
      return sampleRamp(getRamp(biome, waterLevel), h).type;
    },
  }));

  // ── Update player pins whenever roster changes ─────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    const heights = heightsRef.current;
    if (!scene || !heights) return;

    const def = BIOMES[biome];
    const cellW = WORLD_SZ / gridSize;
    const seen  = new Set<number>();

    for (const { tf, fighter } of roster) {
      const id    = Number(fighter.id);
      const isDead = !tf.isAlive;
      const gx    = Number(tf.x), gz = Number(tf.y);
      seen.add(id);

      // World position — centre of grid cell
      const wx = (gx + 0.5) * cellW - WORLD_SZ / 2;
      const wz = (gz + 0.5) * cellW - WORLD_SZ / 2;
      const wy  = sampleHeight(heights, wx, wz, def.heightMult) + 0.02;

      const isSelected = selectedFighterId === id;
      const hexColor   = ARCHETYPE_HEX[fighter.archetype] ?? 0xd4af37;

      let pin = pinsRef.current.get(id);
      if (!pin) {
        pin = makePinMesh(hexColor, isDead);
        pinsRef.current.set(id, pin);
        scene.add(pin);
      }

      pin.position.set(wx, wy, wz);

      // Scale selected fighter up slightly
      const s = isSelected ? 1.35 : 1.0;
      pin.scale.set(s, s, s);

      // Dim dead fighters
      pin.traverse(obj => {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m?.isMeshStandardMaterial) m.opacity = isDead ? 0.45 : 1.0;
        if (m) m.transparent = isDead;
      });
    }

    // Remove pins for fighters no longer in roster
    for (const [id, pin] of pinsRef.current) {
      if (!seen.has(id)) {
        scene.remove(pin);
        pin.traverse(obj => {
          if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (m) Array.isArray(m) ? m.forEach(x => x.dispose()) : m.dispose();
        });
        pinsRef.current.delete(id);
      }
    }
  }, [roster, selectedFighterId, biome, gridSize, waterLevel]);

  // ── Build / rebuild full scene ─────────────────────────────────────────────
  const buildScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setIsBuilding(true);
    builtRef.current = false;

    // Dispose previous
    cancelAnimationFrame(rafRef.current);
    if (ctrlRef.current)  { ctrlRef.current.dispose(); ctrlRef.current = null; }
    if (rendRef.current)  { rendRef.current.dispose(); rendRef.current = null; }
    pinsRef.current.clear();
    if (sceneRef.current) {
      sceneRef.current.traverse(obj => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (mat) Array.isArray(mat) ? mat.forEach(m => m.dispose()) : mat.dispose();
      });
      sceneRef.current = null;
    }
    mount.innerHTML = '';

    const W   = mount.clientWidth || 800;
    const def = BIOMES[biome];

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, MAP_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    rendRef.current = renderer;

    // ── Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(def.skyBot);
    scene.fog = new THREE.FogExp2(def.fogColor, 0.018);
    sceneRef.current = scene;

    // ── Camera
    const camera = new THREE.PerspectiveCamera(52, W / MAP_H, 0.1, 600);
    camera.position.set(0, 20, 26);
    camera.lookAt(0, 0, 0);
    camRef.current = camera;

    // ── Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.07;
    controls.minDistance     = 6;
    controls.maxDistance     = 70;
    controls.maxPolarAngle   = Math.PI / 2.1;
    controls.update();
    ctrlRef.current = controls;

    // ── Heightmap
    const heights = buildHeightmap(seed, biome, waterLevel);
    heightsRef.current = heights;
    const ramp = getRamp(biome, waterLevel);
    const V = SEGS + 1;

    // ── Terrain geometry
    const geo = new THREE.PlaneGeometry(WORLD_SZ, WORLD_SZ, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);
    const pos    = geo.attributes.position as THREE.BufferAttribute;
    const colBuf = new Float32Array(pos.count * 3);

    for (let vy = 0; vy < V; vy++) {
      for (let vx = 0; vx < V; vx++) {
        const idx = vy * V + vx;
        const h   = heights[idx];
        pos.setY(idx, h * def.heightMult);
        const { color } = sampleRamp(ramp, h);
        colBuf[idx * 3]     = color.r;
        colBuf[idx * 3 + 1] = color.g;
        colBuf[idx * 3 + 2] = color.b;
      }
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colBuf, 3));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0.05,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    scene.add(terrain);
    terrainMRef.current = terrain;


    // ── Grid lines (12×12) traced on terrain surface
    {
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 });
      const cellSz  = WORLD_SZ / gridSize;

      for (let i = 0; i <= gridSize; i++) {
        const t = i / gridSize;
        const makeRow = (axis: 0 | 1) => {
          const pts: THREE.Vector3[] = [];
          for (let j = 0; j <= gridSize * 3; j++) {
            const tj = j / (gridSize * 3);
            const vxi = axis === 0 ? Math.round(t  * SEGS) : Math.round(tj * SEGS);
            const vzi = axis === 0 ? Math.round(tj * SEGS) : Math.round(t  * SEGS);
            const h   = heights[Math.min(SEGS, vzi) * V + Math.min(SEGS, vxi)] * def.heightMult + 0.14;
            const wx  = axis === 0 ? t * WORLD_SZ - WORLD_SZ / 2 : tj * WORLD_SZ - WORLD_SZ / 2;
            const wz  = axis === 0 ? tj * WORLD_SZ - WORLD_SZ / 2 : t * WORLD_SZ - WORLD_SZ / 2;
            pts.push(new THREE.Vector3(wx, h, wz));
          }
          return pts;
        };
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(makeRow(0)), lineMat));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(makeRow(1)), lineMat));
      }

      // Hover highlight quad
      const cellSzSc = cellSz * 0.94;
      const hlGeo = new THREE.PlaneGeometry(cellSzSc, cellSzSc);
      hlGeo.rotateX(-Math.PI / 2);
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0, depthWrite: false, depthTest: true });
      const hl = new THREE.Mesh(hlGeo, hlMat);
      hl.name = 'highlight';
      scene.add(hl);

      // Raycaster hover
      const ray = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const onMove = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObject(terrain);
        if (hits.length) {
          const p = hits[0].point;
          const cx = Math.floor((p.x + WORLD_SZ / 2) / cellSz);
          const cz = Math.floor((p.z + WORLD_SZ / 2) / cellSz);
          if (cx >= 0 && cx < gridSize && cz >= 0 && cz < gridSize) {
            setHoveredCell({ x: cx, z: cz });
            const wx = (cx + 0.5) * cellSz - WORLD_SZ / 2;
            const wz = (cz + 0.5) * cellSz - WORLD_SZ / 2;
            const hh  = sampleHeight(heights, wx, wz, def.heightMult) + 0.18;
            hl.position.set(wx, hh, wz);
            hlMat.opacity = 0.20;
            return;
          }
        }
        setHoveredCell(null);
        hlMat.opacity = 0;
      };
      renderer.domElement.addEventListener('mousemove', onMove);
    }

    // ── Lighting
    scene.add(new THREE.AmbientLight(0xffffff, biome === 'volcanic' ? 0.25 : 0.50));

    const sun = new THREE.DirectionalLight(def.sunColor, def.sunIntensity);
    sun.position.set(14, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near: 0.5, far: 90, left: -16, right: 16, top: 16, bottom: -16 });
    scene.add(sun);

    const fill = new THREE.DirectionalLight(
      biome === 'island' ? 0x80c0ff : 0x7090b0, 0.38,
    );
    fill.position.set(-10, 6, -14);
    scene.add(fill);

    scene.add(new THREE.HemisphereLight(
      new THREE.Color(def.skyTop),
      new THREE.Color(biome === 'volcanic' ? '#300' : '#1a3018'),
      0.45,
    ));

    // ── Resize
    const onResize = () => {
      const w = mount.clientWidth;
      renderer.setSize(w, MAP_H);
      camera.aspect = w / MAP_H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Render loop
    let frame = 0;
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      frame++;
      controls.update();
      // Subtle pin bob animation
      if (frame % 2 === 0) {
        for (const [, pin] of pinsRef.current) {
          pin.position.y += Math.sin(frame * 0.04 + pin.position.x) * 0.003;
        }
      }
      renderer.render(scene, camera);
    };
    tick();
    builtRef.current = true;
    setIsBuilding(false);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      controls.dispose();
      renderer.dispose();
      scene.traverse(obj => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const m = (obj as THREE.Mesh).material;
        if (m) Array.isArray(m) ? m.forEach(x => x.dispose()) : m.dispose();
      });
    };
  }, [seed, biome, waterLevel, gridSize]);

  useEffect(() => {
    const cleanup = buildScene();
    return cleanup;
  }, [buildScene]);

  const ticker = events.slice(0, 6);

  return (
    <div className="bg-[#060a12] border border-accent-crimson-end relative overflow-hidden select-none font-mono">

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
        <div className="flex items-center gap-3">
          {roster.filter(r => r.tf?.isAlive).length > 0 && (
            <span className="font-mono text-[10px] text-text-secondary">
              {roster.filter(r => r.tf?.isAlive).length} alive
            </span>
          )}
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 999999))}
            disabled={isBuilding}
            className="flex items-center gap-1.5 font-mono text-[10px] text-text-secondary hover:text-accent-gold border border-separator/40 hover:border-accent-gold/40 px-2.5 py-1.5 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${isBuilding ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
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
                {EVENT_ICONS[ev.eventType] ?? '•'}{' '}
                <span className="text-text-primary">{ev.description}</span>
              </span>
            ))}
          </motion.div>
        </div>
      )}

      {/* Three.js viewport */}
      <div className="relative" style={{ height: MAP_H }}>
        <div ref={mountRef} className="w-full h-full" />

        {/* Biome + seed overlay */}
        <div className="absolute top-3 left-4 pointer-events-none flex flex-col gap-1">
          <span className="bg-black/65 border border-white/12 px-2.5 py-1 text-[10px] text-accent-gold uppercase tracking-widest">
            {BIOMES[biome].label}
          </span>
          <span className="bg-black/50 px-2 py-0.5 text-[9px] text-text-secondary">
            seed {seed}
          </span>
        </div>

        {/* Biome switcher */}
        <div className="absolute top-3 right-4 pointer-events-auto flex gap-1.5">
          {(['island', 'highlands', 'plains', 'volcanic'] as Biome[]).map(b => (
            <button key={b} onClick={() => setBiome(b)}
              className={`font-mono text-[9px] uppercase px-2 py-1 border transition-colors ${
                biome === b
                  ? 'border-accent-gold text-accent-gold bg-accent-gold/10'
                  : 'border-white/15 text-white/35 hover:text-white/55 hover:border-white/30'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Fighter legend */}
        {roster.length > 0 && (
          <div className="absolute bottom-10 left-4 pointer-events-none flex flex-col gap-1 max-h-40 overflow-hidden">
            {roster.map(({ fighter, tf }) => (
              <div key={fighter.id} className="flex items-center gap-1.5 text-[9px]">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: `#${(ARCHETYPE_HEX[fighter.archetype] ?? 0xd4af37).toString(16).padStart(6, '0')}` }}
                />
                <span className={tf.isAlive ? 'text-white/70' : 'text-white/25 line-through'}>
                  {fighter.name?.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Hovered cell */}
        {hoveredCell && (
          <div className="absolute bottom-4 left-4 pointer-events-none bg-black/70 border border-white/10 px-3 py-1.5 text-[10px] text-text-secondary">
            Cell ({hoveredCell.x}, {hoveredCell.z})
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-3 right-4 pointer-events-none flex gap-3 text-[9px] text-white/22">
          <span>drag · rotate</span><span>scroll · zoom</span><span>right-drag · pan</span>
        </div>
      </div>
    </div>
  );
});
