import { useState } from 'react';
import { Menu, X, LayoutDashboard, LogOut, Gamepad2, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SearchBar } from '@/components/SearchBar';
import { useAuth } from '@/lib/auth';
import { linkHref } from '@/lib/router';
import { Avatar } from '@/components/Avatar';
import { useRouterState } from '@tanstack/react-router';

interface NavbarProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  launchLocked?: boolean;
}

export function Navbar({ onOpenAuth, launchLocked = false }: NavbarProps) {
  const { profile, signOut } = useAuth();
  const { location } = useRouterState();
  const pathname = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Games', to: '/games' },
    { label: 'Daily Challenge', to: '/daily-challenge' },
    { label: 'Submit', to: '/submit' },
    { label: 'Requests', to: '/request-game' },
  ];

  return (
    <header className="sr-topbar sticky top-0 z-40 bg-[var(--sr-header)] text-[var(--sr-header-text)]">
      <div className="sr-container flex min-h-16 items-center gap-6">
        <div className="flex-shrink-0">
          <Logo onClick={() => setMobileOpen(false)} />
        </div>

        {!launchLocked && (
          <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex">
            {navLinks.map((l) => (
              <a key={l.to} href={linkHref(l.to)} className="sr-nav-link" aria-current={pathname === l.to || (l.to === '/games' && pathname.startsWith('/games/')) ? 'page' : undefined}>
                {l.label}
              </a>
            ))}
          </nav>
        )}

        {!launchLocked && (
          <div className="ml-auto hidden max-w-sm flex-1 md:block">
            <SearchBar />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 md:ml-2">
          {profile ? (
            <div className="hidden items-center gap-2 md:flex">
              {!launchLocked && profile.role === 'owner' && (
                <a
                  href={linkHref('/manage')}
                  className="sr-btn-ghost"
                  title="Manage games"
                >
                  <Gamepad2 className="h-4 w-4" />
                  Manage
                </a>
              )}
              {!launchLocked && profile.role === 'owner' && (
                <a href={linkHref('/members')} className="sr-btn-ghost" title="Manage members"><Users className="h-4 w-4" />Members</a>
              )}
              {!launchLocked && profile.role === 'owner' && (
                <a
                  href={linkHref('/dashboard')}
                  className="sr-btn-ghost"
                  title="Verification dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </a>
              )}
              {!launchLocked && (
                <>
                  <a
                    href={linkHref(`/profile/${profile.username}`)}
                    className="sr-btn-ghost pl-2"
                    title="Your runner profile"
                  >
                    <Avatar name={profile.username} src={profile.avatar_url} className="h-7 w-7 text-xs" />
                    {profile.username}
                  </a>
                  <a href={linkHref('/account')} className="sr-btn-ghost">Account</a>
                </>
              )}
              {launchLocked && (
                <span className="hidden text-sm text-[var(--sr-text-dim)] lg:inline">
                  {profile.username}
                </span>
              )}
              <button onClick={() => void signOut()} className="sr-btn-ghost" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <button
                onClick={() => onOpenAuth('signin')}
                className="sr-btn-ghost"
              >
                Sign in
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="sr-btn-light"
              >
                Sign up
              </button>
            </div>
          )}

          <button
            className="rounded-sm p-2 text-[var(--sr-text-dim)] hover:bg-[var(--sr-surface-2)] hover:text-[var(--sr-text)] md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="border-t border-[var(--sr-border)] bg-[var(--sr-bg-2)] md:hidden">
          <div className="sr-container flex flex-col gap-3 border-t border-[var(--sr-border)] py-4">
            {!launchLocked && (
              <>
                <SearchBar onNavigate={() => setMobileOpen(false)} />
                {navLinks.map((l) => (
                  <a
                    key={l.to}
                    href={linkHref(l.to)}
                    onClick={() => setMobileOpen(false)}
                    className="sr-nav-link py-2"
                    aria-current={pathname === l.to || (l.to === '/games' && pathname.startsWith('/games/')) ? 'page' : undefined}
                  >
                    {l.label}
                  </a>
                ))}
                <div className="h-px bg-[var(--sr-border)]" />
              </>
            )}
            {profile ? (
              <>
                {!launchLocked && profile.role === 'owner' && (
                  <a
                    href={linkHref('/manage')}
                    onClick={() => setMobileOpen(false)}
                    className="sr-nav-link"
                  >
                    Manage Games
                  </a>
                )}
                {!launchLocked && profile.role === 'owner' && (
                  <a href={linkHref('/members')} onClick={() => setMobileOpen(false)} className="sr-nav-link">Members</a>
                )}
                {!launchLocked && profile.role === 'owner' && (
                  <a
                    href={linkHref('/dashboard')}
                    onClick={() => setMobileOpen(false)}
                    className="sr-nav-link"
                  >
                    Dashboard
                  </a>
                )}
                {!launchLocked && (
                  <>
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
                  </>
                )}
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
