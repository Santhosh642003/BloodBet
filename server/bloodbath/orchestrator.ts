import Groq from 'groq-sdk';
import { DbConnection } from '../../src/spacetime';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SPACETIME_URI     = 'wss://maincloud.spacetimedb.com';
const DB_NAME           = 'bloodbet';
const HOUR_INTERVAL_MS  = 10_000;   // 10 s per in-game hour
const BETTING_WINDOW_MS = 30 * 60 * 1000; // 30 min betting window
const AI_CONCURRENCY    = 4;        // parallel Groq calls

const ARENA_TYPES = [
  'ARCTIC WASTELAND', 'JUNGLE LABYRINTH',
  'VOLCANIC PEAKS',   'URBAN RUINS',
  'DESERT COLOSSEUM',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: any) => Number(v ?? 0);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Run `tasks` with at most `limit` in-flight at once, preserving order. */
async function pooled<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results as T[];
}

function getUrgentNeed(tf: any): string | null {
  if (n(tf.thirst)  >= 65) return 'WATER';
  if (n(tf.hunger)  >= 65) return 'FOOD';
  if (n(tf.injury)  >= 55) return 'MEDKIT';
  if (n(tf.fatigue) >= 75) return 'REST';
  return null;
}

function getTileAt(allTiles: any[], x: number, y: number) {
  return allTiles.find(t => n(t.x) === x && n(t.y) === y);
}

/** Find the nearest tile with a given resource, returns null if none in range */
function nearestResource(allTiles: any[], fromX: number, fromY: number, resource: string, maxDist = 5): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const tile of allTiles) {
    if (!tile.hasResource || tile.resourceType !== resource) continue;
    const d = Math.abs(n(tile.x) - fromX) + Math.abs(n(tile.y) - fromY);
    if (d < bestDist && d <= maxDist) { bestDist = d; best = { x: n(tile.x), y: n(tile.y) }; }
  }
  return best;
}

/** One step toward target — returns adjacent cell or current if already there */
function stepToward(fx: number, fy: number, tx: number, ty: number): { x: number; y: number } {
  if (fx === tx && fy === ty) return { x: fx, y: fy };
  const dx = tx - fx, dy = ty - fy;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: fx + Math.sign(dx), y: fy };
  return { x: fx, y: fy + Math.sign(dy) };
}

