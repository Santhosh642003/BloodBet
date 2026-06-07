import { useState } from 'react';
import { useDB } from '../context/SpacetimeContext';
import { Button } from './Button';
import { motion, AnimatePresence } from 'motion/react';

export function EventBetsPanel({ tournamentId }: { tournamentId: number }) {
  const {
    currentUser, fighters,
    eventBetSlips, eventBetPositions,
    createEventBetSlip, joinEventBetSlip
  } = useDB();

  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Sort and display state
  const [sortBy, setSortBy] = useState<'newest' | 'highest_pool'>('newest');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);

  // Form State
  const [fighter1Id, setFighter1Id] = useState<string>('');
  const [action, setAction] = useState<string>('KILLS');
  const [fighter2Id, setFighter2Id] = useState<string>('0'); // 0 means 'Any'
  const [rounds, setRounds] = useState<string>('3');
  const [amount, setAmount] = useState<string>('5');
  const [side, setSide] = useState<string>('FOR');
  const [error, setError] = useState('');
  
  // Track join amounts per slip id
  const [joinAmounts, setJoinAmounts] = useState<Record<number, string>>({});

  const activeSlipsUnsorted = eventBetSlips.filter(
    (s: any) => Number(s.tournamentId) === tournamentId && s.status === 'OPEN'
  );

  const activeSlipsWithPool = activeSlipsUnsorted.map((slip: any) => {
    const positions = eventBetPositions.filter(p => Number(p.slipId) === Number(slip.id));
    let poolFor = 0;
    let poolAgainst = 0;
    positions.forEach(p => {
      if (p.side === 'FOR') poolFor += Number(p.amount);
      else poolAgainst += Number(p.amount);
    });
    return { ...slip, totalPool: poolFor + poolAgainst, poolFor, poolAgainst, positions };
  });

  const activeSlips = activeSlipsWithPool.sort((a: any, b: any) => {
    let diff = 0;
    if (sortBy === 'newest') {
      diff = Number(b.id) - Number(a.id);
    } else {
      diff = b.totalPool - a.totalPool;
    }
    return sortDirection === 'asc' ? -diff : diff;
  });

  const displayedSlips = showAll ? activeSlips : activeSlips.slice(0, 5);

  const handleCreate = () => {
    setError('');
    const amt = Number(amount);
    if (!fighter1Id) { setError('Select Character 1'); return; }
    if (isNaN(amt) || amt < 5) { setError('Minimum bet is $5'); return; }
    if (!currentUser || currentUser.balance < amt) { setError('Insufficient funds'); return; }

    createEventBetSlip(
      tournamentId,
      Number(fighter1Id),
      action,
      Number(fighter2Id),
      Number(rounds),
      side,
      amt
    );
    setShowCreateForm(false);
  };

  const handleJoin = (slipId: number, joinSide: string, joinAmount: number) => {
    if (!currentUser || currentUser.balance < joinAmount) {
      alert('Insufficient funds');
      return;
    }
    joinEventBetSlip(slipId, joinSide, joinAmount);
  };

  const renderSlip = (slip: any) => {
    const f1 = fighters.find(f => Number(f.id) === Number(slip.fighter1Id))?.name || 'Unknown';
    const f2 = Number(slip.fighter2Id) === 0 ? 'Anyone' : fighters.find(f => Number(f.id) === Number(slip.fighter2Id))?.name || 'Unknown';
    
    const oddsFor = slip.poolFor > 0 ? (slip.totalPool / slip.poolFor).toFixed(2) : '1.00';
    const oddsAgainst = slip.poolAgainst > 0 ? (slip.totalPool / slip.poolAgainst).toFixed(2) : '1.00';

    return (
      <div key={Number(slip.id)} className="bg-bg-tertiary border border-separator p-4">
        <div className="font-heading text-md text-text-primary mb-2 uppercase">
          {f1} <span className="text-accent-gold">{slip.action}</span> {f2} <span className="text-text-secondary text-sm">in {slip.roundsDuration} hours</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* FOR side */}
          <div className="border border-green-500/30 bg-green-900/10 p-3 flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-green-400 uppercase mb-1">FOR</div>
              <div className="font-display text-lg text-text-primary">${slip.poolFor.toFixed(2)}</div>
              <div className="font-mono text-xs text-text-secondary">Payout: {oddsFor}x</div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-sm">$</span>
                <input
                  type="number"
                  min="5"
                  className="w-full bg-bg-primary border border-separator p-1 text-sm font-mono"
                  value={joinAmounts[Number(slip.id)] ?? '5'}
                  onChange={(e) => setJoinAmounts(prev => ({ ...prev, [Number(slip.id)]: e.target.value }))}
                />
              </div>
              <Button size="sm" onClick={() => handleJoin(Number(slip.id), 'FOR', Number(joinAmounts[Number(slip.id)] ?? 5))}>Place Bet</Button>
            </div>
          </div>

          {/* AGAINST side */}
          <div className="border border-red-500/30 bg-red-900/10 p-3 flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-red-400 uppercase mb-1">AGAINST</div>
              <div className="font-display text-lg text-text-primary">${slip.poolAgainst.toFixed(2)}</div>
              <div className="font-mono text-xs text-text-secondary">Payout: {oddsAgainst}x</div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-sm">$</span>
                <input
                  type="number"
                  min="5"
                  className="w-full bg-bg-primary border border-separator p-1 text-sm font-mono"
                  value={joinAmounts[Number(slip.id)] ?? '5'}
                  onChange={(e) => setJoinAmounts(prev => ({ ...prev, [Number(slip.id)]: e.target.value }))}
                />
              </div>
              <Button size="sm" onClick={() => handleJoin(Number(slip.id), 'AGAINST', Number(joinAmounts[Number(slip.id)] ?? 5))}>Place Bet</Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-bg-secondary border border-separator p-6 mt-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <h3 className="font-heading text-lg text-accent-gold uppercase">Event Bets</h3>
        <button
          className="bg-accent-gold text-black font-heading uppercase tracking-wider px-6 py-2 transition-all hover:brightness-110 hover:shadow-[0_0_15px_rgba(255,215,0,0.5)] cursor-crosshair border border-accent-gold whitespace-nowrap"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : 'Create Event Bet'}
        </button>
      </div>

      {showCreateForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 border border-accent-gold bg-bg-tertiary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase mb-1">Character 1</label>
              <select className="w-full bg-bg-primary border border-separator p-2 font-mono text-sm" value={fighter1Id} onChange={e => setFighter1Id(e.target.value)}>
                <option value="">Select Fighter...</option>
                {fighters.map(f => <option key={Number(f.id)} value={Number(f.id)}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase mb-1">Action</label>
              <select className="w-full bg-bg-primary border border-separator p-2 font-mono text-sm" value={action} onChange={e => setAction(e.target.value)}>
                <option value="KILLS">Kills</option>
                <option value="DIES">Dies</option>
                <option value="ALLIES_WITH">Allies With</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase mb-1">Character 2 / Any</label>
              <select className="w-full bg-bg-primary border border-separator p-2 font-mono text-sm" value={fighter2Id} onChange={e => setFighter2Id(e.target.value)}>
                <option value="0">Any / Anyone</option>
                {fighters.map(f => <option key={Number(f.id)} value={Number(f.id)}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase mb-1">In Next N Rounds</label>
              <input type="number" min="1" className="w-full bg-bg-primary border border-separator p-2 font-mono text-sm" value={rounds} onChange={e => setRounds(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase mb-1">Your Side</label>
              <select className="w-full bg-bg-primary border border-separator p-2 font-mono text-sm" value={side} onChange={e => setSide(e.target.value)}>
                <option value="FOR">FOR (It will happen)</option>
                <option value="AGAINST">AGAINST (It won't happen)</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase mb-1">Amount (Min $5)</label>
              <input type="number" min="5" className="w-full bg-bg-primary border border-separator p-2 font-mono text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          
          {error && <div className="text-red-400 font-mono text-xs mb-4">{error}</div>}
          
          <Button onClick={handleCreate} className="w-full">Place Event Bet</Button>
        </motion.div>
      )}

      {activeSlips.length > 0 && (
        <div className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-bg-tertiary p-3 border border-separator">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary uppercase">Sort by:</span>
            <select className="bg-bg-primary border border-separator p-1 text-sm font-mono text-text-primary focus:border-accent-gold" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="newest">Newest</option>
              <option value="highest_pool">Highest Pool</option>
            </select>
            <select className="bg-bg-primary border border-separator p-1 text-sm font-mono text-text-primary focus:border-accent-gold" value={sortDirection} onChange={e => setSortDirection(e.target.value as any)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <div className="font-mono text-sm text-text-secondary">
            {activeSlips.length} Active Bets
          </div>
        </div>
      )}

      {activeSlips.length === 0 && !showCreateForm ? (
        <div className="font-mono text-sm text-text-secondary py-4 text-center border border-dashed border-separator">
          No active event bets. Create one!
        </div>
      ) : (
        <div className="space-y-4">
          {displayedSlips.map(renderSlip)}
        </div>
      )}

      {activeSlips.length > 5 && !showAll && (
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={() => setShowAll(true)}>
            Show All Event Bets ({activeSlips.length})
          </Button>
        </div>
      )}

      <AnimatePresence>
        {showAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-bg-secondary border border-accent-gold w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl shadow-accent-gold/20"
            >
              <div className="flex justify-between items-center p-4 border-b border-accent-gold/30 bg-bg-tertiary">
                <h3 className="font-heading text-xl text-accent-gold uppercase tracking-wider">All Event Bets</h3>
                <button
                  onClick={() => setShowAll(false)}
                  className="text-text-secondary hover:text-accent-gold transition-colors p-2 font-mono text-sm uppercase flex items-center gap-2"
                >
                  ✕ Close
                </button>
              </div>
              
              <div className="p-4 border-b border-separator bg-bg-tertiary flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary uppercase">Sort by:</span>
                  <select className="bg-bg-primary border border-separator p-1 text-sm font-mono text-text-primary focus:border-accent-gold" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                    <option value="newest">Newest</option>
                    <option value="highest_pool">Highest Pool</option>
                  </select>
                  <select className="bg-bg-primary border border-separator p-1 text-sm font-mono text-text-primary focus:border-accent-gold" value={sortDirection} onChange={e => setSortDirection(e.target.value as any)}>
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 bg-bg-primary flex-1">
                {activeSlips.map(renderSlip)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
