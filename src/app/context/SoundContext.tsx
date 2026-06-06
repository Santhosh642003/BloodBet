import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

export type SfxName = 'click' | 'hover' | 'success' | 'error' | 'bet' | 'notification' | 'coin';

interface SoundContextType {
  enabled: boolean;
  toggle: () => void;
  play: (name: SfxName) => void;
}

const SoundContext = createContext<SoundContextType | null>(null);
const STORAGE_KEY = 'bloodbet_sound_enabled';

// Synthesized SFX via Web Audio — no external sound assets required.
function synth(ctx: AudioContext, name: SfxName) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.connect(ctx.destination);

  const beep = (freq: number, start: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, now + start + dur);
    g.gain.setValueAtTime(0.0001, now + start);
    g.gain.exponentialRampToValueAtTime(gain, now + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(g).connect(master);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);
  };

  switch (name) {
    case 'click':
      beep(880, 0, 0.06, 'square', 0.07);
      break;
    case 'hover':
      beep(1400, 0, 0.035, 'sine', 0.03);
      break;
    case 'success':
      beep(523, 0,    0.12, 'triangle', 0.09);
      beep(784, 0.09, 0.18, 'triangle', 0.09);
      break;
    case 'error':
      beep(180, 0,    0.18, 'sawtooth', 0.08, 90);
      break;
    case 'bet':
      beep(660, 0,    0.05, 'square', 0.07);
      beep(990, 0.05, 0.10, 'square', 0.07);
      break;
    case 'coin':
      beep(1046, 0,    0.06, 'square', 0.06);
      beep(1568, 0.06, 0.10, 'square', 0.06);
      break;
    case 'notification':
      beep(740, 0,    0.08, 'sine', 0.07);
      beep(1108, 0.08, 0.12, 'sine', 0.06);
      break;
  }

  setTimeout(() => { try { master.disconnect(); } catch {} }, 1000);
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return null;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  const play = useCallback((name: SfxName) => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    try { synth(ctx, name); } catch {}
  }, [enabled, getCtx]);

  const toggle = useCallback(() => setEnabled(e => !e), []);

  return (
    <SoundContext.Provider value={{ enabled, toggle, play }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used inside SoundProvider');
  return ctx;
}
