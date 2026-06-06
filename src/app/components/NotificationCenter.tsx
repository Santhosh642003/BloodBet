import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Trophy, UserPlus, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDB } from '../context/SpacetimeContext';

const KIND_ICONS: Record<string, JSX.Element> = {
  TOURNAMENT:      <Trophy className="w-4 h-4 text-accent-gold" />,
  FRIEND_REQUEST:  <UserPlus className="w-4 h-4 text-accent-ice-blue" />,
  FRIEND_ACCEPTED: <UserCheck className="w-4 h-4 text-success-green" />,
};

function timeAgo(createdAt: any): string {
  const micros = Number(createdAt?.microsSinceUnixEpoch ?? 0);
  if (!micros) return '';
  const diffMs = Date.now() - micros / 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationCenter() {
  const { notifications, markNotificationRead, markAllNotificationsRead, respondToFriendRequest, friendships } = useDB();
  const [acting, setActing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const sorted = [...notifications].sort((a, b) =>
    Number(b.createdAt?.microsSinceUnixEpoch ?? 0) - Number(a.createdAt?.microsSinceUnixEpoch ?? 0)
  );
  const unreadCount = sorted.filter(n => !n.read).length;

  const handleClick = (n: any) => {
    if (!n.read) markNotificationRead(Number(n.id)).catch(() => {});
    if (n.kind === 'TOURNAMENT') navigate('/tournament');
    else if (n.kind === 'FRIEND_ACCEPTED') navigate('/profile');
    setOpen(false);
  };

  const handleRespond = async (n: any, accept: boolean) => {
    const friendshipId = Number(n.relatedId);
    if (!friendshipId) return;
    setActing(friendshipId);
    try {
      await respondToFriendRequest(friendshipId, accept);
      if (!n.read) await markNotificationRead(Number(n.id)).catch(() => {});
    } catch { /* ignore */ }
    finally { setActing(null); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative text-text-secondary hover:text-accent-gold transition-colors p-1"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[9px] font-mono flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-bg-secondary border border-accent-gold shadow-2xl z-[100]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-separator">
              <span className="font-display text-sm text-accent-gold uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead().catch(() => {})}
                  className="font-mono text-[10px] uppercase text-text-secondary hover:text-accent-gold transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {sorted.length === 0 ? (
              <div className="px-4 py-8 text-center font-mono text-xs text-text-secondary">
                No notifications yet.
              </div>
            ) : (
              <div className="divide-y divide-separator">
                {sorted.map(n => {
                  const fr = n.kind === 'FRIEND_REQUEST'
                    ? friendships.find((f: any) => Number(f.id) === Number(n.relatedId))
                    : null;
                  const stillPending = fr?.status === 'PENDING';

                  return (
                    <div
                      key={Number(n.id)}
                      onClick={() => !stillPending && handleClick(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 transition-colors ${!stillPending ? 'cursor-pointer hover:bg-bg-tertiary' : ''} ${!n.read ? 'bg-accent-gold/5' : ''}`}
                    >
                      <div className="mt-0.5">{KIND_ICONS[n.kind] ?? <Bell className="w-4 h-4 text-text-secondary" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-xs text-text-primary truncate">{n.title}</span>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-gold shrink-0" />}
                        </div>
                        <p className="font-mono text-[11px] text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                        <span className="font-mono text-[9px] text-text-secondary uppercase">{timeAgo(n.createdAt)}</span>

                        {stillPending && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRespond(n, true); }}
                              disabled={acting === Number(fr.id)}
                              className="flex items-center gap-1 border border-success-green text-success-green px-2.5 py-1 font-mono text-[10px] uppercase hover:bg-success-green/10 transition-colors disabled:opacity-50"
                            >
                              <UserCheck className="w-3 h-3" /> Accept
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRespond(n, false); }}
                              disabled={acting === Number(fr.id)}
                              className="flex items-center gap-1 border border-separator text-text-secondary px-2.5 py-1 font-mono text-[10px] uppercase hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
