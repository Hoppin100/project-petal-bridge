import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { AuthModalContext } from "@/lib/auth-modal";
import { registerNavigator } from "@/lib/router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthModal } from "@/components/AuthModal";
import { LaunchCountdown, LAUNCH_AT } from "@/components/LaunchCountdown";
import { useAuth } from "@/lib/auth";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="sr-container flex min-h-[65vh] items-center justify-center py-12">
      <div className="sr-panel w-full max-w-lg p-8 text-center sm:p-10">
        <p className="sr-mono text-5xl font-bold text-[var(--sr-primary)]">404</p>
        <h1 className="mt-4 text-2xl font-bold text-[var(--sr-text)]">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sr-text-muted)]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to="/"
            className="sr-btn-primary"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="sr-container flex min-h-[65vh] items-center justify-center py-12">
      <div className="sr-panel w-full max-w-lg p-8 text-center sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--sr-text)]">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sr-text-muted)]">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="sr-btn-primary"
          >
            Try again
          </button>
          <a
            href="/"
            className="sr-btn-ghost"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SplitRush — Speedrun Leaderboards" },
      { name: "description", content: "Track speedrun times, compare runs, and climb the SplitRush leaderboards." },
      { name: "theme-color", content: "#111712" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const router = useRouter();
  const { loading, profile } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const openAuth = useCallback((mode: "signin" | "signup") => setAuthMode(mode), []);

  useEffect(() => {
    const updateNow = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= LAUNCH_AT) window.clearInterval(timer);
    };
    const timer = window.setInterval(updateNow, 1000);
    updateNow();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    registerNavigator((to) => router.history.push(to));
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault();
      router.history.push(href);
      window.scrollTo({ top: 0 });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  const siteReady = !loading && now !== null;
  const launchLocked =
    !siteReady ||
    (now < LAUNCH_AT && profile?.role !== "owner");

  return (
    <AuthModalContext.Provider value={openAuth}>
      <div className="flex min-h-screen flex-col">
        <a className="sr-skip-link" href="#main-content">Skip to content</a>
        <Navbar onOpenAuth={openAuth} launchLocked={launchLocked} />
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {siteReady ? (
            launchLocked ? (
              <LaunchCountdown
                now={now}
                username={profile?.username}
                onOpenAuth={openAuth}
              />
            ) : (
              <Outlet />
            )
          ) : (
            <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-[var(--sr-text-muted)]">
              Loading SplitRush…
            </div>
          )}
        </main>
        {siteReady && <Footer launchLocked={launchLocked} />}
        {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} />}
      </div>
    </AuthModalContext.Provider>
  );
}
