# BloodBets

A betting/management arena game: AI-driven gladiator tournaments simulated hour-by-hour
on a live grid, with users registering, building/owning fighters, betting on outcomes,
hosting tournaments, sponsoring fighters mid-fight, bidding on fighter contracts, and now
customizing a profile and adding friends.

The whole backend runs on **SpacetimeDB** (a database that *is* the server — game logic
lives in reducers executed inside the DB), the frontend is **React + Vite + Tailwind**,
and tournament fighters are driven turn-by-turn by an **LLM (Groq / Llama 3.1)** via a
standalone orchestrator script.

---

## 1. Architecture at a glance

```
┌────────────────────┐       WebSocket        ┌──────────────────────────┐
│   React Client     │ ─────────────────────▶ │      SpacetimeDB         │
│ (src/app/...)      │ ◀───── live tables ─── │ (server/bloodbath/       │
│  useDB() / hooks   │   subscriptions        │   spacetimedb/src/...)   │
└────────────────────┘                        └──────────────┬───────────┘
                                                              │ reducers
                                            ┌─────────────────┴──────────┐
                                            │   Orchestrator (Node/tsx)  │
                                            │ server/bloodbath/          │
                                            │   orchestrator.ts          │
                                            │  (Groq LLM decisions ->    │
                                            │   advanceHour reducer)     │
                                            └────────────────────────────┘
```

- **Tables** hold all persistent state (users, fighters, tournaments, bets, friendships, ...)
  and are replicated in real time to subscribed clients.
- **Reducers** are the only way to mutate tables — they run *inside* the database,
  atomically and deterministically (no randomness/timers/network inside them, except via
  `ctx.random()`/`ctx.timestamp`).
- The **orchestrator** is an external Node script that connects as a normal client,
  watches for `LIVE` tournaments, asks an LLM what each fighter should do each in-game
  hour, and submits the batch of decisions via the `advanceHour` reducer (which then
  resolves combat, movement, hunger/thirst/injury, alliances, etc., fully inside the DB).

---

## 2. Setting it all up from scratch

