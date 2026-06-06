import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Trophy, Skull, Clock, Swords } from 'lucide-react';
import { NavBar } from '../components/NavBar';
import { useDB } from '../context/SpacetimeContext';

function timestampToMs(ts: any): number {
  const micros = ts?.microsSinceUnixEpoch;
  return micros !== undefined ? Number(micros) / 1000 : 0;
}

export function TournamentHistoryPage() {
  const navigate = useNavigate();
  const { tournaments, tournamentFighters, fighters, liveEvents } = useDB();
  const [expanded, setExpanded] = useState<number | null>(null);

  const completed = [...tournaments]
    .filter(t => t.status === 'COMPLETED')
    .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));

  const summarize = (t: any) => {
    const roster = tournamentFighters
      .filter(tf => Number(tf.tournamentId) === Number(t.id))
      .map(tf => ({ tf, fighter: fighters.find(f => Number(f.id) === Number(tf.fighterId)) }))
      .filter(e => e.fighter);

    const events = liveEvents
      .filter(e => Number(e.tournamentId) === Number(t.id))
      .sort((a, b) => Number(a.id) - Number(b.id));

    const finalPhase = [...events].reverse().find(e => e.eventType === 'PHASE' && /standing|wins by|No survivors/.test(e.description));
    const winnerEntry = [...roster].sort((a, b) => Number(b.tf.kills) - Number(a.tf.kills) || Number(a.tf.injury) - Number(b.tf.injury))[0];
    const winner = roster.find(e => e.tf.isAlive) ?? winnerEntry;

    const leaderboard = [...roster].sort((a, b) => {
      const aSurv = a.tf.eliminatedHour === undefined || a.tf.eliminatedHour === null ? 9999 : Number(a.tf.eliminatedHour);
      const bSurv = b.tf.eliminatedHour === undefined || b.tf.eliminatedHour === null ? 9999 : Number(b.tf.eliminatedHour);
      if (bSurv !== aSurv) return bSurv - aSurv;
      return Number(b.tf.kills) - Number(a.tf.kills);
    });

    const mvp = [...roster].sort((a, b) => Number(b.tf.kills) - Number(a.tf.kills))[0];

    const moveSummary = (fighterId: number) => events
      .filter(e => { try { return JSON.parse(e.involvedIds ?? '[]').includes(fighterId); } catch { return false; } })
      .slice(0, 4)
      .map(e => e.description);

    return { roster, events, winner, leaderboard, mvp, finalPhase };
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-10 text-center">
          <h1 className="text-6xl md:text-7xl mb-4">TOURNAMENT ARCHIVE</h1>
          <p className="font-serif italic text-xl text-text-primary">
            "Every fall is remembered. Every victory immortalized."
          </p>
        </div>

        {completed.length === 0 ? (
          <div className="font-mono text-sm text-text-secondary text-center py-16">
            No tournaments have concluded yet — check back once one wraps up.
          </div>
        ) : (
          <div className="space-y-6">
            {completed.map((t, idx) => {
              const { roster, winner, leaderboard, mvp, finalPhase } = summarize(t);
              const isOpen = expanded === Number(t.id);
              return (
                <motion.div
                  key={Number(t.id)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-bg-secondary border border-separator inner-glow overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : Number(t.id))}
                    className="w-full text-left p-6 hover:bg-bg-tertiary/40 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                      <div>
                        <h3 className="font-display text-2xl text-accent-gold mb-1">{t.name}</h3>
                        <div className="font-mono text-xs text-text-secondary uppercase">
                          {t.arenaType} · {roster.length} fighters · {Number(t.currentHour ?? 0)} hours
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-mono text-[10px] text-text-secondary uppercase flex items-center gap-1 justify-end">
                            <Trophy className="w-3 h-3 text-accent-gold" /> Champion
                          </div>
                          <div className="font-display text-lg text-accent-gold">{winner?.fighter?.name ?? '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[10px] text-text-secondary uppercase">Prize Pool</div>
                          <div className="font-display text-lg text-success-green">${Number(t.prizePool ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    {finalPhase && (
                      <p className="mt-3 font-mono text-xs text-text-secondary italic">"{finalPhase.description}"</p>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-separator p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Leaderboard */}
                      <div>
                        <h4 className="font-heading text-sm text-accent-gold uppercase mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Survival Leaderboard
                        </h4>
                        <div className="space-y-1.5">
                          {leaderboard.map((e, i) => (
                            <div key={Number(e.tf.id)} className="flex items-center justify-between bg-bg-tertiary border border-separator px-3 py-2 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-text-secondary w-5">#{i + 1}</span>
                                <span className={e.tf.isAlive ? 'text-accent-gold' : 'text-text-primary'}>{e.fighter?.name}</span>
                                {e.tf.isAlive && <Trophy className="w-3 h-3 text-accent-gold" />}
                              </div>
                              <div className="flex items-center gap-3 text-text-secondary">
                                <span className="flex items-center gap-1"><Swords className="w-3 h-3" /> {Number(e.tf.kills)}</span>
                                <span className="flex items-center gap-1">
                                  {e.tf.isAlive ? 'Survived' : <><Skull className="w-3 h-3" /> H{Number(e.tf.eliminatedHour ?? 0)}</>}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Highlights */}
                      <div>
                        <h4 className="font-heading text-sm text-accent-gold uppercase mb-3">Tournament Highlights</h4>
                        <div className="space-y-3 font-mono text-xs text-text-secondary">
                          <div className="bg-bg-tertiary border border-accent-gold p-3">
                            <div className="text-accent-gold uppercase text-[10px] mb-1">🏆 Champion</div>
                            <div className="text-text-primary">{winner?.fighter?.name} ({winner?.fighter?.archetype}) — {Number(winner?.tf.kills ?? 0)} kills, last seen {winner?.tf.isAlive ? 'standing tall' : `eliminated hour ${Number(winner?.tf.eliminatedHour ?? 0)}`}</div>
                          </div>
                          <div className="bg-bg-tertiary border border-separator p-3">
                            <div className="text-accent-gold uppercase text-[10px] mb-1">⚔️ MVP — Most Kills</div>
                            <div className="text-text-primary">{mvp?.fighter?.name} — {Number(mvp?.tf.kills ?? 0)} eliminations</div>
                          </div>
                          <div className="bg-bg-tertiary border border-separator p-3">
                            <div className="text-accent-gold uppercase text-[10px] mb-1">🧠 Smartest Play</div>
                            <div className="text-text-primary">
                              {(() => {
                                const strategist = roster.find(e => e.fighter?.archetype === 'STRATEGIC' && e.tf.isAlive)
                                  ?? roster.find(e => e.fighter?.archetype === 'STRATEGIC')
                                  ?? leaderboard[0];
                                return `${strategist?.fighter?.name ?? '—'} (${strategist?.fighter?.archetype}) — outlasted ${roster.length - 1} rivals through calculated survival.`;
                              })()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/tournament-summary/${Number(t.id)}`)}
                          className="mt-4 font-mono text-xs text-accent-gold hover:underline"
                        >
                          View full summary & payouts →
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
