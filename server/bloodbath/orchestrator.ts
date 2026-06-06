import Groq from 'groq-sdk';
import { DbConnection } from '../../src/spacetime';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SPACETIME_URI     = process.env.SPACETIMEDB_HOST || 'wss://maincloud.spacetimedb.com';
const DB_NAME           = process.env.SPACETIMEDB_DB_NAME || 'bloodbet-dre-dev';
const HOUR_INTERVAL_MS  = 10000;
const BETTING_WINDOW_MS = 30 * 60 * 1000;

const ARENA_TYPES = [
  'ARCTIC WASTELAND', 'JUNGLE LABYRINTH',
  'VOLCANIC PEAKS',   'URBAN RUINS',
  'DESERT COLOSSEUM',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const n = (v: any) => Number(v ?? 0);

function getUrgentNeed(tf: any): string | null {
  if (n(tf.thirst) >= 60) return 'WATER';
  if (n(tf.hunger) >= 60) return 'FOOD';
  if (n(tf.injury) >= 50) return 'MEDKIT';
  if (n(tf.fatigue) >= 70) return 'REST';
  return null;
}

// ─── AI PROMPT ───────────────────────────────────────────────────────────────

function buildPrompt(fighter: any, tf: any, visibleFighters: any[], nearbyResources: string[], nearbyTileTypes: string[]): string {
  const archetypeGuide: Record<string, string> = {
    AGGRESSIVE:  'Prioritize attacking enemies. Rush weapon drops. Attack weak fighters on sight.',
    STRATEGIC:   'Think before acting. Secure resources, find shelter, fight only with advantage.',
    COWARDLY:    'Avoid all contact. Hide in forests, flee from enemies, act only when desperate.',
    DIPLOMATIC:  'Seek alliances. Trade resources. Only betray when cornered.',
    BETRAYER:    'Form alliances early then backstab when it benefits you most. Be patient.',
    SURVIVALIST: 'Focus on food, water, shelter. Avoid Cornucopia. Outlast, not outfight.',
  };

  const allies: number[]    = JSON.parse(tf.alliances ?? '[]');
  const inventory: string[] = JSON.parse(tf.inventory  ?? '[]');
  const urgentNeed          = getUrgentNeed(tf);

  const enemiesInSight = visibleFighters
    .filter(f => n(f.fighterId) !== n(tf.fighterId) && !allies.includes(n(f.fighterId)))
    .map(f => `${f.name}(id:${n(f.fighterId)},cond:${f.condition},x:${n(f.x)},y:${n(f.y)})`);

  const alliesInSight = visibleFighters
    .filter(f => allies.includes(n(f.fighterId)))
    .map(f => `${f.name}(id:${n(f.fighterId)})`);

  return `You are ${fighter.name}, archetype: ${fighter.archetype}.
GUIDE: ${archetypeGuide[fighter.archetype] ?? 'Survive at all costs.'}
POS:(${n(tf.x)},${n(tf.y)}) CONDITION:${tf.condition}
hunger:${n(tf.hunger)} thirst:${n(tf.thirst)} fatigue:${n(tf.fatigue)} injury:${n(tf.injury)}
INVENTORY:[${inventory.join(',')}] URGENT:${urgentNeed ?? 'none'}
NEARBY TILES:${nearbyTileTypes.join(',')||'plain'} RESOURCES:${nearbyResources.join(',')||'none'}
ENEMIES:${enemiesInSight.join(',')||'none'} ALLIES:${alliesInSight.join(',')||'none'}

Respond ONLY with JSON (no markdown):
{"action":"MOVE"|"REST"|"CONSUME"|"ATTACK"|"ALLY"|"BETRAY"|"HIDE","targetId":null_or_int,"targetX":null_or_int,"targetY":null_or_int,"itemType":null_or_string,"reasoning":"1 sentence"}

- MOVE: set targetX+targetY to adjacent destination
- ATTACK/ALLY/BETRAY: set targetId to a visible fighter id from ENEMIES or ALLIES
- CONSUME: set itemType to something in your INVENTORY
- If URGENT is REST → use REST action
- If URGENT is WATER/FOOD/MEDKIT and you have it → use CONSUME`;
}

// ─── GET DECISION ─────────────────────────────────────────────────────────────

async function getDecision(
  fighter: any, tf: any,
  visibleFighters: any[],
  nearbyResources: string[],
  nearbyTileTypes: string[]
): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model:       'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens:  120,
        messages: [
          { role: 'system', content: 'You are an AI gladiator. Respond with valid JSON only. No markdown.' },
          { role: 'user',   content: buildPrompt(fighter, tf, visibleFighters, nearbyResources, nearbyTileTypes) },
        ],
      });

      const raw     = res.choices[0]?.message?.content ?? '{}';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed  = JSON.parse(cleaned);

      return { fighterId: n(tf.fighterId), ...parsed };
    } catch (err: any) {
      if (err?.status === 429) {
        const wait = (parseInt(err?.headers?.['retry-after'] ?? '5') + 1) * 1000;
        console.log(`  ⏳ Rate limit for ${fighter.name}, waiting ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        console.error(`  ❌ Error for ${fighter.name}:`, err?.message ?? err);
        break;
      }
    }
  }

  // Smart fallback
  const urgentNeed          = getUrgentNeed(tf);
  const inventory: string[] = JSON.parse(tf.inventory ?? '[]');
  if (urgentNeed === 'REST') return { fighterId: n(tf.fighterId), action: 'REST',    targetId: null, targetX: null, targetY: null, itemType: null, reasoning: 'Fallback: rest' };
  if (urgentNeed && inventory.includes(urgentNeed)) return { fighterId: n(tf.fighterId), action: 'CONSUME', targetId: null, targetX: null, targetY: null, itemType: urgentNeed, reasoning: 'Fallback: consume' };
  return { fighterId: n(tf.fighterId), action: 'HIDE', targetId: null, targetX: null, targetY: null, itemType: null, reasoning: 'Fallback: hide' };
}

// ─── VALIDATE DECISION ────────────────────────────────────────────────────────

function validateDecision(decision: any, visibleFighters: any[], inventory: string[]): any {
  const d = { ...decision };

  // ATTACK/ALLY/BETRAY need a valid visible target
  if (['ATTACK', 'ALLY', 'BETRAY'].includes(d.action)) {
    const validTarget = visibleFighters.some(f => n(f.fighterId) === n(d.targetId));
    if (!validTarget) {
      d.action   = 'HIDE';
      d.targetId = null;
    }
  }

  // CONSUME needs a valid inventory item
  if (d.action === 'CONSUME') {
    if (!d.itemType || !inventory.includes(d.itemType)) {
      // Try to find something useful
      const useful = ['WATER', 'FOOD', 'MEDKIT'].find(i => inventory.includes(i));
      if (useful) d.itemType = useful;
      else { d.action = 'REST'; d.itemType = null; }
    }
  }

  // MOVE needs both coordinates
  if (d.action === 'MOVE') {
    if (d.targetX === null || d.targetX === undefined ||
        d.targetY === null || d.targetY === undefined) {
      d.action = 'REST';
    } else {
      // Clamp to grid
      d.targetX = Math.max(0, Math.min(11, n(d.targetX)));
      d.targetY = Math.max(0, Math.min(11, n(d.targetY)));
    }
  }

  return d;
}

// ─── RUN ONE HOUR ─────────────────────────────────────────────────────────────

async function runHour(conn: DbConnection, tournamentId: number) {
  const allTournaments = [...conn.db.tournament.iter()];
  const tournament     = allTournaments.find(t => n(t.id) === tournamentId);
  if (!tournament || tournament.status !== 'LIVE') return;

  const hour  = n(tournament.currentHour);
  const allTf = [...conn.db.tournamentFighter.iter()]
    .filter(tf => n(tf.tournamentId) === tournamentId);
  const alive = allTf.filter(tf => tf.isAlive);

  if (alive.length <= 1) {
    console.log(`[T${tournamentId}] Only 1 fighter — tournament ending`);
    return;
  }

  const isNight  = hour % 24 >= 20 || hour % 24 < 6;
  const vision   = isNight ? 1 : 2;
  const allTiles = [...conn.db.arenaTile.iter()]
    .filter(t => n(t.tournamentId) === tournamentId);

  console.log(`\n[T${tournamentId}] Hour ${hour} (${isNight ? '🌙' : '☀️'}) — ${alive.length} alive`);

  const decisions: any[] = [];

  for (const tf of alive) {
    const fighter = [...conn.db.fighterTemplate.iter()]
      .find(f => n(f.id) === n(tf.fighterId));
    if (!fighter) continue;

    // Visible fighters
    const visibleTfs = alive.filter(other =>
      n(other.fighterId) !== n(tf.fighterId) &&
      Math.abs(n(other.x) - n(tf.x)) <= vision &&
      Math.abs(n(other.y) - n(tf.y)) <= vision
    );
    const visibleFighters = visibleTfs.map(vtf => {
      const vf = [...conn.db.fighterTemplate.iter()].find(f => n(f.id) === n(vtf.fighterId));
      return { ...vtf, name: vf?.name ?? `#${n(vtf.fighterId)}` };
    });

    // Nearby tiles and resources
    const nearbyTileObjs = allTiles.filter(t =>
      Math.abs(n(t.x) - n(tf.x)) <= 2 &&
      Math.abs(n(t.y) - n(tf.y)) <= 2
    );
    const nearbyResources = nearbyTileObjs
      .filter(t => t.hasResource && t.resourceType)
      .map(t => `${t.resourceType}@(${n(t.x)},${n(t.y)})`);
    const nearbyTileTypes = [...new Set(nearbyTileObjs.map(t => t.tileType as string))];

    let decision = await getDecision(fighter, tf, visibleFighters, nearbyResources, nearbyTileTypes);
    const inventory: string[] = JSON.parse(tf.inventory ?? '[]');
    decision = validateDecision(decision, visibleFighters, inventory);

    const actionStr = decision.action === 'MOVE'
      ? `MOVE→(${decision.targetX},${decision.targetY})`
      : decision.action === 'ATTACK' || decision.action === 'ALLY' || decision.action === 'BETRAY'
      ? `${decision.action}→${visibleFighters.find(f => n(f.fighterId) === n(decision.targetId))?.name ?? decision.targetId}`
      : decision.action === 'CONSUME'
      ? `CONSUME ${decision.itemType}`
      : decision.action;

    console.log(`  [${fighter.name}] ${actionStr} | "${decision.reasoning ?? ''}"`);
    decisions.push(decision);

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`  → Sending ${decisions.length} decisions to advanceHour...`);
  conn.reducers.advanceHour({ tournamentId, decisions: JSON.stringify(decisions) });
  console.log(`  ✓ Hour ${hour} complete`);
}

