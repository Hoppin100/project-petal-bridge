import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import type { Game, Guide, GuideCategory, GuideSection } from '@/lib/types';
import {
  GUIDE_CATEGORIES,
  canEditGuide,
  deleteGuide,
  fetchGameGuides,
  fetchGuideSections,
  fetchHelpfulGuideIds,
  filterGuides,
  guideCategoryLabel,
  saveGuide,
  setGuideHelpful,
  sortGuides,
  type GuideSort,
} from '@/lib/guides';
import { useAuth } from '@/lib/auth';
import { useOpenAuth } from '@/lib/auth-modal';
import { parseYouTubeId } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { FormattedText } from '@/components/FormattedText';

type GuideView =
  | { kind: 'list' }
  | { kind: 'read'; guideId: string }
  | { kind: 'edit'; guide: Guide | null };

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Unpublished';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function updatedDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function GameGuides({ game }: { game: Game }) {
  const { profile } = useAuth();
  const openAuth = useOpenAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [category, setCategory] = useState<GuideCategory | 'all'>('all');
  const [sort, setSort] = useState<GuideSort>('newest');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<GuideView>({ kind: 'list' });
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const result = await fetchGameGuides(game.id);
    setGuides(result.guides);
    setMigrationMissing(result.migrationMissing);
    setLoadError(result.error ?? '');
    setLoading(false);
  }, [game.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profile) {
      setHelpfulIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchHelpfulGuideIds(profile.id).then((ids) => {
      if (!cancelled) setHelpfulIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, guides.length]);

  const visibleGuides = useMemo(
    () => sortGuides(filterGuides(guides, { search, category }), sort),
    [guides, search, category, sort],
  );

  const activeGuide =
    view.kind === 'read' ? guides.find((guide) => guide.id === view.guideId) ?? null : null;

  if (view.kind === 'edit') {
    if (!profile) {
      return (
        <GuidesSignIn
          message="Sign in to write a guide for this game."
          onSignIn={() => openAuth('signin')}
        />
      );
    }
    return (
      <GuideEditor
        game={game}
        guide={view.guide}
        profileId={profile.id}
        onCancel={() => setView({ kind: 'list' })}
        onSaved={async (guideId, status) => {
          await load();
          setNotice(status === 'published' ? 'Guide published.' : 'Draft saved.');
          setView(guideId ? { kind: 'read', guideId } : { kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'read' && activeGuide) {
    return (
      <GuideReader
        guide={activeGuide}
        canEdit={canEditGuide(activeGuide, profile)}
        helpful={helpfulIds.has(activeGuide.id)}
        onBack={() => setView({ kind: 'list' })}
        onEdit={() => setView({ kind: 'edit', guide: activeGuide })}
        onDelete={async () => {
          const error = await deleteGuide(activeGuide.id);
          if (error) {
            setLoadError(error);
            return;
          }
          setNotice('Guide deleted.');
          setView({ kind: 'list' });
          await load();
        }}
        onToggleHelpful={async () => {
          if (!profile) {
            openAuth('signin');
            return;
          }
          const next = !helpfulIds.has(activeGuide.id);
          const error = await setGuideHelpful(activeGuide.id, profile.id, next);
          if (error) {
            setLoadError(error);
            return;
          }
          setHelpfulIds((current) => {
            const copy = new Set(current);
            if (next) copy.add(activeGuide.id);
            else copy.delete(activeGuide.id);
            return copy;
          });
          setGuides((current) =>
            current.map((guide) =>
              guide.id === activeGuide.id
                ? {
                    ...guide,
                    helpful_count: Math.max(0, guide.helpful_count + (next ? 1 : -1)),
                  }
                : guide,
            ),
          );
        }}
      />
    );
  }

  return (
    <section aria-label={`${game.title} guides`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sr-eyebrow flex items-center gap-2">
            <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
            Guides
          </p>
          <h2 className="text-lg font-bold">Learn the routes</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--sr-text-muted)]">
            Community-written walkthroughs, strategies, and tips for {game.title}.
          </p>
        </div>
        <button
          type="button"
          className="sr-btn-primary"
          onClick={() => {
            if (!profile) {
              openAuth('signin');
              return;
            }
            setView({ kind: 'edit', guide: null });
          }}
        >
          <Plus className="h-4 w-4" />
          Write a guide
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-3 border-l-2 border-[var(--sr-primary)] bg-[var(--sr-surface)] px-3 py-2 text-sm text-[var(--sr-text-dim)]">
          {notice}
        </p>
      )}

      {loadError && (
        <p role="alert" className="mb-3 rounded-sm border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
          {loadError}
        </p>
      )}

      {migrationMissing ? (
        <div className="sr-panel p-6 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
          <p className="mt-3 font-semibold text-[var(--sr-text)]">Guides are not available yet</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--sr-text-muted)]">
            Apply <span className="sr-mono">drizzle/migrations/0010_guides_and_forums.sql</span> to
            the project database to enable guides.
          </p>
        </div>
      ) : loading ? (
        <div className="sr-panel flex items-center justify-center py-12 text-[var(--sr-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading guides" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 border-b border-[var(--sr-border)] pb-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sr-text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search guides"
                aria-label="Search guides"
                className="sr-input pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="guide-category-filter">
                Guide category
              </label>
              <select
                id="guide-category-filter"
                value={category}
                onChange={(event) => setCategory(event.target.value as GuideCategory | 'all')}
                className="sr-input w-auto min-w-[9rem]"
              >
                <option value="all">All categories</option>
                {GUIDE_CATEGORIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="guide-sort">
                Sort guides
              </label>
              <select
                id="guide-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as GuideSort)}
                className="sr-input w-auto min-w-[8rem]"
              >
                <option value="newest">Newest</option>
                <option value="helpful">Most helpful</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>

          {visibleGuides.length === 0 ? (
            <div className="sr-panel px-4 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
              <p className="mt-3 font-semibold text-[var(--sr-text)]">
                {guides.length === 0 ? 'No guides yet' : 'No guides match those filters'}
              </p>
              <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
                {guides.length === 0
                  ? 'Be the first to write one for this game.'
                  : 'Try a different search term or category.'}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visibleGuides.map((guide) => (
                <li key={guide.id} className="sr-card-hover flex flex-col p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="sr-badge bg-[var(--sr-primary)]/10 text-[var(--sr-primary)]">
                      {guideCategoryLabel(guide.category)}
                    </span>
                    {guide.status === 'draft' && (
                      <span className="sr-badge bg-[var(--sr-warn-bg)] text-[var(--sr-warn)]">
                        Draft
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'read', guideId: guide.id })}
                    className="text-left font-bold text-[var(--sr-text)] hover:text-[var(--sr-primary)]"
                  >
                    {guide.title}
                  </button>
                  {guide.summary && (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--sr-text-muted)]">
                      {guide.summary}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-[var(--sr-text-muted)]">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Avatar
                        name={guide.author?.username ?? 'Member'}
                        src={guide.author?.avatar_url ?? null}
                        className="h-5 w-5 text-[9px]"
                      />
                      <span className="truncate">{guide.author?.username ?? 'Member'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(guide.published_at ?? guide.updated_at)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" aria-label={`${guide.helpful_count} helpful votes`}>
                      <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="sr-mono">{guide.helpful_count}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function GuidesSignIn({ message, onSignIn }: { message: string; onSignIn: () => void }) {
  return (
    <div className="sr-panel px-4 py-10 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-[var(--sr-primary)]" />
      <p className="mt-3 font-semibold text-[var(--sr-text)]">{message}</p>
      <button type="button" className="sr-btn-primary mt-4" onClick={onSignIn}>
        Sign in
      </button>
    </div>
  );
}

function GuideReader({
  guide,
  canEdit,
  helpful,
  onBack,
  onEdit,
  onDelete,
  onToggleHelpful,
}: {
  guide: Guide;
  canEdit: boolean;
  helpful: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onToggleHelpful: () => Promise<void>;
}) {
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchGuideSections(guide.id).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      setSections(result.sections);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [guide.id]);

  return (
    <article aria-label={guide.title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="sr-btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          All guides
        </button>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className="sr-btn-ghost">
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="sr-btn-ghost text-[var(--sr-danger)]">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      <header className="border-b border-[var(--sr-border)] pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="sr-badge bg-[var(--sr-primary)]/10 text-[var(--sr-primary)]">
            {guideCategoryLabel(guide.category)}
          </span>
          {guide.status === 'draft' && (
            <span className="sr-badge bg-[var(--sr-warn-bg)] text-[var(--sr-warn)]">
              Draft — only you can see this
            </span>
          )}
        </div>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{guide.title}</h2>
        {guide.summary && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sr-text-dim)]">{guide.summary}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--sr-text-muted)]">
            <Avatar
              name={guide.author?.username ?? 'Member'}
              src={guide.author?.avatar_url ?? null}
              className="h-7 w-7 text-xs"
            />
            <span className="font-semibold text-[var(--sr-text)]">
              {guide.author?.username ?? 'Member'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Published {formatDate(guide.published_at ?? guide.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            {guide.updated_at !== guide.created_at && (
              <span className="text-xs text-[var(--sr-text-muted)]">
                Updated {updatedDate(guide.updated_at)}
              </span>
            )}
            <button
              type="button"
              onClick={async () => {
                setVoting(true);
                await onToggleHelpful();
                setVoting(false);
              }}
              disabled={voting}
              aria-pressed={helpful}
              className={`sr-btn-ghost ${helpful ? 'border-[var(--sr-primary)] text-[var(--sr-primary)]' : ''}`}
            >
              {helpful ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
              Helpful
              <span className="sr-mono">{guide.helpful_count}</span>
            </button>
          </div>
        </div>
      </header>

      {guide.cover_image_url && (
        <img
          src={guide.cover_image_url}
          alt=""
          loading="lazy"
          className="mt-4 max-h-80 w-full rounded-sm border border-[var(--sr-border)] object-cover"
          onError={(event) => event.currentTarget.remove()}
        />
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--sr-text-muted)]" aria-label="Loading guide" />
        </div>
      ) : sections.length === 0 ? (
        <p className="mt-6 border-l-2 border-[var(--sr-border-hover)] px-3 py-2 text-sm text-[var(--sr-text-muted)]">
          This guide does not have any sections yet.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-[var(--sr-border)]">
          {sections.map((section, index) => (
            <section key={section.id} className="py-4">
              {section.heading && (
                <h3 className="mb-1 flex items-baseline gap-2 text-lg font-bold">
                  <span className="sr-mono text-xs text-[var(--sr-text-muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.heading}
                </h3>
              )}
              <FormattedText text={section.body} />
              {section.image_url && (
                <img
                  src={section.image_url}
                  alt={section.heading ?? ''}
                  loading="lazy"
                  className="mt-3 max-h-[32rem] w-auto max-w-full rounded-sm border border-[var(--sr-border)] object-contain"
                  onError={(event) => event.currentTarget.remove()}
                />
              )}
              {section.video_url && (
                (() => {
                  const videoId = parseYouTubeId(section.video_url);
                  if (!videoId) {
                    return (
                      <a
                        href={section.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--sr-link)] hover:underline"
                      >
                        <Eye className="h-4 w-4" />
                        Watch the video for this section
                      </a>
                    );
                  }
                  return (
                    <div className="mt-3 aspect-video w-full max-w-2xl overflow-hidden rounded-sm border border-[var(--sr-border)] bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={section.heading ? `${section.heading} video` : 'Guide section video'}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  );
                })()
              )}
            </section>
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this guide?"
        description="The guide and all of its sections will be removed. This cannot be undone."
        confirmLabel="Delete guide"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          void onDelete();
        }}
      />
    </article>
  );
}

interface SectionDraft {
  heading: string;
  body: string;
  image_url: string;
  video_url: string;
}

const emptySection: SectionDraft = { heading: '', body: '', image_url: '', video_url: '' };

function GuideEditor({
  game,
  guide,
  profileId,
  onCancel,
  onSaved,
}: {
  game: Game;
  guide: Guide | null;
  profileId: string;
  onCancel: () => void;
  onSaved: (guideId: string | null, status: 'draft' | 'published') => Promise<void>;
}) {
  const [title, setTitle] = useState(guide?.title ?? '');
  const [summary, setSummary] = useState(guide?.summary ?? '');
  const [category, setCategory] = useState<GuideCategory>(guide?.category ?? 'beginner');
  const [coverImage, setCoverImage] = useState(guide?.cover_image_url ?? '');
  const [sections, setSections] = useState<SectionDraft[]>([{ ...emptySection }]);
  const [loadingSections, setLoadingSections] = useState(Boolean(guide));
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guide) return;
    let cancelled = false;
    void fetchGuideSections(guide.id).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      setSections(
        result.sections.length > 0
          ? result.sections.map((section) => ({
              heading: section.heading ?? '',
              body: section.body,
              image_url: section.image_url ?? '',
              video_url: section.video_url ?? '',
            }))
          : [{ ...emptySection }],
      );
      setLoadingSections(false);
    });
    return () => {
      cancelled = true;
    };
  }, [guide]);

  function updateSection(index: number, patch: Partial<SectionDraft>) {
    setSections((current) =>
      current.map((section, itemIndex) => (itemIndex === index ? { ...section, ...patch } : section)),
    );
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      if (item) copy.splice(target, 0, item);
      return copy;
    });
  }

  async function save(status: 'draft' | 'published') {
    setError('');
    if (!title.trim()) {
      setError('Give the guide a title.');
      return;
    }
    if (!sections.some((section) => section.body.trim())) {
      setError('Add at least one section with some text.');
      return;
    }
    setSaving(status);
    const result = await saveGuide({
      guideId: guide?.id,
      gameId: game.id,
      authorId: guide?.author_id ?? profileId,
      draft: {
        title,
        summary,
        category,
        status,
        cover_image_url: coverImage.trim() || null,
        sections: sections.map((section) => ({
          heading: section.heading,
          body: section.body,
          image_url: section.image_url.trim() || null,
          video_url: section.video_url.trim() || null,
        })),
      },
    });
    setSaving(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await onSaved(result.guideId, status);
  }

  return (
    <section aria-label={guide ? 'Edit guide' : 'New guide'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="sr-eyebrow">Guides</p>
          <h2 className="text-xl font-bold">{guide ? 'Edit guide' : 'Write a guide'}</h2>
        </div>
        <button type="button" onClick={onCancel} className="sr-btn-ghost">
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>

      <div className="sr-panel p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="guide-title" className="mb-1 block text-sm font-medium">
              Title <span className="text-[var(--sr-primary)]">Required</span>
            </label>
            <input
              id="guide-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="sr-input"
              placeholder="e.g. Beginner route: first hour to first boss"
            />
          </div>
          <div>
            <label htmlFor="guide-category" className="mb-1 block text-sm font-medium">
              Category
            </label>
            <select
              id="guide-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as GuideCategory)}
              className="sr-input"
            >
              {GUIDE_CATEGORIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="guide-cover" className="mb-1 block text-sm font-medium">
              Cover image URL <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </label>
            <input
              id="guide-cover"
              type="url"
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              className="sr-input"
              placeholder="https://…"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="guide-summary" className="mb-1 block text-sm font-medium">
              Summary <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </label>
            <textarea
              id="guide-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={2}
              className="sr-input resize-y"
              placeholder="One or two sentences shown on the guide card."
            />
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--sr-border)] pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Sections</h3>
            <span className="text-xs text-[var(--sr-text-muted)]">
              Text supports **bold**, *italic*, `code`, [links](https://example.com), images, and YouTube links on their own line.
            </span>
          </div>

          {loadingSections ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading sections" />
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {sections.map((section, index) => (
                <li key={index} className="border border-[var(--sr-border)] bg-[var(--sr-surface-2)]/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="sr-mono text-xs text-[var(--sr-text-muted)]">
                      Section {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveSection(index, -1)}
                        disabled={index === 0}
                        className="rounded-sm border border-[var(--sr-border)] px-2 py-1 text-xs text-[var(--sr-text-dim)] hover:text-[var(--sr-text)] disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(index, 1)}
                        disabled={index === sections.length - 1}
                        className="rounded-sm border border-[var(--sr-border)] px-2 py-1 text-xs text-[var(--sr-text-dim)] hover:text-[var(--sr-text)] disabled:opacity-40"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSections((current) =>
                            current.length === 1
                              ? [{ ...emptySection }]
                              : current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="rounded-sm border border-[var(--sr-border)] px-2 py-1 text-xs text-[var(--sr-danger)] hover:border-[var(--sr-danger)]"
                        aria-label={`Remove section ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label htmlFor={`section-heading-${index}`} className="mb-1 block text-xs font-medium text-[var(--sr-text-dim)]">
                    Heading
                  </label>
                  <input
                    id={`section-heading-${index}`}
                    type="text"
                    value={section.heading}
                    onChange={(event) => updateSection(index, { heading: event.target.value })}
                    className="sr-input mb-2"
                    placeholder="Optional heading"
                  />
                  <label htmlFor={`section-body-${index}`} className="mb-1 block text-xs font-medium text-[var(--sr-text-dim)]">
                    Text <span className="text-[var(--sr-primary)]">Required</span>
                  </label>
                  <textarea
                    id={`section-body-${index}`}
                    value={section.body}
                    onChange={(event) => updateSection(index, { body: event.target.value })}
                    rows={5}
                    className="sr-input resize-y"
                    placeholder="Explain this part of the route…"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`section-image-${index}`} className="mb-1 block text-xs font-medium text-[var(--sr-text-dim)]">
                        Image URL <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                      </label>
                      <input
                        id={`section-image-${index}`}
                        type="url"
                        value={section.image_url}
                        onChange={(event) => updateSection(index, { image_url: event.target.value })}
                        className="sr-input"
                        placeholder="https://…"
                      />
                    </div>
                    <div>
                      <label htmlFor={`section-video-${index}`} className="mb-1 block text-xs font-medium text-[var(--sr-text-dim)]">
                        YouTube link <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                      </label>
                      <input
                        id={`section-video-${index}`}
                        type="url"
                        value={section.video_url}
                        onChange={(event) => updateSection(index, { video_url: event.target.value })}
                        className="sr-input"
                        placeholder="https://youtube.com/watch?v=…"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <button
            type="button"
            onClick={() => setSections((current) => [...current, { ...emptySection }])}
            className="sr-btn-ghost mt-3"
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-sm border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[var(--sr-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={saving !== null} className="sr-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save('draft')}
            disabled={saving !== null}
            className="sr-btn-ghost"
          >
            {saving === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            type="button"
            onClick={() => void save('published')}
            disabled={saving !== null}
            className="sr-btn-primary"
          >
            {saving === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Publish
          </button>
        </div>
      </div>
    </section>
  );
}
