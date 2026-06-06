import { useNavigate, useLocation } from 'react-router';
import { Wallet, LogOut, Menu, X, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { useDB } from '../context/SpacetimeContext';
import { useSound } from '../context/SoundContext';
import { NotificationCenter } from './NotificationCenter';

const NAV_LINKS = [
  { label: 'Tournaments', path: '/tournament' },
  { label: 'Fighters',    path: '/fighters'   },
  { label: 'Contracts',   path: '/contracts'  },
  { label: 'Build',       path: '/build-fighter' },
  { label: 'Host',        path: '/host-tournament' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'History',     path: '/tournament-history' },
  { label: 'Players',     path: '/players' },
];

export function NavBar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { currentUser, connected, logout } = useDB();
  const { enabled: soundOn, toggle: toggleSound } = useSound();
  const [menuOpen, setMenuOpen] = useState(false);

  const balance  = Number(currentUser?.balance ?? 0).toFixed(2);
  const username = currentUser?.username ?? '...';

  return (
    <nav className="bg-bg-primary border-b border-separator sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* Logo */}
        <div
          className="font-display text-2xl text-accent-gold cursor-pointer hover:brightness-110 transition-all"
          onClick={() => navigate('/dashboard')}
        >
          BLOODBETS
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 font-heading text-sm uppercase">
          {NAV_LINKS.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`transition-colors hover:text-accent-gold ${
                location.pathname === link.path
                  ? 'text-accent-gold border-b border-accent-gold pb-0.5'
                  : 'text-text-secondary'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right — balance + user + logout */}
        <div className="flex items-center gap-3">
          {/* Connection dot */}
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />

          {/* Notifications */}
          <NotificationCenter />

          {/* Sound toggle */}
          <button onClick={toggleSound}
            className="text-text-secondary hover:text-accent-gold transition-colors p-1"
            title={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}>
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Balance */}
          <div className="hidden sm:flex items-center gap-2 bg-bg-secondary border border-accent-gold px-3 py-1.5">
            <Wallet className="w-4 h-4 text-accent-gold" />
            <span className="font-mono text-sm text-accent-gold">${balance}</span>
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 bg-bg-secondary border border-accent-gold flex items-center justify-center font-display text-accent-gold uppercase text-sm cursor-pointer"
            onClick={() => navigate('/profile')}
            title="Profile">
            {currentUser?.avatarEmoji ?? username[0] ?? 'U'}
          </div>

          {/* Logout */}
          <button onClick={logout}
            className="text-text-secondary hover:text-accent-gold transition-colors p-1"
            title="Logout">
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile menu toggle */}
          <button className="md:hidden text-text-secondary hover:text-accent-gold transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden mt-4 border-t border-separator pt-4 flex flex-col gap-3">
          {NAV_LINKS.map(link => (
            <button
              key={link.path}
              onClick={() => { navigate(link.path); setMenuOpen(false); }}
              className={`text-left font-heading uppercase text-sm transition-colors px-2 py-1 ${
                location.pathname === link.path
                  ? 'text-accent-gold'
                  : 'text-text-secondary hover:text-accent-gold'
              }`}
            >
              {link.label}
            </button>
          ))}
          <div className="flex items-center gap-2 px-2 py-1">
            <Wallet className="w-4 h-4 text-accent-gold" />
            <span className="font-mono text-sm text-accent-gold">${balance}</span>
          </div>
        </div>
      )}
    </nav>
  );
}
