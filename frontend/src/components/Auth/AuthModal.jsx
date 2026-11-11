import { useState } from 'react';
import { Scale, Mail, Lock, User, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { loginWithEmail, handleGoogleSuccess, continueAsGuest } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please provide email and password.');
      return;
    }

    if (isSignUp && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    loginWithEmail(email, password, name);
    onClose?.();
  };

  const handleGuest = () => {
    continueAsGuest();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-dark-card border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Branding header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gold/10 border border-gold/40 items-center justify-center mb-3 shadow-lg shadow-gold/10">
            <Scale className="w-6 h-6 text-gold" />
          </div>
          <h2 className="text-2xl font-black text-gold tracking-wider">
            {isSignUp ? 'CREATE ACCOUNT' : 'CLIENT SIGN IN'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Access confidential legal strategy and evidence analysis
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-xl">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Official Google OAuth Sign-In Button */}
        <div className="w-full flex justify-center mb-4">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              handleGoogleSuccess(credentialResponse);
              onClose?.();
            }}
            onError={() => {
              setError('Google verification failed. Please try again or continue as guest.');
            }}
            theme="filled_black"
            shape="pill"
            size="large"
            text="continue_with"
            width="100%"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-slate-500 uppercase tracking-widest">or email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Adv. John Doe"
                  className="w-full bg-dark/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-gold/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full bg-dark/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-gold/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-dark/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-gold/50"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gold hover:bg-gold-light text-dark font-bold text-sm rounded-xl transition-all shadow-lg shadow-gold/20 hover:shadow-gold/40 mt-1"
          >
            {isSignUp ? 'Create Legal Portal Account' : 'Sign In with Email'}
          </button>
        </form>

        {/* Toggle sign in / sign up */}
        <div className="text-center mt-4">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            type="button"
            className="text-xs text-slate-400 hover:text-gold transition-colors"
          >
            {isSignUp ? 'Already registered? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Continue as Guest option */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <button
            onClick={handleGuest}
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-gold hover:underline transition-all"
          >
            <span>Skip for now — Chat as Guest</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
