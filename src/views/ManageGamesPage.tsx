import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Gamepad2,
  Save,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchGames } from '@/lib/games';
import { fetchAllCompetitions, fetchGameCompetitions, isRecordCategory, COMPETITION_COLUMNS } from '@/lib/competitions';
import { lookupSpeedrunGames } from '@/lib/speedrun-games.functions';
import { useAuth } from '@/lib/auth';
import type { Game, Category, GameRequest, CompetitionType } from '@/lib/types';
import { linkHref } from '@/lib/router';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

interface PendingConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

function compareCategories(left: Category, right: Category) {
  return left.sort_order - right.sort_order || left.name.localeCompare(right.name);
}

function orderCategories(categories: Category[]) {
  const mainCategories = categories
    .filter((category) => !category.parent_category_id)
    .sort(compareCategories);
  const ordered: Category[] = [];

  for (const mainCategory of mainCategories) {
    ordered.push(mainCategory);
    ordered.push(
      ...categories
        .filter((category) => category.parent_category_id === mainCategory.id)
        .sort(compareCategories)
    );
  }

  ordered.push(
    ...categories
      .filter(
        (category) =>
          category.parent_category_id &&
          !mainCategories.some((mainCategory) => mainCategory.id === category.parent_category_id)
      )
      .sort(compareCategories)
  );
  return ordered;
}