function getPhase(aliveCount: number, totalCount: number): { label: string; instruction: string } {
  const pct = aliveCount / totalCount;
  if (pct > 0.75) return {
    label: 'EARLY GAME',
    instruction: 'Explore and gather resources. Avoid unnecessary fights. Consider forming alliances.',
  };
  if (pct > 0.40) return {
    label: 'MID GAME',
    instruction: 'Consolidate resources. Pressure weak opponents. Decide whether to honour alliances or betray.',
  };
  if (pct > 0.20) return {
    label: 'LATE GAME',
    instruction: 'The end is near. Alliances are liabilities. Strike decisively or defend your position.',
  };
  return {
    label: 'ENDGAME',
    instruction: 'FINAL SURVIVORS. Trust no one. Kill or be killed. This is your last stand.',
  };
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────

function buildPrompt(
  fighter: any, tf: any,
  visibleFighters: any[],
  nearbyResources: string[],
  nearbyTileTypes: string[],
  currentTileType: string,
  aliveCount: number,
  totalCount: number,
  hour: number,
): string {
  const archetypeGuide: Record<string, string> = {
    AGGRESSIVE:  'You live for combat. Rush enemies, claim kills, dominate through fear. Weakness is death.',
    STRATEGIC:   'You are patient. Gather intelligence, pick fights you can win, never waste resources.',
    COWARDLY:    'Survival above all. Hide, flee, let others die. Fight only when cornered.',
    DIPLOMATIC:  'Build alliances, share resources, create a network. Betray only as a last resort.',
    BETRAYER:    'Gain trust then destroy it at the perfect moment for maximum devastation.',
    SURVIVALIST: 'Resources keep you alive, not kills. Maintain supplies, avoid conflicts, outlast everyone.',
  };

  const allies: number[]    = JSON.parse(tf.alliances ?? '[]');
  const inventory: string[] = JSON.parse(tf.inventory  ?? '[]');
  const urgentNeed          = getUrgentNeed(tf);
  const phase               = getPhase(aliveCount, totalCount);
  const isNight             = hour % 24 >= 20 || hour % 24 < 6;

  const enemies = visibleFighters
    .filter(f => !allies.includes(n(f.fighterId)))
    .map(f => `${f.name}(id:${n(f.fighterId)} cond:${f.condition} inj:${n(f.injury)}% kills:${n(f.kills)})`);

  const alliesVisible = visibleFighters
    .filter(f => allies.includes(n(f.fighterId)))
    .map(f => `${f.name}(id:${n(f.fighterId)} cond:${f.condition})`);

  return `You are ${fighter.name}, a ${fighter.archetype} gladiator. ${n(fighter.wins) > 0 ? `${n(fighter.wins)} previous wins.` : 'First tournament.'}
STATS: STR:${n(fighter.strength)} SPD:${n(fighter.speed)} INT:${n(fighter.intelligence)} LCK:${n(fighter.luck)} CHA:${n(fighter.charisma)}

SITUATION — Hour ${hour} (${isNight ? '🌙 Night' : '☀️ Day'}) | ${phase.label} | ${aliveCount}/${totalCount} alive
  Standing on: ${currentTileType} terrain at (${n(tf.x)},${n(tf.y)})
  Hunger:${n(tf.hunger)}% Thirst:${n(tf.thirst)}% Fatigue:${n(tf.fatigue)}% Injury:${n(tf.injury)}%
  Inventory: [${inventory.join(', ') || 'empty'}]
  Kills: ${n(tf.kills)} | Active allies: ${allies.length}

NEARBY (within 2 tiles):
  Enemies: ${enemies.join(' | ') || 'none'}
  Allies:  ${alliesVisible.join(' | ') || 'none'}
  Resources: ${nearbyResources.join(', ') || 'none'}
  Terrain:   ${nearbyTileTypes.join(', ')}

DIRECTIVE: ${archetypeGuide[fighter.archetype] ?? 'Survive.'}
PHASE ORDER: ${phase.instruction}
${urgentNeed ? `⚠️ URGENT NEED: ${urgentNeed} — address this immediately!` : ''}

Respond with ONLY valid JSON, no markdown:
{"action":"MOVE"|"REST"|"CONSUME"|"ATTACK"|"ALLY"|"BETRAY"|"HIDE","targetId":null,"targetX":null,"targetY":null,"itemType":null,"reasoning":"I ... [first-person, 1 dramatic sentence]"}

Constraints:
- MOVE: targetX/Y must be ADJACENT to your current position (±1 in one direction only, not diagonal)
- ATTACK / ALLY / BETRAY: targetId must be a visible enemy/ally id listed above
- CONSUME: itemType must be in your Inventory
- If URGENT is REST and fatigue > 75: use REST
- If URGENT is WATER/FOOD/MEDKIT and you have it: use CONSUME`;
}

// ─── Get AI Decision ──────────────────────────────────────────────────────────

async function getDecision(
  fighter: any, tf: any,
  visibleFighters: any[],
  nearbyResources: string[],
  nearbyTileTypes: string[],
  currentTileType: string,
  allTiles: any[],
  aliveCount: number,
  totalCount: number,
  hour: number,
  gridW: number,
  gridH: number,
): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model:       'llama-3.3-70b-versatile',
        temperature: 0.75,
        max_tokens:  160,
        messages: [
          { role: 'system', content: 'You are a gladiator AI in a battle royale. Respond with ONLY valid JSON. No markdown, no explanation outside the JSON.' },
          { role: 'user',   content: buildPrompt(fighter, tf, visibleFighters, nearbyResources, nearbyTileTypes, currentTileType, aliveCount, totalCount, hour) },
        ],
      });

      const raw  = res.choices[0]?.message?.content ?? '{}';
      const json = raw.replace(/```json|```/g, '').trim();
      // Extract first JSON object if model adds extra text
      const match = json.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      return { fighterId: n(tf.fighterId), ...JSON.parse(match[0]) };
    } catch (err: any) {
      if (err?.status === 429) {
        const wait = (parseInt(err?.headers?.['retry-after'] ?? '6') + 1) * 1000;
        console.log(`  ⏳ Rate limit for ${fighter.name}, waiting ${wait / 1000}s…`);
        await sleep(wait);
      } else if (attempt < 2) {
        await sleep(800 * (attempt + 1));
      } else {
        console.error(`  ❌ AI failed for ${fighter.name}:`, err?.message ?? err);
      }
    }
  }

  // Smart fallback — heuristic instead of random
  return smartFallback(tf, visibleFighters, allTiles, gridW, gridH);
}

