import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Crown, Play, FastForward, Plus } from 'lucide-react';
import { useDB } from '../context/SpacetimeContext';
import { useSound } from '../context/SoundContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const ARENA_TYPES = ['arctic', 'jungle', 'volcano', 'urban', 'ocean', 'desert'];
const ACTIONS = ['MOVE', 'REST', 'CONSUME', 'ATTACK', 'ALLY', 'HIDE'];

function generateDecisions(tournamentId: number, tournamentFighters: any[], arenaTiles: any[], gridW: number, gridH: number) {
  const alive = tournamentFighters.filter(tf => Number(tf.tournamentId) === tournamentId && tf.isAlive);
  return alive.map(tf => {
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const entry: any = { fighterId: Number(tf.fighterId), action };
    if (action === 'MOVE' || action === 'HIDE') {
      entry.targetX = Math.floor(Math.random() * gridW);
      entry.targetY = Math.floor(Math.random() * gridH);
    } else if (action === 'ATTACK' || action === 'ALLY') {
      const others = alive.filter(o => Number(o.fighterId) !== Number(tf.fighterId));
      if (others.length) entry.targetId = Number(others[Math.floor(Math.random() * others.length)].fighterId);
      else entry.action = 'REST';
    }
    return entry;
  });
}

export function AdminPage() {
  const {
    currentUser, tournaments, tournamentFighters, arenaTiles, users, fighters,
    claimAdmin, setAdmin, adminCreateTournament, startTournament, advanceHour, adminSeedFighters,
  } = useDB();
  const { play } = useSound();

  const [name, setName] = useState('');
  const [arenaType, setArenaType] = useState(ARENA_TYPES[0]);
  const [gridWidth, setGridWidth] = useState('14');
  const [gridHeight, setGridHeight] = useState('14');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isAdmin = !!currentUser?.isAdmin;
  const anyAdmin = users.some((u: any) => u.isAdmin);

  const run = async (key: string, fn: () => Promise<any>) => {
    setError('');
    setBusy(key);
    try {
      await fn();
      play('success');
    } catch (err: any) {
      play('error');
      setError(err?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <Shield className="w-12 h-12 text-accent-gold mx-auto mb-4" />
        <h1 className="font-display text-2xl text-accent-gold mb-2">Admin Access Required</h1>
        {!anyAdmin ? (
          <>
            <p className="font-mono text-sm text-text-secondary mb-6">
              No admin exists yet. Claim the role to take control of the arena.
            </p>
            <Button onClick={() => run('claim', claimAdmin)} disabled={busy === 'claim'}>
              {busy === 'claim' ? 'Claiming...' : 'Claim Admin Role'}
            </Button>
          </>
        ) : (
          <p className="font-mono text-sm text-text-secondary">
            You do not have admin privileges. Ask an existing admin to grant you access.
          </p>
        )}
        {error && <div className="mt-4 font-mono text-xs text-destructive">{error}</div>}
      </div>
    );
  }

  const upcoming = tournaments.filter((t: any) => t.status === 'UPCOMING');
  const live = tournaments.filter((t: any) => t.status === 'LIVE');

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <div className="flex items-center gap-3">
        <Crown className="w-7 h-7 text-accent-gold" />
        <h1 className="font-display text-2xl text-accent-gold">Admin Control Panel</h1>
      </div>

      {error && <div className="bg-red-950/40 border border-red-500 text-red-400 font-mono text-xs px-4 py-3">{error}</div>}

      {/* Fighter roster */}
      <section className="bg-bg-secondary border border-separator p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm uppercase text-accent-gold tracking-wider">
            Fighter Roster — {fighters.filter((f: any) => !f.isUserCreated).length} / 50 AI fighters
          </h2>
          <Button
            variant="secondary"
            disabled={busy === 'seed'}
            onClick={() => run('seed', adminSeedFighters)}
          >
            {busy === 'seed' ? 'Seeding...' : '⚔️ Seed / Restore Fighters'}
          </Button>
        </div>
        <p className="font-mono text-xs text-text-secondary">
          Adds any missing AI fighters without overwriting existing ones. Safe to run after a republish.
        </p>
      </section>

      {/* Create tournament with custom rules */}
      <section className="bg-bg-secondary border border-separator p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase text-accent-gold tracking-wider">Create Tournament — Set the Rules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="NAME" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Tournament name" />
          <div>
            <label className="block font-mono text-[10px] uppercase text-text-secondary mb-1">Arena Type</label>
            <select value={arenaType} onChange={e => setArenaType(e.target.value)}
              className="w-full bg-bg-tertiary border border-separator px-3 py-3 font-mono text-sm text-text-primary focus:border-accent-gold outline-none">
              {ARENA_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Input label="GRID WIDTH (6-30)" type="number" value={gridWidth} onChange={(e: any) => setGridWidth(e.target.value)} />
          <Input label="GRID HEIGHT (6-30)" type="number" value={gridHeight} onChange={(e: any) => setGridHeight(e.target.value)} />
        </div>
        <Button
          disabled={busy === 'create' || !name.trim()}
          onClick={() => run('create', () => adminCreateTournament(
            name.trim(), arenaType,
            Math.max(6, Math.min(30, Number(gridWidth) || 14)),
            Math.max(6, Math.min(30, Number(gridHeight) || 14)),
          )).then(() => setName(''))}
        >
          <Plus className="w-4 h-4 inline mr-2" />
          {busy === 'create' ? 'Creating...' : 'Create Tournament'}
        </Button>
      </section>

      {/* Upcoming tournaments */}
      <section className="bg-bg-secondary border border-separator p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase text-accent-gold tracking-wider">Upcoming Tournaments</h2>
        {upcoming.length === 0 ? (
          <p className="font-mono text-xs text-text-secondary">No upcoming tournaments.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((t: any) => (
              <div key={Number(t.id)} className="flex items-center justify-between border border-separator px-4 py-3">
                <div>
                  <div className="font-heading text-sm text-text-primary">{t.name}</div>
                  <div className="font-mono text-[10px] text-text-secondary uppercase">{t.arenaType} · {Number(t.gridWidth)}×{Number(t.gridHeight)}</div>
                </div>
                <Button variant="secondary" disabled={busy === `start-${t.id}`} onClick={() => run(`start-${t.id}`, () => startTournament(Number(t.id)))}>
                  <Play className="w-3.5 h-3.5 inline mr-1.5" />
                  {busy === `start-${t.id}` ? 'Starting...' : 'Start'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live tournaments */}
      <section className="bg-bg-secondary border border-separator p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase text-accent-gold tracking-wider">Live Tournaments</h2>
        {live.length === 0 ? (
          <p className="font-mono text-xs text-text-secondary">No live tournaments.</p>
        ) : (
          <div className="space-y-3">
            {live.map((t: any) => {
              const tid = Number(t.id);
              const aliveCount = tournamentFighters.filter((tf: any) => Number(tf.tournamentId) === tid && tf.isAlive).length;
              return (
                <div key={tid} className="flex items-center justify-between border border-separator px-4 py-3">
                  <div>
                    <div className="font-heading text-sm text-text-primary">{t.name}</div>
                    <div className="font-mono text-[10px] text-text-secondary uppercase">
                      Hour {Number(t.currentHour)} · {aliveCount} alive
                    </div>
                  </div>
                  <Button variant="secondary" disabled={busy === `adv-${tid}`}
                    onClick={() => run(`adv-${tid}`, () => {
                      const decisions = generateDecisions(tid, tournamentFighters, arenaTiles, Number(t.gridWidth), Number(t.gridHeight));
                      return advanceHour(tid, JSON.stringify(decisions));
                    })}>
                    <FastForward className="w-3.5 h-3.5 inline mr-1.5" />
                    {busy === `adv-${tid}` ? 'Advancing...' : 'Advance Hour'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Admin management */}
      <section className="bg-bg-secondary border border-separator p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase text-accent-gold tracking-wider">Manage Admins</h2>
        <div className="space-y-2">
          {users.map((u: any) => (
            <div key={u.identity.toHexString()} className="flex items-center justify-between border border-separator px-4 py-2.5">
              <span className="font-mono text-xs text-text-primary">{u.username}{u.isAdmin && <span className="text-accent-gold ml-2">★ ADMIN</span>}</span>
              {u.identity.toHexString() !== currentUser?.identity?.toHexString() && (
                <button
                  onClick={() => run(`admin-${u.identity.toHexString()}`, () => setAdmin(u.identity, !u.isAdmin))}
                  disabled={busy === `admin-${u.identity.toHexString()}`}
                  className="font-mono text-[10px] uppercase text-text-secondary hover:text-accent-gold transition-colors"
                >
                  {u.isAdmin ? 'Revoke' : 'Promote'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center font-mono text-[10px] text-text-secondary uppercase">
        With great power comes great responsibility.
      </motion.div>
    </div>
  );
}
