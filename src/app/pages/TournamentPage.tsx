import { useState, useEffect } from 'react';
import { CharacterCard } from '../components/CharacterCard';
import { ArenaMap } from '../components/ArenaMap';
import { CinematicIntro } from '../components/CinematicIntro';
import { EventBetsPanel } from '../components/EventBetsPanel';
import { Button } from '../components/Button';
import { NavBar } from '../components/NavBar';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, Sword, Users, Eye, Trophy, UserPlus, UserCheck,
  ChevronDown, ChevronUp, Wallet, Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDB } from '../context/SpacetimeContext';
import { useSound } from '../context/SoundContext';

const BET_TYPES = [
  { key: 'WIN',          label: 'Wins Tournament',   odds: 12.4 },
  { key: 'SURVIVES_DAY_1',  label: 'Survives Round 1',   odds: 1.4  },
  { key: 'DIES_FIRST',      label: 'Dies First',          odds: 22.0 },
  { key: 'MOST_KILLS',      label: 'Kills 3+ Opponents', odds: 5.0  },
  { key: 'FORMS_ALLIANCE',   label: 'Forms Alliance',      odds: 2.1  },
];

const EVENT_ICONS: Record<string, string> = {
  KILL: '⚔️', ALLIANCE: '🤝', BETRAYAL: '🗡️', FLEE: '💨', TRAP: '⚠️', PHASE: '📢',
};

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  LIVE:      'text-red-400 bg-red-500/10 border-red-500/30',
  COMPLETED:'text-text-secondary bg-separator/10 border-separator',
};

