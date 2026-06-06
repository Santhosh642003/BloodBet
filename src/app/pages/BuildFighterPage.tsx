import { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { NavBar } from '../components/NavBar';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { useDB } from '../context/SpacetimeContext';

const archetypes = [
  { id: 'strategist', name: 'STRATEGIST', icon: '🧠', description: 'High intelligence, alliance-focused, tactical' },
  { id: 'brute', name: 'BRUTE', icon: '💪', description: 'Maximum strength, aggressive, direct combat' },
  { id: 'spy', name: 'SPY', icon: '👁️', description: 'High speed, stealth, backstab specialist' },
  { id: 'medic', name: 'MEDIC', icon: '❤️', description: 'Support role, healing, team player' },
  { id: 'wildcard', name: 'WILDCARD', icon: '🎲', description: 'Unpredictable, high luck, chaotic' },
];

const traits = [
  { id: 'alliance', name: 'Forms Alliances Early', effect: '+20% survival in early rounds' },
  { id: 'betrayer', name: 'Betrays at 50% Health', effect: 'Eliminates allies when wounded' },
  { id: 'never_retreat', name: 'Never Retreats', effect: 'Always engages in combat' },
  { id: 'trap_master', name: 'Trap Master', effect: '+30% damage from traps' },
  { id: 'scavenger', name: 'Resource Scavenger', effect: 'Finds better loot' },
  { id: 'lone_wolf', name: 'Lone Wolf', effect: '+15% damage when alone' },
  { id: 'defensive', name: 'Defensive Stance', effect: '-25% damage taken' },
  { id: 'aggressive', name: 'Hyper Aggressive', effect: '+25% damage dealt' },
  { id: 'calculated', name: 'Calculated Risk', effect: 'Avoids unfavorable fights' },
];

const avatarOptions = [
  { id: 1, colors: ['#C9A84C', '#8B1A1A'] },
  { id: 2, colors: ['#4A9EFF', '#2ECC71'] },
  { id: 3, colors: ['#D42B2B', '#C9A84C'] },
  { id: 4, colors: ['#8A8A92', '#F0EDE6'] },
  { id: 5, colors: ['#2ECC71', '#4A9EFF'] },
  { id: 6, colors: ['#8B1A1A', '#4A9EFF'] },
  { id: 7, colors: ['#C9A84C', '#2ECC71'] },
  { id: 8, colors: ['#D42B2B', '#F0EDE6'] },
];

export function BuildFighterPage() {
  const navigate = useNavigate();
  const { createFighter } = useDB();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    backstory: '',
    archetype: '',
    stats: {
      strength: 3,
      speed: 3,
      intelligence: 3,
      luck: 3,
      charisma: 3,
    },
    traits: [] as string[],
    avatar: 1,
  });

  const totalPoints = Object.values(formData.stats).reduce((a, b) => a + b, 0);
  const maxPoints = 15;

  const updateStat = (stat: keyof typeof formData.stats, value: number) => {
    const newStats = { ...formData.stats, [stat]: value };
    const newTotal = Object.values(newStats).reduce((a, b) => a + b, 0);
    if (newTotal <= maxPoints && value >= 1 && value <= 5) {
      setFormData({ ...formData, stats: newStats });
    }
  };

  const toggleTrait = (traitId: string) => {
    if (formData.traits.includes(traitId)) {
      setFormData({ ...formData, traits: formData.traits.filter(t => t !== traitId) });
    } else if (formData.traits.length < 3) {
      setFormData({ ...formData, traits: [...formData.traits, traitId] });
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.name.length >= 3 && formData.archetype;
    if (step === 2) return true;
    if (step === 3) return formData.traits.length === 3;
    if (step === 4) return true;
    return false;
  };

  const deployFighter = () => {
    const archetypeName = archetypes.find(a => a.id === formData.archetype)?.name ?? formData.archetype;
    createFighter(
      formData.name,
      formData.backstory,
      archetypeName,
      formData.stats.strength,
      formData.stats.speed,
      formData.stats.intelligence,
      formData.stats.luck,
      formData.stats.charisma,
    );
    navigate('/fighters');
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-12 text-center relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4"
          >
            <Sparkles className="w-12 h-12 text-accent-gold" />
          </motion.div>
          <h1 className="text-6xl md:text-8xl mb-4">FORGE YOUR FIGHTER</h1>
          <p className="font-serif italic text-xl text-text-primary">
            "Create a warrior in your image"
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            {['Identity', 'Stats', 'Traits', 'Appearance'].map((label, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className={`flex items-center gap-3 ${idx < 3 ? 'flex-1' : ''}`}>
                  <div
                    className={`w-10 h-10 border-2 flex items-center justify-center font-heading ${
                      step > idx + 1
                        ? 'bg-accent-gold border-accent-gold text-bg-primary'
                        : step === idx + 1
                        ? 'border-accent-gold text-accent-gold'
                        : 'border-separator text-text-secondary'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`font-heading text-sm uppercase ${
                      step >= idx + 1 ? 'text-accent-gold' : 'text-text-secondary'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-px mx-4 ${
                      step > idx + 1 ? 'bg-accent-gold' : 'bg-separator'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          {/* Main Content */}
          <div className="bg-bg-secondary border border-separator inner-glow p-8">
            <AnimatePresence mode="wait">
              {/* Step 1: Identity */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="font-display text-3xl text-accent-gold mb-6 uppercase">
                      Step 1: Identity
                    </h2>
                  </div>

                  <Input
                    label="FIGHTER NAME (3-24 CHARACTERS)"
                    placeholder="ENTER_NAME_HERE"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                    maxLength={24}
                    className="uppercase"
                  />

                  <div>
                    <label className="font-heading uppercase text-accent-gold text-[11px] tracking-widest mb-2 block">
                      BACKSTORY / LORE
                    </label>
                    <textarea
                      value={formData.backstory}
                      onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                      placeholder="Born from the ashes of..."
                      className="w-full bg-bg-tertiary border border-accent-gold text-text-primary px-4 py-3 font-serif italic min-h-32 focus:outline-none focus:border-accent-gold focus:glow-gold transition-all"
                      maxLength={500}
                    />
                    <div className="text-right font-mono text-xs text-text-secondary mt-1">
                      {formData.backstory.length}/500
                    </div>
                  </div>

                  <div>
                    <label className="font-heading uppercase text-accent-gold text-[11px] tracking-widest mb-4 block">
                      SELECT ARCHETYPE
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {archetypes.map((archetype) => (
                        <div
                          key={archetype.id}
                          onClick={() => setFormData({ ...formData, archetype: archetype.id })}
                          className={`border p-4 cursor-pointer transition-all ${
                            formData.archetype === archetype.id
                              ? 'border-accent-gold bg-bg-tertiary'
                              : 'border-separator hover:border-accent-gold'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-3xl">{archetype.icon}</div>
                            <div className="flex-1">
                              <div className="font-heading text-lg text-accent-gold mb-1">
                                {archetype.name}
                              </div>
                              <div className="font-mono text-xs text-text-secondary">
                                {archetype.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Stats */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="font-display text-3xl text-accent-gold mb-2 uppercase">
                      Step 2: Stats
                    </h2>
                    <p className="font-mono text-sm text-text-secondary mb-6">
                      Allocate {maxPoints} points across 5 stats (1-5 per stat)
                    </p>
                  </div>

                  {/* Points remaining */}
                  <div className="bg-bg-tertiary border border-accent-gold p-4 text-center">
                    <div className="font-mono text-xs text-accent-gold uppercase mb-1">
                      Points Remaining
                    </div>
                    <div className="font-display text-4xl text-accent-gold">
                      {maxPoints - totalPoints}
                    </div>
                  </div>

                  {/* Stat sliders */}
                  <div className="space-y-6">
                    {Object.entries(formData.stats).map(([stat, value]) => (
                      <div key={stat}>
                        <div className="flex justify-between mb-2">
                          <label className="font-heading uppercase text-accent-gold text-sm">
                            {stat}
                          </label>
                          <span className="font-mono text-accent-gold">{value}/5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={value}
                          onChange={(e) => updateStat(stat as keyof typeof formData.stats, parseInt(e.target.value))}
                          className="w-full h-2 bg-bg-tertiary appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #C9A84C ${(value / 5) * 100}%, #1A1A1F ${(value / 5) * 100}%)`
                          }}
                        />
                        <div className="flex justify-between mt-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div
                              key={n}
                              className={`w-2 h-2 ${n <= value ? 'bg-accent-gold' : 'bg-separator'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Radar chart visualization */}
                  <div className="bg-bg-primary p-6 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      <svg viewBox="0 0 200 200" className="w-full h-full">
                        {/* Pentagon grid */}
                        {[3, 2, 1].map((level) => (
                          <polygon
                            key={level}
                            points="100,20 180,70 160,160 40,160 20,70"
                            fill="none"
                            stroke="rgba(201, 168, 76, 0.15)"
                            strokeWidth="1"
                            transform={`scale(${level * 0.33}) translate(${(1 - level * 0.33) * 100},${(1 - level * 0.33) * 100})`}
                          />
                        ))}
                        {/* Data polygon */}
                        <polygon
                          points={`${100},${20 + (5 - formData.stats.strength) * 16} ${180 - (5 - formData.stats.speed) * 16},${70} ${160 - (5 - formData.stats.intelligence) * 24},${160} ${40 + (5 - formData.stats.luck) * 24},${160} ${20 + (5 - formData.stats.charisma) * 16},${70}`}
                          fill="rgba(201, 168, 76, 0.2)"
                          stroke="#C9A84C"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Traits */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="font-display text-3xl text-accent-gold mb-2 uppercase">
                      Step 3: Traits
                    </h2>
                    <p className="font-mono text-sm text-text-secondary mb-6">
                      Select exactly 3 personality traits
                    </p>
                  </div>

                  <div className="bg-bg-tertiary border border-accent-gold p-4 text-center">
                    <div className="font-mono text-xs text-accent-gold uppercase mb-1">
                      Traits Selected
                    </div>
                    <div className="font-display text-4xl text-accent-gold">
                      {formData.traits.length}/3
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {traits.map((trait) => {
                      const isSelected = formData.traits.includes(trait.id);
                      const isDisabled = !isSelected && formData.traits.length >= 3;

                      return (
                        <div
                          key={trait.id}
                          onClick={() => !isDisabled && toggleTrait(trait.id)}
                          className={`border p-4 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-accent-gold bg-bg-tertiary'
                              : isDisabled
                              ? 'border-separator opacity-50 cursor-not-allowed'
                              : 'border-separator hover:border-accent-gold'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-heading text-lg text-accent-gold mb-1">
                                {trait.name}
                              </div>
                              <div className="font-mono text-xs text-text-secondary">
                                {trait.effect}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 bg-accent-gold flex items-center justify-center">
                                <span className="text-bg-primary">✓</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Appearance */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="font-display text-3xl text-accent-gold mb-2 uppercase">
                      Step 4: Appearance
                    </h2>
                    <p className="font-mono text-sm text-text-secondary mb-6">
                      Choose your fighter's avatar design
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {avatarOptions.map((option) => (
                      <div
                        key={option.id}
                        onClick={() => setFormData({ ...formData, avatar: option.id })}
                        className={`aspect-square border cursor-pointer transition-all ${
                          formData.avatar === option.id
                            ? 'border-accent-gold border-4'
                            : 'border-separator hover:border-accent-gold'
                        }`}
                      >
                        <div
                          className="w-full h-full"
                          style={{
                            background: `linear-gradient(135deg, ${option.colors[0]}, ${option.colors[1]})`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Preview Panel */}
          <div className="bg-bg-secondary border border-accent-gold inner-glow p-6 sticky top-6 h-fit">
            <h3 className="font-heading text-xl text-accent-gold mb-4 uppercase text-center">
              Fighter Preview
            </h3>

            {/* Avatar */}
            <div className="w-full aspect-square bg-bg-tertiary mb-4 flex items-center justify-center overflow-hidden">
              {formData.avatar && (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(135deg, ${avatarOptions.find(a => a.id === formData.avatar)?.colors[0]}, ${avatarOptions.find(a => a.id === formData.avatar)?.colors[1]})`,
                  }}
                />
              )}
            </div>

            {/* Name */}
            <h3 className="font-display text-2xl text-accent-gold mb-2 text-center">
              {formData.name || 'UNNAMED_FIGHTER'}
            </h3>

            {/* Archetype */}
            {formData.archetype && (
              <div className="font-heading text-text-secondary text-sm uppercase tracking-wider mb-4 text-center">
                {archetypes.find(a => a.id === formData.archetype)?.name}
              </div>
            )}

            {/* Stats */}
            {step >= 2 && (
              <div className="space-y-2 mb-4">
                {Object.entries(formData.stats).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between items-center">
                    <span className="font-mono text-xs text-text-secondary uppercase">{stat}</span>
                    <span className="font-mono text-accent-gold">
                      {'█'.repeat(value)}{'░'.repeat(5 - value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Traits */}
            {step >= 3 && formData.traits.length > 0 && (
              <div className="border-t border-separator pt-4">
                <div className="font-mono text-xs text-accent-gold uppercase mb-2">Traits</div>
                <div className="space-y-1">
                  {formData.traits.map((traitId) => {
                    const trait = traits.find(t => t.id === traitId);
                    return (
                      <div key={traitId} className="font-mono text-xs text-text-secondary">
                        • {trait?.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cost */}
            <div className="bg-bg-tertiary border border-separator p-4 mt-6 text-center">
              <div className="font-mono text-xs text-text-secondary uppercase mb-1">
                Deployment Cost
              </div>
              <div className="font-display text-3xl text-accent-gold">$500</div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between">
          <Button
            variant="secondary"
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Back
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => canProceed() && setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight size={20} />
            </Button>
          ) : (
            <Button
              onClick={deployFighter}
              disabled={!canProceed()}
              className="flex items-center gap-2"
            >
              <Sparkles size={20} />
              Deploy Fighter — $500
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
