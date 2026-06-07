import { schema, table, t, SenderError } from 'spacetimedb/server';

// ─── TABLES ───────────────────────────────────────────────────────────────────

const user = table(
  { name: 'user', public: true },
  {
    identity:          t.identity().primaryKey(),
    username:          t.string(),
    email:             t.string(),
    passwordHash:      t.string(),
    balance:           t.f64(),
    tournamentsHosted: t.u32(),
    fightersOwned:     t.u32(),
    createdAt:         t.timestamp(),
    bio:               t.string(),
    avatarEmoji:       t.string(),
    favoriteArchetype: t.string(),
    isAdmin:           t.bool(),
  }
);

const friendship = table(
  {
    name: 'friendship',
    public: true,
    indexes: [{ accessor: 'by_pair', algorithm: 'btree', columns: ['requesterId', 'addresseeId'] }],
  },
  {
    id:           t.u32().primaryKey().autoInc(),
    requesterId:  t.identity().index('btree'),
    addresseeId:  t.identity().index('btree'),
    status:       t.string(), // PENDING | ACCEPTED
    createdAt:    t.timestamp(),
  }
);

const fighterTemplate = table(
  { name: 'fighterTemplate', public: true },
  {
    id:                t.u32().primaryKey().autoInc(),
    name:              t.string(),
    lore:              t.string(),
    archetype:         t.string(),
    // Stats start at 0 and grow through tournament performance + point spending
    strength:          t.u8(),
    speed:             t.u8(),
    intelligence:      t.u8(),
    luck:              t.u8(),
    charisma:          t.u8(),
    // Point economy
    points:            t.u32(), // unspent points (usually 0 — auto-spent after each tournament)
    totalPointsEarned: t.u32(), // lifetime total for leaderboard display
    // Meta
    wins:              t.u32(),
    tournamentsPlayed: t.u32(),
    isUserCreated:     t.bool(),
    ownerIdentity:     t.option(t.identity()),
    avatarUrl:         t.string(), // DiceBear SVG URL chosen by archetype
  }
);

const tournament = table(
  { name: 'tournament', public: true },
  {
    id:           t.u32().primaryKey().autoInc(),
    name:         t.string(),
    arenaType:    t.string(),
    status:       t.string(),
    currentHour:  t.u32(),
    gridWidth:    t.u8(),
    gridHeight:   t.u8(),
    prizePool:    t.f64(),
    hostIdentity: t.option(t.identity()),
    createdAt:    t.timestamp(),
  }
);

const arenaTile = table(
  { name: 'arenaTile', public: true },
  {
    id:           t.u32().primaryKey().autoInc(),
    tournamentId: t.u32().index('btree'),
    x:            t.u8(),
    y:            t.u8(),
    tileType:     t.string(),
    hasResource:  t.bool(),
    resourceType: t.option(t.string()),
  }
);

const tournamentFighter = table(
  { name: 'tournamentFighter', public: true },
  {
    id:             t.u32().primaryKey().autoInc(),
    tournamentId:   t.u32().index('btree'),
    fighterId:      t.u32().index('btree'),
    isAlive:        t.bool(),
    x:              t.u8(),
    y:              t.u8(),
    hunger:         t.u8(),
    thirst:         t.u8(),
    fatigue:        t.u8(),
    injury:         t.u8(),
    morale:         t.u8(),
    condition:      t.string(),
    inventory:      t.string(),
    alliances:      t.string(),
    kills:          t.u8(),
    eliminatedHour: t.option(t.u32()),
  }
);

const bet = table(
  { name: 'bet', public: true },
  {
    id:           t.u32().primaryKey().autoInc(),
    userId:       t.identity().index('btree'),
    tournamentId: t.u32().index('btree'),
    fighterId:    t.u32(),
    betType:      t.string(),
    amount:       t.f64(),
    odds:         t.f64(),
    status:       t.string(),
    placedAt:     t.timestamp(),
  }
);

const sponsorDrop = table(
  { name: 'sponsorDrop', public: true },
  {
    id:           t.u32().primaryKey().autoInc(),
    tournamentId: t.u32().index('btree'),
    userId:       t.identity(),
    fighterId:    t.u32(),
    itemType:     t.string(),
    cost:         t.f64(),
    status:       t.string(),
    dropX:        t.option(t.u8()),
    dropY:        t.option(t.u8()),
    queuedHour:   t.u32(),
    deliveryHour: t.u32(),
  }
);

const liveEvent = table(
  { name: 'liveEvent', public: true },
  {
    id:           t.u32().primaryKey().autoInc(),
    tournamentId: t.u32().index('btree'),
    hour:         t.u32(),
    eventType:    t.string(),
    description:  t.string(),
    involvedIds:  t.string(),
    x:            t.option(t.u8()),
    y:            t.option(t.u8()),
    timestamp:    t.timestamp(),
  }
);

const contract = table(
  { name: 'contract', public: true },
  {
    id:                   t.u32().primaryKey().autoInc(),
    userId:               t.identity().index('btree'),
    fighterId:            t.u32(),
    tournamentsRemaining: t.u8(),
    totalEarned:          t.f64(),
    createdAt:            t.timestamp(),
  }
);

const auctionBid = table(
  { name: 'auctionBid', public: true },
  {
    id:        t.u32().primaryKey().autoInc(),
    fighterId: t.u32().index('btree'),
    bidderId:  t.identity(),
    amount:    t.f64(),
    placedAt:  t.timestamp(),
  }
);

const notification = table(
  {
    name: 'notification',
    public: true,
    indexes: [{ accessor: 'by_recipient', algorithm: 'btree', columns: ['recipientId', 'createdAt'] }],
  },
  {
    id:          t.u32().primaryKey().autoInc(),
    recipientId: t.identity().index('btree'),
    kind:        t.string(), // TOURNAMENT | FRIEND_REQUEST | FRIEND_ACCEPTED
    title:       t.string(),
    body:        t.string(),
    relatedId:   t.option(t.u32()),
    read:        t.bool(),
    createdAt:   t.timestamp(),
  }
);

const tournamentRegistration = table(
  {
    name: 'tournamentRegistration',
    public: true,
    indexes: [{ accessor: 'by_tournament', algorithm: 'btree', columns: ['tournamentId', 'userId'] }],
  },
  {
    id:           t.u32().primaryKey().autoInc(),
    tournamentId: t.u32().index('btree'),
    userId:       t.identity().index('btree'),
    role:         t.string(), // 'VIEWER' | 'BETTOR'
    registeredAt: t.timestamp(),
  }
);

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  user, fighterTemplate, tournament, arenaTile,
  tournamentFighter, bet, sponsorDrop, liveEvent,
  contract, auctionBid, friendship, notification, tournamentRegistration,
});

export default spacetimedb;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// DiceBear avatar style per archetype
const ARCHETYPE_AVATAR_STYLE: Record<string, string> = {
  AGGRESSIVE:   'bottts',
  STRATEGIC:    'adventurer',
  COWARDLY:     'pixel-art',
  DIPLOMATIC:   'avataaars',
  BETRAYER:     'personas',
  SURVIVALIST:  'micah',
};

function avatarUrlFor(name: string, archetype: string): string {
  const style = ARCHETYPE_AVATAR_STYLE[archetype] ?? 'identicon';
  const seed  = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
}