function smartFallback(tf: any, visibleFighters: any[], allTiles: any[], gridW: number, gridH: number): any {
  const base = { fighterId: n(tf.fighterId), targetId: null, targetX: null, targetY: null, itemType: null };
  const inv: string[]  = JSON.parse(tf.inventory ?? '[]');
  const urgent         = getUrgentNeed(tf);
  const allies: number[] = JSON.parse(tf.alliances ?? '[]');

  if (urgent === 'REST')                             return { ...base, action: 'REST',    reasoning: 'I must rest to survive.' };
  if (urgent && inv.includes(urgent))                return { ...base, action: 'CONSUME', itemType: urgent, reasoning: `I consume ${urgent} before it is too late.` };

  // Move toward closest urgently needed resource
  const resourceTarget = urgent ? nearestResource(allTiles, n(tf.x), n(tf.y), urgent) : null;
  if (resourceTarget) {
    const step = stepToward(n(tf.x), n(tf.y), resourceTarget.x, resourceTarget.y);
    return { ...base, action: 'MOVE', targetX: clamp(step.x, 0, gridW - 1), targetY: clamp(step.y, 0, gridH - 1), reasoning: `I head toward ${urgent} at (${resourceTarget.x},${resourceTarget.y}).` };
  }

  // No visible enemies near → explore
  return { ...base, action: 'HIDE', reasoning: 'I lay low and observe.' };
}

// ─── Validate Decision ────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function validateDecision(
  d: any,
  tf: any,
  visibleFighters: any[],
  inventory: string[],
  gridW: number,
  gridH: number,
): any {
  d = { ...d };

  // Social actions need a valid visible target
  if (['ATTACK', 'ALLY', 'BETRAY'].includes(d.action)) {
    const valid = visibleFighters.some(f => n(f.fighterId) === n(d.targetId));
    if (!valid) {
      // Try to auto-select first visible enemy for ATTACK
      if (d.action === 'ATTACK') {
        const allies: number[] = JSON.parse(tf.alliances ?? '[]');
        const enemy = visibleFighters.find(f => !allies.includes(n(f.fighterId)));
        if (enemy) { d.targetId = n(enemy.fighterId); }
        else { d.action = 'HIDE'; d.targetId = null; }
      } else {
        d.action = 'REST'; d.targetId = null;
      }
    }
  }

  // CONSUME: item must be in inventory
  if (d.action === 'CONSUME') {
    if (!d.itemType || !inventory.includes(d.itemType)) {
      const useful = ['WATER', 'FOOD', 'MEDKIT'].find(i => inventory.includes(i));
      if (useful) d.itemType = useful;
      else { d.action = 'HIDE'; d.itemType = null; }
    }
  }

  // MOVE: must be adjacent (±1 in one axis only) and in bounds
  if (d.action === 'MOVE') {
    if (d.targetX == null || d.targetY == null) {
      d.action = 'REST';
    } else {
      const tx = clamp(n(d.targetX), 0, gridW - 1);
      const ty = clamp(n(d.targetY), 0, gridH - 1);
      const dx = tx - n(tf.x), dy = ty - n(tf.y);
      // Enforce adjacency — AI sometimes teleports
      const adjX = clamp(n(tf.x) + Math.sign(dx), 0, gridW - 1);
      const adjY = clamp(n(tf.y) + Math.sign(dy), 0, gridH - 1);
      d.targetX = adjX; d.targetY = adjY;
    }
  }

  return d;
}

// ─── Run One Hour ─────────────────────────────────────────────────────────────

