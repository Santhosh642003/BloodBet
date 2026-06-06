import { useState } from 'react';
import { motion } from 'motion/react';

interface ArenaTile {
  x: number;
  y: number;
  tileType: string;
  hasResource: boolean;
  resourceType?: string | null;
}

interface RosterEntry {
  tf: any;
  fighter: any;
}

interface LiveEventLite {
  id: number;
  hour: number;
  eventType: string;
  description: string;
  x?: number | null;
  y?: number | null;
}

interface ArenaMapProps {
  width: number;
  height: number;
  tiles: ArenaTile[];
  roster: RosterEntry[];
  events?: LiveEventLite[];
  currentHour?: number;
  selectedFighterId?: number | null;
  onSelectFighter?: (fighterId: number) => void;
}

const TILE_COLORS: Record<string, string> = {
  PLAIN:      '#3a3a42',
  FOREST:     '#1f3a26',
  WATER:      '#1c3a4a',
  RUINS:      '#4a3c2a',
  SHELTER:    '#2a4a3c',
  DANGER:     '#4a2020',
  CORNUCOPIA: '#5a4a14',
};

const RESOURCE_ICONS: Record<string, string> = {
  FOOD:    '🍖',
  WATER:   '💧',
  MEDKIT:  '🩹',
  WEAPON:  '⚔️',
  ARMOR:   '🛡️',
  INTEL:   '📡',
  SMOKE:   '💨',
  TRAP:    '🪤',
};

const ARCHETYPE_COLORS: Record<string, string> = {
  AGGRESSIVE:  '#e0524a',
  STRATEGIC:   '#4a90e0',
  COWARDLY:    '#9a9a9a',
  DIPLOMATIC:  '#4ae09c',
  BETRAYER:    '#b04ae0',
  SURVIVALIST: '#e0c14a',
};

const TILE_W = 72;
const TILE_H = 36;

const EVENT_BURST_ICONS: Record<string, string> = {
  KILL:        '⚔️',
  ALLIANCE:    '🤝',
  BETRAYAL:    '🗡️',
  FLEE:        '💨',
  TRAP:        '⚠️',
  ELIMINATION: '💀',
  SPONSOR:     '🎁',
  COMBAT:      '💥',
};

function isoPos(x: number, y: number) {
  return {
    left: (x - y) * (TILE_W / 2),
    top:  (x + y) * (TILE_H / 2),
  };
}

