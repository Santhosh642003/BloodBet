import { useState } from 'react';
import { CharacterCard } from '../components/CharacterCard';
import { NavBar } from '../components/NavBar';
import { useNavigate } from 'react-router';
import { Filter, Search } from 'lucide-react';
import { useDB } from '../context/SpacetimeContext';

const ROLE_FROM_ARCHETYPE = (archetype: string): string => {
  const a = archetype.toUpperCase();
  if (a.includes('STRATEGIST')) return 'Strategist';
  if (a.includes('BRUTE')) return 'Brute';
  if (a.includes('SPY') || a.includes('BETRAYER')) return 'Spy';
  if (a.includes('MEDIC')) return 'Medic';
  return 'Wildcard';
};

export function FightersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('winRate');
  const { fighters, contracts } = useDB();

  const contractedFighterIds = new Set(contracts.map(c => Number(c.fighterId)));

  const enrichedFighters = fighters.map(fighter => {
    const tournaments = Number(fighter.tournamentsPlayed ?? 0);
    const wins = Number(fighter.wins ?? 0);
    const winRate = tournaments > 0 ? Math.round((wins / tournaments) * 100) : 0;
    return {
      id: Number(fighter.id),
      name: fighter.name,
      archetype: fighter.archetype,
      role: ROLE_FROM_ARCHETYPE(fighter.archetype),
      stats: {
        str: fighter.strength,
        spd: fighter.speed,
        int: fighter.intelligence,
        luck: fighter.luck,
      },
      survivalOdds: 70,
      winOdds: `${(12.4 / (wins + 1)).toFixed(1)}x`,
      avatar: fighter.avatarUrl || undefined,
      winRate,
      tournaments,
      wins,
      contractAvailable: !contractedFighterIds.has(Number(fighter.id)),
    };
  });

  const filteredFighters = enrichedFighters
    .filter(fighter => {
      const matchesSearch = fighter.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'All' || fighter.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (sortBy === 'winRate') return b.winRate - a.winRate;
      if (sortBy === 'tournaments') return b.tournaments - a.tournaments;
      if (sortBy === 'contract') return (b.contractAvailable ? 1 : 0) - (a.contractAvailable ? 1 : 0);
      return 0;
    });

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-6xl md:text-8xl mb-4">THE FIGHTERS</h1>
          <p className="font-serif italic text-2xl text-text-primary max-w-3xl mx-auto">
            "Study them. Understand them. Profit from them."
          </p>
        </div>

        {/* Filter Bar */}
        <div className="bg-bg-secondary border border-separator inner-glow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search fighters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-tertiary border border-accent-gold text-text-primary pl-12 pr-4 py-3 font-mono"
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-bg-tertiary border border-accent-gold text-text-primary pl-12 pr-4 py-3 font-mono appearance-none cursor-pointer"
              >
                <option value="All">All Roles</option>
                <option value="Strategist">Strategist</option>
                <option value="Brute">Brute</option>
                <option value="Spy">Spy</option>
                <option value="Medic">Medic</option>
                <option value="Wildcard">Wildcard</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-bg-tertiary border border-accent-gold text-text-primary px-4 py-3 font-mono appearance-none cursor-pointer"
            >
              <option value="winRate">Sort by Win Rate</option>
              <option value="tournaments">Sort by Experience</option>
              <option value="contract">Sort by Contract Availability</option>
            </select>
          </div>

          {/* Results count */}
          <div className="mt-4 font-mono text-sm text-text-secondary text-center">
            Showing {filteredFighters.length} of {enrichedFighters.length} fighters
          </div>
        </div>

        {/* Fighter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {filteredFighters.map((fighter) => (
            <div key={fighter.id} className="relative">
              <CharacterCard {...fighter} onClick={() => navigate('/tournament')} />

              {/* Career stats badge */}
              <div className="absolute top-4 right-4 bg-bg-primary/90 backdrop-blur-sm border border-separator px-3 py-1">
                <div className="font-mono text-xs text-text-secondary">
                  {fighter.tournaments} tournaments · {fighter.wins} wins
                </div>
                <div className="font-heading text-accent-gold">{fighter.winRate}% win rate</div>
              </div>

              {/* Contract available badge */}
              {fighter.contractAvailable && (
                <div className="absolute bottom-4 left-4 right-4 bg-accent-gold text-bg-primary py-2 text-center font-heading text-xs uppercase tracking-wider">
                  Contract Available
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filteredFighters.length === 0 && (
          <div className="text-center py-20">
            <div className="font-display text-4xl text-text-secondary mb-4">NO FIGHTERS FOUND</div>
            <p className="font-mono text-text-secondary">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