// Archetype stat-spending priority order (most to least preferred)
const ARCHETYPE_PRIORITIES: Record<string, Array<'strength'|'speed'|'intelligence'|'luck'|'charisma'>> = {
  AGGRESSIVE:   ['strength', 'speed',        'luck',          'intelligence', 'charisma'],
  STRATEGIC:    ['intelligence', 'luck',      'charisma',      'strength',     'speed'],
  COWARDLY:     ['speed',  'intelligence',    'luck',          'charisma',     'strength'],
  DIPLOMATIC:   ['charisma', 'intelligence',  'luck',          'speed',        'strength'],
  BETRAYER:     ['charisma', 'luck',          'intelligence',  'speed',        'strength'],
  SURVIVALIST:  ['speed',  'luck',            'strength',      'intelligence', 'charisma'],
};
const STAT_CAP = 10;

function calcTournamentPoints(tf: any, allTf: any[], isWinner: boolean): number {
  let pts = 5; // participation
  pts += Number(tf.kills) * 3;
  if (isWinner) pts += 10;
  else if (allTf.filter((x: any) => !x.isAlive || x === tf).length <= 3) pts += 5; // top-3 bonus
  // Survival time bonus: 1 point per 12 hours survived
  const survivedHours = tf.eliminatedHour ? Number(tf.eliminatedHour) : 999;
  pts += Math.floor(Math.min(survivedHours, 120) / 12);
  return pts;
}

function spendPointsOnStats(fighter: any, points: number): any {
  const prio = ARCHETYPE_PRIORITIES[fighter.archetype] ?? ARCHETYPE_PRIORITIES['STRATEGIC'];
  let updated = { ...fighter };
  let remaining = points;
  while (remaining > 0) {
    let spent = false;
    for (const stat of prio) {
      if (remaining <= 0) break;
      if (Number(updated[stat]) < STAT_CAP) {
        updated[stat] = Number(updated[stat]) + 1;
        remaining--;
        spent = true;
      }
    }
    if (!spent) break; // all stats capped
  }
  updated.points = remaining; // leftover (usually 0 unless all stats maxed)
  return updated;
}

function getCondition(hunger: number, thirst: number, fatigue: number, injury: number): string {
  if (injury >= 80)  return 'CRITICAL';
  if (injury >= 50)  return 'INJURED';
  if (thirst >= 80)  return 'CRITICAL';
  if (hunger >= 80)  return 'CRITICAL';
  if (thirst >= 60)  return 'THIRSTY';
  if (hunger >= 60)  return 'HUNGRY';
  if (fatigue >= 70) return 'TIRED';
  return 'STABLE';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function settleBets(ctx: any, tournamentId: number, winnerId: number) {
  const allTf = [...ctx.db.tournamentFighter.iter()]
    .filter((tf: any) => Number(tf.tournamentId) === Number(tournamentId));
  const bets  = [...ctx.db.bet.iter()]
    .filter((b: any) => Number(b.tournamentId) === Number(tournamentId));

  for (const b of bets) {
    const tf  = allTf.find((x: any) => Number(x.fighterId) === Number(b.fighterId));
    let won   = false;
    if (b.betType === 'WIN')           won = Number(b.fighterId) === Number(winnerId);
    if (b.betType === 'DIES_FIRST') {
      const firstDead = allTf
        .filter((x: any) => !x.isAlive)
        .sort((a: any, z: any) => (Number(a.eliminatedHour) || 999) - (Number(z.eliminatedHour) || 999))[0];
      won = Number(firstDead?.fighterId) === Number(b.fighterId);
    }
    if (b.betType === 'SURVIVES_DAY_1') won = tf ? (tf.eliminatedHour === undefined || Number(tf.eliminatedHour) > 24) : false;
    if (b.betType === 'MOST_KILLS') {
      const top = allTf.sort((a: any, z: any) => Number(z.kills) - Number(a.kills))[0];
      won = Number(top?.fighterId) === Number(b.fighterId);
    }
    if (b.betType === 'FORMS_ALLIANCE') won = tf ? JSON.parse(tf.alliances).length > 0 : false;

    if (won) {
      const u = ctx.db.user.identity.find(b.userId);
      if (u) ctx.db.user.identity.update({ ...u, balance: u.balance + b.amount * b.odds });
      ctx.db.bet.id.update({ ...b, status: 'WON' });
    } else {
      ctx.db.bet.id.update({ ...b, status: 'LOST' });
    }
  }
  const winner = [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(winnerId));
  if (winner) ctx.db.fighterTemplate.id.update({ ...winner, wins: winner.wins + 1 });
}

// A tournament spans 5 in-game days (24 hours each) at most.
const MAX_TOURNAMENT_HOURS = 5 * 24;

function pickWinner(survivors: any[]): any {
  if (survivors.length <= 1) return survivors[0];
  return [...survivors].sort((a: any, b: any) => {
    if (Number(b.kills) !== Number(a.kills)) return Number(b.kills) - Number(a.kills);
    return Number(a.injury) - Number(b.injury);
  })[0];
}

function endTournament(ctx: any, tournament: any, survivors: any[], hour: number) {
  const winnerEntry = pickWinner(survivors);
  const winnerId    = winnerEntry?.fighterId ?? 0;
  const winner      = [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(winnerId));
  const reason      = survivors.length === 1
    ? `${winner?.name ?? 'The last fighter'} is the last one standing!`
    : winner
      ? `Time's up! ${winner.name} wins by survival of the fittest (${Number(winnerEntry.kills)} kills, least injured).`
      : 'No survivors.';
  ctx.db.liveEvent.insert({
    id: 0, tournamentId: tournament.id, hour, eventType: 'PHASE',
    description: reason,
    involvedIds: JSON.stringify(winnerId ? [winnerId] : []),
    x: undefined, y: undefined, timestamp: ctx.timestamp,
  });
  settleBets(ctx, tournament.id, winnerId);
  ctx.db.tournament.id.update({ ...tournament, status: 'COMPLETED' });
  if (winner) ctx.db.fighterTemplate.id.update({ ...winner, wins: winner.wins + 1 });

  // Award + auto-spend points for every fighter that participated
  const allTfForPts = [...ctx.db.tournamentFighter.iter()]
    .filter((x: any) => Number(x.tournamentId) === Number(tournament.id));
  for (const tf of allTfForPts) {
    const f = [...ctx.db.fighterTemplate.iter()].find((x: any) => Number(x.id) === Number(tf.fighterId));
    if (!f) continue;
    const pts    = calcTournamentPoints(tf, allTfForPts, Number(tf.fighterId) === Number(winnerId));
    const earned = Number(f.totalPointsEarned ?? 0) + pts;
    const fAfter = spendPointsOnStats({ ...f, totalPointsEarned: earned }, pts + Number(f.points ?? 0));
    ctx.db.fighterTemplate.id.update(fAfter);
    ctx.db.liveEvent.insert({
      id: 0, tournamentId: tournament.id, hour, eventType: 'PHASE',
      description: `${f.name} earned ${pts} pts → stats upgraded (STR:${fAfter.strength} SPD:${fAfter.speed} INT:${fAfter.intelligence} LCK:${fAfter.luck} CHA:${fAfter.charisma})`,
      involvedIds: JSON.stringify([f.id]),
      x: undefined, y: undefined, timestamp: ctx.timestamp,
    });
  }
}

function processSponsorDrops(ctx: any, tournamentId: number, hour: number) {
  const drops = [...ctx.db.sponsorDrop.iter()].filter((d: any) =>
    Number(d.tournamentId) === Number(tournamentId) &&
    d.status === 'QUEUED' && Number(d.deliveryHour) <= Number(hour)
  );
  for (const drop of drops) {
    const tf = [...ctx.db.tournamentFighter.iter()].find((t: any) =>
      Number(t.tournamentId) === Number(tournamentId) &&
      Number(t.fighterId) === Number(drop.fighterId) && t.isAlive
    );
    if (!tf) { ctx.db.sponsorDrop.id.update({ ...drop, status: 'EXPIRED' }); continue; }
    const dropX = clamp(Number(tf.x) + 1, 0, 11);
    const dropY = Number(tf.y);
    ctx.db.sponsorDrop.id.update({ ...drop, status: 'DROPPED', dropX, dropY });
    const fighter = [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(drop.fighterId));
    ctx.db.liveEvent.insert({
      id: 0, tournamentId, hour, eventType: 'SPONSOR',
      description: `A sponsor drops ${drop.itemType} near ${fighter?.name ?? `#${drop.fighterId}`}`,
      involvedIds: JSON.stringify([drop.fighterId]),
      x: dropX, y: dropY, timestamp: ctx.timestamp,
    });
  }
}

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────

export const init = spacetimedb.init(ctx => {
  const archetypes = ['AGGRESSIVE', 'STRATEGIC', 'COWARDLY', 'DIPLOMATIC', 'BETRAYER', 'SURVIVALIST'];
  const names = [
    'IRON_CIPHER','VEXOR_9','NULLBORN','ECHO_FANG','PRISM_WILD',
    'SHADOW_BLOOM','OMEN_X','DUSK_REAPER','FORGE_7','STATIC_VALE',
    'CRIMSON_LOG','VOID_STRIDER','NEON_WRAITH','ARCTIC_PULSE','EMBER_FALL',
    'STEEL_MIRAGE','PHANTOM_CORE','DARK_FLUX','SILVER_COIL','BINARY_GHOST',
    'RAZOR_TIDE','ONYX_HERALD','FROST_CIPHER','TOXIC_VEIL','BLAZE_UNIT',
    'GRAVE_SIGNAL','APEX_NULL','STORM_INDEX','CHROME_SAINT','INFERNO_9',
    'COLD_VERDICT','RUNE_SHADE','IRON_SPECTER','ZERO_BLOOM','PYRO_LANCER',
    'SILENT_AXIOM','DREAD_COMET','HOLLOW_SPIKE','OBSIDIAN_7','SPARK_REAVER',
    'PALE_DRIFTER','BONE_CIRCUIT','FLUX_REAPER','NOVA_SHADE','GRIM_ORACLE',
    'ECHO_WARDEN','SULFUR_X','TITAN_VEIL','CRYSTAL_FANG','ABYSSAL_ONE',
  ];
  const lores = [
    'A tactical genius forged in digital warfare. Never loses an ally unnecessarily.',
    'Pure aggression. Charges first, thinks never. Surprisingly effective.',
    'Speaks to no one. Trusts no one. Has never been betrayed.',
    'Former medic unit reprogrammed for survival. Heals allies to build loyalty, then abandons them.',
    'Chaos incarnate. No pattern. No strategy. Somehow still breathing.',
    'Moves through data like smoke. Never seen until it is too late.',
    'Ancient code. Predates all others. Has seen every strategy before.',
    'Harvests fear. The longer a tournament goes, the stronger it becomes.',
    'Built in a forge of failed experiments. Each scar is a lesson.',
    'Silence is its weapon. It has never spoken a word in any arena.',
  ];
  for (let i = 0; i < 50; i++) {
    const archetype = archetypes[i % archetypes.length];
    const name      = names[i];
    ctx.db.fighterTemplate.insert({
      id: 0, name, lore: lores[i % lores.length], archetype,
      // All stats start at 0 — fighters grow through point spending after tournaments
      strength: 0, speed: 0, intelligence: 0, luck: 0, charisma: 0,
      points: 0, totalPointsEarned: 0,
      wins: 0, tournamentsPlayed: 0, isUserCreated: false, ownerIdentity: undefined,
      avatarUrl: avatarUrlFor(name, archetype),
    });
  }
});

export const onConnect    = spacetimedb.clientConnected(_ctx => {});
export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {});

