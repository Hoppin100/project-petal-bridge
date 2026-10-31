import { useState } from 'react';
import { Menu, X, LayoutDashboard, LogOut, Gamepad2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SearchBar } from '@/components/SearchBar';
import { useAuth } from '@/lib/auth';
import { linkHref } from '@/lib/router';
import { Avatar } from '@/components/Avatar';

interface NavbarProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Browse games', to: '/games' },
    { label: 'Request a game', to: '/request-game' },
    { label: 'Submit a run', to: '/submit' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--sr-border)] bg-[var(--sr-bg)]">
      <div className="sr-container flex min-h-14 items-center gap-5">
        <div className="flex-shrink-0">
          <Logo onClick={() => setMobileOpen(false)} />
        </div>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 border-l border-[var(--sr-border)] pl-5 md:flex">
          {navLinks.map((l) => (
            <a key={l.to} href={linkHref(l.to)} className="sr-nav-link">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden max-w-sm flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-2">
          {profile ? (
            <div className="hidden items-center gap-2 sm:flex">
              {profile.role === 'owner' && (
                <a
                  href={linkHref('/manage')}
                  className="sr-btn-ghost"
                  title="Manage games"
                >
                  <Gamepad2 className="h-4 w-4" />
                  Manage
                </a>
              )}
              {profile.role === 'owner' && (
                <a
                  href={linkHref('/dashboard')}
                  className="sr-btn-ghost"
                  title="Verification dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </a>
              )}
              <a
                href={linkHref(`/profile/${profile.username}`)}
                className="sr-btn-ghost pl-2"
                title="Your runner profile"
              >
                <Avatar name={profile.username} src={profile.avatar_url} className="h-7 w-7 text-xs" />
                {profile.username}
              </a>
              <a href={linkHref('/account')} className="sr-btn-ghost">Account</a>
              <button onClick={() => void signOut()} className="sr-btn-ghost">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={() => onOpenAuth('signin')}
                className="sr-btn-ghost"
              >
                Sign in
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="sr-btn-primary"
              >
                Sign up
              </button>
            </div>
          )}

          <button
            className="rounded-sm p-2 text-[var(--sr-text-dim)] hover:bg-[var(--sr-surface-2)] hover:text-[var(--sr-text)] md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--sr-border)] bg-[var(--sr-bg-2)] md:hidden">
          <div className="sr-container flex flex-col gap-3 border-t border-[var(--sr-border)] py-4">
            <SearchBar onNavigate={() => setMobileOpen(false)} />
            {navLinks.map((l) => (
              <a
                key={l.to}
                href={linkHref(l.to)}
                onClick={() => setMobileOpen(false)}
                className="sr-nav-link py-2"
              >
                {l.label}
              </a>
            ))}
            <div className="h-px bg-[var(--sr-border)]" />
            {profile ? (
              <>
                {profile.role === 'owner' && (
                  <a
                    href={linkHref('/manage')}
                    onClick={() => setMobileOpen(false)}
                    className="sr-nav-link"
                  >
                    Manage Games
                  </a>
                )}
                {profile.role === 'owner' && (
                  <a
                    href={linkHref('/dashboard')}
                    onClick={() => setMobileOpen(false)}
                    className="sr-nav-link"
                  >
                    Dashboard
                  </a>
                )}
                <a
                  href={linkHref(`/profile/${profile.username}`)}
                  onClick={() => setMobileOpen(false)}
                  className="sr-nav-link flex items-center gap-2"
                >
                  <Avatar name={profile.username} src={profile.avatar_url} className="h-7 w-7 text-xs" />
                  {profile.username}
                </a>
                <a
                  href={linkHref('/account')}
                  onClick={() => setMobileOpen(false)}
                  className="sr-nav-link"
                >
                  Account settings
                </a>
                <button
                  onClick={() => {
                    void signOut();
                    setMobileOpen(false);
                  }}
                  className="sr-nav-link text-left"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onOpenAuth('signin');
                    setMobileOpen(false);
                  }}
                  className="sr-btn-ghost flex-1"
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    onOpenAuth('signup');
                    setMobileOpen(false);
                  }}
                  className="sr-btn-primary flex-1"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