// ─── ORCHESTRATION LOOP ───────────────────────────────────────────────────────

function startLoop(conn: DbConnection) {
  console.log(`\n⏱️  ${HOUR_INTERVAL_MS / 1000}s per in-game hour | ${BETTING_WINDOW_MS / 1000}s betting window\n`);

  const upcomingCreatedAt: Record<number, number> = {};

  setInterval(async () => {
    const all      = [...conn.db.tournament.iter()];
    const live     = all.filter(t => t.status === 'LIVE');
    const upcoming = all.filter(t => t.status === 'UPCOMING');

    if (live.length > 0) {
      for (const t of live) await runHour(conn, n(t.id));
      return;
    }

    if (upcoming.length > 0) {
      const t   = upcoming[0];
      const tid = n(t.id);

      if (!upcomingCreatedAt[tid]) {
        upcomingCreatedAt[tid] = Date.now();
        console.log(`🎰 BETTING OPEN — "${t.name}" starts in ${BETTING_WINDOW_MS / 1000}s`);
        return;
      }

      const remaining = BETTING_WINDOW_MS - (Date.now() - upcomingCreatedAt[tid]);
      if (remaining > 0) {
        console.log(`⏳ ${Math.round(remaining / 1000)}s remaining to bet on "${t.name}"`);
        return;
      }

      console.log(`🏟️  Starting "${t.name}"...`);
      delete upcomingCreatedAt[tid];
      conn.reducers.startTournament({});
      return;
    }

    console.log('📣 Creating next tournament...');
    const arena = ARENA_TYPES[Math.floor(Date.now() / 1000) % ARENA_TYPES.length];
    const num   = Date.now().toString().slice(-4);
    conn.reducers.createTournament({ name: `Tournament #${num}`, arenaType: arena });
  }, HOUR_INTERVAL_MS);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎮 BloodBets Orchestrator v2 — Grid Edition');

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
          startLoop(ctx as unknown as DbConnection);
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
    .onConnectError((_ctx, err) => { console.error('❌ Failed:', err); process.exit(1); })
    .onDisconnect(() => console.log('🔌 Disconnected'))
    .build();
}

main().catch(console.error);