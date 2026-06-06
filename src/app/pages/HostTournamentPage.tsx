import { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { NavBar } from '../components/NavBar';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Crown, Shuffle, Zap } from 'lucide-react';
import { useDB } from '../context/SpacetimeContext';

const arenas = [
  { id: 'arctic', name: 'ARCTIC WASTELAND', icon: '❄️', modifier: 'SPD -1 for all', image: 'linear-gradient(135deg, #4A9EFF, #F0EDE6)' },
  { id: 'jungle', name: 'JUNGLE LABYRINTH', icon: '🌿', modifier: 'INT +1 for all', image: 'linear-gradient(135deg, #2ECC71, #1A1A1F)' },
  { id: 'volcano', name: 'VOLCANIC PEAKS', icon: '🌋', modifier: 'STR +1 for all', image: 'linear-gradient(135deg, #D42B2B, #8B1A1A)' },
  { id: 'urban', name: 'URBAN RUINS', icon: '🏙️', modifier: 'Balanced stats', image: 'linear-gradient(135deg, #8A8A92, #1A1A1F)' },
  { id: 'ocean', name: 'DEEP OCEAN', icon: '🌊', modifier: 'LUCK +1 for all', image: 'linear-gradient(135deg, #4A9EFF, #1A1A1F)' },
  { id: 'desert', name: 'DESERT COLOSSEUM', icon: '🏜️', modifier: 'Endurance test', image: 'linear-gradient(135deg, #C9A84C, #8B1A1A)' },
];

const obstacles = [
  { id: 'trap', name: 'Trap Field', desc: 'Hidden traps across the arena' },
  { id: 'combat', name: 'Forced Combat', desc: 'Fighters must engage' },
  { id: 'survival', name: 'Survival Challenge', desc: 'Environmental hazards' },
  { id: 'scarcity', name: 'Resource Scarcity', desc: 'Limited supplies' },
];

