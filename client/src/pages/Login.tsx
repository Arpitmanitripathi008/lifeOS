import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User as UserIcon, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setUsername('alex_rivera');
    setPassword('password123');
    setError(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
      fillDemoAccount();
    }
  }, []);

  return (
    <div className="min-h-screen bg-ivory flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Branding header */}
        <div className="text-center mb-4">
          <Link to="/" className="text-xs font-medium text-muted hover:text-charcoal inline-flex items-center gap-1 transition-colors">
            ← Back to Home
          </Link>
        </div>
        <div className="flex justify-center items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-olive flex items-center justify-center shadow-md">
            <span className="text-paper text-xl font-serif font-bold">L</span>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-charcoal tracking-tight">LifeOS</h1>
            <p className="text-[11px] font-sans font-medium text-muted uppercase tracking-wider">
              Student Edition
            </p>
          </div>
        </div>

        <h2 className="mt-4 text-center text-xl font-serif font-medium text-charcoal">
          Sign in to your study space
        </h2>
        <p className="mt-1 text-center text-xs text-muted">
          Your adaptive schedule, academic subjects, and private goals
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-paper py-8 px-6 shadow-sm border border-border-light rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-terracotta/10 border border-terracotta/20 flex items-start gap-2.5 text-xs text-terracotta-dark">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-terracotta" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Username or Email
              </label>
              <div className="relative rounded-xl border border-border-light bg-ivory/40 focus-within:border-olive focus-within:ring-1 focus-within:ring-olive transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alex_rivera"
                  className="block w-full pl-9 pr-3 py-2.5 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl border border-border-light bg-ivory/40 focus-within:border-olive focus-within:ring-1 focus-within:ring-olive transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-9 pr-10 py-2.5 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-charcoal focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-medium text-paper bg-olive hover:bg-olive-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-olive transition-all disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Demo account quick login helper */}
          <div className="mt-6 pt-5 border-t border-border-light text-center">
            <p className="text-xs text-muted mb-2 font-medium">Demo student account:</p>
            <button
              type="button"
              onClick={fillDemoAccount}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage/30 text-olive-dark text-xs font-medium hover:bg-sage/50 transition-colors"
            >
              <ShieldCheck size={14} className="text-olive" />
              <span>Fill Alex Rivera (`alex_rivera`)</span>
            </button>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-muted">
              Don't have an account yet?{' '}
              <Link to="/signup" className="font-semibold text-olive hover:text-olive-dark">
                Create student account
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-light">
          LifeOS Student Edition • Private and Isolated Academic Workspaces
        </p>
      </div>
    </div>
  );
};
