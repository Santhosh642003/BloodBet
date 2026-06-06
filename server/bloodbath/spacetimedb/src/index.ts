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
    strength:          t.u8(),
    speed:             t.u8(),
    intelligence:      t.u8(),
    luck:              t.u8(),
    charisma:          t.u8(),
    wins:              t.u32(),
    tournamentsPlayed: t.u32(),
    isUserCreated:     t.bool(),
    ownerIdentity:     t.option(t.identity()),
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

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  user, fighterTemplate, tournament, arenaTile,
  tournamentFighter, bet, sponsorDrop, liveEvent,
  contract, auctionBid, friendship, notification,
});

export default spacetimedb;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
    ctx.db.fighterTemplate.insert({
      id: 0, name: names[i], lore: lores[i % lores.length],
      archetype: archetypes[i % archetypes.length],
      strength: (i * 7 % 4) + 1, speed: (i * 3 % 4) + 1,
      intelligence: (i * 11 % 4) + 1, luck: (i * 5 % 4) + 1, charisma: (i * 13 % 4) + 1,
      wins: 0, tournamentsPlayed: 0, isUserCreated: false, ownerIdentity: undefined,
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

export const startTournament = spacetimedb.reducer(
  { name: 'startTournament' },
  {},
  (ctx, _args) => {
    const tournament = [...ctx.db.tournament.iter()].find((t: any) => t.status === 'UPCOMING');
    if (!tournament) throw new SenderError('No upcoming tournament');
    const W = Number(tournament.gridWidth);
    const H = Number(tournament.gridHeight);
    const terrainTypes = ['PLAIN','PLAIN','PLAIN','FOREST','FOREST','WATER','RUINS','SHELTER','DANGER'];
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const isCenter   = x >= 4 && x <= 7 && y >= 4 && y <= 7;
        const tileType   = isCenter ? 'CORNUCOPIA' : terrainTypes[(x * 3 + y * 7) % terrainTypes.length];
        const hasResource = (x * 13 + y * 17) % 10 < 3;
        const resourceTypes = ['FOOD','WATER','MEDKIT','WEAPON','FOOD','WATER','FOOD','INTEL'];
        const resourceType  = hasResource ? resourceTypes[(x * 5 + y * 11) % resourceTypes.length] : undefined;
        ctx.db.arenaTile.insert({ id: 0, tournamentId: tournament.id, x, y, tileType, hasResource, resourceType });
      }
    }
    const allFighters = [...ctx.db.fighterTemplate.iter()];
    const selected    = allFighters
      .map((f: any, i: number) => ({ f, sort: (i * Number(tournament.id) * 31 + 7) % 1000 }))
      .sort((a: any, b: any) => a.sort - b.sort)
      .slice(0, 10).map((x: any) => x.f);
    const spawnPoints = [
      {x:0,y:0},{x:11,y:0},{x:0,y:11},{x:11,y:11},
      {x:5,y:0},{x:0,y:5},{x:11,y:5},{x:5,y:11},{x:2,y:2},{x:9,y:9},
    ];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i]; const pos = spawnPoints[i];
      ctx.db.tournamentFighter.insert({
        id: 0, tournamentId: tournament.id, fighterId: f.id,
        isAlive: true, x: pos.x, y: pos.y,
        hunger: 20, thirst: 20, fatigue: 10, injury: 0, morale: 80,
        condition: 'STABLE', inventory: '[]', alliances: '[]', kills: 0, eliminatedHour: undefined,
      });
      ctx.db.fighterTemplate.id.update({ ...f, tournamentsPlayed: f.tournamentsPlayed + 1 });
    }
    ctx.db.tournament.id.update({ ...tournament, status: 'LIVE', currentHour: 1 });
    ctx.db.liveEvent.insert({
      id: 0, tournamentId: tournament.id, hour: 0, eventType: 'PHASE',
      description: `The arena opens. ${selected.length} fighters enter the ${tournament.arenaType}.`,
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

    for (const tf of alive) {
      const fighter  = [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(tf.fighterId));
      if (!fighter) continue;
      const decision = parsedDecisions.find((d: any) => Number(d.fighterId) === Number(tf.fighterId));
      const action   = decision?.action ?? 'HIDE';
      const targetId = Number(decision?.targetId ?? 0);
      let newTf      = { ...tf };

      newTf.hunger  = clamp(Number(newTf.hunger)  + 3, 0, 100);
      newTf.thirst  = clamp(Number(newTf.thirst)  + 5, 0, 100);
      newTf.fatigue = clamp(Number(newTf.fatigue) + 4, 0, 100);

      switch (action) {
        case 'MOVE': {
          const nx = clamp(Number(decision?.targetX ?? tf.x), 0, Number(tournament.gridWidth) - 1);
          const ny = clamp(Number(decision?.targetY ?? tf.y), 0, Number(tournament.gridHeight) - 1);
          newTf.x = nx; newTf.y = ny;
          newTf.fatigue = clamp(Number(newTf.fatigue) + 2, 0, 100);
          const tile = [...ctx.db.arenaTile.iter()].find((t: any) =>
            Number(t.tournamentId) === Number(tournamentId) && Number(t.x) === nx && Number(t.y) === ny
          );
          if (tile?.hasResource && tile.resourceType) {
            const inv: string[] = JSON.parse(newTf.inventory);
            inv.push(tile.resourceType);
            newTf.inventory = JSON.stringify(inv);
            ctx.db.arenaTile.id.update({ ...tile, hasResource: false, resourceType: undefined });
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'RESOURCE',
              description: `${fighter.name} finds ${tile.resourceType} at (${nx},${ny})`,
              involvedIds: JSON.stringify([tf.fighterId]), x: nx, y: ny, timestamp: ctx.timestamp,
            });
          }
          ctx.db.liveEvent.insert({
            id: 0, tournamentId, hour, eventType: 'MOVE',
            description: `${fighter.name} moves to (${nx},${ny})`,
            involvedIds: JSON.stringify([tf.fighterId]), x: nx, y: ny, timestamp: ctx.timestamp,
          });
          break;
        }
        case 'REST': {
          const tile = [...ctx.db.arenaTile.iter()].find((t: any) =>
            Number(t.tournamentId) === Number(tournamentId) &&
            Number(t.x) === Number(tf.x) && Number(t.y) === Number(tf.y)
          );
          const isShelter = tile?.tileType === 'SHELTER';
          newTf.fatigue = clamp(Number(newTf.fatigue) - (isShelter ? 20 : 10), 0, 100);
          newTf.condition = 'RESTING';
          ctx.db.liveEvent.insert({
            id: 0, tournamentId, hour, eventType: 'PHASE',
            description: `${fighter.name} rests ${isShelter ? 'in shelter' : 'in the open'}`,
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
            if (item === 'FOOD')   newTf.hunger = clamp(Number(newTf.hunger) - 40, 0, 100);
            if (item === 'WATER')  newTf.thirst = clamp(Number(newTf.thirst) - 50, 0, 100);
            if (item === 'MEDKIT') newTf.injury = clamp(Number(newTf.injury) - 40, 0, 100);
          }
          break;
        }
        case 'ATTACK': {
          const target     = alive.find((a: any) => Number(a.fighterId) === targetId);
          const defFighter = target ? [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(target.fighterId)) : null;
          if (target && defFighter) {
            const attInv       = JSON.parse(newTf.inventory);
            const defInv       = JSON.parse(target.inventory);
            const attHasWeapon = attInv.includes('WEAPON');
            const defHasArmor  = defInv.includes('ARMOR');
            const attPower     = Number(fighter.strength) * 2 + (attHasWeapon ? 15 : 0);
            const defPower     = Number(defFighter.strength) + Number(defFighter.speed) + (defHasArmor ? 15 : 0);
            const roll         = (Number(fighter.id) * 7 + Number(defFighter.id) * 13 + hour * 3) % 100;
            const attWins      = roll < (attPower / (attPower + defPower) * 100);
            if (attWins) {
              ctx.db.tournamentFighter.id.update({ ...target, isAlive: false, eliminatedHour: hour });
              newTf.kills++;
              ctx.db.liveEvent.insert({
                id: 0, tournamentId, hour, eventType: 'COMBAT',
                description: `${fighter.name} eliminates ${defFighter.name}${attHasWeapon ? ' (armed)' : ''}`,
                involvedIds: JSON.stringify([tf.fighterId, target.fighterId]),
                x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
              });
            } else {
              newTf.injury = clamp(Number(newTf.injury) + 25, 0, 100);
              ctx.db.liveEvent.insert({
                id: 0, tournamentId, hour, eventType: 'COMBAT',
                description: `${fighter.name} attacks ${defFighter.name} but is repelled`,
                involvedIds: JSON.stringify([tf.fighterId, target.fighterId]),
                x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
              });
            }
          }
          break;
        }
        case 'ALLY': {
          const target     = alive.find((a: any) => Number(a.fighterId) === targetId);
          const defFighter = target ? [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(target.fighterId)) : null;
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
              description: `${fighter.name} forms alliance with ${defFighter.name}`,
              involvedIds: JSON.stringify([tf.fighterId, targetId]),
              x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
            });
          }
          break;
        }
        case 'BETRAY': {
          const target     = alive.find((a: any) => Number(a.fighterId) === targetId);
          const defFighter = target ? [...ctx.db.fighterTemplate.iter()].find((f: any) => Number(f.id) === Number(target.fighterId)) : null;
          if (target && defFighter) {
            const alliances: number[] = JSON.parse(newTf.alliances);
            newTf.alliances = JSON.stringify(alliances.filter((id: number) => id !== targetId));
            ctx.db.tournamentFighter.id.update({ ...target, injury: clamp(Number(target.injury) + 20, 0, 100) });
            ctx.db.liveEvent.insert({
              id: 0, tournamentId, hour, eventType: 'BETRAY',
              description: `${fighter.name} BETRAYS ${defFighter.name}!`,
              involvedIds: JSON.stringify([tf.fighterId, targetId]),
              x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
            });
          }
          break;
        }
        case 'HIDE': {
          newTf.condition = 'HIDDEN';
          ctx.db.liveEvent.insert({
            id: 0, tournamentId, hour, eventType: 'PHASE',
            description: `${fighter.name} conceals themselves`,
            involvedIds: JSON.stringify([tf.fighterId]),
            x: Number(tf.x), y: Number(tf.y), timestamp: ctx.timestamp,
          });
          break;
        }
      }

      if (newTf.condition !== 'RESTING' && newTf.condition !== 'HIDDEN') {
        newTf.condition = getCondition(Number(newTf.hunger), Number(newTf.thirst), Number(newTf.fatigue), Number(newTf.injury));
      }
      if (Number(newTf.hunger) >= 100 || Number(newTf.thirst) >= 100 || Number(newTf.injury) >= 100) {
        newTf.isAlive = false; newTf.eliminatedHour = hour;
        const cause = Number(newTf.hunger) >= 100 ? 'starvation' : Number(newTf.thirst) >= 100 ? 'dehydration' : 'injuries';
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

export const placeBet = spacetimedb.reducer(
  { name: 'placeBet' },
  { fighterId: t.u32(), betType: t.string(), amount: t.f64() },
  (ctx, { fighterId, betType, amount }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Not registered');
    if (user.balance < amount) throw new SenderError('Insufficient funds');
    const tournament = [...ctx.db.tournament.iter()].find((t: any) => t.status === 'UPCOMING');
    if (!tournament) throw new SenderError('No upcoming tournament');
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
    ctx.db.fighterTemplate.insert({ id: 0, ...args, wins: 0, tournamentsPlayed: 0, isUserCreated: true, ownerIdentity: ctx.sender });
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