export function HostTournamentPage() {
  const navigate = useNavigate();
  const { hostTournament } = useDB();
  const [useAI, setUseAI] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    arena: '',
    rounds: 5,
    fighterSelection: 'random',
    rules: {
      allowAlliances: true,
      allowBetrayals: true,
      doubleElimination: false,
      wildcardEvents: true,
    },
    roundConfig: [] as { obstacle: string; eliminationCount: number }[],
  });

  const generateWithAI = () => {
    setUseAI(true);
    setFormData({
      name: 'THE CRIMSON RECKONING',
      description: 'In the darkest depths of the forgotten arena, only the most ruthless shall prevail. Blood will be the price, glory the reward.',
      arena: 'volcano',
      rounds: 5,
      fighterSelection: 'random',
      rules: {
        allowAlliances: true,
        allowBetrayals: true,
        doubleElimination: false,
        wildcardEvents: true,
      },
      roundConfig: [
        { obstacle: 'survival', eliminationCount: 4 },
        { obstacle: 'trap', eliminationCount: 4 },
        { obstacle: 'combat', eliminationCount: 3 },
        { obstacle: 'scarcity', eliminationCount: 3 },
        { obstacle: 'combat', eliminationCount: 5 },
      ],
    });
  };

  const launchTournament = () => {
    hostTournament(formData.name, formData.arena);
    navigate('/tournament');
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-12 text-center relative">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 1 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4"
          >
            <Crown className="w-12 h-12 text-accent-gold" />
          </motion.div>
          <h1 className="text-6xl md:text-8xl mb-4">THE GAME MASTER'S CHAMBER</h1>
          <p className="font-serif italic text-xl text-text-primary mb-6">
            "Shape the arena. Command the chaos. Reap the glory."
          </p>

          {/* AI Generate Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="inline-block"
          >
            <button
              onClick={generateWithAI}
              className="bg-gradient-to-r from-accent-crimson-start to-accent-crimson-end text-text-primary px-8 py-4 font-heading uppercase tracking-wider flex items-center gap-3 glow-gold hover:brightness-110 transition-all"
            >
              <Zap className="w-5 h-5" />
              Let the AI Decide Everything
              <Zap className="w-5 h-5" />
            </button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          {/* Main Form */}
          <div className="space-y-8">
            {/* Section 1: Basics */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h2 className="font-display text-3xl text-accent-gold mb-6 uppercase">
                1. Tournament Basics
              </h2>

              <div className="space-y-6">
                <Input
                  label="TOURNAMENT NAME"
                  placeholder="THE CRIMSON SEASON"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="uppercase"
                />

                <div>
                  <label className="font-heading uppercase text-accent-gold text-[11px] tracking-widest mb-2 block">
                    THEME / LORE DESCRIPTION
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="In the frozen wastelands where only the strong survive..."
                    className="w-full bg-bg-tertiary border border-accent-gold text-text-primary px-4 py-3 font-serif italic min-h-32 focus:outline-none focus:border-accent-gold focus:glow-gold transition-all"
                    maxLength={500}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Arena */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h2 className="font-display text-3xl text-accent-gold mb-6 uppercase">
                2. Select Arena
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {arenas.map((arena) => (
                  <div
                    key={arena.id}
                    onClick={() => setFormData({ ...formData, arena: arena.id })}
                    className={`border cursor-pointer transition-all overflow-hidden group ${
                      formData.arena === arena.id
                        ? 'border-accent-gold'
                        : 'border-separator hover:border-accent-gold'
                    }`}
                  >
                    <div
                      className="h-32 flex items-center justify-center text-6xl group-hover:scale-110 transition-transform"
                      style={{ background: arena.image }}
                    >
                      <span className="drop-shadow-lg">{arena.icon}</span>
                    </div>
                    <div className="p-4 bg-bg-tertiary">
                      <div className="font-heading text-lg text-accent-gold mb-1">
                        {arena.name}
                      </div>
                      <div className="font-mono text-xs text-text-secondary">
                        {arena.modifier}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Rounds */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h2 className="font-display text-3xl text-accent-gold mb-6 uppercase">
                3. Round Configuration
              </h2>

              <div className="mb-6">
                <label className="font-heading uppercase text-accent-gold text-[11px] tracking-widest mb-2 block">
                  NUMBER OF ROUNDS (3-7)
                </label>
                <input
                  type="range"
                  min="3"
                  max="7"
                  value={formData.rounds}
                  onChange={(e) => {
                    const rounds = parseInt(e.target.value);
                    setFormData({ ...formData, rounds });
                  }}
                  className="w-full h-2 bg-bg-tertiary appearance-none cursor-pointer mb-2"
                />
                <div className="text-center font-display text-4xl text-accent-gold">
                  {formData.rounds}
                </div>
              </div>

              {!useAI && (
                <div className="space-y-4">
                  <div className="font-mono text-sm text-text-secondary">
                    Configure each round (optional - will auto-generate if skipped)
                  </div>
                  {Array.from({ length: formData.rounds }).map((_, idx) => (
                    <div key={idx} className="bg-bg-tertiary border border-separator p-4">
                      <div className="font-heading text-accent-gold mb-3">
                        Round {idx + 1}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          className="bg-bg-primary border border-accent-gold text-text-primary p-2 font-mono text-sm"
                          value={formData.roundConfig[idx]?.obstacle || ''}
                          onChange={(e) => {
                            const newConfig = [...formData.roundConfig];
                            newConfig[idx] = { ...newConfig[idx], obstacle: e.target.value };
                            setFormData({ ...formData, roundConfig: newConfig });
                          }}
                        >
                          <option value="">Select Obstacle...</option>
                          {obstacles.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Eliminations"
                          min="1"
                          max="10"
                          className="bg-bg-primary border border-accent-gold text-text-primary p-2 font-mono text-sm"
                          value={formData.roundConfig[idx]?.eliminationCount || ''}
                          onChange={(e) => {
                            const newConfig = [...formData.roundConfig];
                            newConfig[idx] = { ...newConfig[idx], eliminationCount: parseInt(e.target.value) || 0 };
                            setFormData({ ...formData, roundConfig: newConfig });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Fighter Selection */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h2 className="font-display text-3xl text-accent-gold mb-6 uppercase">
                4. Fighter Selection
              </h2>

              <div className="space-y-4">
                <div
                  onClick={() => setFormData({ ...formData, fighterSelection: 'random' })}
                  className={`border p-4 cursor-pointer transition-all ${
                    formData.fighterSelection === 'random'
                      ? 'border-accent-gold bg-bg-tertiary'
                      : 'border-separator hover:border-accent-gold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Shuffle className="w-6 h-6 text-accent-gold" />
                    <div className="flex-1">
                      <div className="font-heading text-lg text-accent-gold mb-1">
                        Random Selection
                      </div>
                      <div className="font-mono text-xs text-text-secondary">
                        AI picks 20 fighters from the pool automatically
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setFormData({ ...formData, fighterSelection: 'manual' })}
                  className={`border p-4 cursor-pointer transition-all ${
                    formData.fighterSelection === 'manual'
                      ? 'border-accent-gold bg-bg-tertiary'
                      : 'border-separator hover:border-accent-gold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-accent-gold flex items-center justify-center font-display text-bg-primary">
                      20
                    </div>
                    <div className="flex-1">
                      <div className="font-heading text-lg text-accent-gold mb-1">
                        Manual Selection
                      </div>
                      <div className="font-mono text-xs text-text-secondary">
                        Choose exactly 20 fighters yourself
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Rules */}
            <div className="bg-bg-secondary border border-separator inner-glow p-6">
              <h2 className="font-display text-3xl text-accent-gold mb-6 uppercase">
                5. Tournament Rules
              </h2>

              <div className="space-y-4">
                {Object.entries({
                  allowAlliances: 'Allow Alliances',
                  allowBetrayals: 'Allow Betrayals',
                  doubleElimination: 'Double-Elimination Rounds',
                  wildcardEvents: 'Wildcard Events',
                }).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-4 bg-bg-tertiary border border-separator cursor-pointer hover:border-accent-gold transition-colors"
                  >
                    <span className="font-heading text-lg text-text-primary">{label}</span>
                    <input
                      type="checkbox"
                      checked={formData.rules[key as keyof typeof formData.rules]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, [key]: e.target.checked },
                        })
                      }
                      className="w-6 h-6 bg-bg-primary border-2 border-accent-gold checked:bg-accent-gold"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="bg-bg-secondary border border-accent-gold inner-glow p-6 sticky top-6 h-fit">
            <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase text-center">
              Tournament Preview
            </h3>

            <div className="space-y-4">
              {/* Tournament name */}
              <div>
                <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                  Tournament Name
                </div>
                <div className="font-display text-2xl text-accent-gold">
                  {formData.name || 'UNNAMED TOURNAMENT'}
                </div>
              </div>

              {/* Arena */}
              {formData.arena && (
                <div>
                  <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                    Arena
                  </div>
                  <div className="font-heading text-lg text-text-primary">
                    {arenas.find(a => a.id === formData.arena)?.name}
                  </div>
                </div>
              )}

              {/* Rounds */}
              <div>
                <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                  Total Rounds
                </div>
                <div className="font-heading text-lg text-text-primary">
                  {formData.rounds}
                </div>
              </div>

              {/* Rules summary */}
              <div>
                <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                  Active Rules
                </div>
                <div className="space-y-1">
                  {Object.entries(formData.rules)
                    .filter(([_, value]) => value)
                    .map(([key]) => (
                      <div key={key} className="font-mono text-xs text-accent-gold">
                        • {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    ))}
                </div>
              </div>

              {/* Cost */}
              <div className="bg-bg-tertiary border border-accent-gold p-4 mt-6 text-center">
                <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                  Launch Cost
                </div>
                <div className="font-display text-4xl text-accent-gold">$1,000</div>
              </div>

              {/* Expected prize pool */}
              <div className="bg-bg-tertiary border border-separator p-4 text-center">
                <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                  Expected Prize Pool
                </div>
                <div className="font-heading text-2xl text-success-green">
                  $50,000 - $500,000
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <div className="mt-8 text-center">
          <Button
            className="inline-flex items-center gap-3 px-12 py-6 text-lg"
            onClick={launchTournament}
            disabled={!formData.name || !formData.arena}
          >
            <Crown className="w-6 h-6" />
            Launch Tournament — $1,000
          </Button>
        </div>
      </div>
    </div>
  );
}