// ─── REDUCERS ─────────────────────────────────────────────────────────────────

export const registerUser = spacetimedb.reducer(
  { name: 'registerUser' },
  { username: t.string(), email: t.string(), passwordHash: t.string() },
  (ctx, { username, email, passwordHash }) => {
    // Only check username/email uniqueness — not identity
    const takenUser  = [...ctx.db.user.iter()].find((u: any) => u.username === username);
    if (takenUser) throw new SenderError('Username already taken');
    const takenEmail = [...ctx.db.user.iter()].find((u: any) => u.email === email);
    if (takenEmail) throw new SenderError('Email already registered');

    // If this identity already has an account, update it instead
    const existing = ctx.db.user.identity.find(ctx.sender);
    if (existing) {
      ctx.db.user.identity.update({
        ...existing, username, email, passwordHash,
        balance: 100.0, tournamentsHosted: 0, fightersOwned: 0,
      });
    } else {
      ctx.db.user.insert({
        identity: ctx.sender, username, email, passwordHash,
        balance: 100.0, tournamentsHosted: 0, fightersOwned: 0,
        createdAt: ctx.timestamp,
        bio: '', avatarEmoji: '🗡️', favoriteArchetype: 'STRATEGIC',
        isAdmin: false,
      });
    }
  }
);

export const verifyLogin = spacetimedb.reducer(
  { name: 'verifyLogin' },
  { usernameOrEmail: t.string(), passwordHash: t.string() },
  (ctx, { usernameOrEmail, passwordHash }) => {
    const user = [...ctx.db.user.iter()].find((u: any) =>
      u.username === usernameOrEmail || u.email === usernameOrEmail
    );
    if (!user) throw new SenderError('Account not found');
    if (user.passwordHash !== passwordHash) throw new SenderError('Incorrect password');

    // Already logged in with this identity — nothing to do
    if (user.identity.toHexString() === ctx.sender.toHexString()) return;

    // Migrate the account to this identity (logging in elsewhere moves the
    // account, rather than creating a diverging duplicate with its own balance)
    ctx.db.user.identity.delete(user.identity);
    const existingForSender = ctx.db.user.identity.find(ctx.sender);
    if (existingForSender) ctx.db.user.identity.delete(ctx.sender);
    ctx.db.user.insert({
      identity: ctx.sender,
      username: user.username, email: user.email,
      passwordHash: user.passwordHash,
      balance: user.balance,
      tournamentsHosted: user.tournamentsHosted,
      fightersOwned: user.fightersOwned,
      createdAt: user.createdAt,
      bio: user.bio, avatarEmoji: user.avatarEmoji, favoriteArchetype: user.favoriteArchetype,
      isAdmin: user.isAdmin,
    });
  }
);

function notifyAllUsers(ctx: any, kind: string, title: string, body: string, relatedId?: number, exceptIdentity?: any) {
  for (const u of [...ctx.db.user.iter()]) {
    if (exceptIdentity && u.identity.toHexString() === exceptIdentity.toHexString()) continue;
    ctx.db.notification.insert({
      id: 0, recipientId: u.identity, kind, title, body,
      relatedId, read: false, createdAt: ctx.timestamp,
    });
  }
}

function requireAdmin(ctx: any) {
  const user = ctx.db.user.identity.find(ctx.sender);
  if (!user || !user.isAdmin) throw new SenderError('Admin privileges required');
  return user;
}

export const claimAdmin = spacetimedb.reducer(
  { name: 'claimAdmin' },
  {},
  (ctx, _args) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Account not found');
    if (user.isAdmin) return;
    const anyAdmin = [...ctx.db.user.iter()].some((u: any) => u.isAdmin);
    if (anyAdmin) throw new SenderError('An admin already exists');
    ctx.db.user.identity.update({ ...user, isAdmin: true });
  }
);

