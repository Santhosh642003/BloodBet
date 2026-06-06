import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, UserPlus, Clock, UserCheck } from 'lucide-react';
import { NavBar } from '../components/NavBar';
import { useDB } from '../context/SpacetimeContext';

export function PlayersPage() {
  const { users, fighters, friendships, identity, currentUser, sendFriendRequest } = useDB();
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const myHex = identity;

  const friendshipWith = (otherHex: string) => friendships.find(f =>
    (f.requesterId?.toHexString?.() === myHex && f.addresseeId?.toHexString?.() === otherHex) ||
    (f.requesterId?.toHexString?.() === otherHex && f.addresseeId?.toHexString?.() === myHex)
  );

  const results = users
    .filter(u => u.identity?.toHexString?.() !== myHex)
    .filter(u => !query.trim() || u.username?.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.tournamentsHosted ?? 0) - Number(a.tournamentsHosted ?? 0));

  const handleAdd = async (u: any) => {
    const hex = u.identity?.toHexString?.();
    try {
      await sendFriendRequest(u.identity);
      setFeedback(prev => ({ ...prev, [hex]: 'sent' }));
    } catch (e: any) {
      setFeedback(prev => ({ ...prev, [hex]: e?.message ?? 'Failed' }));
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-10 text-center">
          <h1 className="text-6xl md:text-7xl mb-4">FIND PLAYERS</h1>
          <p className="font-serif italic text-xl text-text-primary">
            "Allies sharpen the blade. Enemies sharpen the legend."
          </p>
        </div>

        <div className="relative max-w-xl mx-auto mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username..."
            className="w-full bg-bg-secondary border border-separator focus:border-accent-gold text-text-primary pl-11 pr-4 py-3 font-mono text-sm outline-none"
          />
        </div>

        {results.length === 0 ? (
          <div className="font-mono text-sm text-text-secondary text-center py-12">
            No players found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((u, idx) => {
              const hex = u.identity?.toHexString?.();
              const fr  = friendshipWith(hex);
              const ownedCount = fighters.filter(f => f.ownerIdentity?.toHexString?.() === hex).length;

              let actionNode;
              if (fr?.status === 'ACCEPTED') {
                actionNode = (
                  <div className="flex items-center gap-2 text-success-green font-mono text-xs uppercase">
                    <UserCheck className="w-4 h-4" /> Friends
                  </div>
                );
              } else if (fr?.status === 'PENDING') {
                actionNode = (
                  <div className="flex items-center gap-2 text-text-secondary font-mono text-xs uppercase">
                    <Clock className="w-4 h-4" />
                    {fr.requesterId?.toHexString?.() === myHex ? 'Request sent' : 'Awaiting your response'}
                  </div>
                );
              } else if (feedback[hex] === 'sent') {
                actionNode = (
                  <div className="flex items-center gap-2 text-success-green font-mono text-xs uppercase">
                    <Clock className="w-4 h-4" /> Request sent
                  </div>
                );
              } else {
                actionNode = (
                  <button
                    onClick={() => handleAdd(u)}
                    className="flex items-center gap-2 border border-accent-gold text-accent-gold px-3 py-1.5 font-mono text-xs uppercase hover:bg-accent-gold/10 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" /> Add Friend
                  </button>
                );
              }

              return (
                <motion.div
                  key={hex}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-bg-secondary border border-separator inner-glow p-5 hover:border-accent-gold transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-accent-gold flex items-center justify-center text-2xl">
                      {u.avatarEmoji ?? '🗡️'}
                    </div>
                    <div>
                      <div className="font-display text-lg text-accent-gold">{u.username}</div>
                      <div className="font-mono text-[10px] text-text-secondary uppercase">{u.favoriteArchetype ?? 'STRATEGIC'}</div>
                    </div>
                  </div>

                  {u.bio && (
                    <p className="font-mono text-xs text-text-secondary mb-3 line-clamp-2">{u.bio}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-4 font-mono text-xs">
                    <div>
                      <div className="text-text-secondary">Hosted</div>
                      <div className="text-text-primary font-heading text-base">{Number(u.tournamentsHosted ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Fighters</div>
                      <div className="text-text-primary font-heading text-base">{ownedCount}</div>
                    </div>
                  </div>

                  {actionNode}
                  {feedback[hex] && feedback[hex] !== 'sent' && (
                    <div className="mt-2 font-mono text-[10px] text-destructive">{feedback[hex]}</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {currentUser && (
          <div className="mt-12 text-center font-mono text-xs text-text-secondary">
            Signed in as <span className="text-accent-gold">{currentUser.username}</span> — manage requests on your{' '}
            <span className="text-accent-gold">Profile</span> page.
          </div>
        )}
      </div>
    </div>
  );
}
