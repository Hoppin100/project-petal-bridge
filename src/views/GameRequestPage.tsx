import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export function GameRequestPage({ onRequireAuth }: { onRequireAuth: () => void }) {
  const { session, profile, loading: authLoading } = useAuth();
  const [gameName, setGameName] = useState('');
  const [gameUrl, setGameUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || busy) return;

    const normalizedUrl = gameUrl.trim();
    try {
      const parsedUrl = new URL(normalizedUrl);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        setError('Enter a public http or https link.');
        return;
      }
    } catch {
      setError('Enter a valid public link for the game.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('game_requests').insert({
        requester_id: profile.id,
        game_name: gameName.trim(),
        game_url: normalizedUrl,
      });
      if (insertError) throw insertError;
    } catch (insertError) {
      console.error('game request failed', insertError);
      setError('Could not send your request. Please try again.');
      return;
    } finally {
      setBusy(false);
    }
    setSent(true);
    setGameName('');
    setGameUrl('');
  }

  return (
    <div className="sr-container max-w-3xl py-8 sm:py-12">
      <div className="border-b border-[var(--sr-border)] pb-5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">Requests</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Request a game</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--sr-text-muted)]">
          Tell us what you want to race. Include a public page for the game so the team can review it.
        </p>
      </div>

      {authLoading ? (
        <div className="mt-6">
          <p className="text-sm text-emerald-700">Loading…</p>
        </div>
      ) : !session ? (
        <div className="mt-6 flex flex-col items-start gap-3 border-b border-[var(--sr-border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--sr-text-dim)]">Sign in to submit a game request.</p>
          <button className="sr-btn-primary" onClick={onRequireAuth}>Sign in</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 max-w-xl space-y-5" aria-busy={busy}>
          {sent && (
            <div role="status" className="flex items-start gap-2 border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Request sent. Thanks for helping build the game library.</span>
            </div>
          )}
          <div>
            <label htmlFor="request-game-name" className="mb-1.5 block text-sm font-medium text-[var(--sr-text)]">Game title</label>
            <input
              id="request-game-name"
              name="gameName"
              required
              minLength={2}
              maxLength={100}
              autoComplete="off"
              value={gameName}
              onChange={(event) => { setGameName(event.target.value); setError(''); setSent(false); }}
              className="sr-input"
              placeholder="e.g. Celeste"
              aria-describedby="request-game-name-help"
            />
            <p id="request-game-name-help" className="mt-1.5 text-xs text-[var(--sr-text-muted)]">Use the title players will recognize.</p>
          </div>
          <div>
            <label htmlFor="request-game-url" className="mb-1.5 block text-sm font-medium text-[var(--sr-text)]">Game page link</label>
            <input
              id="request-game-url"
              name="gameUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              required
              maxLength={2048}
              value={gameUrl}
              onChange={(event) => { setGameUrl(event.target.value); setError(''); setSent(false); }}
              className="sr-input"
              placeholder="https://store.steampowered.com/..."
              aria-describedby={error ? 'request-game-url-error' : 'request-game-url-help'}
              aria-invalid={Boolean(error)}
            />
            <p id="request-game-url-help" className="mt-1.5 text-xs text-[var(--sr-text-muted)]">A store page or official game site works well.</p>
            {error && <p id="request-game-url-error" role="alert" className="mt-1.5 text-sm text-red-400">{error}</p>}
          </div>
          <button disabled={busy || !profile} className="sr-btn-primary" type="submit">
            <Send aria-hidden="true" className="h-4 w-4" />
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}
    </div>
  );
}
