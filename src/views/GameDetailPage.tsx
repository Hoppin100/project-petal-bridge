import { useEffect, useState } from 'react';
import {
  Trophy,
  ArrowLeft,
  ExternalLink,
  Info,
  Gamepad2,
  Medal,
  ChevronDown,
  ChevronRight,
  Timer,
  TrendingUp,
  BookOpen,
  MessageSquare,
  Swords,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchGameBySlug } from '@/lib/games';
import type { Game, Category, Run, Profile, RecordSubmission } from '@/lib/types';
import { Leaderboard } from '@/components/Leaderboard';
import { RecordLeaderboard } from '@/components/RecordLeaderboard';
import { GameGuides } from '@/components/GameGuides';
import { GameForums } from '@/components/GameForums';
import { linkHref } from '@/lib/router';
import { formatTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { isComingSoonGame } from '@/lib/games';
import { useOwnerPreview } from '@/lib/preview';
import { isSlowerIsBetterGame } from '@/lib/game-rules';
import {
  RECORD_SUBMISSION_COLUMNS,
  fetchGameCompetitions,
  isRecordCategory,
  recordDirectionLabel,
} from '@/lib/competitions';
import {
  categoriesForType,
  gameTabs,
  groupCategories,
  resolveGameTab,
  supportedCompetitionTypes,
  type GameTab,
} from '@/lib/game-tabs';

interface GameDetailPageProps {
  slug: string;
}

export function GameDetailPage({ slug }: GameDetailPageProps) {
  const { profile, loading: authLoading } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [competitions, setCompetitions] = useState<Category[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [recordSubmissions, setRecordSubmissions] = useState<RecordSubmission[]>([]);
  const [runnerMap, setRunnerMap] = useState<Record<string, Profile>>({});
  const [activeSpeedrunId, setActiveSpeedrunId] = useState<string | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GameTab>('overview');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [underConstruction, setUnderConstruction] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [recordsUnavailable, setRecordsUnavailable] = useState(false);
  const ownerPreview = useOwnerPreview();
  const slowerIsBetter =
    profile?.role === 'owner' && game ? isSlowerIsBetterGame(game, true) : false;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setUnderConstruction(false);
      setLoadError('');
      const { data: isUnderConstruction, error: visibilityError } = await supabase.rpc(
        'is_game_under_construction',
        { p_slug: slug }
      );
      if (cancelled) return;
      if (visibilityError) {
        const visibilityMigrationMissing =
          (visibilityError.code === 'PGRST202' || visibilityError.code === '42883') &&
          /is_game_under_construction/i.test(visibilityError.message);
        if (visibilityMigrationMissing) {
          console.warn('Game visibility migration is not applied; loading the public game page without hidden-game support.');
        } else {
          console.error('Could not check game visibility', visibilityError);
          setLoadError(visibilityError.message);
          setLoading(false);
          return;
        }
      }
      const isStaff = profile?.role === 'owner' || profile?.role === 'moderator';
      if (isUnderConstruction && !isStaff) {
        setUnderConstruction(true);
        setLoading(false);
        return;
      }
      const { game: g, error } = await fetchGameBySlug(slug);
      if (cancelled) return;
      if (error) {
        console.error('Could not load game', error);
        setLoadError(error);
        setLoading(false);
        return;
      }
      if (!g) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGame(g as Game);

      const { categories, error: competitionsError } = await fetchGameCompetitions(g.id);
      if (cancelled) return;
      if (competitionsError) {
        console.error('Could not load competitions', competitionsError);
        setLoadError(competitionsError);
        setLoading(false);
        return;
      }
      const firstSpeedrun = categories.find(
        (category) => !isRecordCategory(category) && !category.parent_category_id
      ) ?? categories.find((category) => !isRecordCategory(category));
      const firstRecord = categories.find(
        (category) => isRecordCategory(category) && !category.parent_category_id
      ) ?? categories.find((category) => isRecordCategory(category));
      setCompetitions(categories);
      setActiveSpeedrunId(firstSpeedrun?.id ?? null);
      setActiveRecordId(firstRecord?.id ?? null);
      setExpandedCategoryId(null);
      setExpandedRecordId(null);
      setActiveTab('overview');

      setLoading(false);
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.error('Could not load game page', error);
      setLoadError('The game library could not be reached. Check the Supabase connection and try again.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, authLoading, profile?.role]);

  // Speedrun leaderboard for the selected speedrun competition.
  useEffect(() => {
    if (!activeSpeedrunId) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: r } = await supabase
        .from('runs')
        .select(
          'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at'
        )
        .eq('category_id', activeSpeedrunId)
        .eq('status', 'verified')
        .order('time_ms', { ascending: !slowerIsBetter })
        .limit(100);
      if (cancelled) return;
      const runList = (r as Run[]) ?? [];
      setRuns(runList);
      await loadRunners(runList.map((run) => run.runner_id));
    })();
    return () => {
      cancelled = true;
    };

    async function loadRunners(ids: string[]) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return;
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, role, bio, avatar_url, created_at')
        .in('id', unique);
      if (cancelled) return;
      const map: Record<string, Profile> = {};
      for (const p of (profs as Profile[]) ?? []) map[p.id] = p;
      setRunnerMap((current) => ({ ...current, ...map }));
    }
  }, [activeSpeedrunId, slowerIsBetter]);

  // Record leaderboard for the selected record competition.
  useEffect(() => {
    if (!ownerPreview || !activeRecordId) {
      setRecordSubmissions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: s, error } = await supabase
        .from('record_submissions')
        .select(RECORD_SUBMISSION_COLUMNS)
        .eq('category_id', activeRecordId)
        .eq('status', 'verified')
        .order('value_numeric', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        const missingTable =
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          /record_submissions/i.test(error.message);
        if (missingTable) {
          setRecordsUnavailable(true);
          setRecordSubmissions([]);
          return;
        }
        console.error('Could not load records', error);
        setRecordSubmissions([]);
        return;
      }
      setRecordsUnavailable(false);
      const list = (s as RecordSubmission[]) ?? [];
      setRecordSubmissions(list);
      const ids = [...new Set(list.map((entry) => entry.submitter_id))];
      if (ids.length === 0) return;
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, role, bio, avatar_url, created_at')
        .in('id', ids);
      if (cancelled) return;
      const map: Record<string, Profile> = {};
      for (const p of (profs as Profile[]) ?? []) map[p.id] = p;
      setRunnerMap((current) => ({ ...current, ...map }));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRecordId, ownerPreview]);

  if (loading || authLoading) {
    return (
      <div className="sr-container py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-primary)] border-t-transparent" />
      </div>
    );
  }

  if (underConstruction) {
    return (
      <div className="sr-container py-20 text-center">
        <Gamepad2 className="mx-auto h-12 w-12 text-[var(--sr-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--sr-text)]">
          This page is under construction
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--sr-text-muted)]">
          This game page is not available to the public yet.
        </p>
        <a href={linkHref('/games')} className="sr-btn-ghost mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to games
        </a>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="sr-container py-16 text-center">
        <h1 className="text-2xl font-bold">Game data unavailable</h1>
        <p role="alert" className="mx-auto mt-2 max-w-xl text-sm text-[var(--sr-text-muted)]">
          The game library could not be reached. Check the Supabase connection and try again.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="sr-btn-ghost mt-5">Retry</button>
      </div>
    );
  }

  if (notFound || !game) {
    return (
      <div className="sr-container py-20 text-center">
        <Trophy className="mx-auto h-12 w-12 text-[var(--sr-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--sr-text)]">Game not found</h1>
        <a href={linkHref('/games')} className="sr-btn-ghost mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to games
        </a>
      </div>
    );
  }

  const speedrunCategories = categoriesForType(competitions, 'speedrun');
  const recordCategories = ownerPreview ? categoriesForType(competitions, 'record') : [];
  const activeSpeedrun = speedrunCategories.find((c) => c.id === activeSpeedrunId);
  const activeRecord = recordCategories.find((c) => c.id === activeRecordId);
  const worldRecord = runs[0];
  const comingSoon = !ownerPreview && isComingSoonGame(game);
  const support = supportedCompetitionTypes(competitions);
  const tabs = gameTabs(support);
  const currentTab = resolveGameTab(activeTab, tabs);

  const header = (
    <GameHeader game={game} comingSoon={comingSoon} worldRecord={worldRecord} />
  );

  // Published experience: keep the existing game page for visitors until the
  // owner publishes the tabbed layout.
  if (!ownerPreview) {
    return (
      <div className="sr-container pb-12">
        {header}
        {competitions.length === 0 && <NoCategories />}
        {speedrunCategories.length > 0 && (
          <SpeedrunPanel
            categories={speedrunCategories}
            activeId={activeSpeedrunId}
            onSelect={setActiveSpeedrunId}
            expandedCategoryId={expandedCategoryId}
            onExpand={setExpandedCategoryId}
            runs={runs}
            runnerMap={runnerMap}
            slowerIsBetter={slowerIsBetter}
            showHeading={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="sr-container pb-12">
      {header}

      <nav
        className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--sr-border)]"
        aria-label="Game sections"
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="game-tab-panel"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                selected
                  ? 'border-[var(--sr-primary)] text-[var(--sr-text)]'
                  : 'border-transparent text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]'
              }`}
            >
              {tab.id === 'speedruns' && <Timer aria-hidden="true" className="h-4 w-4" />}
              {tab.id === 'records' && <TrendingUp aria-hidden="true" className="h-4 w-4" />}
              {tab.id === 'guides' && <BookOpen aria-hidden="true" className="h-4 w-4" />}
              {tab.id === 'forums' && <MessageSquare aria-hidden="true" className="h-4 w-4" />}
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div
        id="game-tab-panel"
        role="tabpanel"
        aria-label={`${tabs.find((tab) => tab.id === currentTab)?.label ?? 'Game'} section`}
        className="pt-5"
      >
        {currentTab === 'overview' && (
          <GameOverview
            game={game}
            categories={competitions}
            support={support}
            worldRecord={worldRecord}
            onOpenTab={setActiveTab}
          />
        )}

        {currentTab === 'speedruns' && (
          <>
            {speedrunCategories.length === 0 ? (
              <NoCategories />
            ) : (
              <SpeedrunPanel
                categories={speedrunCategories}
                activeId={activeSpeedrunId}
                onSelect={setActiveSpeedrunId}
                expandedCategoryId={expandedCategoryId}
                onExpand={setExpandedCategoryId}
                runs={runs}
                runnerMap={runnerMap}
                slowerIsBetter={slowerIsBetter}
                showHeading
              />
            )}
          </>
        )}

        {currentTab === 'records' && (
          <RecordPanel
            game={game}
            categories={recordCategories}
            activeId={activeRecordId}
            activeRecord={activeRecord}
            onSelect={setActiveRecordId}
            expandedCategoryId={expandedRecordId}
            onExpand={setExpandedRecordId}
            submissions={recordSubmissions}
            runnerMap={runnerMap}
            recordsUnavailable={recordsUnavailable}
          />
        )}

        {currentTab === 'guides' && <GameGuides game={game} />}
        {currentTab === 'forums' && <GameForums game={game} />}
      </div>
    </div>
  );
}

function GameHeader({
  game,
  comingSoon,
  worldRecord,
}: {
  game: Game;
  comingSoon: boolean;
  worldRecord: Run | undefined;
}) {
  return (
    <section className="border-b border-[var(--sr-border)] py-6">
      <div className="mb-6 flex items-center justify-between">
        <a
          href={linkHref('/games')}
          className="inline-flex items-center gap-1 text-sm text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          All games
        </a>

        <span className="sr-mono text-xs text-[var(--sr-text-muted)]">{game.source || 'Game leaderboard'}</span>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex h-36 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)] sm:h-40 sm:w-56">
          {game.cover_url ? (
            <img
              src={game.cover_url}
              alt={game.title}
              className="h-full w-full object-cover"
              onError={(event) => event.currentTarget.remove()}
            />
          ) : <Gamepad2 className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          {game.is_featured && <p className="sr-eyebrow">Featured leaderboard</p>}
          <h1 className="text-2xl font-bold sm:text-4xl">{game.title}</h1>
          {comingSoon && (
            <p className="mt-2 inline-flex rounded-sm bg-[var(--sr-warn)] px-2 py-1 text-xs font-bold uppercase tracking-wide text-black">
              Coming soon
            </p>
          )}
          {game.blurb && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sr-text-dim)]">
              {game.blurb}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {comingSoon ? (
              <div>
                <button type="button" disabled className="sr-btn-primary cursor-not-allowed opacity-60">
                  Submit a run
                </button>
                <p role="status" className="mt-2 text-sm text-[var(--sr-warn)]">
                  Cannot submit a run yet — {game.title} hasn’t been released.
                </p>
              </div>
            ) : (
              <a href={linkHref(`/submit?game=${game.id}`)} className="sr-btn-primary">
                Submit a run
              </a>
            )}
            {game.page_url && (
              <a
                href={game.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="sr-btn-ghost"
              >
                <ExternalLink className="h-4 w-4" />
                Game page
              </a>
            )}
            {worldRecord && (
              <div className="flex items-center gap-2 border-l-2 border-[var(--sr-primary)] pl-3">
                <span className="text-xs text-[var(--sr-text-muted)]">Record</span>
                <span className="sr-mono text-lg font-semibold text-[var(--sr-text)]">
                  {formatTime(worldRecord.time_ms)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function NoCategories() {
  return (
    <section className="sr-panel mt-6 p-4 sm:p-5">
      <div className="py-8 text-center">
        <Medal className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
        <p className="mt-3 font-semibold text-[var(--sr-text)]">No categories yet</p>
        <p className="mt-1 text-sm text-[var(--sr-text-muted)]">Leaderboards will appear here when categories are added.</p>
      </div>
    </section>
  );
}

function GameOverview({
  game,
  categories,
  support,
  worldRecord,
  onOpenTab,
}: {
  game: Game;
  categories: Category[];
  support: { speedruns: boolean; records: boolean };
  worldRecord: Run | undefined;
  onOpenTab: (tab: GameTab) => void;
}) {
  const speedruns = categoriesForType(categories, 'speedrun');
  const records = categoriesForType(categories, 'record');
  const mainSpeedruns = speedruns.filter((category) => !category.parent_category_id);
  const mainRecords = records.filter((category) => !category.parent_category_id);

  return (
    <div className="flex flex-col gap-4">
      <section className="sr-panel p-4 sm:p-5">
        <p className="sr-eyebrow flex items-center gap-2">
          <Swords aria-hidden="true" className="h-3.5 w-3.5" />
          Overview
        </p>
        <h2 className="text-lg font-bold">{game.title}</h2>
        {game.blurb ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sr-text-dim)]">{game.blurb}</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--sr-text-muted)]">
            No description has been added for this game yet.
          </p>
        )}
        <dl className="mt-4 grid gap-3 border-t border-[var(--sr-border)] pt-4 sm:grid-cols-3">
          <div>
            <dt className="sr-stat-label">Platform</dt>
            <dd className="mt-0.5 text-sm font-semibold">{game.source || '—'}</dd>
          </div>
          <div>
            <dt className="sr-stat-label">Speedrun boards</dt>
            <dd className="sr-mono mt-0.5 text-sm font-semibold">
              {support.speedruns ? speedruns.length : 'Not offered'}
            </dd>
          </div>
          <div>
            <dt className="sr-stat-label">Record boards</dt>
            <dd className="sr-mono mt-0.5 text-sm font-semibold">
              {support.records ? records.length : 'Not offered'}
            </dd>
          </div>
        </dl>
        {worldRecord && (
          <p className="mt-3 border-l-2 border-[var(--sr-primary)] pl-3 text-sm text-[var(--sr-text-muted)]">
            Fastest verified time right now:{' '}
            <span className="sr-mono font-semibold text-[var(--sr-text)]">
              {formatTime(worldRecord.time_ms)}
            </span>
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {support.speedruns && (
          <OverviewCard
            icon={<Timer className="h-5 w-5" />}
            eyebrow="Competition"
            title="Speedruns"
            description={`${speedruns.length} timed ${speedruns.length === 1 ? 'board' : 'boards'} with video proof and verification.`}
            items={mainSpeedruns.slice(0, 4).map((category) => category.name)}
            actionLabel="View speedruns"
            onAction={() => onOpenTab('speedruns')}
          />
        )}
        {support.records && (
          <OverviewCard
            icon={<TrendingUp className="h-5 w-5" />}
            eyebrow="Competition"
            title="Records"
            description={`${records.length} numeric ${records.length === 1 ? 'board' : 'boards'} ranked by the best value.`}
            items={mainRecords.slice(0, 4).map((category) => category.name)}
            actionLabel="View records"
            onAction={() => onOpenTab('records')}
          />
        )}
        <OverviewCard
          icon={<BookOpen className="h-5 w-5" />}
          eyebrow="Community"
          title="Guides"
          description="Walkthroughs, advanced strategies, and glitch explanations written by players."
          actionLabel="Browse guides"
          onAction={() => onOpenTab('guides')}
        />
        <OverviewCard
          icon={<MessageSquare className="h-5 w-5" />}
          eyebrow="Community"
          title="Forums"
          description="Ask for help, share strategies, and talk through routes with other runners."
          actionLabel="Open forums"
          onAction={() => onOpenTab('forums')}
        />
      </div>
    </div>
  );
}

function OverviewCard({
  icon,
  eyebrow,
  title,
  description,
  items,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  items?: string[];
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="sr-card flex flex-col p-4">
      <div className="flex items-center gap-2 text-[var(--sr-primary)]">
        {icon}
        <p className="sr-eyebrow mb-0">{eyebrow}</p>
      </div>
      <h3 className="mt-1 text-base font-bold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--sr-text-muted)]">{description}</p>
      {items && items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-sm border border-[var(--sr-border)] px-2 py-0.5 text-xs text-[var(--sr-text-dim)]"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onAction} className="sr-btn-ghost mt-4 self-start">
        {actionLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function SpeedrunPanel({
  categories,
  activeId,
  onSelect,
  expandedCategoryId,
  onExpand,
  runs,
  runnerMap,
  slowerIsBetter,
  showHeading,
}: {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  expandedCategoryId: string | null;
  onExpand: (id: string | null) => void;
  runs: Run[];
  runnerMap: Record<string, Profile>;
  slowerIsBetter: boolean;
  showHeading: boolean;
}) {
  const active = categories.find((category) => category.id === activeId);
  const mainCategories = categories.filter((category) => !category.parent_category_id);
  const visibleSubcategories = categories.filter(
    (category) => category.parent_category_id === expandedCategoryId
  );

  return (
    <section className="sr-panel mt-6 p-4 sm:p-5" aria-label="Speedrun leaderboards">
      {showHeading && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="sr-eyebrow flex items-center gap-2">
              <Timer aria-hidden="true" className="h-3.5 w-3.5" />
              Speedruns
            </p>
            <h2 className="text-lg font-bold">Timed leaderboards</h2>
          </div>
          <span className="text-xs text-[var(--sr-text-muted)]">
            {mainCategories.length} {mainCategories.length === 1 ? 'competition' : 'competitions'}
          </span>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--sr-border)]" role="group" aria-label="Speedrun category">
        {mainCategories.map((category) => {
          const hasSubcategories = categories.some((item) => item.parent_category_id === category.id);
          const isActive = active?.parent_category_id
            ? active.parent_category_id === category.id
            : active?.id === category.id;
          const isExpanded = expandedCategoryId === category.id;
          return (
            <button
              key={category.id}
              aria-pressed={isActive}
              onClick={() => {
                onSelect(category.id);
                onExpand(
                  hasSubcategories ? (isExpanded ? null : category.id) : null
                );
              }}
              className={`inline-flex flex-shrink-0 items-center gap-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-[var(--sr-primary)] text-[var(--sr-text)]'
                  : 'border-transparent text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]'
              }`}
            >
              {category.name}
              {hasSubcategories && (isExpanded
                ? <ChevronDown aria-hidden="true" className="h-4 w-4" />
                : <ChevronRight aria-hidden="true" className="h-4 w-4" />)}
            </button>
          );
        })}
      </div>

      {expandedCategoryId && visibleSubcategories.length > 0 && (
        <div
          id={`subcategories-${expandedCategoryId}`}
          className="mb-5 border-b border-[var(--sr-border)] bg-[var(--sr-surface)] px-3 py-3"
          aria-label={`Subcategories of ${mainCategories.find((category) => category.id === expandedCategoryId)?.name ?? 'category'}`}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
            Subcategories
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleSubcategories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={activeId === category.id}
                onClick={() => onSelect(category.id)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  activeId === category.id
                    ? 'border-[var(--sr-primary)] bg-[var(--sr-primary)]/10 text-[var(--sr-text)]'
                    : 'border-[var(--sr-border)] text-[var(--sr-text-muted)] hover:border-[var(--sr-border-hover)] hover:text-[var(--sr-text)]'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {active?.timing_rules && (
        <div className="mb-5 flex items-start gap-2 border-l-2 border-[var(--sr-border-hover)] bg-[var(--sr-surface)] px-3 py-2.5 text-sm text-[var(--sr-text-dim)]">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
          <div>
            <span className="font-semibold text-[var(--sr-text)]">Timing rules:</span>{' '}
            {active.timing_rules}
          </div>
        </div>
      )}

      <div className="mb-3 mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">Leaderboard</h3>
        {active && <p className="text-sm text-[var(--sr-text-muted)]">{active.name}</p>}
      </div>
      <Leaderboard runs={runs} runnerMap={runnerMap} slowerIsBetter={slowerIsBetter} />
    </section>
  );
}

function RecordPanel({
  game,
  categories,
  activeId,
  activeRecord,
  onSelect,
  expandedCategoryId,
  onExpand,
  submissions,
  runnerMap,
  recordsUnavailable,
}: {
  game: Game;
  categories: Category[];
  activeId: string | null;
  activeRecord: Category | undefined;
  onSelect: (id: string) => void;
  expandedCategoryId: string | null;
  onExpand: (id: string | null) => void;
  submissions: RecordSubmission[];
  runnerMap: Record<string, Profile>;
  recordsUnavailable: boolean;
}) {
  if (categories.length === 0) {
    return <NoCategories />;
  }

  const groups = groupCategories(categories);
  const orphanCategories = categories.filter(
    (category) =>
      category.parent_category_id &&
      !categories.some((parent) => parent.id === category.parent_category_id),
  );
  const mainCategories = groups.map((group) => group.main);
  const activeParentId = activeRecord?.parent_category_id ?? activeId;
  const activeGroup = groups.find(
    (group) => group.main.id === activeParentId || group.children.some((child) => child.id === activeId),
  );
  const visibleSubcategories =
    activeGroup?.main.id === expandedCategoryId ? activeGroup.children : [];
  const flatCategories = mainCategories.length > 0 ? null : orphanCategories;
  const mainCount = flatCategories ? flatCategories.length : mainCategories.length;
  const subcategoryCount = groups.reduce((count, group) => count + group.children.length, 0);

  return (
    <section className="sr-panel p-4 sm:p-5" aria-label="Record leaderboards">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="sr-eyebrow flex items-center gap-2">
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
            Records
          </p>
          <h2 className="text-lg font-bold">Numeric record boards</h2>
        </div>
        <span className="text-xs text-[var(--sr-text-muted)]">
          {mainCount} {mainCount === 1 ? 'competition' : 'competitions'}
          {subcategoryCount > 0 &&
            ` · ${subcategoryCount} ${subcategoryCount === 1 ? 'variant' : 'variants'}`}
        </span>
      </div>

      {recordsUnavailable ? (
        <p role="status" className="border-l-2 border-[var(--sr-warn)] px-3 py-2 text-sm text-[var(--sr-text-muted)]">
          Record boards are not available yet. Apply
          {' '}drizzle/migrations/0009_competition_types.sql
          {' '}to the project database to enable them.
        </p>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--sr-border)]" role="group" aria-label="Record competition">
            {flatCategories
              ? flatCategories.map((category) => {
                  const isActive = activeId === category.id;
                  return (
                    <button
                      key={category.id}
                      aria-pressed={isActive}
                      onClick={() => onSelect(category.id)}
                      className={`inline-flex flex-shrink-0 items-center gap-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'border-[var(--sr-primary)] text-[var(--sr-text)]'
                          : 'border-transparent text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]'
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })
              : groups.map((group) => {
                  const isActive = activeParentId === group.main.id;
                  const hasSubcategories = group.children.length > 0;
                  const isExpanded = expandedCategoryId === group.main.id;
                  return (
                    <button
                      key={group.main.id}
                      aria-pressed={isActive}
                      onClick={() => {
                        onSelect(group.main.id);
                        onExpand(hasSubcategories ? (isExpanded ? null : group.main.id) : null);
                      }}
                      className={`inline-flex flex-shrink-0 items-center gap-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'border-[var(--sr-primary)] text-[var(--sr-text)]'
                          : 'border-transparent text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]'
                      }`}
                    >
                      {group.main.name}
                      {hasSubcategories &&
                        (isExpanded ? (
                          <ChevronDown aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <ChevronRight aria-hidden="true" className="h-4 w-4" />
                        ))}
                    </button>
                  );
                })}
          </div>

          {visibleSubcategories.length > 0 && (
            <div
              className="mb-5 border-b border-[var(--sr-border)] bg-[var(--sr-surface)] px-3 py-3"
              aria-label={`Record variants under ${activeGroup?.main.name ?? 'competition'}`}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                Variants of {activeGroup?.main.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {visibleSubcategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={activeId === category.id}
                    onClick={() => onSelect(category.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      activeId === category.id
                        ? 'border-[var(--sr-primary)] bg-[var(--sr-primary)]/10 text-[var(--sr-text)]'
                        : 'border-[var(--sr-border)] text-[var(--sr-text-muted)] hover:border-[var(--sr-border-hover)] hover:text-[var(--sr-text)]'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeRecord && (
            <div className="mb-5 mt-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-base font-bold">{activeRecord.name}</h3>
                <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-text-dim)]">
                  {activeRecord.record_unit ?? 'Value'}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {recordDirectionLabel(activeRecord.record_higher_is_better)}
                </span>
              </div>
              {activeRecord.record_description && (
                <p className="max-w-3xl text-sm text-[var(--sr-text-dim)]">
                  {activeRecord.record_description}
                </p>
              )}
              {activeRecord.record_rules && (
                <div className="flex items-start gap-2 border-l-2 border-[var(--sr-border-hover)] bg-[var(--sr-surface)] px-3 py-2.5 text-sm text-[var(--sr-text-dim)]">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
                  <div>
                    <span className="font-semibold text-[var(--sr-text)]">Rules: </span>
                    {activeRecord.record_rules}
                  </div>
                </div>
              )}
              <a
                href={linkHref(`/submit?game=${game.id}&competition=${activeRecord.id}`)}
                className="sr-btn-ghost self-start"
              >
                Submit this record
              </a>
            </div>
          )}

          <RecordLeaderboard
            submissions={submissions}
            competition={activeRecord ?? { ...emptyRecordCompetition, id: '', game_id: game.id, name: '' }}
            submitterMap={runnerMap}
          />
        </>
      )}
    </section>
  );
}

const emptyRecordCompetition: Category = {
  id: '',
  game_id: '',
  parent_category_id: null,
  name: '',
  timing_rules: null,
  sort_order: 0,
  created_at: '',
  competition_type: 'record',
  record_unit: null,
  record_description: null,
  record_rules: null,
  record_higher_is_better: true,
};