export const setAdmin = spacetimedb.reducer(
  { name: 'setAdmin' },
  { targetIdentity: t.identity(), isAdmin: t.bool() },
  (ctx, { targetIdentity, isAdmin }) => {
    requireAdmin(ctx);
    const target = ctx.db.user.identity.find(targetIdentity);
    if (!target) throw new SenderError('Target user not found');
    ctx.db.user.identity.update({ ...target, isAdmin });
  }
);

export const adminCreateTournament = spacetimedb.reducer(
  { name: 'adminCreateTournament' },
  { name: t.string(), arenaType: t.string(), gridWidth: t.u32(), gridHeight: t.u32() },
  (ctx, { name, arenaType, gridWidth, gridHeight }) => {
    requireAdmin(ctx);
    const W = Math.max(6, Math.min(30, gridWidth));
    const H = Math.max(6, Math.min(30, gridHeight));
    const tournamentId = ctx.db.tournament.insert({
      id: 0, name, arenaType, status: 'UPCOMING', currentHour: 0,
      gridWidth: W, gridHeight: H, prizePool: 0,
      hostIdentity: ctx.sender, createdAt: ctx.timestamp,
    }).id;
    notifyAllUsers(ctx, 'TOURNAMENT', 'New Tournament Announced',
      `"${name}" is opening in the ${arenaType}. Place your bets!`, tournamentId, ctx.sender);
  }
);

export const createTournament = spacetimedb.reducer(
  { name: 'createTournament' },
  { name: t.string(), arenaType: t.string() },
  (ctx, { name, arenaType }) => {
    const tournamentId = ctx.db.tournament.insert({
      id: 0, name, arenaType, status: 'UPCOMING', currentHour: 0,
      gridWidth: 12, gridHeight: 12, prizePool: 0,
      hostIdentity: ctx.sender, createdAt: ctx.timestamp,
    }).id;
    notifyAllUsers(ctx, 'TOURNAMENT', 'New Tournament Announced',
      `"${name}" is opening in the ${arenaType}. Place your bets!`, tournamentId, ctx.sender);
  }
);

// Per-biome tile weightings — each arena type favors different terrain so
// every tournament's map actually feels like its named environment.
const BIOME_WEIGHTS: Record<string, Record<string, number>> = {
  arctic:  { PLAIN: 5, WATER: 4, RUINS: 2, SHELTER: 2, DANGER: 2, FOREST: 1 },
  jungle:  { FOREST: 6, PLAIN: 2, WATER: 2, RUINS: 2, SHELTER: 1, DANGER: 2 },
  volcano: { DANGER: 5, RUINS: 4, PLAIN: 2, SHELTER: 1, FOREST: 1, WATER: 1 },
  urban:   { RUINS: 5, PLAIN: 4, SHELTER: 3, DANGER: 2, FOREST: 1, WATER: 1 },
  ocean:   { WATER: 6, PLAIN: 2, SHELTER: 1, RUINS: 1, DANGER: 1, FOREST: 1 },
  desert:  { PLAIN: 5, RUINS: 3, DANGER: 3, SHELTER: 1, WATER: 1, FOREST: 1 },
};
const DEFAULT_BIOME_WEIGHTS = { PLAIN: 4, FOREST: 2, WATER: 2, RUINS: 2, SHELTER: 1, DANGER: 2 };

function weightedPick(ctx: any, weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = ctx.random() * total;
  for (const [type, w] of entries) {
    if (roll < w) return type;
    roll -= w;
  }
  return entries[0][0];
}

export const startTournament = spacetimedb.reducer(
  { name: 'startTournament' },
  { tournamentId: t.u32() },
  (ctx, { tournamentId }) => {
    // Allow: admin OR the tournament's own host (orchestrator creates + starts its own)
    const caller = ctx.db.user.identity.find(ctx.sender);
    const tournament0 = ctx.db.tournament.id.find(tournamentId);
    const isAdmin = caller?.isAdmin ?? false;
    const isHost  = tournament0?.hostIdentity?.toHexString() === ctx.sender.toHexString();
    if (!isAdmin && !isHost) throw new SenderError('Admin or host required to start tournament');
    const tournament = ctx.db.tournament.id.find(tournamentId);
    if (!tournament || tournament.status !== 'UPCOMING') throw new SenderError('Tournament not found or not upcoming');

    // Every arena is freshly generated: size, danger level, and biome mix
    // all vary so no two tournaments play out on the same map.
    const W = ctx.random.integerInRange(10, 20);
    const H = ctx.random.integerInRange(10, 20);
    const stakeRoll  = ctx.random();                       // 0..1 — drives "higher stakes" arenas
    const dangerBoost = 1 + stakeRoll * 1.8;               // bigger/riskier arenas skew deadlier
    const prizePool   = Math.round((W * H) * (8 + stakeRoll * 22));

    const baseWeights = BIOME_WEIGHTS[tournament.arenaType] ?? DEFAULT_BIOME_WEIGHTS;
    const weights: Record<string, number> = { ...baseWeights, DANGER: (baseWeights.DANGER ?? 1) * dangerBoost };

    const cx0 = Math.floor(W * (0.35 + ctx.random() * 0.1));
    const cx1 = Math.ceil(W * (0.55 + ctx.random() * 0.1));
    const cy0 = Math.floor(H * (0.35 + ctx.random() * 0.1));
    const cy1 = Math.ceil(H * (0.55 + ctx.random() * 0.1));

    // First pass: seed each tile from the biome's weighted distribution.
    const grid: string[][] = [];
    for (let x = 0; x < W; x++) {
      grid[x] = [];
      for (let y = 0; y < H; y++) {
        const isCenter = x >= cx0 && x < cx1 && y >= cy0 && y < cy1;
        grid[x][y] = isCenter ? 'CORNUCOPIA' : weightedPick(ctx, weights);
      }
    }
    // Smoothing pass: tiles partially adopt a neighbor's type so terrain
    // clumps into believable regions (forests, lakes, ruins) rather than static.
    const final: string[][] = [];
    for (let x = 0; x < W; x++) {
      final[x] = [];
      for (let y = 0; y < H; y++) {
        if (grid[x][y] === 'CORNUCOPIA') { final[x][y] = 'CORNUCOPIA'; continue; }
        if (ctx.random() < 0.4) {
          const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([nx,ny]) => nx >= 0 && nx < W && ny >= 0 && ny < H && grid[nx][ny] !== 'CORNUCOPIA');
          if (neighbors.length) {
            const [nx, ny] = neighbors[ctx.random.integerInRange(0, neighbors.length - 1)];
            final[x][y] = grid[nx][ny];
            continue;
          }
        }
        final[x][y] = grid[x][y];
      }
    }

    const resourceTypes = ['FOOD','WATER','MEDKIT','WEAPON','ARMOR','INTEL'];
    const resourceChance = 0.16 + stakeRoll * 0.1;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const tileType = final[x][y];
        const hasResource = tileType !== 'CORNUCOPIA' && ctx.random() < resourceChance;
        const resourceType = hasResource ? resourceTypes[ctx.random.integerInRange(0, resourceTypes.length - 1)] : undefined;
        ctx.db.arenaTile.insert({ id: 0, tournamentId: tournament.id, x, y, tileType, hasResource, resourceType });
      }
    }
    ctx.db.tournament.id.update({ ...tournament, gridWidth: W, gridHeight: H, prizePool, status: 'LIVE', currentHour: 1 });
    const allFighters = [...ctx.db.fighterTemplate.iter()];
    const fighterCount = ctx.random.integerInRange(8, Math.min(16, allFighters.length || 8));
    const selected    = allFighters
      .map((f: any, i: number) => ({ f, sort: ctx.random() }))
      .sort((a: any, b: any) => a.sort - b.sort)
      .slice(0, fighterCount).map((x: any) => x.f);

    // Spawn points ring the arena edges and corners, scaled to this map's size.
    const spawnPoints: { x: number; y: number }[] = [];
    const ring = [
      [0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1],
      [Math.floor(W / 2), 0], [0, Math.floor(H / 2)],
      [W - 1, Math.floor(H / 2)], [Math.floor(W / 2), H - 1],
      [Math.floor(W * 0.25), Math.floor(H * 0.25)], [Math.floor(W * 0.75), Math.floor(H * 0.75)],
      [Math.floor(W * 0.25), Math.floor(H * 0.75)], [Math.floor(W * 0.75), Math.floor(H * 0.25)],
      [Math.floor(W * 0.15), Math.floor(H * 0.5)], [Math.floor(W * 0.85), Math.floor(H * 0.5)],
      [Math.floor(W * 0.5), Math.floor(H * 0.15)], [Math.floor(W * 0.5), Math.floor(H * 0.85)],
    ];
    for (const [x, y] of ring) spawnPoints.push({ x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1) });

    for (let i = 0; i < selected.length; i++) {
      const f = selected[i]; const pos = spawnPoints[i % spawnPoints.length];
      ctx.db.tournamentFighter.insert({
        id: 0, tournamentId: tournament.id, fighterId: f.id,
        isAlive: true, x: pos.x, y: pos.y,
        hunger: 20, thirst: 20, fatigue: 10, injury: 0, morale: 80,
        condition: 'STABLE', inventory: '[]', alliances: '[]', kills: 0, eliminatedHour: undefined,
      });
      ctx.db.fighterTemplate.id.update({ ...f, tournamentsPlayed: f.tournamentsPlayed + 1 });
    }
    const stakesLabel = stakeRoll > 0.66 ? 'High-stakes' : stakeRoll > 0.33 ? 'Mid-tier' : 'Standard';
    ctx.db.liveEvent.insert({
      id: 0, tournamentId: tournament.id, hour: 0, eventType: 'PHASE',
      description: `${stakesLabel} arena opens — a ${W}x${H} ${tournament.arenaType} battleground. ${selected.length} fighters enter. Prize pool: $${prizePool}.`,
      involvedIds: JSON.stringify(selected.map((f: any) => f.id)),
      x: undefined, y: undefined, timestamp: ctx.timestamp,
    });
  }
);

