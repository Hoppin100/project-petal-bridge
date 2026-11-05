import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { linkHref } from '@/lib/router';

export function MembersPage() {
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('id, username, role, bio, avatar_url, created_at')
      .order('username');
    if (loadError) setError('Members could not be loaded. Try again.');
    else setMembers((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (session && profile?.role === 'owner') void load();
    else setLoading(false);
  }, [authLoading, session, profile?.role]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((member) => member.username.toLowerCase().includes(q)) : members;
  }, [members, query]);

  async function changeRole(member: Profile, role: 'owner' | 'member') {
    const action = role === 'owner' ? `Make ${member.username} an owner?` : `Remove owner access from ${member.username}?`;
    if (!confirm(action)) return;
    setBusyId(member.id);
    setError('');
    setNotice('');
    const { error: roleError } = await supabase.rpc('set_member_role', { p_member: member.id, p_role: role });
    setBusyId(null);
    if (roleError) {
      setError(roleError.message.includes('own owner') ? 'You cannot remove your own owner access.' : roleError.message.includes('At least one') ? 'SplitRush needs at least one owner.' : 'That role could not be changed.');
      return;
    }
    setNotice(role === 'owner' ? `${member.username} is now an owner.` : `${member.username} is now a member.`);
    await Promise.all([load(), refreshProfile()]);
  }

  if (authLoading) return <div className="sr-container py-20 text-center text-[var(--sr-text-muted)]">Loading…</div>;
  if (!session) return <div className="sr-container py-20 text-center text-[var(--sr-text-dim)]">Sign in to manage members.</div>;
  if (profile?.role !== 'owner') return <div className="sr-container py-20 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[var(--sr-text-muted)]" /><h1 className="mt-4 text-2xl font-bold">Owners only</h1></div>;

  return <div className="sr-container max-w-5xl py-8 sm:py-10">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">Owner tools</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-bold"><Users className="h-7 w-7" />Members</h1><p className="mt-1 text-sm text-[var(--sr-text-muted)]">Promote trusted members or remove owner access.</p></div>
      <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sr-text-muted)]" /><input className="sr-input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a member" aria-label="Find a member" /></div>
    </div>
    {error && <p role="alert" className="mb-4 border-l-2 border-red-400 px-3 py-2 text-sm text-red-300">{error} <button className="sr-link ml-2" onClick={() => void load()}>Retry</button></p>}
    {notice && <p role="status" className="mb-4 border-l-2 border-[var(--sr-primary)] px-3 py-2 text-sm text-[var(--sr-text-dim)]">{notice}</p>}
    {loading ? <div className="sr-panel p-8 text-center text-sm text-[var(--sr-text-muted)]">Loading members…</div> : visible.length === 0 ? <div className="sr-panel p-8 text-center text-sm text-[var(--sr-text-muted)]">No members found. Try another name.</div> : <div className="sr-panel divide-y divide-[var(--sr-border)] px-4">
      {visible.map((member) => <div key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <a href={linkHref(`/profile/${member.username}`)} className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={member.username} src={member.avatar_url} className="h-9 w-9 text-xs" /><span className="truncate font-semibold">{member.username}</span>{member.id === profile.id && <span className="text-xs text-[var(--sr-primary)]">You</span>}</a>
        <span className="sr-badge w-fit bg-[var(--sr-surface-2)] capitalize text-[var(--sr-text-dim)]">{member.role}</span>
        {member.role === 'owner' ? <button disabled={busyId !== null || member.id === profile.id} onClick={() => void changeRole(member, 'member')} className="sr-btn-ghost">{busyId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}Make member</button> : <button disabled={busyId !== null} onClick={() => void changeRole(member, 'owner')} className="sr-btn-primary">{busyId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Make owner</button>}
      </div>)}
    </div>}
  </div>;
}