import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Trophy, Skull, Swords, Wallet, ArrowLeft, Brain, Heart } from 'lucide-react';
import { NavBar } from '../components/NavBar';
import { useDB } from '../context/SpacetimeContext';

export function TournamentSummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    tournaments, tournamentFighters, fighters, liveEvents, bets, users, identity,
  } = useDB();

  const tournamentId = Number(id);
  const tournament = tournaments.find(t => Number(t.id) === tournamentId);

  const roster = tournamentFighters
    .filter(tf => Number(tf.tournamentId) === tournamentId)
    .map(tf => ({ tf, fighter: fighters.find(f => Number(f.id) === Number(tf.fighterId)) }))
    .filter(e => e.fighter);

  const events = liveEvents
    .filter(e => Number(e.tournamentId) === tournamentId)
    .sort((a, b) => Number(a.id) - Number(b.id));

  const finalPhase = [...events].reverse().find(e => e.eventType === 'PHASE' && /standing|wins by|No survivors/.test(e.description));

  const leaderboard = [...roster].sort((a, b) => {
    const aSurv = a.tf.eliminatedHour === undefined || a.tf.eliminatedHour === null ? 9999 : Number(a.tf.eliminatedHour);
    const bSurv = b.tf.eliminatedHour === undefined || b.tf.eliminatedHour === null ? 9999 : Number(b.tf.eliminatedHour);
    if (bSurv !== aSurv) return bSurv - aSurv;
    return Number(b.tf.kills) - Number(a.tf.kills);
  });

  const winner    = roster.find(e => e.tf.isAlive) ?? leaderboard[0];
  const mvp       = [...roster].sort((a, b) => Number(b.tf.kills) - Number(a.tf.kills))[0];
  const survivor  = leaderboard[0];
  const strategist = roster.find(e => e.fighter?.archetype === 'STRATEGIC' && e.tf.isAlive)
    ?? roster.find(e => e.fighter?.archetype === 'STRATEGIC')
    ?? leaderboard[0];

  const moveSummary = (fighterId: number) => events
    .filter(e => { try { return JSON.parse(e.involvedIds ?? '[]').map(Number).includes(Number(fighterId)); } catch { return false; } })
    .map(e => `H${e.hour}: ${e.description}`)
    .slice(0, 5);

  const tournamentBets = bets.filter(b => Number(b.tournamentId) === tournamentId);
  const payouts = tournamentBets.map(b => {
    const user = users.find(u => u.identity?.toHexString?.() === b.userId?.toHexString?.());
    const fighter = fighters.find(f => Number(f.id) === Number(b.fighterId));
    const payout = b.status === 'WON' ? Number(b.amount) * Number(b.odds) : 0;
    return {
      id: Number(b.id),
      username: user?.username ?? 'Unknown',
      isMe: b.userId?.toHexString?.() === identity,
      fighterName: fighter?.name ?? `#${b.fighterId}`,
      betType: b.betType,
      amount: Number(b.amount),
      odds: Number(b.odds),
      status: b.status,
      payout,
    };
  }).sort((a, b) => b.payout - a.payout);

  const totalWagered = payouts.reduce((s, p) => s + p.amount, 0);
  const totalPaidOut = payouts.reduce((s, p) => s + p.payout, 0);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <NavBar />
        <div className="max-w-4xl mx-auto p-6 text-center py-24 font-mono text-text-secondary">
          Tournament not found.
          <div className="mt-4">
            <button onClick={() => navigate('/tournament-history')} className="text-accent-gold hover:underline">← Back to archive</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-6xl mx-auto p-6">
        <button onClick={() => navigate('/tournament-history')} className="flex items-center gap-2 font-mono text-xs text-text-secondary hover:text-accent-gold transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Archive
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="font-mono text-xs text-destructive uppercase tracking-widest mb-2">Tournament Concluded</div>
          <h1 className="text-6xl md:text-7xl mb-3">{tournament.name}</h1>
          <p className="font-serif italic text-xl text-text-primary">{tournament.arenaType} · {Number(tournament.currentHour ?? 0)} in-game hours</p>
          {finalPhase && <p className="mt-3 font-mono text-sm text-accent-gold italic">"{finalPhase.description}"</p>}
        </motion.div>

        {/* Champion banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-bg-secondary to-bg-tertiary border border-accent-gold inner-glow p-8 mb-10 text-center"
        >
          <Trophy className="w-12 h-12 text-accent-gold mx-auto mb-3" />
          <div className="font-mono text-xs text-text-secondary uppercase mb-1">Champion of the Arena</div>
          <h2 className="font-display text-4xl text-accent-gold mb-2">{winner?.fighter?.name}</h2>
          <div className="font-mono text-sm text-text-secondary uppercase">{winner?.fighter?.archetype} · {Number(winner?.tf.kills ?? 0)} kills</div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Leaderboard */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-bg-secondary border border-separator inner-glow p-6">
            <h3 className="font-display text-xl text-accent-gold mb-4 uppercase">Final Leaderboard</h3>
            <div className="space-y-1.5">
              {leaderboard.map((e, i) => (
                <div key={Number(e.tf.id)} className="flex items-center justify-between bg-bg-tertiary border border-separator px-3 py-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary w-5">#{i + 1}</span>
                    <span className={e.tf.isAlive ? 'text-accent-gold' : 'text-text-primary'}>{e.fighter?.name}</span>
                    <span className="text-text-secondary uppercase text-[10px]">{e.fighter?.archetype}</span>
                  </div>
                  <div className="flex items-center gap-3 text-text-secondary">
                    <span className="flex items-center gap-1"><Swords className="w-3 h-3" /> {Number(e.tf.kills)}</span>
                    <span className="flex items-center gap-1">
                      {e.tf.isAlive ? <span className="text-success-green">Survived</span> : <><Skull className="w-3 h-3" /> Hour {Number(e.tf.eliminatedHour ?? 0)}</>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Awards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-bg-secondary border border-separator inner-glow p-6">
            <h3 className="font-display text-xl text-accent-gold mb-4 uppercase">Awards & Standouts</h3>
            <div className="space-y-3">
              <div className="bg-bg-tertiary border border-accent-gold p-3">
                <div className="flex items-center gap-2 text-accent-gold uppercase text-[10px] mb-1"><Trophy className="w-3.5 h-3.5" /> Champion</div>
                <div className="font-mono text-xs text-text-primary">{winner?.fighter?.name} — outlasted the entire arena</div>
              </div>
              <div className="bg-bg-tertiary border border-separator p-3">
                <div className="flex items-center gap-2 text-accent-gold uppercase text-[10px] mb-1"><Swords className="w-3.5 h-3.5" /> Most Kills (MVP)</div>
                <div className="font-mono text-xs text-text-primary">{mvp?.fighter?.name} — {Number(mvp?.tf.kills ?? 0)} eliminations</div>
              </div>
              <div className="bg-bg-tertiary border border-separator p-3">
                <div className="flex items-center gap-2 text-accent-gold uppercase text-[10px] mb-1"><Heart className="w-3.5 h-3.5" /> Best Survivor</div>
                <div className="font-mono text-xs text-text-primary">{survivor?.fighter?.name} — {survivor?.tf.isAlive ? 'made it to the final hour' : `lasted until hour ${Number(survivor?.tf.eliminatedHour ?? 0)}`}</div>
              </div>
              <div className="bg-bg-tertiary border border-separator p-3">
                <div className="flex items-center gap-2 text-accent-gold uppercase text-[10px] mb-1"><Brain className="w-3.5 h-3.5" /> Smartest Player</div>
                <div className="font-mono text-xs text-text-primary">{strategist?.fighter?.name} ({strategist?.fighter?.archetype}) — calculated survival over brute force</div>
              </div>
            </div>

            {winner && moveSummary(Number(winner.fighter?.id)).length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[10px] text-text-secondary uppercase mb-2">Champion's Key Moments</div>
                <ul className="space-y-1 font-mono text-[11px] text-text-secondary">
                  {moveSummary(Number(winner.fighter?.id)).map((m, i) => <li key={i}>· {m}</li>)}
                </ul>
              </div>
            )}
          </motion.div>
        </div>

        {/* Payouts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-bg-secondary border border-separator inner-glow p-6 mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-accent-gold uppercase flex items-center gap-2">
              <Wallet className="w-5 h-5" /> Bet Payouts
            </h3>
            <div className="font-mono text-xs text-text-secondary">
              ${totalWagered.toFixed(2)} wagered · <span className="text-success-green">${totalPaidOut.toFixed(2)} paid out</span>
            </div>
          </div>
          {payouts.length === 0 ? (
            <p className="font-mono text-sm text-text-secondary">No bets were placed on this tournament.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-text-secondary uppercase text-[10px] border-b border-separator">
                    <th className="text-left py-2 px-2">Bettor</th>
                    <th className="text-left py-2 px-2">Fighter</th>
                    <th className="text-left py-2 px-2">Bet Type</th>
                    <th className="text-right py-2 px-2">Stake</th>
                    <th className="text-right py-2 px-2">Odds</th>
                    <th className="text-right py-2 px-2">Result</th>
                    <th className="text-right py-2 px-2">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} className={`border-b border-separator/40 ${p.isMe ? 'bg-accent-gold/5' : ''}`}>
                      <td className="py-2 px-2 text-text-primary">{p.username}{p.isMe && <span className="text-accent-gold"> (you)</span>}</td>
                      <td className="py-2 px-2 text-text-secondary">{p.fighterName}</td>
                      <td className="py-2 px-2 text-text-secondary uppercase">{p.betType.replace(/_/g, ' ')}</td>
                      <td className="py-2 px-2 text-right text-text-primary">${p.amount.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-text-secondary">{p.odds.toFixed(1)}x</td>
                      <td className={`py-2 px-2 text-right uppercase ${p.status === 'WON' ? 'text-success-green' : p.status === 'LOST' ? 'text-destructive' : 'text-text-secondary'}`}>{p.status}</td>
                      <td className={`py-2 px-2 text-right font-heading ${p.payout > 0 ? 'text-success-green' : 'text-text-secondary'}`}>
                        {p.payout > 0 ? `+$${p.payout.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
