import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User as UserIcon, Mail, UserCheck, AlertCircle, ArrowRight } from 'lucide-react';

export const Signup: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters long and alphanumeric.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your confirmation.');
      return;
    }

    try {
      setLoading(true);
      await register(fullName.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Branding header */}
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
          Create your student workspace
        </h2>
        <p className="mt-1 text-center text-xs text-muted">
          Your private, isolated academic management system
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
                Full Name
              </label>
              <div className="relative rounded-xl border border-border-light bg-ivory/40 focus-within:border-olive focus-within:ring-1 focus-within:ring-olive transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <UserCheck size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="block w-full pl-9 pr-3 py-2 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Username
              </label>
              <div className="relative rounded-xl border border-border-light bg-ivory/40 focus-within:border-olive focus-within:ring-1 focus-within:ring-olive transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sarah_chen"
                  className="block w-full pl-9 pr-3 py-2 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl border border-border-light bg-ivory/40 focus-within:border-olive focus-within:ring-1 focus-within:ring-olive transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sarah@lifeos.edu"
                  className="block w-full pl-9 pr-3 py-2 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
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
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="block w-full pl-9 pr-10 py-2 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
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

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                Confirm Password
              </label>
              <div className="relative rounded-xl border border-border-light bg-ivory/40 focus-within:border-olive focus-within:ring-1 focus-within:ring-olive transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="block w-full pl-9 pr-3 py-2 bg-transparent text-sm text-charcoal placeholder-muted-light focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-medium text-paper bg-olive hover:bg-olive-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-olive transition-all disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center">
            <p className="text-xs text-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-olive hover:text-olive-dark">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-light">
          Your data is encrypted and strictly isolated to your student account.
        </p>
      </div>
    </div>
  );
};