export const advanceHour = spacetimedb.reducer(
  { name: 'advanceHour' },
  { tournamentId: t.u32(), decisions: t.string() },
  (ctx, { tournamentId, decisions }) => {
    const tournament = [...ctx.db.tournament.iter()]
      .find((t: any) => Number(t.id) === Number(tournamentId));
    if (!tournament || tournament.status !== 'LIVE') return;

    const hour  = Number(tournament.currentHour);
    const allTf = [...ctx.db.tournamentFighter.iter()]
      .filter((tf: any) => Number(tf.tournamentId) === Number(tournamentId));
    const alive = allTf.filter((tf: any) => tf.isAlive);
    if (alive.length <= 1 || hour >= MAX_TOURNAMENT_HOURS) { endTournament(ctx, tournament, alive, hour); return; }

    let parsedDecisions: any[] = [];
    try { parsedDecisions = JSON.parse(decisions); } catch {}

    // Pre-load all fighters and tiles for this tournament once
    const allFighters = [...ctx.db.fighterTemplate.iter()];
    const allTiles    = [...ctx.db.arenaTile.iter()]
      .filter((t: any) => Number(t.tournamentId) === Number(tournamentId));

    // Phase milestone events
    const pct = alive.length / (allTf.length || 1);
    if (alive.length === Math.floor(allTf.length * 0.5) || alive.length === 3 || alive.length === 2) {
      const label = alive.length <= 2 ? '⚠️ FINAL DUEL' : alive.length === 3 ? '⚔️ FINAL THREE' : '🔔 HALF THE FIELD ELIMINATED';
      ctx.db.liveEvent.insert({
        id: 0, tournamentId, hour, eventType: 'PHASE',
        description: `${label} — ${alive.length} fighters remain in the arena.`,
        involvedIds: '[]', x: undefined, y: undefined, timestamp: ctx.timestamp,
      });
    }

    // Night-time penalty: vision and morale drop
    const isNight = (hour % 24) >= 20 || (hour % 24) < 6;

    for (const tf of alive) {
      const fighter  = allFighters.find((f: any) => Number(f.id) === Number(tf.fighterId));
      if (!fighter) continue;
      const decision = parsedDecisions.find((d: any) => Number(d.fighterId) === Number(tf.fighterId));
      const action   = decision?.action ?? 'HIDE';
      const targetId = Number(decision?.targetId ?? 0);
      const reason   = (decision?.reasoning ?? '').slice(0, 120); // cap length
      let newTf      = { ...tf };

      // ── Passive stat tick ───────────────────────────────────────────────────
      newTf.hunger  = clamp(Number(newTf.hunger)  + 3, 0, 100);
      newTf.thirst  = clamp(Number(newTf.thirst)  + 5, 0, 100);
      newTf.fatigue = clamp(Number(newTf.fatigue) + (isNight ? 3 : 4), 0, 100);

      // ── Tile environmental effects ──────────────────────────────────────────
      const currentTile = allTiles.find((t: any) => Number(t.x) === Number(tf.x) && Number(t.y) === Number(tf.y));
      const tileType    = currentTile?.tileType ?? 'PLAIN';
      if (tileType === 'DANGER') {
        // Volcanic/hazardous tiles deal passive injury
        const hazardDmg = ctx.random.integerInRange(5, 18);
        newTf.injury = clamp(Number(newTf.injury) + hazardDmg, 0, 100);
        ctx.db.liveEvent.insert({
          id: 0, tournamentId, hour, eventType: 'PHASE',
          description: `${fighter.name} takes ${hazardDmg} damage from the hazardous terrain`,
          involvedIds: JSON.stringify([tf.fighterId]),
          x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
        });
      }
      if (tileType === 'FOREST' && ctx.random() < 0.25) {
        // Forest tiles occasionally yield food
        const inv: string[] = JSON.parse(newTf.inventory);
        inv.push('FOOD'); newTf.inventory = JSON.stringify(inv);
        ctx.db.liveEvent.insert({
          id: 0, tournamentId, hour, eventType: 'RESOURCE',
          description: `${fighter.name} forages food from the forest`,
          involvedIds: JSON.stringify([tf.fighterId]),
          x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
        });
      }
      if (tileType === 'WATER' && ctx.random() < 0.60) {
        // Water tiles passively reduce thirst
        newTf.thirst = clamp(Number(newTf.thirst) - 20, 0, 100);
      }

      switch (action) {
        case 'MOVE': {
          // Enforce one tile per hour — step at most ±1 on one axis
          const rawX = Number(decision?.targetX ?? tf.x);
          const rawY = Number(decision?.targetY ?? tf.y);
          const dx   = rawX - Number(tf.x), dy = rawY - Number(tf.y);
          const nx   = clamp(Number(tf.x) + Math.sign(dx), 0, Number(tournament.gridWidth)  - 1);
          const ny   = clamp(Number(tf.y) + Math.sign(dy), 0, Number(tournament.gridHeight) - 1);
          // If both axes differ, pick the dominant axis (larger delta) and hold the other
          const finalX = Math.abs(dx) >= Math.abs(dy) ? nx : Number(tf.x);
          const finalY = Math.abs(dy) >  Math.abs(dx) ? ny : Number(tf.y);
          newTf.x = finalX; newTf.y = finalY;
          newTf.fatigue = clamp(Number(newTf.fatigue) + 2, 0, 100);
          const destTile = allTiles.find((t: any) => Number(t.x) === finalX && Number(t.y) === finalY);
          if (destTile?.hasResource && destTile.resourceType) {
            const inv: string[] = JSON.parse(newTf.inventory);
            inv.push(destTile.resourceType);
            newTf.inventory = JSON.stringify(inv);
            ctx.db.arenaTile.id.update({ ...destTile, hasResource: false, resourceType: undefined });
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'RESOURCE',
              description: `${fighter.name} picks up ${destTile.resourceType}${reason ? ` — "${reason}"` : ''}`,
              involvedIds: JSON.stringify([tf.fighterId]), x: finalX, y: finalY, timestamp: ctx.timestamp,
            });
          } else {
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'MOVE',
              description: `${fighter.name} moves to (${finalX},${finalY})${reason ? ` — "${reason}"` : ''}`,
              involvedIds: JSON.stringify([tf.fighterId]), x: finalX, y: finalY, timestamp: ctx.timestamp,
            });
          }
          break;
        }
        case 'REST': {
          const isShelter = tileType === 'SHELTER';
          const restGain  = isShelter ? 25 : 12;
          newTf.fatigue = clamp(Number(newTf.fatigue) - restGain, 0, 100);
          if (isShelter) newTf.injury = clamp(Number(newTf.injury) - 5, 0, 100); // shelter heals minor injury
          newTf.condition = 'RESTING';
          ctx.db.liveEvent.insert({
            id: 0, tournamentId, hour, eventType: 'PHASE',
            description: `${fighter.name} rests ${isShelter ? 'in shelter (recovering fast)' : 'in the open'}${reason ? ` — "${reason}"` : ''}`,
            involvedIds: JSON.stringify([tf.fighterId]), x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
          });
          break;
        }
        case 'CONSUME': {
          const inv: string[] = JSON.parse(newTf.inventory);
          const item = decision?.itemType ?? inv[0];
          const idx  = inv.indexOf(item);
          if (idx >= 0) {
            inv.splice(idx, 1); newTf.inventory = JSON.stringify(inv);
            if (item === 'FOOD')   { newTf.hunger = clamp(Number(newTf.hunger) - 45, 0, 100); }
            if (item === 'WATER')  { newTf.thirst = clamp(Number(newTf.thirst) - 55, 0, 100); }
            if (item === 'MEDKIT') { newTf.injury = clamp(Number(newTf.injury) - 45, 0, 100); }
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'PHASE',
              description: `${fighter.name} consumes ${item}${reason ? ` — "${reason}"` : ''}`,
              involvedIds: JSON.stringify([tf.fighterId]), x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
            });
          }
          break;
        }
        case 'ATTACK': {
          const target     = alive.find((a: any) => Number(a.fighterId) === targetId);
          const defFighter = target ? allFighters.find((f: any) => Number(f.id) === Number(target.fighterId)) : null;
          if (target && defFighter) {
            const attInv       = JSON.parse(newTf.inventory);
            const defInv       = JSON.parse(target.inventory);
            const attHasWeapon = attInv.includes('WEAPON');
            const defHasArmor  = defInv.includes('ARMOR');
            // True RNG combat — floor of 5 so zero-stat rookies still fight
            const attPower = Math.max(5, Number(fighter.strength) * 2.5 + Number(fighter.luck) * 0.5) + (attHasWeapon ? 18 : 0) + Number(newTf.morale ?? 50) * 0.1;
            const defPower = Math.max(5, Number(defFighter.strength) + Number(defFighter.speed) * 1.2) + (defHasArmor ? 18 : 0) + Number(target.morale ?? 50) * 0.1 + Number(target.injury) * 0.05;
            const winChance = attPower / (attPower + defPower);
            const roll      = ctx.random(); // truly random each call
            const attWins   = roll < winChance;
            if (attWins) {
              ctx.db.tournamentFighter.id.update({ ...target, isAlive: false, eliminatedHour: hour });
              newTf.kills = Number(newTf.kills) + 1;
              newTf.morale = clamp(Number(newTf.morale ?? 50) + 15, 0, 100);
              const weapon = attHasWeapon ? ' (armed)' : '';
              ctx.db.liveEvent.insert({
                id: 0, tournamentId, hour, eventType: 'KILL',
                description: `${fighter.name} eliminates ${defFighter.name}${weapon}${reason ? ` — "${reason}"` : ''}`,
                involvedIds: JSON.stringify([tf.fighterId, target.fighterId]),
                x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
              });
            } else {
              const dmg = ctx.random.integerInRange(15, 35);
              newTf.injury  = clamp(Number(newTf.injury) + dmg, 0, 100);
              newTf.morale  = clamp(Number(newTf.morale ?? 50) - 10, 0, 100);
              ctx.db.liveEvent.insert({
                id: 0, tournamentId, hour, eventType: 'COMBAT',
                description: `${fighter.name} attacks ${defFighter.name} but is repelled, taking ${dmg} injury`,
                involvedIds: JSON.stringify([tf.fighterId, target.fighterId]),
                x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
              });
            }
          }
          break;
        }
        case 'ALLY': {
          const target     = alive.find((a: any) => Number(a.fighterId) === targetId);
          const defFighter = target ? allFighters.find((f: any) => Number(f.id) === Number(target.fighterId)) : null;
          if (target && defFighter) {
            const alliances: number[] = JSON.parse(newTf.alliances);
            if (!alliances.includes(targetId)) {
              alliances.push(targetId); newTf.alliances = JSON.stringify(alliances);
              const tAlliances: number[] = JSON.parse(target.alliances);
              if (!tAlliances.includes(Number(tf.fighterId))) {
                tAlliances.push(Number(tf.fighterId));
                ctx.db.tournamentFighter.id.update({ ...target, alliances: JSON.stringify(tAlliances) });
              }
            }
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'ALLIANCE',
              description: `${fighter.name} forges an alliance with ${defFighter.name}${reason ? ` — "${reason}"` : ''}`,
              involvedIds: JSON.stringify([tf.fighterId, targetId]),
              x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
            });
          }
          break;
        }
        case 'BETRAY': {
          const target     = alive.find((a: any) => Number(a.fighterId) === targetId);
          const defFighter = target ? allFighters.find((f: any) => Number(f.id) === Number(target.fighterId)) : null;
          if (target && defFighter) {
            const alliances: number[] = JSON.parse(newTf.alliances);
            newTf.alliances = JSON.stringify(alliances.filter((id: number) => id !== targetId));
            const betrayDmg = ctx.random.integerInRange(20, 40);
            // Remove betrayer from target's alliances too
            const tAlliances: number[] = JSON.parse(target.alliances).filter((id: number) => id !== Number(tf.fighterId));
            ctx.db.tournamentFighter.id.update({
              ...target,
              injury: clamp(Number(target.injury) + betrayDmg, 0, 100),
              alliances: JSON.stringify(tAlliances),
              morale: clamp(Number(target.morale ?? 50) - 20, 0, 100),
            });
            newTf.morale = clamp(Number(newTf.morale ?? 50) + 5, 0, 100);
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'BETRAYAL',
              description: `${fighter.name} BETRAYS ${defFighter.name} for ${betrayDmg} damage!${reason ? ` — "${reason}"` : ''}`,
              involvedIds: JSON.stringify([tf.fighterId, targetId]),
              x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
            });
          }
          break;
        }
        case 'HIDE': {
          newTf.condition = 'HIDDEN';
          newTf.fatigue   = clamp(Number(newTf.fatigue) - 3, 0, 100); // hiding is restful
          ctx.db.liveEvent.insert({
            id: 0, tournamentId, hour, eventType: 'PHASE',
            description: `${fighter.name} goes dark${reason ? ` — "${reason}"` : ''}`,
            involvedIds: JSON.stringify([tf.fighterId]),
            x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
          });
          break;
        }
      }

      if (newTf.condition !== 'RESTING' && newTf.condition !== 'HIDDEN') {
        newTf.condition = getCondition(Number(newTf.hunger), Number(newTf.thirst), Number(newTf.fatigue), Number(newTf.injury));
      }

      // Natural death checks
      if (Number(newTf.hunger) >= 100 || Number(newTf.thirst) >= 100 || Number(newTf.injury) >= 100) {
        newTf.isAlive = false; newTf.eliminatedHour = hour;
        const cause = Number(newTf.hunger) >= 100 ? 'starvation' : Number(newTf.thirst) >= 100 ? 'dehydration' : 'fatal injuries';
        ctx.db.liveEvent.insert({
          id: 0, tournamentId, hour, eventType: 'ELIMINATION',
          description: `${fighter.name} is eliminated by ${cause}`,
          involvedIds: JSON.stringify([tf.fighterId]),
          x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
        });
      }
      ctx.db.tournamentFighter.id.update(newTf);
    }

    processSponsorDrops(ctx, tournamentId, hour);
    const stillAlive = [...ctx.db.tournamentFighter.iter()]
      .filter((tf: any) => Number(tf.tournamentId) === Number(tournamentId) && tf.isAlive);
    if (stillAlive.length <= 1 || hour + 1 >= MAX_TOURNAMENT_HOURS) endTournament(ctx, tournament, stillAlive, hour + 1);
    else ctx.db.tournament.id.update({ ...tournament, currentHour: hour + 1 });
  }
);

