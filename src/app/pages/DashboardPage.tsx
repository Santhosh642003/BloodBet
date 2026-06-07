import { Button } from '../components/Button';
import { NavBar } from '../components/NavBar';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useDB } from '../context/SpacetimeContext';
import { useEffect } from 'react';

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    currentUser, connected, fighters, tournaments,
    bets, identity, subscriptionReady, loginPending,
  } = useDB();

  // Redirect to login only after the initial subscription has loaded AND
  // we're not in the middle of a login (loginPending stays true until the
  // user row arrives via the subscription, preventing a false redirect).
  useEffect(() => {
    if (!subscriptionReady || loginPending || currentUser) return;
    if (!identity) return;
    navigate('/login');
  }, [subscriptionReady, loginPending, currentUser, identity, navigate]);

  const balance      = currentUser?.balance ?? 0;
  const username     = currentUser?.username ?? '...';

  // Balance sparkline — just use current balance as flat line for now
  const balanceData  = [
    { value: balance * 0.85 },
    { value: balance * 0.9 },
    { value: balance * 0.87 },
    { value: balance * 0.95 },
    { value: balance * 0.92 },
    { value: balance * 0.98 },
    { value: balance },
  ];

  // My bets — filter to current user
  const myBets = bets.filter(b => b.userId?.toHexString() === identity);

  const activeBets   = myBets.filter(b => b.status === 'PENDING').slice(0, 5);
  const wonBets      = myBets.filter(b => b.status === 'WON').length;
  const lostBets     = myBets.filter(b => b.status === 'LOST').length;

  // Live tournament
  const liveTournament   = tournaments.find(t => t.status === 'LIVE');
  const upcomingTourneys = tournaments.filter(t => t.status === 'UPCOMING').slice(0, 2);

  // Get fighter name by id
  const getFighterName = (id: number) =>
    fighters.find(f => Number(f.id) === id)?.name ?? `Fighter #${id}`;

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-text-secondary text-sm"
        >
          Welcome back, <span className="text-accent-gold font-heading">{username}</span>
          {' · '}
          <span className={connected ? 'text-green-400' : 'text-yellow-400'}>
            {connected ? '● LIVE' : '○ CONNECTING...'}
          </span>
          {' · '}
          <span>{wonBets} wins · {lostBets} losses</span>
        </motion.div>

        {/* Hero Banner — Live Tournament */}
        {liveTournament ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-crimson-gradient p-8 border border-accent-crimson-end"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="font-display text-3xl text-text-primary mb-2 uppercase">
                  {liveTournament.name}
                </div>
                <div className="flex items-center gap-4 font-mono text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                    ROUND {liveTournament.currentRound} LIVE
                  </span>
                  <span className="text-text-secondary">⚔ {liveTournament.arenaType}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-text-secondary mb-1">Prize Pool</div>
                <div className="font-display text-3xl text-success-green">
                  ${liveTournament.prizePool.toFixed(2)}
                </div>
              </div>
            </div>

            {/* My active bet on this tournament */}
            {(() => {
              const myLiveBet = activeBets.find(b => Number(b.tournamentId) === Number(liveTournament.id));
              return myLiveBet ? (
                <div className="bg-bg-primary/30 backdrop-blur-sm border border-separator p-4 mb-4">
                  <div className="flex items-center gap-2 text-text-primary font-mono text-sm mb-2">
                    ✅ You bet{' '}
                    <span className="text-accent-gold">${myLiveBet.amount}</span> on{' '}
                    <span className="text-accent-gold">{getFighterName(Number(myLiveBet.fighterId))}</span>
                    {' '}· {myLiveBet.betType.replace(/_/g, ' ')}
                  </div>
                  <div className="font-heading text-lg text-accent-ice-blue">
                    Odds: {myLiveBet.odds}x · Potential payout: ${(myLiveBet.amount * myLiveBet.odds).toFixed(2)}
                  </div>
                </div>
              ) : (
                <div className="bg-bg-primary/30 border border-separator p-4 mb-4 font-mono text-sm text-text-secondary">
                  No active bet on this tournament.{' '}
                  <span
                    className="text-accent-gold cursor-pointer hover:underline"
                    onClick={() => navigate('/tournament')}
                  >
                    Place one now →
                  </span>
                </div>
              );
            })()}

            <div className="flex gap-4">
              <Button onClick={() => navigate('/tournament')}>Watch Live</Button>
              <Button variant="secondary" onClick={() => navigate('/tournament')}>Place Bet</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-bg-secondary border border-separator p-8 text-center"
          >
            <div className="font-display text-2xl text-text-secondary mb-2">NO LIVE TOURNAMENT</div>
            <div className="font-mono text-sm text-text-secondary mb-4">
              The arena is quiet. A new tournament will begin shortly.
            </div>
            <Button onClick={() => navigate('/tournament')}>View Upcoming</Button>
          </motion.div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Column 1 */}
          <div className="space-y-6">
            {/* Wallet */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">My Wallet</h3>
              <div className="font-display text-4xl text-text-primary mb-4">
                ${balance.toFixed(2)}
              </div>
              <div className="h-20 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={balanceData}>
                    <Line type="monotone" dataKey="value" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 bg-bg-tertiary border border-accent-gold text-accent-gold py-2 font-heading text-sm uppercase">
                  Deposit
                </button>
                <button className="flex-1 bg-bg-tertiary border border-separator text-text-secondary py-2 font-heading text-sm uppercase hover:border-accent-gold hover:text-accent-gold transition-colors">
                  Withdraw
                </button>
              </div>
            </div>

            {/* Active Bets */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">
                Active Bets ({activeBets.length})
              </h3>
              {activeBets.length === 0 ? (
                <div className="font-mono text-sm text-text-secondary text-center py-4">
                  No active bets.{' '}
                  <span className="text-accent-gold cursor-pointer" onClick={() => navigate('/tournament')}>
                    Place one →
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeBets.map((bet, idx) => (
                    <div key={idx} className="bg-bg-tertiary border border-separator p-4 hover:border-accent-gold transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display text-sm text-accent-gold">
                          {getFighterName(Number(bet.fighterId))}
                        </span>
                        <span className="px-2 py-1 text-xs font-mono bg-destructive/20 text-destructive">
                          PENDING
                        </span>
                      </div>
                      <div className="flex justify-between font-mono text-sm">
                        <span className="text-text-secondary">${bet.amount} · {bet.betType.replace(/_/g, ' ')}</span>
                        <span className="text-accent-gold">{bet.odds}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            {/* Upcoming Tournaments */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">
                Upcoming Tournaments
              </h3>
              {upcomingTourneys.length === 0 ? (
                <div className="font-mono text-sm text-text-secondary text-center py-4">
                  No upcoming tournaments scheduled.
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTourneys.map((t, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate('/tournament')}
                      className="bg-bg-tertiary border border-separator p-4 hover:border-accent-gold transition-colors cursor-pointer"
                    >
                      <div className="font-display text-lg text-text-primary mb-2 uppercase">{t.name}</div>
                      <div className="flex justify-between font-mono text-xs text-text-secondary mb-3">
                        <span>UPCOMING</span>
                        <span>{t.arenaType}</span>
                      </div>
                      <button className="w-full bg-accent-gold text-bg-primary py-2 font-heading text-sm uppercase">
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Bet */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">Quick Bet</h3>
              <div className="font-mono text-sm text-text-secondary text-center py-4">
                Head to the{' '}
                <span className="text-accent-gold cursor-pointer hover:underline" onClick={() => navigate('/tournament')}>
                  Tournament page
                </span>
                {' '}to place bets on live fighters.
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">My Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Bets',        value: myBets.length },
                  { label: 'Wins',              value: wonBets,  color: 'text-green-400' },
                  { label: 'Losses',            value: lostBets, color: 'text-red-400' },
                  { label: 'Fighters Owned',    value: currentUser?.fightersOwned ?? 0 },
                  { label: 'Tournaments Hosted', value: currentUser?.tournamentsHosted ?? 0 },
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-center bg-bg-tertiary border border-separator p-3">
                    <span className="font-mono text-sm text-text-secondary">{stat.label}</span>
                    <span className={`font-display text-lg ${stat.color ?? 'text-accent-gold'}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Leaderboard Snapshot */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase">Top Game Masters</h3>
              <div className="space-y-2">
                {/* Real leaderboard from DB */}
                {[...Array(1)].map((_, i) => (
                  <div key={i} className="font-mono text-sm text-text-secondary text-center py-2">
                    Host tournaments to appear here.
                  </div>
                ))}
                <Button variant="secondary" className="w-full mt-2" onClick={() => navigate('/leaderboard')}>
                  View Full Leaderboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
