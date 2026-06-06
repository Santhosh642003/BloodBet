import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Users, Check, X, UserMinus, Search, UserPlus, Pencil } from 'lucide-react';
import { Button } from '../components/Button';
import { NavBar } from '../components/NavBar';
import { useDB } from '../context/SpacetimeContext';

const EMOJI_CHOICES = ['🗡️', '🛡️', '🔥', '🐺', '👑', '💀', '⚡', '🦅', '🩸', '🎯'];
const ARCHETYPES = ['AGGRESSIVE', 'STRATEGIC', 'COWARDLY', 'DIPLOMATIC', 'BETRAYER', 'SURVIVALIST'];

export function ProfilePage() {
  const navigate = useNavigate();
  const {
    currentUser, identity, fighters, friendships, users,
    updateProfile, updateAccount, respondToFriendRequest, removeFriend, sendFriendRequest,
  } = useDB();

  const [bio, setBio]               = useState(currentUser?.bio ?? '');
  const [avatar, setAvatar]         = useState(currentUser?.avatarEmoji ?? '🗡️');
  const [archetype, setArchetype]   = useState(currentUser?.favoriteArchetype ?? 'STRATEGIC');
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(currentUser?.username ?? '');
  const [nameSaving, setNameSaving]   = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  const [search, setSearch]           = useState('');
  const [searchFeedback, setSearchFeedback] = useState<Record<string, string>>({});

  const myHex = identity;

  const accepted = friendships.filter(f =>
    f.status === 'ACCEPTED' &&
    (f.requesterId?.toHexString?.() === myHex || f.addresseeId?.toHexString?.() === myHex)
  );
  const incoming = friendships.filter(f =>
    f.status === 'PENDING' && f.addresseeId?.toHexString?.() === myHex
  );
  const outgoing = friendships.filter(f =>
    f.status === 'PENDING' && f.requesterId?.toHexString?.() === myHex
  );

  const userByHex = (hex: string) => users.find(u => u.identity?.toHexString?.() === hex);
  const otherOf = (f: any) =>
    f.requesterId?.toHexString?.() === myHex ? f.addresseeId?.toHexString?.() : f.requesterId?.toHexString?.();
  const friendshipWith = (otherHex: string) => friendships.find(f =>
    (f.requesterId?.toHexString?.() === myHex && f.addresseeId?.toHexString?.() === otherHex) ||
    (f.requesterId?.toHexString?.() === otherHex && f.addresseeId?.toHexString?.() === myHex)
  );

  const ownedFighters = fighters.filter(f => f.ownerIdentity?.toHexString?.() === myHex);

  const searchResults = search.trim()
    ? users
        .filter(u => u.identity?.toHexString?.() !== myHex)
        .filter(u => u.username?.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(bio, avatar, archetype);
      setMessage('Profile updated.');
    } catch (e: any) {
      setMessage(e?.message ?? 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    setNameSaving(true);
    setNameMessage(null);
    try {
      await updateAccount(usernameDraft.trim());
      setNameMessage('Username updated.');
      setEditingName(false);
    } catch (e: any) {
      setNameMessage(e?.message ?? 'Failed to update username');
    } finally {
      setNameSaving(false);
    }
  };

  const handleAddFriend = async (u: any) => {
    const hex = u.identity?.toHexString?.();
    try {
      await sendFriendRequest(u.identity);
      setSearchFeedback(prev => ({ ...prev, [hex]: 'sent' }));
    } catch (e: any) {
      setSearchFeedback(prev => ({ ...prev, [hex]: e?.message ?? 'Failed' }));
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />

      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-12 text-center">
          <h1 className="text-6xl md:text-7xl mb-4">YOUR PROFILE</h1>
          <p className="font-serif italic text-xl text-text-primary">
            "Make your mark before the arena makes one on you."
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: identity card + edit form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 bg-bg-secondary border border-accent-gold inner-glow p-6 h-fit"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-bg-tertiary border border-accent-gold flex items-center justify-center text-4xl mb-3">
                {avatar}
              </div>
              {editingName ? (
                <div className="w-full max-w-[220px] space-y-2">
                  <input
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    maxLength={24}
                    className="w-full bg-bg-tertiary border border-accent-gold text-text-primary px-3 py-1.5 font-display text-lg text-center outline-none"
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1 !py-1.5 !text-xs" onClick={handleSaveName} disabled={nameSaving}>
                      {nameSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <button
                      onClick={() => { setEditingName(false); setUsernameDraft(currentUser?.username ?? ''); setNameMessage(null); }}
                      className="px-3 border border-separator text-text-secondary hover:text-text-primary hover:border-accent-gold transition-colors font-heading text-xs uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                  {nameMessage && <div className="font-mono text-[10px] text-accent-ice-blue">{nameMessage}</div>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl text-accent-gold">{currentUser?.username ?? '...'}</h2>
                  <button
                    onClick={() => { setEditingName(true); setUsernameDraft(currentUser?.username ?? ''); setNameMessage(null); }}
                    title="Edit username"
                    className="text-text-secondary hover:text-accent-gold transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="font-mono text-xs text-text-secondary mt-1">{currentUser?.email}</p>
              <div className="mt-3 font-mono text-sm text-accent-gold">
                ${Number(currentUser?.balance ?? 0).toFixed(2)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs text-text-secondary uppercase block mb-2">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_CHOICES.map(e => (
                    <button
                      key={e}
                      onClick={() => setAvatar(e)}
                      className={`w-9 h-9 flex items-center justify-center text-lg border transition-colors ${
                        avatar === e ? 'border-accent-gold bg-bg-tertiary' : 'border-separator hover:border-accent-gold'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-text-secondary uppercase block mb-2">Favorite Archetype</label>
                <select
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value)}
                  className="w-full bg-bg-tertiary border border-separator focus:border-accent-gold text-text-primary px-3 py-2 font-mono text-sm outline-none"
                >
                  {ARCHETYPES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="font-mono text-xs text-text-secondary uppercase block mb-2">Bio</label>
                <textarea
                  value={bio}
                  maxLength={280}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the arena who you are..."
                  rows={4}
                  className="w-full bg-bg-tertiary border border-separator focus:border-accent-gold text-text-primary px-3 py-2 font-mono text-sm outline-none resize-none"
                />
                <div className="font-mono text-[10px] text-text-secondary text-right mt-1">{bio.length}/280</div>
              </div>

              {message && (
                <div className="font-mono text-xs text-accent-ice-blue">{message}</div>
              )}

              <Button className="w-full !py-2 !text-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </motion.div>

          {/* Right: stats + friends */}
          <div className="lg:col-span-2 space-y-8">
            {/* Search players */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-bg-secondary border border-separator inner-glow p-6"
            >
              <h3 className="font-display text-xl text-accent-gold mb-4 uppercase flex items-center gap-2">
                <Search className="w-5 h-5" /> Find Players
              </h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full bg-bg-tertiary border border-separator focus:border-accent-gold text-text-primary pl-10 pr-4 py-2 font-mono text-sm outline-none"
                />
              </div>

              {search.trim() && (
                searchResults.length === 0 ? (
                  <p className="font-mono text-xs text-text-secondary">No players match "{search.trim()}".</p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map(u => {
                      const hex = u.identity?.toHexString?.();
                      const fr  = friendshipWith(hex);
                      return (
                        <div key={hex} className="flex items-center justify-between bg-bg-tertiary border border-separator p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{u.avatarEmoji ?? '🗡️'}</span>
                            <div>
                              <div className="font-mono text-sm text-text-primary">{u.username}</div>
                              <div className="font-mono text-[10px] text-text-secondary uppercase">{u.favoriteArchetype ?? 'STRATEGIC'}</div>
                            </div>
                          </div>
                          {fr?.status === 'ACCEPTED' ? (
                            <span className="font-mono text-[10px] text-success-green uppercase">Friends</span>
                          ) : fr?.status === 'PENDING' ? (
                            <span className="font-mono text-[10px] text-text-secondary uppercase">Pending</span>
                          ) : searchFeedback[hex] === 'sent' ? (
                            <span className="font-mono text-[10px] text-success-green uppercase">Request sent</span>
                          ) : (
                            <button
                              onClick={() => handleAddFriend(u)}
                              className="flex items-center gap-1.5 border border-accent-gold text-accent-gold px-2.5 py-1 font-mono text-[10px] uppercase hover:bg-accent-gold/10 transition-colors"
                            >
                              <UserPlus className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              <button
                onClick={() => navigate('/players')}
                className="mt-4 font-mono text-xs text-accent-gold hover:underline"
              >
                Browse all players →
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-bg-secondary border border-separator inner-glow p-6"
            >
              <h3 className="font-display text-2xl text-accent-gold mb-4 uppercase">Career Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-center font-mono">
                <div>
                  <div className="font-display text-3xl text-accent-gold">{Number(currentUser?.tournamentsHosted ?? 0)}</div>
                  <div className="text-xs text-text-secondary uppercase">Hosted</div>
                </div>
                <div>
                  <div className="font-display text-3xl text-accent-gold">{Number(currentUser?.fightersOwned ?? 0)}</div>
                  <div className="text-xs text-text-secondary uppercase">Fighters Owned</div>
                </div>
                <div>
                  <div className="font-display text-3xl text-accent-gold">{ownedFighters.reduce((s, f) => s + Number(f.wins ?? 0), 0)}</div>
                  <div className="text-xs text-text-secondary uppercase">Combined Wins</div>
                </div>
              </div>
            </motion.div>

            {/* Incoming requests */}
            {incoming.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-bg-secondary border border-accent-gold inner-glow p-6"
              >
                <h3 className="font-display text-xl text-accent-gold mb-4 uppercase">Friend Requests</h3>
                <div className="space-y-3">
                  {incoming.map(f => {
                    const u = userByHex(otherOf(f));
                    return (
                      <div key={Number(f.id)} className="flex items-center justify-between bg-bg-tertiary border border-separator p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{u?.avatarEmoji ?? '🗡️'}</span>
                          <span className="font-mono text-sm text-text-primary">{u?.username ?? 'Unknown'}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => respondToFriendRequest(Number(f.id), true)}
                            className="w-8 h-8 flex items-center justify-center border border-success-green text-success-green hover:bg-success-green/10 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => respondToFriendRequest(Number(f.id), false)}
                            className="w-8 h-8 flex items-center justify-center border border-destructive text-destructive hover:bg-destructive/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Friends list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-bg-secondary border border-separator inner-glow p-6"
            >
              <h3 className="font-display text-xl text-accent-gold mb-4 uppercase flex items-center gap-2">
                <Users className="w-5 h-5" /> Friends ({accepted.length})
              </h3>
              {accepted.length === 0 ? (
                <p className="font-mono text-sm text-text-secondary">
                  No friends yet — head to the Players page to find some.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {accepted.map(f => {
                    const u = userByHex(otherOf(f));
                    return (
                      <div key={Number(f.id)} className="flex items-center justify-between bg-bg-tertiary border border-separator p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{u?.avatarEmoji ?? '🗡️'}</span>
                          <div>
                            <div className="font-mono text-sm text-text-primary">{u?.username ?? 'Unknown'}</div>
                            <div className="font-mono text-[10px] text-text-secondary uppercase">{u?.favoriteArchetype}</div>
                          </div>
                        </div>
                        <button onClick={() => removeFriend(Number(f.id))}
                          title="Remove friend"
                          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-destructive transition-colors">
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {outgoing.length > 0 && (
                <div className="mt-4 font-mono text-xs text-text-secondary">
                  {outgoing.length} pending request{outgoing.length > 1 ? 's' : ''} sent — waiting on a response.
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