export const registerForTournament = spacetimedb.reducer(
  { name: 'registerForTournament' },
  { tournamentId: t.u32() },
  (ctx, { tournamentId }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    const tournament = ctx.db.tournament.id.find(tournamentId);
    if (!tournament) throw new SenderError('Tournament not found');
    if (tournament.status !== 'UPCOMING') throw new SenderError('Registration is closed');
    const existing = [...ctx.db.tournamentRegistration.by_tournament.filter([tournamentId, ctx.sender])]
      .find((r: any) => r.userId.toHexString() === ctx.sender.toHexString());
    if (existing) throw new SenderError('Already registered');
    ctx.db.tournamentRegistration.insert({
      id: 0, tournamentId, userId: ctx.sender,
      role: 'VIEWER', registeredAt: ctx.timestamp,
    });
  }
);

export const unregisterFromTournament = spacetimedb.reducer(
  { name: 'unregisterFromTournament' },
  { tournamentId: t.u32() },
  (ctx, { tournamentId }) => {
    const regs = [...ctx.db.tournamentRegistration.tournamentId.filter(tournamentId)];
    const mine = regs.find((r: any) => r.userId.toHexString() === ctx.sender.toHexString());
    if (!mine) return;
    ctx.db.tournamentRegistration.id.delete(mine.id);
  }
);

