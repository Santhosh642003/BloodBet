# BloodBets 🩸

> *"Bet on survival. Own the arena."*

A real-time Hunger Games-style AI betting platform. 50 AI gladiators fight in a 12×12 grid arena. Users bet on fighters, sponsor them mid-tournament, and compete to become the Game Master.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend/DB | SpacetimeDB (TypeScript module) |
| AI Engine | Groq API (llama-3.1-8b-instant) |
| Package Manager | pnpm |

---

## Prerequisites

Install these before starting:

- [Node.js 22+](https://nodejs.org) — must be v22, not v20
- [pnpm](https://pnpm.io) — `npm install -g pnpm`
- [SpacetimeDB CLI](https://spacetimedb.com/install) — `curl -sSf https://install.spacetimedb.com | sh`
- [Groq API key](https://console.groq.com) — free tier, no credit card

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/bloodbets.git
cd bloodbets
```

### 2. Install frontend dependencies

```bash
pnpm install
pnpm add react@18.3.1 react-dom@18.3.1
pnpm add -D @types/react @types/react-dom
```

### 3. Install backend dependencies

```bash
cd server/bloodbath
pnpm install
pnpm add spacetimedb groq-sdk undici@6
pnpm add -D tsx
cd ../..
```

### 4. Login to SpacetimeDB

```bash
spacetime login
# Opens browser — sign in with GitHub
```

### 5. Publish the backend module

```bash
cd server/bloodbath
spacetime publish bloodbet -c=always --yes
cd ../..
```

This will:
- Create the `bloodbet` database on SpacetimeDB Maincloud
- Run the `init` reducer and seed all 50 AI fighters
- Set up all tables (user, tournament, fighter, bet, etc.)

### 6. Regenerate client bindings

```bash
spacetime generate --lang typescript --out-dir src/spacetime --module-path server/bloodbath/spacetimedb bloodbet
```

### 7. Set up environment variables

Create `server/bloodbath/.env`:

```
GROQ_API_KEY=your_groq_api_key_here
```

Get your key at [console.groq.com](https://console.groq.com) — it's free.

### 8. Run everything

You need **3 terminals** running simultaneously:

**Terminal 1 — Frontend:**
```bash
cd bloodbets
pnpm dev
# Opens at http://localhost:5173
```

**Terminal 2 — SpacetimeDB hot reload (dev only):**
```bash
cd server/bloodbath
spacetime dev
# Watches for backend changes and auto-republishes
```

**Terminal 3 — AI Orchestrator:**
```bash
cd server/bloodbath
pnpm orchestrator
# Runs tournaments, calls Groq for AI decisions every 15s
```

---

## How It Works

### The Game Loop

```
Orchestrator creates UPCOMING tournament
    ↓
2-minute betting window (users place bets)
    ↓
Tournament starts — 10 fighters spawn on 12×12 grid
    ↓
Every 15 seconds = 1 in-game hour
    ↓
Orchestrator asks Groq for each fighter's decision
(MOVE / ATTACK / ALLY / BETRAY / REST / CONSUME / HIDE)
    ↓
Decisions sent to advanceHour reducer
    ↓
Server processes combat, resource collection, eliminations
    ↓
Live events pushed to all connected users via WebSocket
    ↓
Last fighter standing wins — bets settled automatically
    ↓
Next tournament created
```

### Betting Types

| Bet | Odds |
|-----|------|
| Wins Tournament | 9.0x |
| Dies First | 22.0x |
| Survives Day 1 | 1.8x |
| Most Kills | 6.0x |
| Forms Alliance | 2.1x |

### Sponsorship System

Users with active bets can sponsor their fighter mid-tournament:

| Item | Cost | Effect |
|------|------|--------|
| Food | $50 | Reduces hunger |
| Water | $50 | Reduces thirst |
| Medkit | $150 | Reduces injury |
| Intel | $250 | Reveals enemy positions |
| Smoke Bomb | $175 | Escape mechanism |
| Weapon | $400 | Combat bonus |

3-hour cooldown per fighter per sponsor.

---

## Project Structure

```
bloodbets/
├── src/
│   ├── app/
│   │   ├── pages/          # All page components
│   │   ├── components/     # Shared UI components
│   │   ├── hooks/
│   │   │   └── useSpacetime.ts   # Main DB hook
│   │   └── context/
│   │       └── SpacetimeContext.tsx
│   └── spacetime/          # Auto-generated DB bindings (don't edit)
│
├── server/bloodbath/
│   ├── spacetimedb/src/
│   │   └── index.ts        # ENTIRE BACKEND — tables + reducers
│   ├── orchestrator.ts     # AI tournament engine
│   └── .env                # GROQ_API_KEY (not in git)
│
├── package.json
└── vite.config.ts
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/bloodbath/spacetimedb/src/index.ts` | Backend schema + all game logic |
| `server/bloodbath/orchestrator.ts` | AI decision engine (Groq calls) |
| `src/app/hooks/useSpacetime.ts` | React hook for live DB connection |
| `src/spacetime/index.ts` | Auto-generated — don't edit |

---

## Making Backend Changes

After editing `server/bloodbath/spacetimedb/src/index.ts`:

```bash
# Republish (resets all data)
spacetime publish bloodbet -c=always --yes

# Regenerate frontend bindings
spacetime generate --lang typescript --out-dir src/spacetime --module-path server/bloodbath/spacetimedb bloodbet
```

---

## Useful Commands

```bash
# Check what's in the DB
spacetime sql bloodbet "SELECT id, name, archetype FROM fighterTemplate"
spacetime sql bloodbet "SELECT id, name, status, current_hour FROM tournament"
spacetime sql bloodbet "SELECT username FROM user"

# Watch server logs live
spacetime logs bloodbet --follow

# Manually create a tournament (for testing)
spacetime call bloodbet createTournament "Test Tournament" "JUNGLE LABYRINTH"

# Check your database dashboard
# https://spacetimedb.com/bloodbet
```

---

## Common Issues

**"Tried to read X bytes" error in browser**
→ Bindings are out of sync. Run `spacetime generate ...` again and hard refresh.

**Login auto-logs in as wrong user**
→ Clear localStorage in browser console: `localStorage.clear()`

**Orchestrator rate limited**
→ Normal on Groq free tier. It retries automatically with backoff.

**`advanceHour` not incrementing**
→ Check `spacetime logs bloodbet` for panics. Usually a BigInt comparison issue.

**`pnpm install` fails**
→ Make sure you're in the right folder (the one with `package.json`).

---

## Environment

| Variable | Where | Value |
|----------|-------|-------|
| `GROQ_API_KEY` | `server/bloodbath/.env` | From console.groq.com |

---

## Team Notes

- **SpacetimeDB is the entire backend** — no Express, no REST API. All logic lives in reducers in `index.ts`.
- **Don't edit `src/spacetime/`** — it's auto-generated. Edit `index.ts` instead, then regenerate.
- **The orchestrator must be running** for tournaments to progress. It's the AI brain.
- **All data is real-time** — SpacetimeDB pushes updates to all connected clients via WebSocket automatically.