export function ManageGamesPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, Category[]>>({});
  const [loading, setLoading] = useState(true);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [reorderingGameId, setReorderingGameId] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState<{
    gameId: string;
    cat: Category | null;
    parentCategoryId: string | null;
    initialName?: string;
    initialTimingRules?: string | null;
    initialRecord?: Category | null;
    initialCompetitionType?: CompetitionType;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [subcategoryClipboard, setSubcategoryClipboard] = useState<{
    sourceGameTitle: string;
    sourceCategoryName: string;
    categories: Pick<
      Category,
      | 'name'
      | 'timing_rules'
      | 'competition_type'
      | 'record_unit'
      | 'record_description'
      | 'record_rules'
      | 'record_higher_is_better'
    >[];
  } | null>(null);
  const [categoryClipboardNotice, setCategoryClipboardNotice] = useState<string | null>(null);
  const [pastingIntoCategoryId, setPastingIntoCategoryId] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    const { games: gameList, error: loadError } = await fetchGames();
    if (loadError) setError(`Could not load games: ${loadError}`);
    setGames(gameList);
    // Read every game's categories in one pass so each row can show its
    // category count straight away instead of only after being expanded.
    if (gameList.length) {
      const { categories, error: categoriesError } = await fetchAllCompetitions(
        gameList.map((game) => game.id)
      );
      if (categoriesError) {
        console.error('load categories failed', categoriesError);
        setError(`Could not load categories: ${categoriesError}`);
        setLoading(false);
        return;
      }
      const grouped: Record<string, Category[]> = {};
      for (const category of categories) {
        (grouped[category.game_id] ??= []).push(category);
      }
      for (const gameId of Object.keys(grouped)) {
        grouped[gameId] = orderCategories(grouped[gameId]!);
      }
      setCategoryMap(grouped);
    } else {
      setCategoryMap({});
    }
    setLoading(false);
  }, []);

  const loadCategories = useCallback(async (gameId: string) => {
    const { categories, error: categoriesError } = await fetchGameCompetitions(gameId);
    if (categoriesError) {
      console.error('load categories failed', categoriesError);
      setError(`Could not load categories: ${categoriesError}`);
      return;
    }
    setCategoryMap((prev) => ({ ...prev, [gameId]: orderCategories(categories) }));
  }, []);

  const loadRequests = useCallback(async () => {
    const { data, error: requestError } = await supabase
      .from('game_requests')
      .select('id, requester_id, game_name, game_url, status, created_at, reviewed_at, reviewed_by')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (requestError) {
      console.error('load game requests failed', requestError);
      return;
    }
    setRequests((data as GameRequest[]) ?? []);
  }, []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    if (profile?.role !== 'owner') {
      setLoading(false);
      return;
    }
    void loadGames();
    void loadRequests();
  }, [session, profile, loadGames, loadRequests]);

  // While the stored session and profile are still being read, show neither
  // the tools nor the "owners only" message — an owner reloading this page
  // would otherwise see an access-denied screen flash first.
  if (authLoading) {
    return (
      <div className="sr-container py-20 text-center">
        <p className="text-[var(--sr-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="sr-container py-20 text-center">
        <p className="text-[var(--sr-text)]">Sign in to manage games.</p>
      </div>
    );
  }

  if (profile?.role !== 'owner') {
    return (
      <div className="sr-container py-20 text-center">
        <Gamepad2 className="mx-auto h-12 w-12 text-[var(--sr-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--sr-text)]">Owners only</h1>
        <p className="mt-2 text-sm text-[var(--sr-text-muted)]">
          Only authorized owner accounts can create and manage game pages.
        </p>
      </div>
    );
  }

  async function handleDeleteGame(game: Game) {
    setConfirmation({
      title: `Delete ${game.title}?`,
      description: 'This will permanently delete the game, its categories, and associated runs. This cannot be undone.',
      confirmLabel: 'Delete game',
      onConfirm: () => { void deleteGame(game); },
    });
  }

  async function deleteGame(game: Game) {
    setError(null);
    const { error: delErr } = await supabase.from('games').delete().eq('id', game.id);
    if (delErr) {
      console.error('delete game failed', delErr);
      setError('Could not delete game.');
      return;
    }
    await loadGames();
  }

  async function reviewRequest(request: GameRequest, status: 'reviewed' | 'declined') {
    const { error: updateError } = await supabase.from('game_requests').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile?.id ?? null,
    }).eq('id', request.id);
    if (updateError) {
      console.error('review game request failed', updateError);
      setError('Could not update game request.');
      return;
    }
    await loadRequests();
  }

  async function handleDeleteCategory(cat: Category, gameId: string) {
    const parentName = (categoryMap[gameId] ?? []).find((item) => item.id === cat.parent_category_id)?.name;
    const categoryLabel = cat.parent_category_id
      ? `subcategory "${cat.name}" under "${parentName ?? 'unknown category'}"`
      : `category "${cat.name}"`;
    setConfirmation({
      title: `Delete ${cat.parent_category_id ? 'subcategory' : 'category'}?`,
      description: `This will permanently delete ${categoryLabel} and all associated runs. This cannot be undone.`,
      confirmLabel: 'Delete category',
      onConfirm: () => { void deleteCategory(cat, gameId); },
    });
  }

  async function deleteCategory(cat: Category, gameId: string) {
    setError(null);
    const { error: delErr } = await supabase.from('categories').delete().eq('id', cat.id);
    if (delErr) {
      console.error('delete category failed', delErr);
      setError('Could not delete category.');
      return;
    }
    await loadCategories(gameId);
  }

  function duplicateCategory(category: Category, gameId: string) {
    const categories = categoryMap[gameId] ?? [];
    const existingNames = new Set(categories.map((item) => item.name.toLowerCase()));
    let copyName = `${category.name} (Copy)`;
    let suffix = 2;
    while (existingNames.has(copyName.toLowerCase())) {
      copyName = `${category.name} (Copy ${suffix})`;
      suffix += 1;
    }

    setError(null);
    setCategoryClipboardNotice(null);
    setShowCatModal({
      gameId,
      cat: null,
      parentCategoryId: category.parent_category_id,
      initialName: copyName,
      initialTimingRules: category.timing_rules,
      initialRecord: isRecordCategory(category) ? category : null,
    });
    setCategoryClipboardNotice(`Review the copy "${copyName}" and save to create it.`);
  }

  function copySubcategories(game: Game, parent: Category) {
    const subcategories = (categoryMap[game.id] ?? [])
      .filter((category) => category.parent_category_id === parent.id)
      .map((category) => ({
        name: category.name,
        timing_rules: category.timing_rules,
        competition_type: category.competition_type,
        record_unit: category.record_unit,
        record_description: category.record_description,
        record_rules: category.record_rules,
        record_higher_is_better: category.record_higher_is_better,
      }));
    if (subcategories.length === 0) return;

    setError(null);
    setSubcategoryClipboard({
      sourceGameTitle: game.title,
      sourceCategoryName: parent.name,
      categories: subcategories,
    });
    setCategoryClipboardNotice(
      `Copied ${subcategories.length} subcategor${subcategories.length === 1 ? 'y' : 'ies'} from "${game.title}" â†’ "${parent.name}". Choose Paste on a destination category.`
    );
  }

  function copySubcategory(game: Game, category: Category) {
    const parent = (categoryMap[game.id] ?? []).find((item) => item.id === category.parent_category_id);
    if (!parent) {
      setError('Could not find the main category for this subcategory.');
      return;
    }

    setError(null);
    setSubcategoryClipboard({
      sourceGameTitle: game.title,
      sourceCategoryName: parent.name,
      categories: [
        {
          name: category.name,
          timing_rules: category.timing_rules,
          competition_type: category.competition_type,
          record_unit: category.record_unit,
          record_description: category.record_description,
          record_rules: category.record_rules,
          record_higher_is_better: category.record_higher_is_better,
        },
      ],
    });
    setCategoryClipboardNotice(
      `Copied subcategory "${category.name}" from "${game.title}" â†’ "${parent.name}". Choose Paste on a destination category.`
    );
  }

  async function pasteSubcategories(game: Game, parent: Category) {
    if (!subcategoryClipboard || pastingIntoCategoryId) return;

    setError(null);
    setCategoryClipboardNotice(null);
    setPastingIntoCategoryId(parent.id);
    try {
      const { categories: existingCategories, error: loadError } = await fetchGameCompetitions(
        game.id
      );
      if (loadError) throw new Error(loadError);

      const currentCategories = existingCategories;
      const lastSortOrder = Math.max(
        0,
        ...currentCategories
          .filter((category) => category.parent_category_id === parent.id)
          .map((category) => category.sort_order)
      );
      const rows = subcategoryClipboard.categories.map((category, index) => ({
        game_id: game.id,
        parent_category_id: parent.id,
        name: category.name,
        timing_rules: category.timing_rules,
        competition_type: category.competition_type,
        record_unit: category.record_unit,
        record_description: category.record_description,
        record_rules: category.record_rules,
        record_higher_is_better: category.record_higher_is_better,
        sort_order: lastSortOrder + (index + 1) * 10,
      }));
      const { data: insertedCategories, error: insertError } = await supabase
        .from('categories')
        .insert(rows)
        .select(COMPETITION_COLUMNS);
      if (insertError) throw insertError;
      const inserted = ((insertedCategories as Partial<Category>[]) ?? []).map((category) => ({
        ...category,
        competition_type:
          category.competition_type === 'record' ? ('record' as const) : ('speedrun' as const),
        record_unit: category.record_unit ?? null,
        record_description: category.record_description ?? null,
        record_rules: category.record_rules ?? null,
        record_higher_is_better: category.record_higher_is_better ?? true,
      })) as Category[];
      if (
        inserted.length !== rows.length ||
        inserted.some(
          (category) =>
            category.game_id !== game.id ||
            category.parent_category_id !== parent.id
        )
      ) {
        throw new Error('The saved subcategories did not match the selected game and destination category.');
      }

      const updatedCategories = orderCategories([
        ...currentCategories,
        ...inserted,
      ]);
      setCategoryMap((prev) => ({ ...prev, [game.id]: updatedCategories }));
      setCategoryClipboardNotice(
        `Pasted ${rows.length} subcategor${rows.length === 1 ? 'y' : 'ies'} into "${parent.name}".`
      );
    } catch (cause) {
      console.error('paste subcategories failed', cause);
      const detail =
        typeof cause === 'object' && cause !== null && 'message' in cause &&
        typeof cause.message === 'string'
          ? cause.message
          : '';
      setError(detail ? `Could not paste subcategories: ${detail}` : 'Could not paste subcategories.');
    } finally {
      setPastingIntoCategoryId(null);
    }
  }

  async function moveCategory(gameId: string, index: number, direction: -1 | 1) {
    if (reorderingGameId === gameId) return;
    const categories = [...(categoryMap[gameId] ?? [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    [categories[index], categories[targetIndex]] = [categories[targetIndex]!, categories[index]!];
    setError(null);
    setReorderingGameId(gameId);
    try {
      const { error: reorderError } = await supabase.rpc('reorder_categories', {
        p_game_id: gameId,
        p_category_ids: categories.map((category) => category.id),
      });
      if (reorderError) {
        const missingRpc =
          reorderError.code === 'PGRST202' ||
          reorderError.code === '42883' ||
          /could not find the function|function .* does not exist/i.test(reorderError.message);

        if (!missingRpc) throw reorderError;

        // Keep reordering usable if the database migration has not been applied yet.
        const writes = await Promise.all(
          categories.map((category, order) =>
            supabase
              .from('categories')
              .update({ sort_order: (order + 1) * 10 })
              .eq('id', category.id)
              .eq('game_id', gameId)
          )
        );
        const writeFailure = writes.find((result) => result.error)?.error;
        if (writeFailure) throw writeFailure;
      }
      setCategoryMap((prev) => ({
        ...prev,
        [gameId]: categories.map((category, order) => ({ ...category, sort_order: (order + 1) * 10 })),
      }));
    } catch (cause) {
      console.error('reorder categories failed', cause);
      const message =
        typeof cause === 'object' && cause !== null && 'message' in cause &&
        typeof cause.message === 'string'
          ? cause.message
          : '';
      setError(
        message
          ? `Could not save category order: ${message}`
          : 'Could not save category order. Check the Supabase connection and owner permissions.'
      );
      await loadCategories(gameId);
    } finally {
      setReorderingGameId(null);
    }
  }

  return (
    <div className="sr-container py-8 sm:py-10">
      <div className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="sr-eyebrow">Owner tools</p>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-[var(--sr-text)]">
            <Gamepad2 className="h-7 w-7 text-[var(--sr-primary)]" />
            Manage Games
          </h1>
          <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
            Create game pages and categories that show up across SplitRush.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingGame(null);
            setShowGameModal(true);
          }}
          className="sr-btn-primary w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          New game
        </button>
      </div>

      {requests.length > 0 && (
        <section className="sr-panel mb-6 p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-bold text-[var(--sr-text)]">Pending game requests <span className="sr-badge ml-2 bg-[var(--sr-surface-2)] text-[var(--sr-text)]">{requests.length}</span></h2>
          <div className="divide-y divide-[var(--sr-border)]">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--sr-text)]">{request.game_name}</p>
                  <a href={request.game_url} target="_blank" rel="noreferrer" className="break-all text-sm text-[var(--sr-primary)] hover:underline">{request.game_url}</a>
                  <p className="text-xs text-[var(--sr-text-muted)]">Requested {new Date(request.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => void reviewRequest(request, 'reviewed')} className="sr-btn-ghost w-full sm:w-auto">Mark reviewed</button>
                <button onClick={() => void reviewRequest(request, 'declined')} className="sr-btn-ghost w-full border-[var(--sr-danger)]/40 text-[var(--sr-danger)] sm:w-auto">Decline</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {categoryClipboardNotice && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface)] px-3 py-2 text-sm text-[var(--sr-text)]">
          <span>{categoryClipboardNotice}</span>
          {subcategoryClipboard && (
            <button
              type="button"
              onClick={() => {
                setSubcategoryClipboard(null);
                setCategoryClipboardNotice('Subcategory clipboard cleared.');
              }}
              className="text-xs text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
            >
              Clear copied subcategories
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="sr-card p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--sr-primary)]" />
        </div>
      ) : games.length === 0 ? (
        <div className="sr-panel flex flex-col items-center gap-3 p-8 text-center sm:p-12">
          <Gamepad2 className="h-12 w-12 text-[var(--sr-text-muted)]" />
          <p className="text-[var(--sr-text)]">No games yet</p>
          <p className="text-sm text-[var(--sr-text-muted)]">
            Create your first game page to get leaderboards started.
          </p>
          <button
            onClick={() => {
              setEditingGame(null);
              setShowGameModal(true);
            }}
            className="sr-btn-primary mt-2"
          >
            <Plus className="h-4 w-4" />
            Create game
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {games.map((game) => {
            const cats = categoryMap[game.id] ?? [];
            const expanded = expandedGameId === game.id;
            const mainCats = cats.filter((category) => !category.parent_category_id);
            const speedrunCount = mainCats.filter((category) => !isRecordCategory(category)).length;
            const recordCount = mainCats.filter((category) => isRecordCategory(category)).length;
            return (
              <div key={game.id} className="sr-card overflow-hidden">
                <div className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-md bg-[var(--sr-surface-2)]">
                    {game.cover_url && (
                      <img src={game.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold text-[var(--sr-text)]">{game.title}</h3>
                      {game.is_featured && (
                        <span className="sr-badge bg-[var(--sr-primary)]/20 text-[var(--sr-primary)]">
                          Featured
                        </span>
                      )}
                      {game.is_hidden && (
                        <span className="sr-badge sr-badge-pending">
                          Hidden from public
                        </span>
                      )}
                      {game.source && (
                        <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-text-dim)]">
                          {game.source}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[var(--sr-text-muted)]">
                      /{game.slug} · {speedrunCount} speedrun{speedrunCount === 1 ? '' : 's'} ·{' '}
                      {recordCount} record{recordCount === 1 ? '' : 's'}
                    </p>
                    {game.blurb && (
                      <p className="truncate text-sm text-[var(--sr-text)]/60 mt-0.5">{game.blurb}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={linkHref(`/games/${game.slug}`)}
                      className="sr-btn-ghost text-xs"
                      target="_blank"
                    >
                      View
                    </a>
                    <button
                      onClick={() => {
                        setEditingGame(game);
                        setShowGameModal(true);
                      }}
                      className="rounded-md p-2 text-[var(--sr-text-muted)] hover:text-[var(--sr-link)]"
                      title="Edit game"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGame(game)}
                      className="rounded-md p-2 text-[var(--sr-danger)] hover:bg-[var(--sr-bad-bg)]"
                      title="Delete game"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setExpandedGameId(expanded ? null : game.id);
                        if (!expanded) void loadCategories(game.id);
                      }}
                      className="sr-btn-ghost text-xs"
                    >
                      {expanded ? 'Hide' : 'Categories'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-[var(--sr-border)] bg-[var(--sr-surface-2)] p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--sr-text)]">Categories and subcategories</h4>
                        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-[var(--sr-text-muted)]">Every category is its own competition: a timed speedrun board or a numeric record board. One game can hold as many of each as you like.</p>
                        {reorderingGameId === game.id && (
                          <p role="status" className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--sr-primary)]">
                            <Loader2 className="h-3 w-3 animate-spin" /> Saving new order
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setShowCatModal({ gameId: game.id, cat: null, parentCategoryId: null, initialCompetitionType: 'speedrun' })}
                          className="sr-btn-ghost text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add speedrun
                        </button>
                        <button
                          onClick={() => setShowCatModal({ gameId: game.id, cat: null, parentCategoryId: null, initialCompetitionType: 'record' })}
                          className="sr-btn-ghost text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add record
                        </button>
                      </div>
                    </div>
                    {cats.length === 0 ? (
                      <p className="text-sm text-[var(--sr-text-muted)]">
                        No categories yet. Add one so runners can submit runs.
                      </p>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {cats.map((cat, index) => (
                          <li
                            key={cat.id}
                            className={`flex items-center justify-between gap-3 border border-[var(--sr-border)] bg-[var(--sr-surface)] px-3 py-2.5 transition-colors hover:border-[var(--sr-border-hover)] ${cat.parent_category_id ? 'ml-7 border-l-2 border-l-[var(--sr-primary)]' : ''}`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => void moveCategory(game.id, index, -1)}
                                  disabled={index === 0 || reorderingGameId === game.id}
                                  aria-label={`Move ${cat.name} up`}
                                  title="Move up"
                                  className="rounded-md p-0.5 text-[var(--sr-text-muted)] hover:bg-[var(--sr-surface-3)] hover:text-[var(--sr-primary)] disabled:opacity-30"
                                ><ArrowUp className="h-3.5 w-3.5" /></button>
                                <button
                                  type="button"
                                  onClick={() => void moveCategory(game.id, index, 1)}
                                  disabled={index === cats.length - 1 || reorderingGameId === game.id}
                                  aria-label={`Move ${cat.name} down`}
                                  title="Move down"
                                  className="rounded-md p-0.5 text-[var(--sr-text-muted)] hover:bg-[var(--sr-surface-3)] hover:text-[var(--sr-primary)] disabled:opacity-30"
                                ><ArrowDown className="h-3.5 w-3.5" /></button>
                              </div>
                              <span className="sr-mono flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-[var(--sr-surface-2)] text-xs font-semibold text-[var(--sr-primary)]">{cat.parent_category_id ? 'â†³' : String(index + 1).padStart(2, '0')}</span>
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--sr-text)]">
                                  {cat.name}
                                  <span
                                    className={`sr-badge ${
                                      isRecordCategory(cat)
                                        ? 'bg-[var(--sr-surface-2)] text-[var(--sr-text-dim)]'
                                        : 'bg-[var(--sr-primary)]/15 text-[var(--sr-primary)]'
                                    }`}
                                  >
                                    {isRecordCategory(cat) ? 'Record' : 'Speedrun'}
                                  </span>
                                  {isRecordCategory(cat) && cat.record_unit && (
                                    <span className="sr-mono text-xs font-normal text-[var(--sr-text-muted)]">
                                      {cat.record_unit} · {cat.record_higher_is_better ? 'highest wins' : 'lowest wins'}
                                    </span>
                                  )}
                                </p>
                                {cat.parent_category_id && (
                                  <p className="text-xs text-[var(--sr-text-muted)]">
                                    Subcategory of {cats.find((item) => item.id === cat.parent_category_id)?.name ?? 'unknown category'}
                                  </p>
                                )}
                                {isRecordCategory(cat)
                                  ? cat.record_rules && (
                                      <p className="truncate text-xs text-[var(--sr-text-muted)]">
                                        {cat.record_rules}
                                      </p>
                                    )
                                  : cat.timing_rules && (
                                      <p className="truncate text-xs text-[var(--sr-text-muted)]">
                                        {cat.timing_rules}
                                      </p>
                                    )}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
                              {cat.parent_category_id && (
                                <button
                                  type="button"
                                  onClick={() => copySubcategory(game, cat)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                                  aria-label={`Copy subcategory ${cat.name}`}
                                  title="Copy subcategory"
                                >
                                  <ClipboardCopy className="h-3.5 w-3.5" />
                                  Copy
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void duplicateCategory(cat, game.id)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                                aria-label={`Duplicate ${cat.parent_category_id ? 'subcategory' : 'category'} ${cat.name}`}
                                title="Duplicate this competition"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Duplicate
                              </button>
                              <button
                                onClick={() => setShowCatModal({ gameId: game.id, cat, parentCategoryId: cat.parent_category_id })}
                                className="rounded-md p-1.5 text-[var(--sr-text-muted)] hover:text-[var(--sr-link)]"
                                aria-label={`Edit ${cat.parent_category_id ? 'subcategory' : 'category'} ${cat.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat, game.id)}
                                className="rounded-md p-1.5 text-[var(--sr-danger)] hover:bg-[var(--sr-bad-bg)]"
                                aria-label={`Delete ${cat.parent_category_id ? 'subcategory' : 'category'} ${cat.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {!cat.parent_category_id && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setShowCatModal({ gameId: game.id, cat: null, parentCategoryId: cat.id, initialRecord: isRecordCategory(cat) ? cat : null })}
                                    aria-label={`Add subcategory under ${cat.name}`}
                                    className="rounded-md px-2 py-1 text-xs text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                                  >
                                    Add subcategory
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copySubcategories(game, cat)}
                                    disabled={!cats.some((category) => category.parent_category_id === cat.id)}
                                    title="Copy this category's subcategories"
                                    aria-label={`Copy subcategories from ${cat.name}`}
                                    className="rounded-md px-2 py-1 text-xs text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <ClipboardCopy className="mr-1 inline h-3.5 w-3.5" />
                                    Copy
                                  </button>
                                  {subcategoryClipboard && (
                                    <button
                                      type="button"
                                      onClick={() => void pasteSubcategories(game, cat)}
                                      disabled={pastingIntoCategoryId !== null}
                                      title={`Paste copied subcategories from ${subcategoryClipboard.sourceGameTitle} > ${subcategoryClipboard.sourceCategoryName}`}
                                      aria-label={`Paste subcategories into ${cat.name}`}
                                      className="rounded-md px-2 py-1 text-xs text-[var(--sr-primary)] hover:bg-[var(--sr-surface-2)] disabled:cursor-wait disabled:opacity-50"
                                    >
                                      {pastingIntoCategoryId === cat.id ? (
                                        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <ClipboardPaste className="mr-1 inline h-3.5 w-3.5" />
                                      )}
                                      Paste
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showGameModal && (
        <GameModal
          game={editingGame}
          onClose={() => setShowGameModal(false)}
          onSaved={(gameId, notice) => {
            setShowGameModal(false);
            setError(notice ?? null);
            void loadGames();
            if (gameId) {
              setExpandedGameId(gameId);
              void loadCategories(gameId);
            }
          }}
        />
      )}

      {showCatModal && (
        <CategoryModal
          key={`${showCatModal.gameId}:${showCatModal.cat?.id ?? 'new'}:${showCatModal.parentCategoryId ?? 'main'}:${showCatModal.initialName ?? ''}:${showCatModal.initialCompetitionType ?? ''}`}
          gameId={showCatModal.gameId}
          category={showCatModal.cat}
          initialName={showCatModal.initialName}
          initialTimingRules={showCatModal.initialTimingRules}
          initialRecord={showCatModal.initialRecord ?? null}
          initialCompetitionType={showCatModal.initialCompetitionType}
          existingCategories={categoryMap[showCatModal.gameId] ?? []}
          parentCategories={(categoryMap[showCatModal.gameId] ?? []).filter((category) => !category.parent_category_id)}
          initialParentCategoryId={showCatModal.parentCategoryId}
          onClose={() => setShowCatModal(null)}
          onSaved={async (keepAdding) => {
            const gid = showCatModal.gameId;
            if (!keepAdding) setShowCatModal(null);
            await loadCategories(gid);
          }}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => { if (!open) setConfirmation(null); }}
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          destructive
          onConfirm={confirmation.onConfirm}
        />
      )}
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function GameModal({
  game,
  onClose,
  onSaved,
}: {
  game: Game | null;
  onClose: () => void;
  onSaved: (gameId?: string, notice?: string) => void;
}) {
  const [title, setTitle] = useState(game?.title ?? '');
  const [slug, setSlug] = useState(game?.slug ?? '');
  const [coverUrl, setCoverUrl] = useState(game?.cover_url ?? '');
  const [blurb, setBlurb] = useState(game?.blurb ?? '');
  const [pageUrl, setPageUrl] = useState(game?.page_url ?? '');
  const [source, setSource] = useState(game?.source ?? '');
  const [featured, setFeatured] = useState(game?.is_featured ?? false);
  const [hidden, setHidden] = useState(game?.is_hidden ?? false);
  const [coverPreviewError, setCoverPreviewError] = useState(false);
  const [supportsSpeedruns, setSupportsSpeedruns] = useState(true);
  const [supportsRecords, setSupportsRecords] = useState(false);
  const [categoryNames, setCategoryNames] = useState('');
  const [recordCategoryNames, setRecordCategoryNames] = useState('');
  const [slugTouched, setSlugTouched] = useState(!!game);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedrunLookup, setSpeedrunLookup] = useState<{
    query: string;
    status: 'idle' | 'checking' | 'found' | 'not-found' | 'error';
    games: Array<{ id: string; name: string; url: string; exactMatch: boolean }>;
  }>({ query: '', status: 'idle', games: [] });

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (game) return;
    const query = title.trim();
    if (query.length < 3) {
      setSpeedrunLookup({ query, status: 'idle', games: [] });
      return;
    }

    let cancelled = false;
    setSpeedrunLookup({ query, status: 'checking', games: [] });
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await lookupSpeedrunGames({ data: { name: query } });
        if (!cancelled) {
          setSpeedrunLookup({
            query,
            status: result.games.length > 0 ? 'found' : 'not-found',
            games: result.games,
          });
        }
      } catch (cause) {
        console.error('speedrun.com game lookup failed', cause);
        if (!cancelled) setSpeedrunLookup({ query, status: 'error', games: [] });
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [title, game]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    const trimmedSlug = slugify(slug.trim() || trimmedTitle);
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }
    if (!trimmedSlug) {
      setError('Slug is required.');
      return;
    }
    const categories = game || !supportsSpeedruns
      ? []
      : categoryNames.split('\n').map((name) => name.trim()).filter(Boolean);
    const recordCategories = game || !supportsRecords
      ? []
      : recordCategoryNames
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [namePart, unitPart] = line.split('|');
            return {
              name: (namePart ?? '').trim(),
              unit: (unitPart ?? '').trim() || 'Value',
            };
          })
          .filter((entry) => entry.name);
    const categoryKeys = categories.map((name) => name.toLocaleLowerCase());
    if (new Set(categoryKeys).size !== categoryKeys.length) {
      setError('Remove duplicate speedrun category names before saving.');
      return;
    }
    const recordKeys = recordCategories.map((entry) => entry.name.toLocaleLowerCase());
    if (new Set(recordKeys).size !== recordKeys.length) {
      setError('Remove duplicate record names before saving.');
      return;
    }
    // A speedrun and a record may share a name; each competition type keeps its
    // own boards and leaderboards.

    setSaving(true);
    try {
      const payload = {
        title: trimmedTitle,
        slug: trimmedSlug,
        cover_url: coverUrl.trim() || null,
        blurb: blurb.trim() || null,
        page_url: pageUrl.trim() || null,
        source: source.trim() || null,
        is_featured: featured,
        is_hidden: hidden,
      };
      let savedGameId = game?.id;
      if (game) {
        const { error: updErr } = await supabase
          .from('games')
          .update(payload)
          .eq('id', game.id);
        if (updErr) throw updErr;
      } else {
        const { data: createdGame, error: insErr } = await supabase
          .from('games')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        savedGameId = createdGame.id;

        if (categories.length > 0 || recordCategories.length > 0) {
          const rows = [
            ...categories.map((name, index) => ({
              game_id: createdGame.id,
              name,
              timing_rules: null,
              parent_category_id: null,
              sort_order: (index + 1) * 10,
              competition_type: 'speedrun' as const,
              record_unit: null,
              record_description: null,
              record_rules: null,
              record_higher_is_better: true,
            })),
            ...recordCategories.map((entry, index) => ({
              game_id: createdGame.id,
              name: entry.name,
              timing_rules: null,
              parent_category_id: null,
              sort_order: (index + 1) * 10,
              competition_type: 'record' as const,
              record_unit: entry.unit,
              record_description: null,
              record_rules: null,
              record_higher_is_better: true,
            })),
          ];
          const { error: categoriesError } = await supabase.from('categories').insert(rows);
          if (categoriesError) {
            console.error('save initial game categories failed', categoriesError);
            onSaved(
              createdGame.id,
              `Game created, but its categories could not be saved. Add them from the expanded game below. ${categoriesError.message}`
            );
            return;
          }
        }
      }
      onSaved(game ? undefined : savedGameId);
    } catch (cause) {
      console.error('save game failed', cause);
      const err = cause as { code?: string; message?: string };
      const detail = err?.message ?? '';
      if (err?.code === '23505') {
        setError('That slug is already taken. Pick a different URL slug.');
      } else if (
        err?.code === 'PGRST204' ||
        /column .* does not exist|Could not find the/i.test(detail)
      ) {
        setError(/is_hidden/i.test(detail)
          ? 'The database is missing game visibility support. Apply migrations 0003 and 0004, then try again.'
          : 'The database is missing a game details column. Apply the latest database migrations, then try again.');
      } else if (err?.code === '42501') {
        setError(
          'Only owner accounts can add or edit games. Sign in with an owner account and try again.'
        );
      } else if (detail) {
        setError(`Could not save game: ${detail}`);
      } else {
        setError('Could not save game. Check that the slug is unique.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface)] p-5 sr-fade-in sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="game-modal-title" className="text-xl font-bold text-[var(--sr-text)]">
              {game ? 'Edit game' : 'New game'}
            </h2>
            <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
              {game ? 'Update the details shown on this game page.' : 'Start with the name; optional details can be filled in later.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close game form" className="rounded-md p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-link)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <section className="rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface-2)]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--sr-text)]">Game details</h3>
            <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="game-title" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Game name <span className="text-[var(--sr-primary)]">Required</span>
            </label>
            <input
              id="game-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Super Mario 64"
              className="sr-input"
              autoFocus
              required
            />
            {!game && speedrunLookup.status !== 'idle' && (
              <div className="mt-2 text-sm text-[var(--sr-text-muted)]" role={speedrunLookup.status === 'error' ? 'alert' : 'status'}>
                {speedrunLookup.status === 'checking' && 'Checking speedrun.com…'}
                {speedrunLookup.status === 'not-found' && `No speedrun.com listing found for “${speedrunLookup.query}”.`}
                {speedrunLookup.status === 'error' && 'Could not check speedrun.com. You can still create the game.'}
                {speedrunLookup.status === 'found' && (
                  <>
                    <p className="mb-1 text-[var(--sr-text)]">
                      {speedrunLookup.games.some((item) => item.exactMatch)
                        ? 'Exact game match found on speedrun.com:'
                        : 'No exact match found. Possible speedrun.com matches:'}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {speedrunLookup.games.map((item) => (
                        <li key={item.id}>
                          <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--sr-primary)] hover:underline">
                            {item.name}{item.exactMatch ? ' (exact match)' : ''}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="game-slug" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">Page address</label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-[var(--sr-text-muted)]">/games/</span>
              <input
                id="game-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="game-name"
                className="sr-input sr-mono"
                aria-describedby="game-slug-help"
                required
              />
              {slugTouched && !game && (
                <button type="button" onClick={() => setSlugTouched(false)} className="sr-btn-ghost shrink-0 text-xs">
                  Reset
                </button>
              )}
            </div>
            <p id="game-slug-help" className="mt-1 text-xs text-[var(--sr-text-muted)]">
              {game ? 'Changing this also changes the game page URL.' : 'Generated from the game name. You can edit it; it must be unique.'}
            </p>
          </div>
            </div>
          </section>

          <section className="rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface-2)]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--sr-text)]">
              Page presentation <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </h3>
            <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="game-cover" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Cover image URL <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </label>
            <input
              id="game-cover"
              type="url"
              value={coverUrl}
              onChange={(e) => {
                setCoverUrl(e.target.value);
                setCoverPreviewError(false);
              }}
              placeholder="https://..."
              className="sr-input"
            />
            {coverUrl && !coverPreviewError ? (
              <img
                key={coverUrl}
                src={coverUrl}
                alt={`${title || 'Game'} cover preview`}
                className="mt-2 h-24 w-40 rounded-md object-cover border border-[var(--sr-border)]"
                onError={() => setCoverPreviewError(true)}
              />
            ) : (
              <p className="mt-2 flex h-24 w-40 items-center justify-center rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface-2)] px-2 text-center text-xs text-[var(--sr-text-muted)]">
                {coverPreviewError ? 'Image could not be loaded' : 'Cover preview'}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="game-description" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Short description <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </label>
            <textarea
              id="game-description"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              rows={2}
              placeholder="Short description of the game..."
              className="sr-input resize-none"
            />
          </div>
            </div>
          </section>

          <section className="rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface-2)]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--sr-text)]">
              Links and visibility <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="game-page-url" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Official game page <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </label>
            <input
              id="game-page-url"
              type="url"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://store.steampowered.com/app/..."
              className="sr-input"
            />
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
              Link to the official store, wiki, or website.
            </p>
          </div>

          <div>
            <label htmlFor="game-source" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Platform <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
            </label>
            <input
              id="game-source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Roblox, Steam, web browser..."
              maxLength={60}
              className="sr-input"
            />
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
              Where players access the game, such as Roblox, Steam, or browser.
            </p>
          </div>
            </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-[var(--sr-text)]">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-md border-[var(--sr-border)] accent-[var(--sr-primary)]"
            />
            <span>
              <span className="block font-medium">Feature on the homepage</span>
              <span className="text-xs text-[var(--sr-text-muted)]">Highlight this game in the featured games section.</span>
            </span>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-[var(--sr-text)]">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-md border-[var(--sr-border)] accent-[var(--sr-primary)]"
            />
            <span>
              <span className="block font-medium">Hide game from public</span>
              <span className="text-xs text-[var(--sr-text-muted)]">
                Only moderators and owners can view its page until it is ready.
              </span>
            </span>
          </label>
          </section>

          {!game && (
            <section className="rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface-2)]/50 p-4">
              <h3 className="text-sm font-semibold text-[var(--sr-text)]">Competition types</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--sr-text-muted)]">
                Choose what this game runs. You can add, edit, and reorder categories later from
                the game list. Speedruns and records are stored separately.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-2 border px-3 py-2.5 text-sm transition-colors ${
                    supportsSpeedruns
                      ? 'border-[var(--sr-primary)] bg-[var(--sr-primary)]/10'
                      : 'border-[var(--sr-border)] hover:border-[var(--sr-border-hover)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={supportsSpeedruns}
                    onChange={(event) => setSupportsSpeedruns(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--sr-primary)]"
                  />
                  <span>
                    <span className="block font-semibold text-[var(--sr-text)]">Speedruns</span>
                    <span className="text-xs text-[var(--sr-text-muted)]">
                      Timed boards ranked by fastest completion.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2 border px-3 py-2.5 text-sm transition-colors ${
                    supportsRecords
                      ? 'border-[var(--sr-primary)] bg-[var(--sr-primary)]/10'
                      : 'border-[var(--sr-border)] hover:border-[var(--sr-border-hover)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={supportsRecords}
                    onChange={(event) => setSupportsRecords(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--sr-primary)]"
                  />
                  <span>
                    <span className="block font-semibold text-[var(--sr-text)]">Records</span>
                    <span className="text-xs text-[var(--sr-text-muted)]">
                      Numeric boards ranked by the best value.
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {supportsSpeedruns && (
                  <div className="border-l-2 border-[var(--sr-primary)] pl-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label htmlFor="initial-categories" className="text-sm font-semibold text-[var(--sr-text)]">
                        Speedrun categories{' '}
                        <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                      </label>
                      <span className="text-xs text-[var(--sr-text-muted)]">
                        {categoryNames.split('\n').filter((name) => name.trim()).length} added
                      </span>
                    </div>
                    <textarea
                      id="initial-categories"
                      value={categoryNames}
                      onChange={(e) => setCategoryNames(e.target.value)}
                      rows={3}
                      placeholder={'One category per line, for example:\nAny%\n100%\nAll Bosses'}
                      className="sr-input resize-y"
                      aria-describedby="initial-categories-help"
                    />
                    <p id="initial-categories-help" className="mt-1 text-xs leading-5 text-[var(--sr-text-muted)]">
                      Each line becomes a timed speedrun board.
                    </p>
                  </div>
                )}

                {supportsRecords && (
                  <div className="border-l-2 border-[var(--sr-border-hover)] pl-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label htmlFor="initial-records" className="text-sm font-semibold text-[var(--sr-text)]">
                        Record categories{' '}
                        <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                      </label>
                      <span className="text-xs text-[var(--sr-text-muted)]">
                        {recordCategoryNames.split('\n').filter((line) => line.trim()).length} added
                      </span>
                    </div>
                    <textarea
                      id="initial-records"
                      value={recordCategoryNames}
                      onChange={(e) => setRecordCategoryNames(e.target.value)}
                      rows={3}
                      placeholder={'One record per line as Name | Unit, for example:\nMost Coins | Coins\nHighest Score | Points\nLongest Survival | Seconds'}
                      className="sr-input resize-y"
                      aria-describedby="initial-records-help"
                    />
                    <p id="initial-records-help" className="mt-1 text-xs leading-5 text-[var(--sr-text-muted)]">
                      Use <span className="sr-mono">Name | Unit</span>. The unit defaults to
                      “Value” when omitted. Higher is better unless you change it later.
                    </p>
                  </div>
                )}
              </div>

              {!supportsSpeedruns && !supportsRecords && (
                <p className="mt-3 border-l-2 border-[var(--sr-warn)] pl-3 text-xs text-[var(--sr-text-muted)]">
                  No competition types selected. Guides and forums will still be available.
                </p>
              )}
            </section>
          )}

          {error && (
            <div role="alert" className="rounded-md border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--sr-border)] pt-4 sm:flex-row-reverse sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="sr-btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="sr-btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : game ? 'Save changes' : 'Create game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({
  gameId,
  category,
  initialName,
  initialTimingRules,
  initialRecord,
  initialCompetitionType,
  existingCategories,
  parentCategories,
  initialParentCategoryId,
  onClose,
  onSaved,
}: {
  gameId: string;
  category: Category | null;
  initialName?: string | undefined;
  initialTimingRules?: string | null | undefined;
  initialRecord?: Category | null | undefined;
  initialCompetitionType?: CompetitionType | undefined;
  existingCategories: Category[];
  parentCategories: Category[];
  initialParentCategoryId: string | null;
  onClose: () => void;
  onSaved: (keepAdding: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(initialName ?? category?.name ?? '');
  const [competitionType, setCompetitionType] = useState<CompetitionType>(
    category?.competition_type ??
      initialRecord?.competition_type ??
      initialCompetitionType ??
      'speedrun'
  );
  const [timingRules, setTimingRules] = useState(initialTimingRules ?? category?.timing_rules ?? '');
  const [recordUnit, setRecordUnit] = useState(
    category?.record_unit ?? initialRecord?.record_unit ?? ''
  );
  const [recordDescription, setRecordDescription] = useState(
    category?.record_description ?? initialRecord?.record_description ?? ''
  );
  const [recordRules, setRecordRules] = useState(
    category?.record_rules ?? initialRecord?.record_rules ?? ''
  );
  const [recordHigherIsBetter, setRecordHigherIsBetter] = useState(
    category?.record_higher_is_better ?? initialRecord?.record_higher_is_better ?? true
  );
  const [sharedCategoryIds, setSharedCategoryIds] = useState<string[]>([]);
  const [parentCategoryId, setParentCategoryId] = useState(initialParentCategoryId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const isRecord = competitionType === 'record';
  // Levels may only group competitions of the same type, so a record board can
  // never be nested under a speedrun board (or the other way around).
  const compatibleParents = parentCategories.filter(
    (parent) =>
      parent.id !== category?.id && !isRecordCategory(parent) === !isRecord
  );
  const sharedRuleTargets = existingCategories.filter(
    (item) => item.id !== category?.id && !isRecordCategory(item)
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const keepAdding = submitter instanceof HTMLButtonElement && submitter.value === 'save-another';
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Category name is required.');
      return;
    }
    const trimmedUnit = recordUnit.trim();
    if (isRecord && !trimmedUnit) {
      setError('Records need a measurement unit, such as Kills, Points, or Wins.');
      return;
    }
    if (parentCategoryId && !compatibleParents.some((parent) => parent.id === parentCategoryId)) {
      setError(
        isRecord
          ? 'Select a valid record competition to group this record under.'
          : 'Select a valid main category for this subcategory.'
      );
      return;
    }
    const targetParentId = parentCategoryId || null;
    const targetSiblings = existingCategories.filter(
      (item) => item.parent_category_id === targetParentId && item.id !== category?.id
    );
    const categorySortOrder =
      category && category.parent_category_id === targetParentId
        ? category.sort_order
        : Math.max(0, ...targetSiblings.map((item) => item.sort_order)) + 10;
    const dupe = parentCategoryId
      ? undefined
      : existingCategories.find(
          (c) =>
            c.name.toLowerCase() === trimmedName.toLowerCase() &&
            c.id !== category?.id &&
            c.competition_type === competitionType
        );
    if (dupe) {
      setError(
        `A ${isRecord ? 'record' : 'speedrun'} category with that name already exists for this game. The same name is allowed under the other competition type.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        game_id: gameId,
        name: trimmedName,
        timing_rules: isRecord ? null : timingRules.trim() || null,
        sort_order: categorySortOrder,
        parent_category_id: targetParentId,
        competition_type: competitionType,
        record_unit: isRecord ? trimmedUnit : null,
        record_description: isRecord ? recordDescription.trim() || null : null,
        record_rules: isRecord ? recordRules.trim() || null : null,
        record_higher_is_better: isRecord ? recordHigherIsBetter : true,
      };
      let savedCategoryId = category?.id;
      if (category) {
        const { data: updatedCategory, error: updErr } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', category.id)
          .select('id, game_id, parent_category_id')
          .single();
        if (updErr) throw updErr;
        if (
          updatedCategory.game_id !== gameId ||
          updatedCategory.parent_category_id !== targetParentId
        ) {
          throw new Error('The saved category did not match the selected game and parent category.');
        }
      } else {
        const { data: insertedCategory, error: insErr } = await supabase
          .from('categories')
          .insert(payload)
          .select('id, game_id, parent_category_id')
          .single();
        if (insErr) throw insErr;
        if (
          insertedCategory.game_id !== gameId ||
          insertedCategory.parent_category_id !== targetParentId
        ) {
          throw new Error('The saved category did not match the selected game and parent category.');
        }
        savedCategoryId = insertedCategory.id;
      }

      const categoriesToUpdate = isRecord
        ? []
        : sharedCategoryIds.filter((id) => id !== savedCategoryId);
      if (categoriesToUpdate.length > 0) {
        const { error: sharedRulesError } = await supabase
          .from('categories')
          .update({ timing_rules: payload.timing_rules })
          .in('id', categoriesToUpdate);
        if (sharedRulesError) throw sharedRulesError;
      }

      await onSaved(keepAdding);
      if (keepAdding) {
        setName('');
        setTimingRules('');
        setRecordUnit('');
        setRecordDescription('');
        setRecordRules('');
        setSharedCategoryIds([]);
        setSavedNotice('Category added. You can add another or close this form.');
      }
    } catch (cause) {
      console.error('save category failed', cause);
      const detail =
        typeof cause === 'object' && cause !== null && 'message' in cause &&
        typeof cause.message === 'string'
          ? cause.message
          : '';
      if (
        detail.includes('categories_game_id_name_key') ||
        detail.includes('categories_main_name_key')
      ) {
        setError(
          'The database still blocks duplicate category names. Apply drizzle/migrations/0010_guides_and_forums.sql to the project database, then try again.'
        );
        return;
      }
      if (/(competition_type|record_unit|record_description|record_rules|record_higher_is_better)/i.test(detail)) {
        setError(
          'The database is missing competition type support. Apply drizzle/migrations/0009_competition_types.sql to the project database, then try again.'
        );
        return;
      }
      if (detail.includes('must target a speedrun competition') || detail.includes('must target a record competition')) {
        setError('This competition already has submissions of the other type. Delete them or keep the current type.');
        return;
      }
      if (detail.includes('already has speedrun submissions') || detail.includes('already has record submissions')) {
        setError(
          'This competition already has submissions, so its type cannot change. Create a new competition instead.'
        );
        return;
      }
      setError(detail ? `Could not save category: ${detail}` : 'Could not save category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-[var(--sr-border)] bg-[var(--sr-surface)] p-5 sr-fade-in sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="category-modal-title" className="text-xl font-bold text-[var(--sr-text)]">
              {category
                ? isRecord
                  ? 'Edit record'
                  : category.parent_category_id
                    ? 'Edit subcategory'
                    : 'Edit category'
                : isRecord
                  ? initialParentCategoryId
                    ? 'New record variant'
                    : 'New record'
                  : 'New category'}
            </h2>
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">Choose how runners will find and compare these runs.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close category form" className="rounded-md p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-link)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Competition type <span className="text-[var(--sr-primary)]">Required</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['speedrun', 'record'] as CompetitionType[]).map((type) => {
                const selected = competitionType === type;
                return (
                  <label
                    key={type}
                    className={`flex cursor-pointer items-start gap-2 border px-3 py-2.5 text-sm transition-colors ${
                      selected
                        ? 'border-[var(--sr-primary)] bg-[var(--sr-primary)]/10'
                        : 'border-[var(--sr-border)] hover:border-[var(--sr-border-hover)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="competition-type"
                      value={type}
                      checked={selected}
                      onChange={() => {
                        setCompetitionType(type);
                        if (type === 'record') setSharedCategoryIds([]);
                      }}
                      className="mt-0.5 accent-[var(--sr-primary)]"
                    />
                    <span>
                      <span className="block font-semibold text-[var(--sr-text)]">
                        {type === 'record' ? 'Record' : 'Speedrun'}
                      </span>
                      <span className="text-xs text-[var(--sr-text-muted)]">
                        {type === 'record'
                          ? 'Numeric value wins. No time formatting.'
                          : 'Timed leaderboard, exactly like existing categories.'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
              This only applies to this competition. The game can hold both types.
            </p>
          </fieldset>

          <div>
            <label htmlFor="category-name" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              {isRecord ? 'Record name' : 'Category name'} <span className="text-[var(--sr-primary)]">Required</span>
            </label>
            <input
              id="category-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isRecord
                  ? 'e.g. Most Kills in One Match, Highest Score'
                  : 'e.g. Any%, Glitchless, All bosses'
              }
              className="sr-input"
              autoFocus
              required
            />
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
              {isRecord
                ? 'Each record gets its own leaderboard with the same rules for every player.'
                : 'Keep categories distinct; use one leaderboard format per category.'}
            </p>
          </div>

          {isRecord ? (
            <>
              <div>
                <label htmlFor="record-description" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
                  Description <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                </label>
                <textarea
                  id="record-description"
                  value={recordDescription}
                  onChange={(e) => setRecordDescription(e.target.value)}
                  rows={2}
                  placeholder="What the record measures, e.g. eliminations in a single match."
                  className="sr-input resize-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="record-unit" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
                    Measurement unit <span className="text-[var(--sr-primary)]">Required</span>
                  </label>
                  <input
                    id="record-unit"
                    type="text"
                    list="record-unit-options"
                    value={recordUnit}
                    onChange={(e) => setRecordUnit(e.target.value)}
                    placeholder="Kills, Wins, Points..."
                    className="sr-input"
                    maxLength={24}
                    required
                  />
                  <datalist id="record-unit-options">
                    {['Kills', 'Wins', 'Points', 'Score', 'Damage', 'Distance', 'Streak', 'Level', 'Goals'].map(
                      (unit) => (
                        <option key={unit} value={unit} />
                      )
                    )}
                  </datalist>
                  <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                    Shown next to every submitted value.
                  </p>
                </div>

                <div>
                  <label htmlFor="record-direction" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
                    Leaderboard order
                  </label>
                  <select
                    id="record-direction"
                    value={recordHigherIsBetter ? 'higher' : 'lower'}
                    onChange={(event) => setRecordHigherIsBetter(event.target.value === 'higher')}
                    className="sr-input"
                  >
                    <option value="higher">Highest value wins</option>
                    <option value="lower">Lowest value wins</option>
                  </select>
                  <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                    Most records are highest-wins. Pick lowest-wins for stats like times or deaths.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="record-rules" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
                  Rules and restrictions <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                </label>
                <textarea
                  id="record-rules"
                  value={recordRules}
                  onChange={(e) => setRecordRules(e.target.value)}
                  rows={3}
                  placeholder="Game mode, difficulty, allowed loadouts, or anything reviewers must check."
                  className="sr-input resize-none"
                />
                <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                  Shown to players when they submit and to owners while reviewing.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="category-rules" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
                  Timing rules <span className="font-normal text-[var(--sr-text-muted)]">Optional</span>
                </label>
                <textarea
                  id="category-rules"
                  value={timingRules}
                  onChange={(e) => setTimingRules(e.target.value)}
                  rows={2}
                  placeholder="Explain what counts as a valid run and how it should be timed."
                  className="sr-input resize-none"
                />
                <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                  Shown to runners and used by the verification assistant.
                </p>
              </div>

              {sharedRuleTargets.length > 0 && (
                <fieldset className="rounded-md border border-[var(--sr-border)] p-3">
                  <legend className="px-1 text-sm font-medium text-[var(--sr-text)]">
                    Use these timing rules for other categories
                  </legend>
                  <p className="mb-2 text-xs text-[var(--sr-text-muted)]">
                    Selected categories will be updated to use the timing rules above.
                  </p>
                  <div className="flex max-h-36 flex-col gap-2 overflow-y-auto">
                    {sharedRuleTargets.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-[var(--sr-text)]">
                        <input
                          type="checkbox"
                          checked={sharedCategoryIds.includes(item.id)}
                          onChange={(event) => {
                            setSharedCategoryIds((current) =>
                              event.target.checked
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id)
                            );
                          }}
                          className="accent-[var(--sr-primary)]"
                        />
                        {item.name}
                        {item.parent_category_id && (
                          <span className="text-[var(--sr-text-muted)]">
                            {' '}(under {existingCategories.find((parent) => parent.id === item.parent_category_id)?.name ?? 'unknown category'})
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--sr-text)]" htmlFor="parent-category">
              {isRecord ? 'Group under an existing record' : 'Category level'}
            </label>
            <select
              id="parent-category"
              value={parentCategoryId}
              onChange={(event) => setParentCategoryId(event.target.value)}
              className="sr-input"
            >
              <option value="">{isRecord ? 'Standalone record' : 'Main leaderboard'}</option>
              {compatibleParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {isRecord ? `Grouped under ${parent.name}` : `Subcategory of ${parent.name}`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
              {isRecord
                ? 'Optional. Use this for game modes or variants that belong with another record.'
                : 'Use subcategories for separate rule sets or platform variants under a main category.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-md border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
              {error}
            </div>
          )}

          {savedNotice && <p role="status" className="text-sm text-[var(--sr-primary)]">{savedNotice}</p>}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--sr-border)] pt-4 sm:flex-row-reverse sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="sr-btn-ghost">Cancel</button>
            <button type="submit" name="category-action" value="save" disabled={saving} className="sr-btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : category ? 'Save changes' : isRecord ? 'Add record' : 'Add category'}
            </button>
            {!category && (
              <button type="submit" name="category-action" value="save-another" disabled={saving} className="sr-btn-ghost">
                Add &amp; add another
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
