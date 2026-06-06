import { useState } from 'react';
import { CharacterCard } from '../components/CharacterCard';
import { Button } from '../components/Button';
import { NavBar } from '../components/NavBar';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Sword, Users, Zap, Eye, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDB } from '../context/SpacetimeContext';

const BET_TYPES = [
  { key: 'WIN',              label: 'Wins Tournament',    odds: 12.4 },
  { key: 'SURVIVES_ROUND_1', label: 'Survives Round 1',   odds: 1.4  },
  { key: 'DIES_FIRST',       label: 'Dies First',          odds: 22.0 },
  { key: 'KILLS_3_PLUS',     label: 'Kills 3+ Opponents', odds: 5.0  },
  { key: 'FORMS_ALLIANCE',   label: 'Forms Alliance',      odds: 2.1  },
];

const EVENT_ICONS: Record<string, string> = {
  KILL:     '⚔️',
  ALLIANCE: '🤝',
  BETRAYAL: '🗡️',
  FLEE:     '💨',
  TRAP:     '⚠️',
};

export function TournamentPage() {
  const navigate   = useNavigate();
  const {
    currentUser, tournaments, fighters, bets, liveEvents,
    placeBet, identity,
  } = useDB();

  const [selectedFighterId, setSelectedFighterId] = useState<number | null>(null);
  const [selectedBetType,   setSelectedBetType]   = useState<string>('WIN');
  const [betAmount,         setBetAmount]          = useState('');
  const [betError,          setBetError]           = useState('');
  const [betSuccess,        setBetSuccess]         = useState('');

  // Active tournament — prefer LIVE, fall back to UPCOMING
  const liveTournament     = tournaments.find(t => t.status === 'LIVE');
  const upcomingTournament = tournaments.find(t => t.status === 'UPCOMING');
  const activeTournament   = liveTournament ?? upcomingTournament;

  // Fighters in this tournament
  const tournamentFighterIds = activeTournament
    ? fighters.map(f => Number(f.id)) // all fighters visible; server picks 20
    : [];

  // For live: only show fighters that are in the tournament
  // For now show all 50 in lobby, filtered when live
  const displayFighters = activeTournament?.status === 'LIVE'
    ? fighters.slice(0, 20)
    : fighters;

  // Live events for active tournament
  const filteredEvents  = liveEvents
    .filter(e => activeTournament && Number(e.tournamentId) === Number(activeTournament.id))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 20);

  // My bets on this tournament
  const myTournamentBets = bets.filter(b =>
    activeTournament && Number(b.tournamentId) === Number(activeTournament.id) &&
    b.userId?.toHexString() === identity
  );

  const selectedFighter = selectedFighterId !== null
    ? fighters.find(f => Number(f.id) === selectedFighterId) ?? null
    : null;

  const handlePlaceBet = () => {
    setBetError('');
    setBetSuccess('');

    if (!activeTournament) { setBetError('No active tournament.'); return; }
    if (!currentUser)       { setBetError('You must be logged in.'); return; }
    if (!selectedFighter)   { setBetError('Select a fighter first.'); return; }
    if (!betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0) {
      setBetError('Enter a valid amount.'); return;
    }
    if (Number(betAmount) > currentUser.balance) {
      setBetError(`Insufficient funds. Balance: $${currentUser.balance.toFixed(2)}`); return;
    }
    if (activeTournament.status !== 'UPCOMING') {
      setBetError('Betting is only open for upcoming tournaments.'); return;
    }

    placeBet(
      Number(activeTournament.id),
      Number(selectedFighter.id),
      selectedBetType,
      Number(betAmount)
    );

    const odds = BET_TYPES.find(b => b.key === selectedBetType)?.odds ?? 2;
    setBetSuccess(`Bet placed! $${betAmount} on ${selectedFighter.name} · ${selectedBetType.replace(/_/g, ' ')} · Potential: $${(Number(betAmount) * odds).toFixed(2)}`);
    setBetAmount('');
    setTimeout(() => {
      setSelectedFighterId(null);
      setBetSuccess('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Tournament Header */}
        {activeTournament ? (
          <div className="mb-8 border-b border-separator pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-5xl mb-2 uppercase">{activeTournament.name || 'TOURNAMENT'}</h1>
                <div className="font-heading text-lg text-text-secondary uppercase">
                  {activeTournament.arenaType}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="font-mono text-text-secondary text-xs uppercase mb-1">Round</div>
                  <div className="font-display text-3xl text-accent-gold">
                    {activeTournament.currentRound} / {activeTournament.totalRounds}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-text-secondary text-xs uppercase mb-1">Prize Pool</div>
                  <div className="font-display text-3xl text-success-green">
                    ${Number(activeTournament.prizePool ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-8 bg-bg-secondary border border-accent-crimson-end p-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  activeTournament.status === 'LIVE' ? 'bg-destructive' : 'bg-yellow-500'
                }`} />
                <span className="font-heading text-lg text-text-primary">
                  {activeTournament.status === 'LIVE'
                    ? `ROUND ${activeTournament.currentRound} LIVE`
                    : activeTournament.status === 'UPCOMING'
                    ? 'BETTING OPEN — STARTS SOON'
                    : 'TOURNAMENT COMPLETE'}
                </span>
              </div>
              {activeTournament.status === 'UPCOMING' && (
                <div className="font-mono text-sm text-accent-gold">
                  ✅ Betting is open — select a fighter below
                </div>
              )}
              {myTournamentBets.length > 0 && (
                <div className="font-mono text-sm text-text-secondary">
                  Your bets: {myTournamentBets.length}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8 text-center py-16">
            <div className="font-display text-4xl text-text-secondary mb-4">NO ACTIVE TOURNAMENT</div>
            <div className="font-mono text-text-secondary">The orchestrator will create one shortly.</div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
          {/* Fighter Grid */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-accent-gold uppercase">
                {activeTournament?.status === 'LIVE' ? 'Arena Fighters' : 'Fighter Roster — Select to Bet'}
              </h2>
              <div className="font-mono text-sm text-text-secondary">
                {displayFighters.length} fighters
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
              {displayFighters.map((fighter, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedFighterId(Number(fighter.id));
                    setBetError('');
                    setBetSuccess('');
                  }}
                  className={`cursor-pointer transition-all ${
                    selectedFighterId === Number(fighter.id)
                      ? 'ring-2 ring-accent-gold'
                      : 'hover:ring-1 hover:ring-accent-gold/50'
                  }`}
                >
                  <CharacterCard
                    name={fighter.name}
                    archetype={fighter.archetype}
                    role={fighter.archetype}
                    stats={{
                      str:  fighter.strength,
                      spd:  fighter.speed,
                      int:  fighter.intelligence,
                      luck: fighter.luck,
                    }}
                    survivalOdds={70}
                    winOdds={`${(12.4 / (fighter.wins + 1)).toFixed(1)}x`}
                    winRate={fighter.tournamentsPlayed > 0
                      ? Math.round((fighter.wins / fighter.tournamentsPlayed) * 100)
                      : 0}
                    onClick={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar — Bet Panel + Event Feed */}
          <div className="space-y-6">
            {/* Bet Panel */}
            {activeTournament?.status === 'UPCOMING' && (
              <div className="bg-bg-secondary border border-accent-gold inner-glow p-6 sticky top-24">
                <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">Place Bet</h3>

                {selectedFighter ? (
                  <div className="space-y-4">
                    {/* Selected fighter */}
                    <div className="bg-bg-tertiary border border-accent-gold p-4">
                      <div className="font-display text-lg text-accent-gold">{selectedFighter.name}</div>
                      <div className="font-mono text-xs text-text-secondary">{selectedFighter.archetype}</div>
                      <div className="flex gap-4 mt-2 font-mono text-xs text-text-secondary">
                        <span>STR {selectedFighter.strength}</span>
                        <span>SPD {selectedFighter.speed}</span>
                        <span>INT {selectedFighter.intelligence}</span>
                        <span>LCK {selectedFighter.luck}</span>
                      </div>
                    </div>

                    {/* Bet type */}
                    <div>
                      <div className="font-mono text-xs text-text-secondary uppercase mb-2">Bet Type</div>
                      <div className="space-y-2">
                        {BET_TYPES.map(bt => (
                          <div
                            key={bt.key}
                            onClick={() => setSelectedBetType(bt.key)}
                            className={`p-3 border cursor-pointer flex justify-between items-center transition-colors ${
                              selectedBetType === bt.key
                                ? 'border-accent-gold bg-accent-gold/10'
                                : 'border-separator hover:border-accent-gold'
                            }`}
                          >
                            <span className="font-mono text-sm text-text-primary">{bt.label}</span>
                            <span className="font-heading text-accent-gold">{bt.odds}x</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <div className="font-mono text-xs text-text-secondary uppercase mb-2">
                        Amount (Balance: ${currentUser?.balance.toFixed(2) ?? '0.00'})
                      </div>
                      <input
                        type="number"
                        placeholder="$0.00"
                        value={betAmount}
                        onChange={e => setBetAmount(e.target.value)}
                        className="w-full bg-bg-tertiary border border-accent-gold text-text-primary px-4 py-3 font-mono"
                      />
                      {betAmount && (
                        <div className="font-mono text-xs text-accent-gold mt-1">
                          Potential payout: ${(Number(betAmount) * (BET_TYPES.find(b => b.key === selectedBetType)?.odds ?? 2)).toFixed(2)}
                        </div>
                      )}
                    </div>

                    {betError   && <div className="font-mono text-xs text-red-400 bg-red-900/20 border border-red-500/30 p-3">{betError}</div>}
                    {betSuccess && <div className="font-mono text-xs text-green-400 bg-green-900/20 border border-green-500/30 p-3">{betSuccess}</div>}

                    <Button className="w-full" onClick={handlePlaceBet}>
                      CONFIRM BET
                    </Button>
                    <button
                      onClick={() => setSelectedFighterId(null)}
                      className="w-full font-mono text-xs text-text-secondary hover:text-accent-gold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="font-mono text-sm text-text-secondary text-center py-8">
                    ← Select a fighter to place a bet
                  </div>
                )}
              </div>
            )}

            {/* My Bets on this tournament */}
            {myTournamentBets.length > 0 && (
              <div className="bg-bg-secondary border border-separator p-6">
                <h3 className="font-heading text-lg text-accent-gold mb-3 uppercase">My Bets</h3>
                <div className="space-y-2">
                  {myTournamentBets.map((bet, i) => (
                    <div key={i} className="bg-bg-tertiary border border-separator p-3 font-mono text-sm">
                      <div className="flex justify-between">
                        <span className="text-accent-gold">
                          {fighters.find(f => String(f.id) === String(bet.fighterId))?.name ?? `Fighter #${bet.fighterId}`}
                        </span>
                        <span className={
                          bet.status === 'WON'  ? 'text-green-400' :
                          bet.status === 'LOST' ? 'text-red-400'   : 'text-yellow-400'
                        }>
                          {bet.status}
                        </span>
                      </div>
                      <div className="text-text-secondary text-xs mt-1">
                        ${Number(bet.amount ?? 0).toFixed(2)} · {bet.betType.replace(/_/g, ' ')} · {Number(bet.odds ?? 0).toFixed(1)}x
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Event Feed */}
            <div className="bg-bg-secondary border border-separator p-6">
              <h3 className="font-heading text-lg text-accent-gold mb-4 uppercase">
                Live Event Feed
              </h3>
              {liveEvents.length === 0 ? (
                <div className="font-mono text-sm text-text-secondary text-center py-4">
                  Waiting for tournament to start...
                </div>
              ) : (
                <div className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto">
                  {liveEvents.map((event, i) => (
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
                        R{event.round}
                      </span>
                      <span>{EVENT_ICONS[event.eventType] ?? '•'}</span>
                      <span className="text-xs leading-relaxed">{event.description}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