async function runHour(conn: DbConnection, tournamentId: number) {
  const tournament = [...conn.db.tournament.iter()].find(t => n(t.id) === tournamentId);
  if (!tournament || tournament.status !== 'LIVE') return;

  const hour    = n(tournament.currentHour);
  const gridW   = n(tournament.gridWidth)  || 12;
  const gridH   = n(tournament.gridHeight) || 12;
  const allTf   = [...conn.db.tournamentFighter.iter()].filter(tf => n(tf.tournamentId) === tournamentId);
  const alive   = allTf.filter(tf => tf.isAlive);
  const total   = allTf.length;
  const isNight = hour % 24 >= 20 || hour % 24 < 6;

  if (alive.length <= 1) {
    console.log(`[T${tournamentId}] Only ${alive.length} fighter(s) remaining — ending`);
    return;
  }

  const allTiles = [...conn.db.arenaTile.iter()].filter(t => n(t.tournamentId) === tournamentId);
  const allFighters = [...conn.db.fighterTemplate.iter()];
  const vision  = isNight ? 1 : 2;

  console.log(`\n[T${tournamentId}] Hour ${hour} (${isNight ? '🌙' : '☀️'}) — ${alive.length}/${total} alive`);

  // Announce phase milestones
  const phase = getPhase(alive.length, total);
  if ([Math.floor(total * 0.5), Math.floor(total * 0.25), 3].includes(alive.length)) {
    console.log(`  📢 ${phase.label} — ${phase.instruction}`);
  }

  // Build tasks for parallel AI execution
  const tasks = alive.map(tf => async () => {
    const fighter = allFighters.find(f => n(f.id) === n(tf.fighterId));
    if (!fighter) return null;

    const visibleTfs = alive.filter(other =>
      n(other.fighterId) !== n(tf.fighterId) &&
      Math.abs(n(other.x) - n(tf.x)) <= vision &&
      Math.abs(n(other.y) - n(tf.y)) <= vision
    );
    const visibleFighters = visibleTfs.map(vtf => ({
      ...vtf,
      name: allFighters.find(f => n(f.id) === n(vtf.fighterId))?.name ?? `#${n(vtf.fighterId)}`,
    }));

    const nearbyTiles = allTiles.filter(t =>
      Math.abs(n(t.x) - n(tf.x)) <= 2 && Math.abs(n(t.y) - n(tf.y)) <= 2
    );
    const nearbyResources = nearbyTiles
      .filter(t => t.hasResource && t.resourceType)
      .map(t => `${t.resourceType}@(${n(t.x)},${n(t.y)})`);
    const nearbyTileTypes = [...new Set(nearbyTiles.map(t => t.tileType as string))];
    const currentTile = getTileAt(allTiles, n(tf.x), n(tf.y));
    const currentTileType = currentTile?.tileType ?? 'PLAIN';

    let decision = await getDecision(
      fighter, tf, visibleFighters, nearbyResources, nearbyTileTypes,
      currentTileType, allTiles, alive.length, total, hour, gridW, gridH,
    );
    const inventory: string[] = JSON.parse(tf.inventory ?? '[]');
    decision = validateDecision(decision, tf, visibleFighters, inventory, gridW, gridH);

    // Console log with reasoning for entertainment
    const actionStr =
      decision.action === 'MOVE'    ? `MOVE→(${decision.targetX},${decision.targetY})` :
      decision.action === 'ATTACK'  ? `ATTACK→${visibleFighters.find(f => n(f.fighterId) === n(decision.targetId))?.name ?? decision.targetId}` :
      decision.action === 'ALLY'    ? `ALLY→${visibleFighters.find(f => n(f.fighterId) === n(decision.targetId))?.name ?? decision.targetId}` :
      decision.action === 'BETRAY'  ? `💀BETRAY→${visibleFighters.find(f => n(f.fighterId) === n(decision.targetId))?.name ?? decision.targetId}` :
      decision.action === 'CONSUME' ? `CONSUME ${decision.itemType}` :
      decision.action;
    console.log(`  [${fighter.name}] ${actionStr} — "${decision.reasoning ?? ''}"`);

    return decision;
  });

  const results = await pooled(tasks, AI_CONCURRENCY);
  const decisions = results.filter(Boolean);

  console.log(`  → Advancing hour with ${decisions.length} decisions…`);
  conn.reducers.advanceHour({ tournamentId, decisions: JSON.stringify(decisions) });
  console.log(`  ✓ Hour ${hour} complete`);
}

// ─── Avatar Generation ────────────────────────────────────────────────────────

const ARCHETYPE_PROMPT: Record<string, string> = {
  AGGRESSIVE:   'aggressive angry teenage boy, scarred face, battle worn, intense glare, survivor gear',
  STRATEGIC:    'calculating teenage girl, sharp eyes, tactical vest, calm and intelligent expression',
  COWARDLY:     'frightened teenage boy, wide scared eyes, dirty face, hiding behind hoodie, desperate',
  DIPLOMATIC:   'charismatic teenage girl, friendly smile, leader aura, post-apocalyptic clothing',
  BETRAYER:     'cunning smirking teenage boy, shifty eyes, sly expression, street smart, dangerous',
  SURVIVALIST:  'tough resourceful teenage girl, weathered face, survival gear, determined expression',
};

