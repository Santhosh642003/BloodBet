import { useState } from 'react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDB } from '../context/SpacetimeContext';

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function LoginPage() {
  const [isSignup, setIsSignup]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername]         = useState('');
  const [email, setEmail]               = useState('');
  const [loginInput, setLoginInput]     = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [agreed, setAgreed]             = useState(false);
  const [error, setError]               = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const navigate = useNavigate();
  const { connected, register, verifyLogin } = useDB();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignup) {
      if (username.trim().length < 3) return setError('Username must be at least 3 characters');
      if (!email.trim()) return setError('Email is required');
      if (password.length < 6) return setError('Password must be at least 6 characters');
      if (password !== confirmPassword) return setError('Passwords do not match');
      if (!agreed) return setError('You must accept the Arena Terms & Survival Policy');
    } else {
      if (!loginInput.trim()) return setError('Username or email is required');
      if (!password) return setError('Password is required');
    }

    setSubmitting(true);
    try {
      const passwordHash = await hashPassword(password);
      if (isSignup) {
        await register(username.trim(), email.trim(), passwordHash);
      } else {
        await verifyLogin(loginInput.trim(), passwordHash);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[55%_45%]">

      {/* Left Panel */}
      <div className="relative bg-bg-primary p-12 flex flex-col justify-between min-h-[50vh] lg:min-h-screen">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-crimson-start to-bg-primary" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 opacity-50">
            <div className="w-full h-full bg-gradient-to-t from-accent-gold to-transparent blur-3xl" />
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-2 border-accent-gold rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-accent-gold" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
            </div>
            <span className="font-display text-2xl text-accent-gold">BLOODBETS</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 max-w-lg"
        >
          <p className="font-serif italic text-3xl text-text-primary mb-12 leading-relaxed">
            "In the arena, only the prepared survive. Are you prepared to profit?"
          </p>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="font-display text-4xl text-accent-gold mb-2">$4.2M</div>
              <div className="font-mono text-xs text-text-secondary uppercase">Total payout this season</div>
            </div>
            <div>
              <div className="font-display text-4xl text-accent-gold mb-2">12,847</div>
              <div className="font-mono text-xs text-text-secondary uppercase">Active bettors</div>
            </div>
            <div>
              <div className="font-display text-4xl text-accent-gold mb-2">50</div>
              <div className="font-mono text-xs text-text-secondary uppercase">Unique AI fighters</div>
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="font-mono text-xs text-text-secondary">
            {connected ? 'ARENA CONNECTED' : 'CONNECTING TO ARENA...'}
          </span>
        </div>
      </div>

      {/* Right Panel */}
      <div className="bg-bg-secondary p-12 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="flex gap-8 mb-8 border-b border-separator">
            <button onClick={() => setIsSignup(false)}
              className={`font-heading uppercase text-sm pb-3 transition-colors ${
                !isSignup ? 'text-accent-gold border-b-2 border-accent-gold' : 'text-text-secondary hover:text-text-primary'
              }`}>
              Log In
            </button>
            <button onClick={() => setIsSignup(true)}
              className={`font-heading uppercase text-sm pb-3 transition-colors ${
                isSignup ? 'text-accent-gold border-b-2 border-accent-gold' : 'text-text-secondary hover:text-text-primary'
              }`}>
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isSignup ? (
              <>
                <Input label="USERNAME OR EMAIL" placeholder="your_username or your@email.com"
                  value={loginInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginInput(e.target.value)} />
                <div className="relative">
                  <Input label="PASSWORD" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 bottom-3 text-accent-gold">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Input label="USERNAME (3-24 CHARS)" placeholder="your_arena_name" maxLength={24}
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} />
                <Input label="EMAIL" type="email" placeholder="your@email.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
                <div className="relative">
                  <Input label="PASSWORD (MIN 6 CHARS)" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 bottom-3 text-accent-gold">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <Input label="CONFIRM PASSWORD" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)} />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-bg-tertiary border border-accent-gold inner-glow p-4 text-center">
                  <div className="font-mono text-accent-gold text-lg">💰 $100.00 WELCOME BONUS</div>
                  <div className="font-mono text-xs text-text-secondary mt-1">credited on registration</div>
                </motion.div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 border-accent-gold bg-bg-tertiary" />
                  <span className="font-mono text-xs text-text-secondary">
                    I accept the Arena Terms & Survival Policy
                  </span>
                </label>
              </>
            )}

            {error && (
              <div className="bg-red-950/40 border border-red-500 text-red-400 font-mono text-xs px-4 py-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !connected}>
              {submitting ? 'PLEASE WAIT...' : isSignup ? 'JOIN THE BLOODBETS' : 'ENTER THE ARENA'}
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-separator" />
              <span className="font-mono text-xs text-text-secondary">OR</span>
              <div className="flex-1 h-px bg-separator" />
            </div>

            <button type="button"
              className="w-full border border-separator bg-bg-tertiary text-text-primary py-3 font-heading uppercase text-sm tracking-wider hover:border-accent-gold transition-colors flex items-center justify-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
