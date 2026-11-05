import { useState, useEffect } from 'react';
import { Loader2, Check, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

export function AccountPage() {
  const { profile, session, loading, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'
  >('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
    }
  }, [profile]);

  // Username availability check (skip if unchanged from current)
  useEffect(() => {
    if (!profile) return;
    const trimmed = username.trim();
    if (trimmed === profile.username) {
      setUsernameStatus('idle');
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 20 || !USERNAME_RE.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    let current = true;
    const t = setTimeout(async () => {
      const { data, error: checkError } = await supabase.rpc('check_username_available', {
        p_username: trimmed,
      });
      if (!current) return;
      if (checkError) { setUsernameStatus('idle'); return; }
      setUsernameStatus(
        data === 'invalid_format' ? 'invalid' : ((data as typeof usernameStatus) ?? 'idle')
      );
    }, 350);
    return () => { current = false; clearTimeout(t); };
  }, [username, profile]);

  if (loading) return <div className="sr-container py-20 text-center text-emerald-700">Loading…</div>;

  if (!session) {
    return (
      <div className="sr-container py-20 text-center text-emerald-100">
        Sign in to manage your account.
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!profile) return;

    const trimmed = username.trim();
    if (trimmed !== profile.username) {
      if (trimmed.length < 3 || trimmed.length > 20 || !USERNAME_RE.test(trimmed)) {
        setError('Username must be 3–20 characters: letters, numbers, underscores.');
        return;
      }
      if (usernameStatus !== 'available') {
        setError('That username is not available.');
        return;
      }
    }

    setSaving(true);
    try {
      const { error: updError } = await supabase
        .from('profiles')
        .update({
          username: trimmed,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', profile.id);
      if (updError) {
        if (updError.code === '23505') {
          throw new Error('That username is taken.');
        }
        throw updError;
      }
      await refreshProfile();
      setSuccess('Account updated.');
    } catch (cause) {
      console.error('account update failed', cause);
      setError(
        cause instanceof Error ? cause.message : 'Could not update account.'
      );
    } finally {
      setSaving(false);
    }
  }

  const usernameHelp = (() => {
    if (username.trim() === profile?.username) {
      return { text: 'Current username', ok: null };
    }
    switch (usernameStatus) {
      case 'checking':
        return { text: 'Checking...', ok: false, pending: true };
      case 'available':
        return { text: 'Available', ok: true };
      case 'taken':
        return { text: 'That username is taken', ok: false };
      case 'invalid':
        return { text: '3–20 chars: letters, numbers, underscores', ok: false };
      case 'reserved':
        return { text: 'That name is reserved', ok: false };
      default:
        return { text: '3–20 chars: letters, numbers, underscores', ok: null };
    }
  })();

  return (
    <div className="sr-container max-w-xl py-8 sm:py-10">
      <header className="mb-6">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">Your profile</p>
        <h1 className="text-3xl font-bold text-[var(--sr-text)]">Account settings</h1>
        <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
          Update your username and profile details.
        </p>
      </header>

      <form onSubmit={handleSave} className="sr-panel flex flex-col gap-5 p-4 sm:p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-emerald-100">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="sr-input"
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
            {usernameHelp.pending && <Loader2 className="h-3 w-3 animate-spin" />}
            {usernameHelp.text}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-emerald-100">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell other runners about yourself..."
            className="sr-input resize-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-emerald-100">
            Profile picture
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Paste a direct image URL (https://...)"
            className="sr-input"
          />
          <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
            Use a public image link. Your picture appears beside your name and on your runner profile.
          </p>
          <div className="mt-3 flex items-center gap-3 rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface)] p-3">
            <Avatar name={username || profile?.username || 'Runner'} src={avatarUrl} className="h-12 w-12 text-base" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">Preview</p>
              <p className="truncate text-sm font-semibold text-[var(--sr-text)]">{username || profile?.username}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <button type="submit" disabled={saving} className="sr-btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </form>

      {profile?.role === 'owner' && (
        <div className="mt-8 rounded-lg border border-[var(--sr-primary)]/30 bg-[var(--sr-primary)]/10 p-4 text-sm text-emerald-200">
          You have owner privileges. You can verify and reject runs, manage
          reference examples, and review AI assessments from the dashboard.
        </div>
      )}
      {profile?.role === 'moderator' && (
        <div className="mt-8 rounded-lg border border-[var(--sr-primary)]/30 bg-[var(--sr-primary)]/10 p-4 text-sm text-emerald-200">
          You have moderator privileges and can preview game pages hidden from the public.
        </div>
      )}
    </div>
  );
}
