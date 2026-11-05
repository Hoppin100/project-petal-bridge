import { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSwitch: (mode: 'signin' | 'signup') => void;
}

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

export function AuthModal({ mode, onClose, onSwitch }: AuthModalProps) {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'
  >('idle');
  const [submitting, setSubmitting] = useState(false);
  const [checkingTimer, setCheckingTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [mode]);

  // Debounced username availability check
  useEffect(() => {
    if (mode !== 'signup') return;
    if (checkingTimer) clearTimeout(checkingTimer);
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc(
        'check_username_available',
        { p_username: trimmed }
      );
      if (rpcError) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus(
          data === 'invalid_format' ? 'invalid' : (data as typeof usernameStatus)
        );
    }, 350);
    setCheckingTimer(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, mode]);

  function validateUsername(u: string): string | null {
    const trimmed = u.trim();
    if (trimmed.length < 3 || trimmed.length > 20)
      return 'Username must be 3–20 characters.';
    if (!USERNAME_RE.test(trimmed))
      return 'Only letters, numbers, and underscores are allowed.';
    return null;
  }

  async function ensureProfile(userId: string, usernameValue: unknown) {
    const { data: existingProfile, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existingProfile) return;

    const profileUsername =
      typeof usernameValue === 'string' && usernameValue.trim()
        ? usernameValue.trim()
        : `runner_${userId.replace(/-/g, '').slice(0, 13)}`;

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      username: profileUsername,
      role: 'member',
    });
    if (profileError?.code === '23505') {
      throw new Error('That username is taken. Please choose another.');
    }
    if (profileError) throw profileError;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let sessionEstablished = false;

    if (mode === 'signup') {
      const uErr = validateUsername(username);
      if (uErr) {
        setError(uErr);
        return;
      }

    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { data: availability, error: availabilityError } =
          await supabase.rpc('check_username_available', {
            p_username: username.trim(),
          });
        if (availabilityError) {
          throw new Error(
            `Could not check username availability: ${availabilityError.message}`
          );
        }
        if (availability !== 'available') {
          setUsernameStatus(
            availability === 'invalid_format'
              ? 'invalid'
              : availability === 'taken' || availability === 'reserved'
                ? availability
                : 'idle'
          );
          throw new Error(
            availability === 'taken'
              ? 'That username is taken. Please choose another.'
              : availability === 'reserved'
                ? 'That username is reserved. Please choose another.'
                : 'Please choose an available username.'
          );
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { username: username.trim() },
          },
        });
        if (signUpError) throw signUpError;
        const userId = data.user?.id;
        if (!userId) throw new Error('Signup did not return a user.');

        if (!data.session) {
          // Email confirmation is on, so Supabase holds the session until
          // the confirmation link is clicked. Don't force a sign-in here:
          // it fails with "Email not confirmed" and reads as a broken
          // account. Tell the person what to do instead.
          setNotice(
            'Account created! Check your inbox for the confirmation email, then sign in.'
          );
          setSubmitting(false);
          return;
        }
        sessionEstablished = true;
        await ensureProfile(userId, data.user?.user_metadata?.['username']);
        await refreshProfile(userId);
        onClose();
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
        if (signInError) throw signInError;
        sessionEstablished = true;
        await ensureProfile(
          data.user.id,
          data.user.user_metadata?.['username']
        );
        await refreshProfile(data.user.id);
        onClose();
      }
    } catch (cause) {
      console.error('auth failed', cause);
      if (sessionEstablished) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) console.error('sign out after auth failure failed', signOutError);
      }
      const msg =
        cause instanceof Error ? cause.message : 'Something went wrong.';
      if (/not confirmed|email_not_confirmed/i.test(msg)) {
        setError(
          "This email isn't confirmed yet. Click the link in the confirmation email, then sign in."
        );
      } else if (mode === 'signin' && /invalid|credentials/i.test(msg)) {
        setError('Invalid email or password.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const usernameHelp = (() => {
    switch (usernameStatus) {
      case 'checking':
        return { text: 'Checking...', ok: false, pending: true };
      case 'available':
        return { text: 'Available', ok: true };
      case 'taken':
        return { text: 'That username is taken', ok: false };
      case 'invalid':
        return { text: '3–20 characters: letters, numbers, underscores', ok: false };
      case 'reserved':
        return { text: 'That name is reserved', ok: false };
      default:
        return { text: '3–20 characters: letters, numbers, underscores', ok: null };
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <div
        className="sr-panel w-full max-w-md p-5 shadow-2xl sr-fade-in sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">
              SplitRush account
            </p>
            <h2 id="auth-title" className="text-xl font-bold text-[var(--sr-text)]">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm p-2 text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-surface-2)] hover:text-[var(--sr-text)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-emerald-100">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="speedrun_hero"
                className="sr-input"
                autoComplete="username"
                maxLength={20}
              />
              <p
                className={`mt-1 flex items-center gap-1 text-xs ${
                  usernameHelp.ok === true
                    ? 'text-emerald-400'
                    : usernameHelp.ok === false
                    ? 'text-red-400'
                    : 'text-emerald-700'
                }`}
              >
                {usernameHelp.ok === true && <Check className="h-3 w-3" />}
                {usernameHelp.pending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {usernameHelp.text}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-emerald-100">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="sr-input"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-emerald-100">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="sr-input"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {notice && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="sr-btn-primary"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-emerald-700">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => onSwitch('signin')}
                className="sr-link font-semibold"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to SplitRush?{' '}
              <button
                onClick={() => onSwitch('signup')}
                className="sr-link font-semibold"
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