function timeAgoMs(ts: any): string {
  const micros = ts?.microsSinceUnixEpoch;
  if (!micros) return '';
  const diffMs = Date.now() - Number(micros) / 1000;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Rename windowMs to avoid duplicate naming collisions if needed
function countdown(createdAtTs: any, now: number, windowMs = 30 * 60 * 1000): string {
  const micros = createdAtTs?.microsSinceUnixEpoch;
  if (!micros) return '--:--';
  const end = Number(micros) / 1000 + windowMs;
  const rem = Math.max(0, end - now);
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Single tournament card (expanded view) ──────────────────────────────────

// Note: If 'activeTournament' or 'filteredEvents' from the betting branch 
// are missing from props, make sure they are derived or destructured here.
function TournamentCard({
  tournament, fighters, tournamentFighters, arenaTiles, bets, liveEvents,
  registrations, users, currentUser, identity, registerForTournament, unregisterFromTournament,
  placeBet, defaultExpanded, activeTournament, filteredEvents = [],
}: any) {
  const { play } = useSound();
  const navigate = useNavigate();
  const now = useNow();

  const tid = Number(tournament.id);
  const isLive     = tournament.status === 'LIVE';
  const isUpcoming = tournament.status === 'UPCOMING';
  const isCompleted= tournament.status === 'COMPLETED';

  const [expanded,        setExpanded]        = useState(defaultExpanded);
  const [selectedFighter, setSelectedFighter] = useState<any>(null);
  const [selectedBetType, setSelectedBetType] = useState('WIN');
  const [betAmount,        setBetAmount]        = useState('');
  const [betError,        setBetError]         = useState('');
  const [betSuccess,      setBetSuccess]       = useState('');
  const [regBusy,          setRegBusy]          = useState(false);

  // Cinematic intro
  const [showIntro, setShowIntro] = useState(false);
  const [seenIntro, setSeenIntro] = useState(false);
  useEffect(() => {
    if (isLive && !seenIntro && Number(tournament.currentHour ?? 0) <= 1) {
      setShowIntro(true);
      setSeenIntro(true);
    }
  }, [isLive]);

  // Redirect to summary when completed while we were watching
  const [wasLive, setWasLive] = useState(isLive);
  useEffect(() => { if (isLive) setWasLive(true); }, [isLive]);
  useEffect(() => {
    if (wasLive && isCompleted) navigate(`/tournament-summary/${tid}`);
  }, [wasLive, isCompleted]);

  const roster = tournamentFighters
    .filter((tf: any) => Number(tf.tournamentId) === tid)
    .map((tf: any) => ({ tf, fighter: fighters.find((f: any) => Number(f.id) === Number(tf.fighterId)) ?? null }))
    .filter((e: any) => e.fighter !== null);

  const displayFighters = isLive
    ? roster
    : fighters.map((f: any) => ({ tf: null, fighter: f }));

  const aliveCount = roster.filter((e: any) => e.tf.isAlive).length;
  const tiles       = arenaTiles.filter((t: any) => Number(t.tournamentId) === tid);
  const events      = liveEvents
    .filter((e: any) => Number(e.tournamentId) === tid)
    .sort((a: any, b: any) => Number(b.id) - Number(a.id))
    .slice(0, 25);

  const myBets = bets.filter((b: any) =>
    Number(b.tournamentId) === tid && b.userId?.toHexString?.() === identity
  );
  const allBets = bets.filter((b: any) => Number(b.tournamentId) === tid);

  const myReg = registrations.find((r: any) =>
    Number(r.tournamentId) === tid && r.userId?.toHexString?.() === identity
  );
  const regList = registrations.filter((r: any) => Number(r.tournamentId) === tid);
  const bettorCount = regList.filter((r: any) => r.role === 'BETTOR').length;
  const viewerCount = regList.filter((r: any) => r.role === 'VIEWER').length;

  const hostUser = users.find((u: any) =>
    tournament.hostIdentity && u.identity?.toHexString?.() === tournament.hostIdentity?.toHexString?.()
  );

  const handleRegister = async () => {
    setRegBusy(true);
    try {
      if (myReg) {
        await unregisterFromTournament(tid);
      } else {
        await registerForTournament(tid);
      }
      play('click');
    } catch { play('error'); }
    finally { setRegBusy(false); }
  };

  const handlePlaceBet = () => {
    setBetError('');
    setBetSuccess('');
    if (!selectedFighter) { setBetError('Select a fighter.'); return; }
    if (!betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0) {
      setBetError('Enter a valid amount.'); return;
    }
    if (Number(betAmount) > (currentUser?.balance ?? 0)) {
      setBetError(`Insufficient funds ($${(currentUser?.balance ?? 0).toFixed(2)})`); return;
    }
    play('bet');
    placeBet(tid, Number(selectedFighter.id), selectedBetType, Number(betAmount));
    const odds = BET_TYPES.find(b => b.key === selectedBetType)?.odds ?? 2;
    setBetSuccess(`Bet placed! $${betAmount} on ${selectedFighter.name} · Potential: $${(Number(betAmount) * odds).toFixed(2)}`);
    setBetAmount('');
    setTimeout(() => { setSelectedFighter(null); setBetSuccess(''); }, 2500);
  };

  return (
    <motion.div layout className="border border-separator bg-bg-secondary overflow-hidden">
      {showIntro && (
        <CinematicIntro
          tournamentName={tournament.name}
          arenaType={tournament.arenaType}
          fighterCount={roster.length}
          onFinish={() => setShowIntro(false)}
        />
      )}

      {/* Card header — always visible */}
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
        onClick={() => setExpanded((v: boolean) => !v)}
        onKeyDown={e => e.key === 'Enter' && setExpanded((v: boolean) => !v)}
      >
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display text-xl text-accent-gold">{tournament.name}</span>
              <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${STATUS_COLORS[tournament.status] ?? ''}`}>
                {isLive ? `🔴 LIVE · H${Number(tournament.currentHour ?? 0)}` : tournament.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 font-mono text-xs text-text-secondary">
              <span>{tournament.arenaType}</span>
              {hostUser && <span>GM: {hostUser.username}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{regList.length} registered</span>
              <span className="flex items-center gap-1"><Wallet className="w-3 h-3" />${Number(tournament.prizePool ?? 0).toFixed(0)} pool</span>
              {isUpcoming && <span className="text-yellow-400">⏱ {countdown(tournament.createdAt, now)}</span>}
              {isLive && <span>{aliveCount}/{roster.length} alive</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isUpcoming && (
            <button
              onClick={e => { e.stopPropagation(); handleRegister(); }}
              disabled={regBusy}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase border transition-colors ${
                myReg
                  ? 'border-accent-gold text-accent-gold hover:bg-red-500/10 hover:border-red-400 hover:text-red-400'
                  : 'border-separator text-text-secondary hover:border-accent-gold hover:text-accent-gold'
              }`}
            >
              {myReg ? <><UserCheck className="w-3 h-3" /> Registered</> : <><UserPlus className="w-3 h-3" /> Register</>}
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-separator"
          >
            <div className="p-6 space-y-6">

              {/* Registration panel (UPCOMING) */}
              {isUpcoming && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Register CTA */}
                  <div className="bg-bg-tertiary border border-accent-gold/30 p-5">
                    <h3 className="font-heading text-sm uppercase text-accent-gold mb-3">Registration</h3>
                    {myReg ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 font-mono text-sm text-success-green">
                          <UserCheck className="w-4 h-4" /> You&apos;re registered as <strong>{myReg.role}</strong>
                        </div>
                        <p className="font-mono text-xs text-text-secondary">
                          {myReg.role === 'BETTOR'
                            ? 'You have a bet on this tournament. Good luck!'
                            : 'Watching as a viewer. Place a bet to become a bettor.'}
                        </p>
                        <button
                          onClick={handleRegister}
                          disabled={regBusy || myReg?.role === 'BETTOR'}
                          className="font-mono text-[10px] uppercase text-text-secondary hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          {myReg?.role === 'BETTOR' ? 'Cannot unregister (active bet)' : 'Unregister'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="font-mono text-xs text-text-secondary">
                          Register as a viewer to follow this tournament. You&apos;ll automatically become a bettor if you place a bet.
                        </p>
                        <Button onClick={handleRegister} disabled={regBusy} variant="secondary" className="w-full">
                          <UserPlus className="w-4 h-4 inline mr-2" />
                          {regBusy ? 'Registering...' : 'Register as Viewer'}
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-6 mt-4 pt-4 border-t border-separator">
                      <div className="text-center">
                        <div className="font-display text-2xl text-accent-gold">{bettorCount}</div>
                        <div className="font-mono text-[10px] text-text-secondary uppercase">Bettors</div>
                      </div>
                      <div className="text-center">
                        <div className="font-display text-2xl text-text-primary">{viewerCount}</div>
                        <div className="font-mono text-[10px] text-text-secondary uppercase">Viewers</div>
                      </div>
                      <div className="text-center">
                        <div className="font-display text-2xl text-success-green">${Number(tournament.prizePool ?? 0).toFixed(0)}</div>
                        <div className="font-mono text-[10px] text-text-secondary uppercase">Prize Pool</div>
                      </div>
                    </div>
                  </div>

                  {/* Who has registered */}
                  <div className="bg-bg-tertiary border border-separator p-5">
                    <h3 className="font-heading text-sm uppercase text-accent-gold mb-3 flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Registered Participants
                    </h3>
                    {regList.length === 0 ? (
                      <p className="font-mono text-xs text-text-secondary text-center py-4">No participants yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {regList.map((r: any) => {
                          const ru = users.find((u: any) => u.identity?.toHexString?.() === r.userId?.toHexString?.());
                          const myBet = bets.find((b: any) =>
                            Number(b.tournamentId) === tid && b.userId?.toHexString?.() === r.userId?.toHexString?.()
                          );
                          const betFighter = myBet ? fighters.find((f: any) => Number(f.id) === Number(myBet.fighterId)) : null;
                          return (
                            <div key={Number(r.id)} className="flex items-center justify-between py-1.5 border-b border-separator/40 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-text-primary">{ru?.avatarEmoji ?? '👤'} {ru?.username ?? 'Unknown'}</span>
                                <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                                  r.role === 'BETTOR'
                                    ? 'border-accent-gold/40 text-accent-gold'
                                    : 'border-separator text-text-secondary'
                                }`}>{r.role}</span>
                              </div>
                              {myBet && betFighter && (
                                <div className="font-mono text-[10px] text-text-secondary text-right">
                                  <span className="text-accent-gold">${Number(myBet.amount ?? 0).toFixed(0)}</span> on {betFighter.name}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Arena Map (LIVE) */}
              {isLive && (
                <ArenaMap
                  width={Number(tournament.gridWidth ?? 12)}
                  height={Number(tournament.gridHeight ?? 12)}
                  tiles={tiles}
                  roster={roster}
                  events={events}
                  currentHour={Number(tournament.currentHour ?? 0)}
                  selectedFighterId={selectedFighter ? Number(selectedFighter.id) : null}
                  onSelectFighter={(id: number) => {
                    setSelectedFighter(fighters.find((f: any) => Number(f.id) === id) ?? null);
                    setBetError(''); setBetSuccess('');
                  }}
                />
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

                {/* Fighter grid */}
                <div>
                  <h3 className="font-heading text-sm uppercase text-accent-gold mb-4 flex items-center gap-2">
                    <Sword className="w-4 h-4" />
                    {isLive ? `Arena Fighters — ${aliveCount} Alive` : `Fighter Pool — ${fighters.length} fighters`}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {displayFighters.slice(0, isLive ? undefined : 12).map(({ tf, fighter }: any, idx: number) => {
                      const dead = tf ? !tf.isAlive : false;
                      const sel  = selectedFighter && Number(selectedFighter.id) === Number(fighter.id);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (dead || (!isUpcoming && !isLive)) return;
                            setSelectedFighter(sel ? null : fighter);
                            setBetError(''); setBetSuccess('');
                          }}
                          className={`transition-all ${dead ? 'opacity-40' : isUpcoming || isLive ? 'cursor-pointer' : ''} ${sel ? 'ring-2 ring-accent-gold' : !dead && (isUpcoming || isLive) ? 'hover:ring-1 hover:ring-accent-gold/50' : ''}`}
                        >
                          <CharacterCard
                            name={fighter.name}
                            archetype={fighter.archetype}
                            stats={{ str: fighter.strength, spd: fighter.speed, int: fighter.intelligence, luck: fighter.luck }}
                            survivalOdds={70}
                            winOdds={`${(12.4 / (fighter.wins + 1)).toFixed(1)}x`}
                            avatar={fighter.avatarUrl || undefined}
                            dead={dead}
                            conditionLabel={tf ? tf.condition : undefined}
                            onClick={() => {}}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {!isLive && fighters.length > 12 && (
                    <p className="font-mono text-xs text-text-secondary mt-3 text-center">+ {fighters.length - 12} more fighters in the pool</p>
                  )}
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">

                  {/* Bet panel (UPCOMING only) */}
                  {isUpcoming && (
                    <div className="bg-bg-tertiary border border-accent-gold/40 p-5">
                      <h3 className="font-heading text-sm uppercase text-accent-gold mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Place a Bet
                      </h3>
                      {selectedFighter ? (
                        <div className="space-y-3">
                          <div className="border border-accent-gold/30 p-3 bg-bg-secondary">
                            <div className="font-display text-base text-accent-gold">{selectedFighter.name}</div>
                            <div className="font-mono text-[10px] text-text-secondary">{selectedFighter.archetype}</div>
                          </div>
                          <div className="space-y-1.5">
                            {BET_TYPES.map(bt => (
                              <div
                                key={bt.key}
                                onClick={() => setSelectedBetType(bt.key)}
                                className={`px-3 py-2 border cursor-pointer flex justify-between items-center transition-colors ${
                                  selectedBetType === bt.key
                                    ? 'border-accent-gold bg-accent-gold/10'
                                    : 'border-separator hover:border-accent-gold/50'
                                }`}
                              >
                                <span className="font-mono text-xs text-text-primary">{bt.label}</span>
                                <span className="font-heading text-xs text-accent-gold">{bt.odds}x</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="font-mono text-[10px] text-text-secondary uppercase mb-1">
                              Amount (Balance: ${(currentUser?.balance ?? 0).toFixed(2)})
                            </div>
                            <input
                              type="number"
                              placeholder="$0.00"
                              value={betAmount}
                              onChange={e => setBetAmount(e.target.value)}
                              className="w-full bg-bg-secondary border border-accent-gold/40 text-text-primary px-3 py-2 font-mono text-sm focus:border-accent-gold outline-none"
                            />
                            {betAmount && (
                              <div className="font-mono text-[10px] text-accent-gold mt-1">
                                Payout: ${(Number(betAmount) * (BET_TYPES.find(b => b.key === selectedBetType)?.odds ?? 2)).toFixed(2)}
                              </div>
                            )}
                          </div>
                          {betError   && <div className="font-mono text-xs text-red-400 bg-red-900/20 border border-red-500/30 p-2">{betError}</div>}
                          {betSuccess && <div className="font-mono text-xs text-green-400 bg-green-900/20 border border-green-500/30 p-2">{betSuccess}</div>}
                          <Button className="w-full" onClick={handlePlaceBet}>Confirm Bet</Button>
                          <button onClick={() => setSelectedFighter(null)} className="w-full font-mono text-[10px] text-text-secondary hover:text-accent-gold transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <p className="font-mono text-xs text-text-secondary text-center py-4">← Select a fighter to bet</p>
                      )}
                    </div>
                  )}

                  {/* All bets on this tournament */}
                  {allBets.length > 0 && (
                    <div className="bg-bg-tertiary border border-separator p-4">
                      <h3 className="font-heading text-xs uppercase text-accent-gold mb-3 flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5" /> Bets Placed ({allBets.length})
                      </h3>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {allBets.map((bet: any, i: number) => {
                          const betUser = users.find((u: any) => u.identity?.toHexString?.() === bet.userId?.toHexString?.());
                          const betFighter = fighters.find((f: any) => Number(f.id) === Number(bet.fighterId));
                          const isMe = bet.userId?.toHexString?.() === identity;
                          return (
                            <div key={i} className={`flex justify-between items-start py-1.5 border-b border-separator/40 last:border-0 ${isMe ? 'bg-accent-gold/5 -mx-1 px-1' : ''}`}>
                              <div>
                                <div className="font-mono text-xs text-text-primary flex items-center gap-1">
                                  {betUser?.avatarEmoji ?? '👤'} {betUser?.username ?? 'Unknown'}
                                  {isMe && <span className="text-accent-gold text-[9px]">YOU</span>}
                                </div>
                                <div className="font-mono text-[10px] text-text-secondary">
                                  {betFighter?.name ?? `#${bet.fighterId}`} · {(bet.betType ?? '').replace(/_/g, ' ')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-xs text-accent-gold">${Number(bet.amount ?? 0).toFixed(0)}</div>
                                <div className={`font-mono text-[9px] ${bet.status === 'WON' ? 'text-green-400' : bet.status === 'LOST' ? 'text-red-400' : 'text-text-secondary'}`}>
                                  {bet.status}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Event feed */}
                  <div className="bg-bg-tertiary border border-separator p-4">
                    <h3 className="font-heading text-xs uppercase text-accent-gold mb-3">Event Feed</h3>
                    {events.length === 0 ? (
                      <p className="font-mono text-xs text-text-secondary text-center py-3">
                        {isUpcoming ? 'Waiting for tournament to begin...' : 'No events yet.'}
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {events.map((ev: any, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 6 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-start gap-2 pb-1.5 border-b border-separator/40 last:border-0 ${
                              ev.eventType === 'KILL'     ? 'text-red-300'    :
                              ev.eventType === 'ALLIANCE' ? 'text-accent-gold':
                              ev.eventType === 'BETRAYAL' ? 'text-orange-400' :
                              'text-text-primary'
                            }`}
                          >
                            <span className="text-text-secondary font-mono text-[9px] shrink-0 mt-0.5">H{Number(ev.hour ?? 0)}</span>
                            <span className="text-xs">{EVENT_ICONS[ev.eventType] ?? '•'}</span>
                            <span className="font-mono text-[10px] leading-relaxed">{ev.description}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Integrated from betting-overhaul branch ─── */}
              {/* Event Bets Panel */}
              {activeTournament && <EventBetsPanel tournamentId={Number(activeTournament.id)} />}

              {/* Live Event Feed */}
              <div className="bg-bg-secondary border border-separator p-6 mt-6">
                <h3 className="font-heading text-lg text-accent-gold mb-4 uppercase">
                  Live Event Feed
                </h3>
                {filteredEvents.length === 0 ? (
                  <div className="font-mono text-sm text-text-secondary text-center py-4">
                    Waiting for tournament to start...
                  </div>
                ) : (
                  <div className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto">
                    {filteredEvents.map((event: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-start gap-3 p-2 border-b border-separator/50 ${
                          event.eventType === 'KILL'     ? 'text-red-300'    :
                          event.eventType === 'ALLIANCE' ? 'text-accent-gold':
                          event.eventType === 'BETRAYAL' ? 'text-orange-400' :
                          'text-text-primary'
                        }`}
                      >
                        <span className="text-text-secondary text-xs shrink-0">
                          H{Number(event.hour ?? 0)}
                        </span>
                        <span>{EVENT_ICONS[event.eventType] ?? '•'}</span>
                        <span className="text-xs leading-relaxed">{event.description}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              {/* ──────────────────────────────────────────────── */}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TournamentPage() {
  const {
    currentUser, tournaments, fighters, tournamentFighters, arenaTiles,
    bets, liveEvents, tournamentRegistrations, users, identity,
    registerForTournament, unregisterFromTournament, placeBet,
  } = useDB();

  const [filter, setFilter] = useState<'ALL' | 'UPCOMING' | 'LIVE' | 'COMPLETED'>('ALL');

  const sorted = [...tournaments].sort((a, b) => {
    const order: Record<string, number> = { LIVE: 0, UPCOMING: 1, COMPLETED: 2 };
    const oa = order[a.status] ?? 3;
    const ob = order[b.status] ?? 3;
    if (oa !== ob) return oa - ob;
    return Number(b.id) - Number(a.id);
  });

  const filtered = filter === 'ALL' ? sorted : sorted.filter(t => t.status === filter);

  const liveCnt     = tournaments.filter(t => t.status === 'LIVE').length;
  const upcomingCnt = tournaments.filter(t => t.status === 'UPCOMING').length;
  const completedCnt= tournaments.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-4xl text-accent-gold uppercase">Tournament Arena</h1>
            <div className="flex items-center gap-6 font-mono text-xs text-text-secondary">
              {liveCnt > 0 && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />{liveCnt} LIVE
                </span>
              )}
              {upcomingCnt > 0 && <span className="text-yellow-400">{upcomingCnt} UPCOMING</span>}
              <span>{completedCnt} COMPLETED</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 border-b border-separator pb-0">
            {(['ALL', 'LIVE', 'UPCOMING', 'COMPLETED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`font-heading text-xs uppercase px-4 py-2 transition-colors border-b-2 -mb-px ${
                  filter === f
                    ? 'border-accent-gold text-accent-gold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {f === 'ALL' ? `All (${tournaments.length})` :
                 f === 'LIVE' ? `Live (${liveCnt})` :
                 f === 'UPCOMING' ? `Registration Open (${upcomingCnt})` :
                 `Completed (${completedCnt})`}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament list */}
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <Trophy className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-30" />
            <div className="font-display text-3xl text-text-secondary mb-2">
              {filter === 'LIVE' ? 'No live tournaments' : filter === 'UPCOMING' ? 'No open registration' : 'No tournaments yet'}
            </div>
            <div className="font-mono text-sm text-text-secondary">
              The arena orchestrator will announce new tournaments soon.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t, i) => (
              <TournamentCard
                key={Number(t.id)}
                tournament={t}
                fighters={fighters}
                tournamentFighters={tournamentFighters}
                arenaTiles={arenaTiles}
                bets={bets}
                liveEvents={liveEvents}
                registrations={tournamentRegistrations}
                users={users}
                currentUser={currentUser}
                identity={identity}
                registerForTournament={registerForTournament}
                unregisterFromTournament={unregisterFromTournament}
                placeBet={placeBet}
                defaultExpanded={i === 0 && t.status !== 'COMPLETED'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}