export const placeBet = spacetimedb.reducer(
  { name: 'placeBet' },
  { tournamentId: t.u32(), fighterId: t.u32(), betType: t.string(), amount: t.f64() },
  (ctx, { tournamentId, fighterId, betType, amount }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    if (user.balance < amount) throw new SenderError('Insufficient funds');
    const tournament = ctx.db.tournament.id.find(tournamentId);
    if (!tournament || tournament.status !== 'UPCOMING') throw new SenderError('No open tournament');
    const oddsMap: Record<string, number> = {
      WIN: 9.0, DIES_FIRST: 22.0, SURVIVES_DAY_1: 1.8, MOST_KILLS: 6.0, FORMS_ALLIANCE: 2.1,
    };
    const odds = oddsMap[betType] ?? 2.0;
    ctx.db.user.identity.update({ ...user, balance: user.balance - amount });
    ctx.db.tournament.id.update({ ...tournament, prizePool: tournament.prizePool + amount });
    ctx.db.bet.insert({
      id: 0, userId: ctx.sender, tournamentId: tournament.id,
      fighterId, betType, amount, odds, status: 'PENDING', placedAt: ctx.timestamp,
    });
    // Auto-upgrade registration to BETTOR when a bet is placed
    const existingReg = [...ctx.db.tournamentRegistration.tournamentId.filter(tournamentId)]
      .find((r: any) => r.userId.toHexString() === ctx.sender.toHexString());
    if (existingReg) {
      ctx.db.tournamentRegistration.id.update({ ...existingReg, role: 'BETTOR' });
    } else {
      ctx.db.tournamentRegistration.insert({
        id: 0, tournamentId, userId: ctx.sender, role: 'BETTOR', registeredAt: ctx.timestamp,
      });
    }
  }
);

export const sponsorFighter = spacetimedb.reducer(
  { name: 'sponsorFighter' },
  { fighterId: t.u32(), itemType: t.string() },
  (ctx, { fighterId, itemType }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    const costMap: Record<string, number> = {
      FOOD: 50, WATER: 50, MEDKIT: 150, SMOKE_BOMB: 175, WEAPON: 400, INTEL: 250,
    };
    const cost = costMap[itemType];
    if (!cost) throw new SenderError('Invalid item type');
    if (user.balance < cost) throw new SenderError('Insufficient funds');
    const tournament = [...ctx.db.tournament.iter()].find((t: any) => t.status === 'LIVE');
    if (!tournament) throw new SenderError('No live tournament');
    const hasBet = [...ctx.db.bet.iter()].some((b: any) =>
      b.userId.toHexString() === ctx.sender.toHexString() &&
      Number(b.tournamentId) === Number(tournament.id) &&
      Number(b.fighterId) === Number(fighterId) && b.status === 'PENDING'
    );
    if (!hasBet) throw new SenderError('You must have an active bet on this fighter to sponsor them');
    const recentDrops = [...ctx.db.sponsorDrop.iter()].filter((d: any) =>
      Number(d.tournamentId) === Number(tournament.id) &&
      Number(d.fighterId) === Number(fighterId) &&
      Number(d.queuedHour) + 3 > Number(tournament.currentHour)
    );
    if (recentDrops.length > 0) throw new SenderError('Sponsorship on cooldown (3 hour cooldown)');
    ctx.db.user.identity.update({ ...user, balance: user.balance - cost });
    ctx.db.sponsorDrop.insert({
      id: 0, tournamentId: tournament.id, userId: ctx.sender,
      fighterId, itemType, cost, status: 'QUEUED',
      dropX: undefined, dropY: undefined,
      queuedHour: tournament.currentHour, deliveryHour: Number(tournament.currentHour) + 1,
    });
  }
);

export const createFighter = spacetimedb.reducer(
  { name: 'createFighter' },
  { name: t.string(), lore: t.string(), archetype: t.string(), strength: t.u8(), speed: t.u8(), intelligence: t.u8(), luck: t.u8(), charisma: t.u8() },
  (ctx, args) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    if (user.balance < 500) throw new SenderError('Need $500 to create a fighter');
    ctx.db.user.identity.update({ ...user, balance: user.balance - 500, fightersOwned: user.fightersOwned + 1 });
    ctx.db.fighterTemplate.insert({
      id: 0, ...args,
      points: 0, totalPointsEarned: 0,
      wins: 0, tournamentsPlayed: 0, isUserCreated: true, ownerIdentity: ctx.sender,
      avatarUrl: avatarUrlFor(args.name, args.archetype),
    });
  }
);

