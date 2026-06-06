import { useState } from 'react';
import { Button } from '../components/Button';
import { NavBar } from '../components/NavBar';
import { TrendingUp, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { useDB } from '../context/SpacetimeContext';

export function ContractsPage() {
  const { fighters, contracts, auctionBids, currentUser, identity, placeBid } = useDB();
  const [selectedFighter, setSelectedFighter] = useState<number | null>(null);
  const [bidAmount, setBidAmount] = useState('');

  const fighterById = (id: number) => fighters.find(f => Number(f.id) === id);

  const myContracts = contracts
    .filter(c => c.userId?.toHexString?.() === identity)
    .map(c => {
      const fighter = fighterById(Number(c.fighterId));
      const totalTournaments = 3;
      const tournamentsRemaining = Number(c.tournamentsRemaining ?? 0);
      const earned = Number(c.totalEarned ?? 0);
      return {
        id: Number(c.id),
        fighterName: fighter?.name ?? `Fighter #${c.fighterId}`,
        tournamentsRemaining,
        totalTournaments,
        earned,
      };
    });

  const contractedFighterIds = new Set(contracts.map(c => Number(c.fighterId)));

  const auctionListings = fighters
    .filter(f => !contractedFighterIds.has(Number(f.id)))
    .map(fighter => {
      const fighterId = Number(fighter.id);
      const bidsForFighter = auctionBids.filter(b => Number(b.fighterId) === fighterId);
      const currentBid = bidsForFighter.reduce((max, b) => Math.max(max, Number(b.amount ?? 0)), 0);
      const tournaments = Number(fighter.tournamentsPlayed ?? 0);
      const wins = Number(fighter.wins ?? 0);
      const survivalRate = tournaments > 0 ? Math.round((wins / tournaments) * 100) : 0;
      return {
        id: fighterId,
        fighter: fighter.name,
        tournaments,
        wins,
        survivalRate,
        currentBid,
        bidders: new Set(bidsForFighter.map(b => b.bidderId?.toHexString?.())).size,
      };
    });

  const handlePlaceBid = (fighterId: number) => {
    setSelectedFighter(fighterId);
  };

  const confirmBid = (fighterId: number) => {
    const amount = Number(bidAmount);
    if (!amount || amount <= 0) return;
    placeBid(fighterId, amount);
    setBidAmount('');
    setSelectedFighter(null);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-6xl md:text-8xl mb-4">CONTRACT AUCTION</h1>
          <p className="font-serif italic text-2xl text-text-primary max-w-3xl mx-auto">
            "Own a fighter. Share their glory."
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-bg-secondary border border-accent-gold inner-glow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="font-display text-3xl text-accent-gold mb-2">3</div>
              <div className="font-mono text-xs text-text-secondary uppercase">
                Tournament Contract Length
              </div>
            </div>
            <div>
              <div className="font-display text-3xl text-accent-gold mb-2">100%</div>
              <div className="font-mono text-xs text-text-secondary uppercase">
                Revenue Share of Winnings
              </div>
            </div>
            <div>
              <div className="font-display text-3xl text-accent-gold mb-2">48H</div>
              <div className="font-mono text-xs text-text-secondary uppercase">
                Maximum Auction Duration
              </div>
            </div>
          </div>
        </div>

        {/* My Contracts Section */}
        {myContracts.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display text-4xl text-accent-gold mb-6 uppercase">My Contracts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myContracts.map((contract, idx) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-bg-secondary border border-accent-gold inner-glow p-6"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-display text-2xl text-accent-gold mb-2">
                        {contract.fighterName}
                      </h3>
                      <div className="font-mono text-sm text-text-secondary">
                        {contract.tournamentsRemaining} of {contract.totalTournaments} tournaments remaining
                      </div>
                    </div>
                    <div className="w-16 h-16 bg-bg-tertiary border border-accent-gold flex items-center justify-center">
                      <span className="text-2xl">⚔️</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between font-mono text-xs text-text-secondary mb-2">
                      <span>Contract Progress</span>
                      <span>{contract.totalTournaments - contract.tournamentsRemaining}/{contract.totalTournaments}</span>
                    </div>
                    <div className="h-2 bg-bg-tertiary">
                      <div
                        className="h-full bg-gradient-to-r from-accent-gold to-success-green transition-all duration-500"
                        style={{ width: `${((contract.totalTournaments - contract.tournamentsRemaining) / contract.totalTournaments) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="bg-bg-tertiary border border-separator p-3 text-center">
                    <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                      Total Earned
                    </div>
                    <div className="font-heading text-xl text-success-green">
                      ${contract.earned.toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Auction Listings */}
        <div>
          <h2 className="font-display text-4xl text-accent-gold mb-6 uppercase">Active Auctions</h2>
          {auctionListings.length === 0 ? (
            <div className="font-mono text-sm text-text-secondary text-center py-12">
              No fighters currently up for auction.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {auctionListings.map((listing, idx) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-bg-secondary border border-separator inner-glow p-6 hover:border-accent-gold transition-all group"
                >
                  {/* Fighter avatar */}
                  <div className="w-full aspect-square bg-bg-tertiary mb-4 flex items-center justify-center">
                    <div className="text-6xl text-accent-gold opacity-20 group-hover:opacity-40 transition-opacity">
                      ⚔️
                    </div>
                  </div>

                  {/* Fighter name */}
                  <h3 className="font-display text-xl text-accent-gold mb-3">{listing.fighter}</h3>

                  {/* Career stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-xs">
                    <div>
                      <div className="text-text-secondary">Tournaments</div>
                      <div className="text-text-primary font-heading text-lg">{listing.tournaments}</div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Wins</div>
                      <div className="text-success-green font-heading text-lg">{listing.wins}</div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Survival</div>
                      <div className="text-accent-ice-blue font-heading text-lg">{listing.survivalRate}%</div>
                    </div>
                  </div>

                  {/* Current bid */}
                  <div className="bg-bg-tertiary border border-accent-gold p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-xs text-text-secondary uppercase">Current Bid</span>
                      <span className="font-mono text-xs text-text-secondary">{listing.bidders} bidders</span>
                    </div>
                    <div className="font-display text-3xl text-accent-gold">
                      ${listing.currentBid.toLocaleString()}
                    </div>
                  </div>

                  {/* Contract terms */}
                  <div className="bg-bg-primary/50 border border-separator p-3 mb-4 text-center">
                    <div className="font-mono text-xs text-accent-gold uppercase mb-1">Contract Terms</div>
                    <div className="font-mono text-xs text-text-secondary">
                      3 Tournaments · 100% Revenue Share
                    </div>
                  </div>

                  {/* Bid section */}
                  {selectedFighter === listing.id ? (
                    <div className="space-y-3">
                      <div className="font-mono text-xs text-text-secondary">
                        Balance: ${Number(currentUser?.balance ?? 0).toFixed(2)}
                      </div>
                      <input
                        type="number"
                        placeholder={`Min. $${listing.currentBid + 50}`}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="w-full bg-bg-tertiary border border-accent-gold text-text-primary px-4 py-2 font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 !py-2 !text-sm"
                          onClick={() => confirmBid(listing.id)}
                        >
                          Confirm Bid
                        </Button>
                        <button
                          onClick={() => { setSelectedFighter(null); setBidAmount(''); }}
                          className="px-4 border border-separator text-text-secondary hover:text-text-primary hover:border-accent-gold transition-colors font-heading text-sm uppercase"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full !py-2 !text-sm"
                      onClick={() => handlePlaceBid(listing.id)}
                    >
                      Place Bid
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* How Contracts Work */}
        <div className="mt-16 bg-gradient-to-br from-bg-secondary to-bg-tertiary border border-separator p-8">
          <h3 className="font-display text-3xl text-accent-gold mb-6 text-center uppercase">
            How Contracts Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-accent-gold flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-accent-gold" />
              </div>
              <h4 className="font-heading text-lg text-accent-gold mb-2 uppercase">Win the Auction</h4>
              <p className="font-mono text-sm text-text-secondary">
                Place the highest bid before time expires to secure the contract
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-accent-gold flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-accent-gold" />
              </div>
              <h4 className="font-heading text-lg text-accent-gold mb-2 uppercase">Fighter Competes</h4>
              <p className="font-mono text-sm text-text-secondary">
                Your fighter participates in 3 tournaments automatically
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-accent-gold flex items-center justify-center mx-auto mb-4">
                <span className="font-display text-2xl text-accent-gold">$</span>
              </div>
              <h4 className="font-heading text-lg text-accent-gold mb-2 uppercase">Earn Revenue</h4>
              <p className="font-mono text-sm text-text-secondary">
                Receive 100% of all prize winnings your fighter earns
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
