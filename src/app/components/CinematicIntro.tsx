import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, SkipForward } from 'lucide-react';

interface CinematicIntroProps {
  tournamentName: string;
  arenaType: string;
  fighterCount: number;
  onFinish: () => void;
}

// Lightweight synthesized score via Web Audio — no external sound assets needed.
function useCinematicScore(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) { stopRef.current(); return; }

    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 1.2);

    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    drone.connect(droneGain).connect(master);
    drone.start();

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 27.5;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    sub.connect(subGain).connect(master);
    sub.start();

    // Rising tension sweep
    const sweep = ctx.createOscillator();
    sweep.type = 'triangle';
    sweep.frequency.setValueAtTime(110, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 5);
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 0.05;
    sweep.connect(sweepGain).connect(master);
    sweep.start();

    // Periodic impact "hits"
    const hitTimer = setInterval(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 0.5);
    }, 1800);

    stopRef.current = () => {
      clearInterval(hitTimer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => { try { ctx.close(); } catch {} }, 500);
    };

    return () => stopRef.current();
  }, [enabled]);

  return ctxRef;
}

const PHASES = [
  { title: 'THE ARENA AWAKENS', sub: (arena: string) => arena },
  { title: 'GLADIATORS ENTER', sub: (_: string, n: number) => `${n} fighters step onto the field` },
  { title: 'THE CROWD HOLDS ITS BREATH', sub: () => 'Place your bets. Choose your champion.' },
  { title: 'LET THE BLOOD BETS BEGIN', sub: () => '' },
];

export function CinematicIntro({ tournamentName, arenaType, fighterCount, onFinish }: CinematicIntroProps) {
  const [phase, setPhase] = useState(0);
  const [muted, setMuted] = useState(false);
  useCinematicScore(!muted);

  useEffect(() => {
    if (phase >= PHASES.length) {
      const t = setTimeout(onFinish, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase(p => p + 1), 2400);
    return () => clearTimeout(t);
  }, [phase, onFinish]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Pulsing crimson vignette */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at center, rgba(139,0,0,0.25) 0%, rgba(0,0,0,0.95) 70%)' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ background: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)' }}
        />

        {/* Title card */}
        <div className="relative text-center px-6">
          <AnimatePresence mode="wait">
            {phase < PHASES.length && (
              <motion.div
                key={phase}
                initial={{ opacity: 0, scale: 0.85, letterSpacing: '0.4em' }}
                animate={{ opacity: 1, scale: 1, letterSpacing: '0.15em' }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              >
                <div className="font-mono text-xs text-destructive uppercase tracking-[0.5em] mb-4">
                  {tournamentName}
                </div>
                <h1 className="font-display text-5xl md:text-7xl text-accent-gold uppercase drop-shadow-[0_0_24px_rgba(212,175,55,0.5)]">
                  {PHASES[phase].title}
                </h1>
                <p className="mt-4 font-serif italic text-lg md:text-xl text-text-primary">
                  {PHASES[phase].sub(arenaType, fighterCount)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom bar: progress + controls */}
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {PHASES.map((_, i) => (
              <div key={i} className={`h-0.5 w-10 transition-colors ${i <= phase ? 'bg-accent-gold' : 'bg-separator'}`} />
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMuted(m => !m)}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-text-secondary hover:text-accent-gold transition-colors"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={onFinish}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-text-secondary hover:text-accent-gold transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip Intro
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