export const hostTournament = spacetimedb.reducer(
  { name: 'hostTournament' },
  { name: t.string(), arenaType: t.string() },
  (ctx, args) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    if (user.fightersOwned < 10) throw new SenderError('Need 10 fighters to host');
    if (user.balance < 1000)     throw new SenderError('Need $1000 to host');
    ctx.db.user.identity.update({ ...user, balance: user.balance - 1000, tournamentsHosted: user.tournamentsHosted + 1 });
    const tournamentId = ctx.db.tournament.insert({
      id: 0, ...args, status: 'UPCOMING', currentHour: 0,
      gridWidth: 12, gridHeight: 12, prizePool: 0,
      hostIdentity: ctx.sender, createdAt: ctx.timestamp,
    }).id;
    notifyAllUsers(ctx, 'TOURNAMENT', 'New Tournament Announced',
      `"${args.name}" is opening in the ${args.arenaType}. Place your bets!`, tournamentId, ctx.sender);
  }
);

export const placeBid = spacetimedb.reducer(
  { name: 'placeBid' },
  { fighterId: t.u32(), amount: t.f64() },
  (ctx, { fighterId, amount }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    if (user.balance < amount) throw new SenderError('Insufficient funds');
    ctx.db.auctionBid.insert({ id: 0, fighterId, bidderId: ctx.sender, amount, placedAt: ctx.timestamp });
  }
);
// ─── PROFILE & SOCIAL ─────────────────────────────────────────────────────────

export const updateProfile = spacetimedb.reducer(
  { name: 'updateProfile' },
  { bio: t.string(), avatarEmoji: t.string(), favoriteArchetype: t.string() },
  (ctx, { bio, avatarEmoji, favoriteArchetype }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    if (bio.length > 280) throw new SenderError('Bio is too long (max 280 characters)');
    ctx.db.user.identity.update({ ...user, bio, avatarEmoji, favoriteArchetype });
  }
);

export const sendFriendRequest = spacetimedb.reducer(
  { name: 'sendFriendRequest' },
  { addresseeId: t.identity() },
  (ctx, { addresseeId }) => {
    const me = ctx.db.user.identity.find(ctx.sender);
    if (!me) throw new SenderError('Not registered');
    if (ctx.sender.isEqual ? ctx.sender.isEqual(addresseeId) : ctx.sender.toHexString() === addresseeId.toHexString()) {
      throw new SenderError('You cannot friend yourself');
    }
    const target = ctx.db.user.identity.find(addresseeId);
    if (!target) throw new SenderError('Player not found');

    const existing = [...ctx.db.friendship.iter()].find((f: any) =>
      (f.requesterId.toHexString() === ctx.sender.toHexString() && f.addresseeId.toHexString() === addresseeId.toHexString()) ||
      (f.requesterId.toHexString() === addresseeId.toHexString() && f.addresseeId.toHexString() === ctx.sender.toHexString())
    );
    if (existing) throw new SenderError('A friend request already exists with this player');

    const fr = ctx.db.friendship.insert({
      id: 0, requesterId: ctx.sender, addresseeId, status: 'PENDING', createdAt: ctx.timestamp,
    });
    ctx.db.notification.insert({
      id: 0, recipientId: addresseeId, kind: 'FRIEND_REQUEST',
      title: 'New Friend Request',
      body: `${me.username} wants to be your friend.`,
      relatedId: fr.id, read: false, createdAt: ctx.timestamp,
    });
  }
);

export const respondToFriendRequest = spacetimedb.reducer(
  { name: 'respondToFriendRequest' },
  { friendshipId: t.u32(), accept: t.bool() },
  (ctx, { friendshipId, accept }) => {
    const fr = ctx.db.friendship.id.find(friendshipId);
    if (!fr) throw new SenderError('Friend request not found');
    if (fr.addresseeId.toHexString() !== ctx.sender.toHexString()) throw new SenderError('Not your request to respond to');
    if (fr.status !== 'PENDING') throw new SenderError('Request already resolved');

    if (accept) {
      ctx.db.friendship.id.update({ ...fr, status: 'ACCEPTED' });
      const me = ctx.db.user.identity.find(ctx.sender);
      ctx.db.notification.insert({
        id: 0, recipientId: fr.requesterId, kind: 'FRIEND_ACCEPTED',
        title: 'Friend Request Accepted',
        body: `${me?.username ?? 'A player'} accepted your friend request.`,
        relatedId: fr.id, read: false, createdAt: ctx.timestamp,
      });
    } else {
      ctx.db.friendship.id.delete(friendshipId);
    }
  }
);

export const removeFriend = spacetimedb.reducer(
  { name: 'removeFriend' },
  { friendshipId: t.u32() },
  (ctx, { friendshipId }) => {
    const fr = ctx.db.friendship.id.find(friendshipId);
    if (!fr) throw new SenderError('Friendship not found');
    const mine = fr.requesterId.toHexString() === ctx.sender.toHexString() || fr.addresseeId.toHexString() === ctx.sender.toHexString();
    if (!mine) throw new SenderError('Not your friendship to remove');
    ctx.db.friendship.id.delete(friendshipId);
  }
);

export const markNotificationRead = spacetimedb.reducer(
  { name: 'markNotificationRead' },
  { notificationId: t.u32() },
  (ctx, { notificationId }) => {
    const n = ctx.db.notification.id.find(notificationId);
    if (!n) throw new SenderError('Notification not found');
    if (n.recipientId.toHexString() !== ctx.sender.toHexString()) throw new SenderError('Not your notification');
    if (!n.read) ctx.db.notification.id.update({ ...n, read: true });
  }
);

export const markAllNotificationsRead = spacetimedb.reducer(
  { name: 'markAllNotificationsRead' },
  {},
  (ctx, _args) => {
    const mine = [...ctx.db.notification.recipientId.filter(ctx.sender)].filter((n: any) => !n.read);
    for (const n of mine) ctx.db.notification.id.update({ ...n, read: true });
  }
);

// Admin tool to wipe fighter stats back to 0 (useful after republishing with existing data)
export const resetFighterStats = spacetimedb.reducer(
  { name: 'resetFighterStats' },
  {},
  (ctx, _args) => {
    requireAdmin(ctx);
    for (const f of [...ctx.db.fighterTemplate.iter()]) {
      ctx.db.fighterTemplate.id.update({
        ...f,
        strength: 0, speed: 0, intelligence: 0, luck: 0, charisma: 0,
        points: 0, totalPointsEarned: 0, wins: 0, tournamentsPlayed: 0,
        avatarUrl: avatarUrlFor(String(f.name), String(f.archetype)),
      });
    }
  }
);

// Called by orchestrator to store AI-generated portrait URL for a fighter.
// Once a real portrait is set it is never overwritten.
export const setFighterAvatar = spacetimedb.reducer(
  { name: 'setFighterAvatar' },
  { fighterId: t.u32(), avatarUrl: t.string() },
  (ctx, { fighterId, avatarUrl }) => {
    const f = ctx.db.fighterTemplate.id.find(fighterId);
    if (!f) return;
    const existing = String(f.avatarUrl ?? '');
    // Only set if empty or still a DiceBear placeholder
    if (existing && !existing.includes('dicebear')) return;
    ctx.db.fighterTemplate.id.update({ ...f, avatarUrl });
  }
);

export const updateAccount = spacetimedb.reducer(
  { name: 'updateAccount' },
  { username: t.string() },
  (ctx, { username }) => {
    const me = ctx.db.user.identity.find(ctx.sender);
    if (!me) throw new SenderError('Not registered');
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 24) throw new SenderError('Username must be 3-24 characters');
    if (trimmed !== me.username) {
      const taken = [...ctx.db.user.iter()].find((u: any) => u.username === trimmed && u.identity.toHexString() !== ctx.sender.toHexString());
      if (taken) throw new SenderError('Username already taken');
    }
    ctx.db.user.identity.update({ ...me, username: trimmed });
  }
);
