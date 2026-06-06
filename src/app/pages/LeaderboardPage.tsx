import { useState } from 'react';
import { NavBar } from '../components/NavBar';
import { motion } from 'motion/react';
import { Trophy, Crown, TrendingUp } from 'lucide-react';
import { useDB } from '../context/SpacetimeContext';

const masterStatus = (rank: number) =>
  rank <= 3 ? 'LEGENDARY' : rank <= 7 ? 'ACTIVE' : 'RISING';

const bettorStatus = (rank: number) =>
  rank <= 3 ? 'WHALE' : rank <= 7 ? 'HIGH_ROLLER' : 'RISING';

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'masters' | 'bettors' | 'fighters'>('masters');
  const { users, fighters, bets } = useDB();

  const gameMasters = [...users]
    .filter(u => Number(u.tournamentsHosted ?? 0) > 0)
    .sort((a, b) => Number(b.tournamentsHosted ?? 0) - Number(a.tournamentsHosted ?? 0))
    .slice(0, 12)
    .map((u, idx) => ({
      rank: idx + 1,
      username: u.username,
      tournaments: Number(u.tournamentsHosted ?? 0),
      prizePool: Number(u.balance ?? 0),
      topFighter: fighters.find(f => f.ownerIdentity?.toHexString?.() === u.identity?.toHexString?.())?.name ?? '—',
      status: masterStatus(idx + 1),
      avatar: '👑',
    }));

  const topBettors = [...users]
    .map(u => {
      const userBets = bets.filter(b => b.userId?.toHexString?.() === u.identity?.toHexString?.());
      const totalBets = userBets.reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
      const wins = userBets.filter(b => b.status === 'WON').length;
      const winRate = userBets.length > 0 ? Math.round((wins / userBets.length) * 1000) / 10 : 0;
      return { user: u, totalBets, wins, winRate, betCount: userBets.length };
    })
    .filter(b => b.betCount > 0)
    .sort((a, b) => b.totalBets - a.totalBets)
    .slice(0, 10)
    .map((b, idx) => ({
      rank: idx + 1,
      username: b.user.username,
      totalBets: b.totalBets,
      wins: b.wins,
      winRate: b.winRate,
      roi: b.totalBets > 0 ? Math.round(((b.wins * 100 - b.totalBets) / b.totalBets) * 100) : 0,
      status: bettorStatus(idx + 1),
    }));

  const topFighters = [...fighters]
    .sort((a, b) => Number(b.wins ?? 0) - Number(a.wins ?? 0))
    .slice(0, 10)
    .map((f, idx) => {
      const tournaments = Number(f.tournamentsPlayed ?? 0);
      const wins = Number(f.wins ?? 0);
      return {
        rank: idx + 1,
        name: f.name,
        tournaments,
        wins,
        winRate: tournaments > 0 ? Math.round((wins / tournaments) * 1000) / 10 : 0,
        kills: wins * 7,
        earnings: wins * 100000,
      };
    });

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 1 }}
          >
            <h1 className="text-6xl md:text-8xl mb-4">HALL OF LEGENDS</h1>
          </motion.div>
          <p className="font-serif italic text-2xl text-text-primary">
            "Only the greatest are remembered"
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-8 mb-12 border-b border-separator">
          <button
            onClick={() => setActiveTab('masters')}
            className={`font-heading uppercase text-lg pb-4 transition-all ${
              activeTab === 'masters'
                ? 'text-accent-gold border-b-2 border-accent-gold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Top Game Masters
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bettors')}
            className={`font-heading uppercase text-lg pb-4 transition-all ${
              activeTab === 'bettors'
                ? 'text-accent-gold border-b-2 border-accent-gold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Bettors
            </div>
          </button>
          <button
            onClick={() => setActiveTab('fighters')}
            className={`font-heading uppercase text-lg pb-4 transition-all ${
              activeTab === 'fighters'
                ? 'text-accent-gold border-b-2 border-accent-gold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Top Fighters
            </div>
          </button>
        </div>

        {/* Top 3 Podium */}
        {activeTab === 'masters' && gameMasters.length >= 3 && (
          <>
            <div className="grid grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
              {/* Rank 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="pt-12"
              >
                <div className="bg-bg-secondary border border-accent-gold inner-glow p-6 text-center">
                  <div className="text-6xl mb-4">{gameMasters[1].avatar}</div>
                  <div className="w-12 h-12 bg-gradient-to-br from-text-secondary to-text-primary flex items-center justify-center mx-auto mb-3">
                    <span className="font-display text-2xl text-bg-primary">2</span>
                  </div>
                  <h3 className="font-display text-2xl text-accent-gold mb-2">
                    {gameMasters[1].username}
                  </h3>
                  <div className="font-mono text-sm text-text-secondary mb-2">
                    {gameMasters[1].tournaments} tournaments
                  </div>
                  <div className="font-heading text-lg text-success-green">
                    ${(gameMasters[1].prizePool / 1000000).toFixed(1)}M
                  </div>
                </div>
              </motion.div>

              {/* Rank 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
              >
                <div className="bg-bg-secondary border-2 border-accent-gold inner-glow p-6 text-center relative glow-gold">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <Crown className="w-12 h-12 text-accent-gold" />
                  </div>
                  <div className="text-7xl mb-4 mt-4">{gameMasters[0].avatar}</div>
                  <div className="w-16 h-16 bg-gradient-to-br from-accent-gold to-accent-crimson-end flex items-center justify-center mx-auto mb-3">
                    <span className="font-display text-3xl text-bg-primary">1</span>
                  </div>
                  <h3 className="font-display text-3xl text-accent-gold mb-2">
                    {gameMasters[0].username}
                  </h3>
                  <div className="font-mono text-sm text-text-secondary mb-2">
                    {gameMasters[0].tournaments} tournaments
                  </div>
                  <div className="font-heading text-2xl text-success-green">
                    ${(gameMasters[0].prizePool / 1000000).toFixed(1)}M
                  </div>
                </div>
              </motion.div>

              {/* Rank 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="pt-16"
              >
                <div className="bg-bg-secondary border border-accent-gold inner-glow p-6 text-center">
                  <div className="text-6xl mb-4">{gameMasters[2].avatar}</div>
                  <div className="w-12 h-12 bg-gradient-to-br from-accent-crimson-start to-bg-tertiary flex items-center justify-center mx-auto mb-3">
                    <span className="font-display text-2xl text-text-primary">3</span>
                  </div>
                  <h3 className="font-display text-2xl text-accent-gold mb-2">
                    {gameMasters[2].username}
                  </h3>
                  <div className="font-mono text-sm text-text-secondary mb-2">
                    {gameMasters[2].tournaments} tournaments
                  </div>
                  <div className="font-heading text-lg text-success-green">
                    ${(gameMasters[2].prizePool / 1000000).toFixed(1)}M
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Full Leaderboard Table */}
        <div className="bg-bg-secondary border border-separator inner-glow">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-6 border-b border-separator font-heading uppercase text-xs text-accent-gold">
            <div className="col-span-1">Rank</div>
            <div className="col-span-3">
              {activeTab === 'masters' && 'Game Master'}
              {activeTab === 'bettors' && 'Bettor'}
              {activeTab === 'fighters' && 'Fighter'}
            </div>
            <div className="col-span-2">
              {activeTab === 'masters' && 'Tournaments'}
              {activeTab === 'bettors' && 'Total Bets'}
              {activeTab === 'fighters' && 'Tournaments'}
            </div>
            <div className="col-span-2">
              {activeTab === 'masters' && 'Prize Pool'}
              {activeTab === 'bettors' && 'Win Rate'}
              {activeTab === 'fighters' && 'Wins'}
            </div>
            <div className="col-span-2">
              {activeTab === 'masters' && 'Top Fighter'}
              {activeTab === 'bettors' && 'ROI'}
              {activeTab === 'fighters' && 'Kills'}
            </div>
            <div className="col-span-2">Status</div>
          </div>

          {/* Table Body - Game Masters */}
          {activeTab === 'masters' && (
            <div>
              {gameMasters.map((master, idx) => (
                <motion.div
                  key={master.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="grid grid-cols-12 gap-4 p-6 border-b border-separator hover:bg-bg-tertiary transition-colors items-center"
                >
                  <div className="col-span-1">
                    <div
                      className={`w-10 h-10 border flex items-center justify-center font-display text-lg ${
                        master.rank <= 3
                          ? 'border-accent-gold text-accent-gold'
                          : 'border-separator text-text-secondary'
                      }`}
                    >
                      {master.rank}
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center gap-3">
                    <span className="text-3xl">{master.avatar}</span>
                    <span className="font-heading text-lg text-text-primary">
                      {master.username}
                    </span>
                  </div>
                  <div className="col-span-2 font-mono text-text-primary">
                    {master.tournaments}
                  </div>
                  <div className="col-span-2 font-heading text-lg text-success-green">
                    ${(master.prizePool / 1000000).toFixed(2)}M
                  </div>
                  <div className="col-span-2 font-mono text-sm text-accent-gold">
                    {master.topFighter}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`px-3 py-1 text-xs font-heading uppercase ${
                        master.status === 'LEGENDARY'
                          ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold'
                          : master.status === 'ACTIVE'
                          ? 'bg-accent-ice-blue/20 text-accent-ice-blue border border-accent-ice-blue'
                          : 'bg-success-green/20 text-success-green border border-success-green'
                      }`}
                    >
                      {master.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Table Body - Bettors */}
          {activeTab === 'bettors' && (
            <div>
              {topBettors.map((bettor, idx) => (
                <motion.div
                  key={bettor.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="grid grid-cols-12 gap-4 p-6 border-b border-separator hover:bg-bg-tertiary transition-colors items-center"
                >
                  <div className="col-span-1">
                    <div
                      className={`w-10 h-10 border flex items-center justify-center font-display text-lg ${
                        bettor.rank <= 3
                          ? 'border-accent-gold text-accent-gold'
                          : 'border-separator text-text-secondary'
                      }`}
                    >
                      {bettor.rank}
                    </div>
                  </div>
                  <div className="col-span-3 font-heading text-lg text-text-primary">
                    {bettor.username}
                  </div>
                  <div className="col-span-2 font-heading text-lg text-success-green">
                    ${bettor.totalBets.toLocaleString()}
                  </div>
                  <div className="col-span-2 font-mono text-text-primary">
                    {bettor.winRate}%
                  </div>
                  <div className="col-span-2 font-heading text-lg text-accent-gold">
                    +{bettor.roi}%
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`px-3 py-1 text-xs font-heading uppercase ${
                        bettor.status === 'WHALE'
                          ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold'
                          : bettor.status === 'HIGH_ROLLER'
                          ? 'bg-accent-ice-blue/20 text-accent-ice-blue border border-accent-ice-blue'
                          : 'bg-success-green/20 text-success-green border border-success-green'
                      }`}
                    >
                      {bettor.status.replace('_', ' ')}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Table Body - Fighters */}
          {activeTab === 'fighters' && (
            <div>
              {topFighters.map((fighter, idx) => (
                <motion.div
                  key={fighter.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="grid grid-cols-12 gap-4 p-6 border-b border-separator hover:bg-bg-tertiary transition-colors items-center"
                >
                  <div className="col-span-1">
                    <div
                      className={`w-10 h-10 border flex items-center justify-center font-display text-lg ${
                        fighter.rank <= 3
                          ? 'border-accent-gold text-accent-gold'
                          : 'border-separator text-text-secondary'
                      }`}
                    >
                      {fighter.rank}
                    </div>
                  </div>
                  <div className="col-span-3 font-display text-lg text-accent-gold">
                    {fighter.name}
                  </div>
                  <div className="col-span-2 font-mono text-text-primary">
                    {fighter.tournaments}
                  </div>
                  <div className="col-span-2 font-heading text-lg text-success-green">
                    {fighter.wins}
                  </div>
                  <div className="col-span-2 font-mono text-text-primary">
                    {fighter.kills}
                  </div>
                  <div className="col-span-2 font-heading text-accent-gold">
                    ${(fighter.earnings / 1000).toFixed(0)}K
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