### Prerequisites
- Node.js 18+ and npm
- The [SpacetimeDB CLI](https://spacetimedb.com/install) (`spacetime`)
- A [Groq API key](https://console.groq.com) (free tier is fine) for the AI orchestrator

### Step 1 — Install dependencies
```bash
# Frontend (repo root)
npm install

# Backend / orchestrator
cd server/bloodbath
npm install
```

### Step 2 — Publish the SpacetimeDB module
This compiles `server/bloodbath/spacetimedb/src/index.ts` (the schema + reducers) and
uploads it as a live database called `bloodbet`.

```bash
cd server/bloodbath
spacetime login                     # one-time auth with SpacetimeDB Cloud
npm run spacetime:publish           # publishes to maincloud as "bloodbet"
# or, for local development:
spacetime start                     # in a separate terminal — runs a local instance
npm run spacetime:publish:local
```

> If you change any **table** definition (add/remove/rename a column, add a table),
> you must republish. If your changes alter existing row shapes you may need
> `spacetime publish bloodbet --delete-data always --yes` to wipe old, incompatible data.

### Step 3 — Generate TypeScript client bindings
Whenever the schema (tables/reducers) changes, regenerate the typed bindings the
frontend imports from `src/spacetime`:

```bash
cd server/bloodbath
npm run spacetime:generate
```
(check the `spacetime:generate` script's `--out-dir` against where `src/spacetime`
actually re-exports from — make sure they match before running the frontend)

### Step 4 — Run the AI orchestrator
This is what actually drives tournaments forward hour-by-hour (creates tournaments,
opens betting windows, asks the LLM for each fighter's action, and submits results).
Without it running, tournaments will sit in `UPCOMING`/`LIVE` forever with no progress.

```bash
cd server/bloodbath
echo "GROQ_API_KEY=your_key_here" > .env
npm run orchestrator
```

### Step 5 — Run the frontend
```bash
# from repo root
npm run dev
```
Open the printed local URL (typically `http://localhost:5173`), register an account,
and you're in.

### Production build
```bash
npm run build      # outputs to dist/
```

---

## 3. How a tournament works (rules)

- A tournament starts `UPCOMING` with a ~2 minute betting window, then goes `LIVE`.
- Each **in-game hour** (currently every **10 real-world seconds**, see
  `HOUR_INTERVAL_MS` in `orchestrator.ts`) every living fighter gets an LLM-generated
  decision (`MOVE`, `REST`, `CONSUME`, `ATTACK`, `ALLY`, `BETRAY`, `HIDE`), validated,
  and submitted in a batch to the `advanceHour` reducer.
- `advanceHour` resolves all of it deterministically inside the database: movement,
  combat odds (based on stats/weapons), hunger/thirst/fatigue/injury accrual,
  alliances/betrayals, sponsor drops, and elimination/condition updates.
- **End conditions** (whichever happens first):
  1. Only one fighter remains alive → that fighter wins ("last one standing").
  2. The tournament reaches `MAX_TOURNAMENT_HOURS` (5 in-game days = 120 hours) →
     the survivor with the most kills (ties broken by least injury) is declared the
     winner via `pickWinner()`, with a distinct "Time's up!" message.
- On end: bets are settled (`settleBets`), the winning fighter's `wins` is incremented,
  and the tournament is marked `COMPLETED`.

---

## 4. File-by-file guide

### Backend — `server/bloodbath/`

| File | What it does |
|---|---|
| `spacetimedb/src/index.ts` | **The entire game backend.** Defines every table (schema) and every reducer (game logic) that runs inside SpacetimeDB. This is the single source of truth for all persistent state and rules — tournaments, fighters, bets, users, profiles, friendships, contracts, auctions, arena tiles, live events, sponsor drops. Key pieces: `endTournament`/`pickWinner` (deciding & paying out a winner), `advanceHour` (the big per-hour simulation step), `settleBets`, `processSponsorDrops`, condition/need helpers, and the `init` lifecycle hook that seeds 50 starter fighters. |
| `orchestrator.ts` | A standalone Node script (run with `npm run orchestrator`) that connects to the live database as a client, drives the game loop: creates new tournaments, manages betting windows, and — every `HOUR_INTERVAL_MS` — asks Groq's `llama-3.1-8b-instant` for each living fighter's next action (`buildPrompt`/`getDecision`), sanity-checks the AI's response (`validateDecision`), and submits the batch via `advanceHour`. Without this running, nothing in a tournament progresses. |
| `CLAUDE.md` | Reference notes on SpacetimeDB concepts, CLI usage, and the TypeScript SDK — useful background reading before touching `index.ts`. |
| `package.json` | Scripts for publishing the module, generating client bindings, and running the orchestrator. |

### Frontend — `src/`

#### Connection layer
| File | What it does |
|---|---|
| `spacetime/` | **Generated** SpacetimeDB TypeScript client bindings (tables, reducers, types) — produced by `spacetime generate`. Don't hand-edit; regenerate after schema changes. |
| `app/hooks/useSpacetime.ts` | The core data hook: opens the WebSocket connection to SpacetimeDB, subscribes to every table, normalizes rows (BigInt → Number), keeps reactive React state for each table, and exposes typed wrapper functions for every reducer (`register`, `verifyLogin`, `placeBet`, `sponsorFighter`, `createTournament`, `createFighter`, `hostTournament`, `placeBid`, `updateProfile`, `sendFriendRequest`, `respondToFriendRequest`, `removeFriend`, `logout`, ...). |
| `app/context/SpacetimeContext.tsx` | Thin React context wrapper around `useSpacetime()` — exposes `useDB()` so any component can read live tables/state and call reducers without prop drilling. |

#### Pages — `app/pages/`
| File | What it does |
|---|---|
| `LandingPage.tsx` | Public marketing/splash page shown before login. |
| `LoginPage.tsx` | Register / log in (hashes passwords client-side with `crypto.subtle` SHA-256, calls `register`/`verifyLogin`). |
| `DashboardPage.tsx` | Logged-in home — overview of your stats, fighters, balance, etc. |
| `TournamentPage.tsx` | View a `LIVE`/`UPCOMING` tournament: countdown timer, roster (with dead fighters grayed out), live event feed, betting UI, and the 2.5D `ArenaMap`. |
| `FightersPage.tsx` | Browse all fighter templates (the 50 seeded gladiators plus user-created ones). |
| `BuildFighterPage.tsx` | Form to create your own custom fighter (costs in-game currency). |
| `HostTournamentPage.tsx` | Form to host a new tournament (requires owning enough fighters + balance). |
| `ContractsPage.tsx` | View/manage fighter contracts and the contract auction (placing bids via `placeBid`). |
| `LeaderboardPage.tsx` | Tabs ranking top game masters (by tournaments hosted), top bettors (by winnings/ROI), and top fighters (by wins). |
| `ProfilePage.tsx` | **New.** Customize your profile (avatar emoji, favorite archetype, bio) via `updateProfile`; view career stats; manage incoming/outgoing friend requests and your friends list (`respondToFriendRequest`, `removeFriend`). |
| `PlayersPage.tsx` | **New.** Search/browse all registered players by username, see their stats/bio, and send friend requests (`sendFriendRequest`) — with live status (pending/friends/etc.) shown per player. |

#### Components — `app/components/`
| File | What it does |
|---|---|
| `NavBar.tsx` | Top navigation bar — links (incl. the new Players page), live connection indicator, balance display, avatar (now opens your `/profile`), logout. |
| `ArenaMap.tsx` | The 2.5D isometric "live telecast" view of a tournament: CSS-based diamond tiles, terrain/resource icons, animated fighter markers with hover tooltips, scrolling event ticker, and animated event "burst" icons — all driven by live `arenaTile`/`tournamentFighter`/`liveEvent` table data. |
| `CharacterCard.tsx` | Reusable fighter card showing stats/archetype/condition; supports a "dead/grayed out" display state. |
| `StatBar.tsx` | Small visual bar for a single stat (strength, speed, etc). |
| `Button.tsx` / `Input.tsx` | Styled form primitives used throughout the app. |
| `ui/` | Generated shadcn/ui component library (dialog, tabs, card, badge, avatar, etc.) used as building blocks. |

#### Other
| File | What it does |
|---|---|
| `app/App.tsx` | Top-level router (`react-router`) — maps every URL path to its page component. Add new routes here. |

---

## 5. Adding a new feature (checklist)

Following the existing pattern (see `server/bloodbath/CLAUDE.md` for SpacetimeDB specifics):

1. **Backend — schema**: add/modify a `table(...)` in `spacetimedb/src/index.ts` and
   include it in the `schema({...})` call.
2. **Backend — logic**: add a `spacetimedb.reducer({ name: '...' }, { ...args }, (ctx, args) => {...})`
   that mutates tables. Remember: reducers must be deterministic (`ctx.timestamp`/`ctx.random()`
   only — no `Date.now()`/`Math.random()`/network/filesystem).
3. **Republish**: `npm run spacetime:publish` (or `:local`) from `server/bloodbath`.
4. **Regenerate bindings**: `npm run spacetime:generate` so the client picks up new
   tables/reducers in `src/spacetime`.
5. **Client — subscribe & wrap**: in `useSpacetime.ts`, add the new table to the
   `subscribe([...])` list, seed/normalize its initial state, register `onInsert`/
   `onUpdate`/`onDelete` callbacks, and add a `useCallback` wrapper for each new reducer
   using the **named-object-argument** form: `conn.reducers.myReducer({ field1, field2 })`
   (positional args silently fail with a "fatal error" — this bit us once already).
6. **Client — UI**: read the new state via `useDB()` and build/extend a page or component;
   register new routes in `App.tsx` and nav links in `NavBar.tsx` if needed.

---

## 6. The new "Profile & Friends" feature

- **Tables** (`server/bloodbath/spacetimedb/src/index.ts`):
  - `user` gained `bio`, `avatarEmoji`, `favoriteArchetype` columns.
  - New `friendship` table: `requesterId`/`addresseeId` (Identity, indexed),
    `status` (`PENDING` | `ACCEPTED`), `createdAt`.
- **Reducers**: `updateProfile`, `sendFriendRequest`, `respondToFriendRequest`, `removeFriend`.
- **Client**: `useSpacetime.ts` subscribes to `friendship` and exposes wrapper functions
  for all four reducers; player search is done **entirely client-side** by filtering the
  already-subscribed `users` table by username (no dedicated search reducer needed).
- **UI**: `/profile` (edit your avatar/bio/favorite archetype, manage friend requests
  and your friends list) and `/players` (search players, view their stats/bio, send
  friend requests with live pending/accepted status).

> ⚠️ Because this adds new tables/columns/reducers, you **must** republish the module
> and regenerate bindings (`npm run spacetime:publish` then `npm run spacetime:generate`
> from `server/bloodbath`) before the new Profile/Players pages will work — the
> currently-generated `src/spacetime` bindings don't yet know about `friendship`,
> `updateProfile`, etc.

---

## 7. Known gotchas

- **Reducer calls must use named-object arguments**, e.g.
  `conn.reducers.registerUser({ username, email, passwordHash })`, never positional args —
  the SDK serializes by reading `value.<fieldName>`, so passing the wrong shape throws
  synchronously ("fatal error") instead of a useful message.
- Tournaments don't progress unless the **orchestrator** (`npm run orchestrator`) is
  running — it's the only thing that calls `advanceHour`.
- If you change table shapes, old replicated data can become incompatible — republish
  with `--delete-data always --yes` if you hit schema-conflict errors.