export function ArenaMap({ width, height, tiles, roster, events = [], currentHour, selectedFighterId, onSelectFighter }: ArenaMapProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const tileAt = (x: number, y: number) => tiles.find(t => Number(t.x) === x && Number(t.y) === y);

  const mapWidthPx  = (width + height) * (TILE_W / 2);
  const mapHeightPx = (width + height) * (TILE_H / 2) + TILE_H * 2;

  const alive = roster.filter(r => r.tf.isAlive);

  // Most recent located event drives the burst animation; latest 5 drive the ticker
  const locatedEvents = events.filter(e => e.x !== null && e.x !== undefined && e.y !== null && e.y !== undefined);
  const latestBurst   = locatedEvents[0];
  const tickerEvents  = events.slice(0, 5);

  return (
    <div className="bg-bg-secondary border border-accent-crimson-end p-6 relative overflow-hidden">
      {/* Telecast header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-heading text-lg text-accent-gold uppercase">Arena Map</h3>
          <div className="flex items-center gap-1.5 bg-destructive/20 border border-destructive px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">On Air</span>
          </div>
          {currentHour !== undefined && (
            <span className="font-mono text-xs text-text-secondary">HOUR {currentHour}</span>
          )}
        </div>
        <div className="font-mono text-xs text-text-secondary">
          {alive.length} alive on the grid · hover a marker for details
        </div>
      </div>

      {/* Live ticker */}
      {tickerEvents.length > 0 && (
        <div className="mb-4 bg-bg-primary/60 border border-separator overflow-hidden whitespace-nowrap">
          <motion.div
            key={tickerEvents[0]?.id}
            className="inline-flex gap-10 py-2 px-4 font-mono text-xs text-text-secondary"
            initial={{ x: '100%' }}
            animate={{ x: '-100%' }}
            transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
          >
            {tickerEvents.map(e => (
              <span key={e.id}>
                <span className="text-accent-gold">[{e.hour}:00]</span>{' '}
                <span>{EVENT_BURST_ICONS[e.eventType] ?? '•'}</span>{' '}
                <span className="text-text-primary">{e.description}</span>
              </span>
            ))}
          </motion.div>
        </div>
      )}

      <div className="overflow-auto">
        <div
          className="relative mx-auto"
          style={{ width: mapWidthPx + TILE_W, height: mapHeightPx, minWidth: mapWidthPx + TILE_W }}
        >
          {/* Tiles */}
          {Array.from({ length: height }).map((_, y) =>
            Array.from({ length: width }).map((__, x) => {
              const tile = tileAt(x, y);
              const { left, top } = isoPos(x, y);
              const color = tile ? (TILE_COLORS[tile.tileType] ?? TILE_COLORS.PLAIN) : TILE_COLORS.PLAIN;
              return (
                <div
                  key={`${x}-${y}`}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: left + mapWidthPx / 2,
                    top,
                    width: TILE_W,
                    height: TILE_H * 2,
                  }}
                >
                  <div
                    style={{
                      width: TILE_W,
                      height: TILE_H,
                      background: color,
                      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    title={tile?.tileType ?? 'PLAIN'}
                  />
                  {tile?.hasResource && tile.resourceType && (
                    <div
                      className="absolute text-xs leading-none"
                      style={{ top: TILE_H / 2 - 8 }}
                      title={tile.resourceType}
                    >
                      {RESOURCE_ICONS[tile.resourceType] ?? '✦'}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Live event burst */}
          {latestBurst && (() => {
            const { left, top } = isoPos(Number(latestBurst.x), Number(latestBurst.y));
            return (
              <motion.div
                key={latestBurst.id}
                className="absolute flex items-center justify-center text-2xl pointer-events-none"
                style={{
                  left: left + mapWidthPx / 2 + TILE_W / 2 - 16,
                  top: top + TILE_H / 2 - 16,
                  zIndex: 100,
                }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.4, 1], opacity: [0, 1, 0] }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
              >
                <span className="drop-shadow-[0_0_6px_rgba(212,175,55,0.9)]">
                  {EVENT_BURST_ICONS[latestBurst.eventType] ?? '✦'}
                </span>
              </motion.div>
            );
          })()}

          {/* Fighters */}
          {roster.map(({ tf, fighter }) => {
            const fx = Number(tf.x);
            const fy = Number(tf.y);
            const { left, top } = isoPos(fx, fy);
            const isDead     = !tf.isAlive;
            const isSelected = selectedFighterId === Number(fighter.id);
            const isHovered  = hovered === Number(fighter.id);
            const color = ARCHETYPE_COLORS[fighter.archetype] ?? '#d4af37';

            return (
              <motion.div
                key={Number(tf.id)}
                className="absolute flex flex-col items-center"
                style={{
                  left: left + mapWidthPx / 2 + TILE_W / 2 - 9,
                  top: top + TILE_H / 2 - 18,
                  zIndex: isHovered || isSelected ? 50 : 10 + fy,
                  cursor: isDead ? 'default' : 'pointer',
                  opacity: isDead ? 0.35 : 1,
                }}
                animate={{ left: left + mapWidthPx / 2 + TILE_W / 2 - 9, top: top + TILE_H / 2 - 18 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                onMouseEnter={() => setHovered(Number(fighter.id))}
                onMouseLeave={() => setHovered(null)}
                onClick={() => !isDead && onSelectFighter?.(Number(fighter.id))}
              >
                <div
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]"
                  style={{
                    background: isDead ? '#555' : color,
                    border: isSelected ? '2px solid #d4af37' : '1px solid rgba(0,0,0,0.4)',
                    boxShadow: isDead ? 'none' : `0 0 8px ${color}99`,
                    filter: isDead ? 'grayscale(1)' : 'none',
                  }}
                >
                  {isDead ? '☠' : ''}
                </div>

                {(isHovered || isSelected) && (
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-bg-primary border border-accent-gold p-3 w-48 z-50 font-mono text-xs shadow-xl">
                    <div className="font-display text-sm text-accent-gold mb-1">{fighter.name}</div>
                    <div className="text-text-secondary uppercase mb-2">{fighter.archetype}</div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Position</span><span className="text-text-primary">({fx}, {fy})</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Status</span>
                      <span className={isDead ? 'text-red-400' : 'text-accent-ice-blue'}>
                        {isDead ? 'ELIMINATED' : tf.condition}
                      </span>
                    </div>
                    {!isDead && (
                      <>
                        <div className="flex justify-between text-text-secondary">
                          <span>Hunger / Thirst</span>
                          <span className="text-text-primary">{Number(tf.hunger)} / {Number(tf.thirst)}</span>
                        </div>
                        <div className="flex justify-between text-text-secondary">
                          <span>Fatigue / Injury</span>
                          <span className="text-text-primary">{Number(tf.fatigue)} / {Number(tf.injury)}</span>
                        </div>
                        <div className="flex justify-between text-text-secondary">
                          <span>Kills</span>
                          <span className="text-text-primary">{Number(tf.kills ?? 0)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs text-text-secondary">
        {Object.entries(ARCHETYPE_COLORS).map(([archetype, color]) => (
          <div key={archetype} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
            {archetype}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#555] grayscale" />
          ELIMINATED
        </div>
      </div>
    </div>
  );
}