function pollinationsUrl(name: string, archetype: string): string {
  const base = ARCHETYPE_PROMPT[archetype] ?? 'teenage survivor, post-apocalyptic arena';
  const prompt = encodeURIComponent(
    `realistic portrait photo of ${base}, named ${name}, gritty arena background, cinematic lighting, photorealistic, detailed face, 4k`
  );
  // Use name as seed for deterministic output per fighter
  const seed = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&seed=${seed}&model=flux`;
}

async function generateAvatars(conn: DbConnection) {
  const fighters = [...conn.db.fighterTemplate.iter()];
  const needsAvatar = fighters.filter(f => {
    const url = String(f.avatarUrl ?? '');
    return !url || url.includes('dicebear') || url === '';
  });

  if (needsAvatar.length === 0) {
    console.log('🖼️  All fighters already have AI portraits');
    return;
  }

  console.log(`🎨 Generating AI portraits for ${needsAvatar.length} fighters (this takes ~30s each)…`);

  const tasks = needsAvatar.map(f => async () => {
    const url = pollinationsUrl(String(f.name), String(f.archetype));
    // Fetch the image to trigger generation and wait for it to be ready
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
        if (res.ok) {
          conn.reducers.setFighterAvatar({ fighterId: Number(f.id), avatarUrl: url });
          console.log(`  🖼️  ${f.name} → portrait ready`);
          return;
        }
        console.warn(`  ⚠️  ${f.name} got HTTP ${res.status}, retrying…`);
      } catch (e: any) {
        console.warn(`  ⚠️  ${f.name} fetch failed (attempt ${attempt + 1}): ${e?.message ?? e}`);
      }
      await sleep(3000);
    }
    console.error(`  ❌ Could not generate portrait for ${f.name} after 3 attempts`);
  });

  // Sequential to avoid hammering Pollinations
  await pooled(tasks, 1);
  console.log('✅ All portraits generated and cached');
}

// ─── Orchestration Loop ───────────────────────────────────────────────────────

function startLoop(conn: DbConnection) {
  console.log(`\n⏱️  ${HOUR_INTERVAL_MS / 1000}s per in-game hour | ${BETTING_WINDOW_MS / 1000}s betting window\n`);

  const bettingOpenedAt: Record<number, number> = {};

  setInterval(async () => {
    const all      = [...conn.db.tournament.iter()];
    const live     = all.filter(t => t.status === 'LIVE');
    const upcoming = all.filter(t => t.status === 'UPCOMING');

    // Advance all live tournaments in parallel
    if (live.length > 0) {
      await Promise.all(live.map(t => runHour(conn, n(t.id))));
      return;
    }

    // Handle upcoming tournaments
    if (upcoming.length > 0) {
      const t   = upcoming[0];
      const tid = n(t.id);

      if (!bettingOpenedAt[tid]) {
        bettingOpenedAt[tid] = Date.now();
        console.log(`🎰 BETTING OPEN — "${t.name}" | ${BETTING_WINDOW_MS / 1000}s remaining`);
        return;
      }

      const elapsed = Date.now() - bettingOpenedAt[tid];
      if (elapsed < BETTING_WINDOW_MS) {
        const rem = Math.ceil((BETTING_WINDOW_MS - elapsed) / 1000);
        console.log(`⏳ ${rem}s remaining to bet on "${t.name}"`);
        return;
      }

      console.log(`🏟️  Starting "${t.name}" (id:${tid})…`);
      delete bettingOpenedAt[tid];
      try {
        conn.reducers.startTournament({ tournamentId: tid });
      } catch (e: any) {
        console.error('  ❌ Failed to start tournament:', e?.message ?? e);
      }
      return;
    }

    // No tournaments at all — create one
    console.log('📣 No active tournaments — creating one…');
    const arena = ARENA_TYPES[Math.floor(Date.now() / 1000) % ARENA_TYPES.length];
    const num   = Date.now().toString().slice(-4);
    try {
      conn.reducers.createTournament({ name: `Tournament #${num}`, arenaType: arena });
    } catch (e: any) {
      console.error('  ❌ Failed to create tournament:', e?.message ?? e);
    }
  }, HOUR_INTERVAL_MS);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎮 BloodBets Orchestrator v3 — AI Arena Edition');

  DbConnection.builder()
    .withUri(SPACETIME_URI)
    .withDatabaseName(DB_NAME)
    .onConnect((ctx, identity, _token) => {
      console.log('✅ Connected as:', identity.toHexString());
      ctx.subscriptionBuilder()
        .onApplied(() => {
          const tCount = [...ctx.db.tournament.iter()].length;
          const fCount = [...ctx.db.fighterTemplate.iter()].length;
          console.log(`📡 Subscribed — Tournaments: ${tCount}, Fighters: ${fCount}`);
          const conn2 = ctx as unknown as DbConnection;
          generateAvatars(conn2).then(() => startLoop(conn2));
        })
        .subscribe([
          'SELECT * FROM tournament',
          'SELECT * FROM tournamentFighter',
          'SELECT * FROM fighterTemplate',
          'SELECT * FROM arenaTile',
          'SELECT * FROM liveEvent',
          'SELECT * FROM sponsorDrop',
        ]);
    })
    .onConnectError((_ctx, err) => { console.error('❌ Connection failed:', err); process.exit(1); })
    .onDisconnect(() => console.log('🔌 Disconnected'))
    .build();
}

main().catch(console.error);
