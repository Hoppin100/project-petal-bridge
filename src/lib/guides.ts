import { supabase } from '@/lib/supabase';
import type { Guide, GuideCategory, GuideSection, Profile } from '@/lib/types';

export const GUIDE_COLUMNS =
  'id, game_id, author_id, title, summary, category, status, cover_image_url, helpful_count, created_at, updated_at, published_at';

export const GUIDE_SECTION_COLUMNS =
  'id, guide_id, heading, body, image_url, video_url, sort_order, created_at';

export const GUIDE_CATEGORIES: Array<{ id: GuideCategory; label: string }> = [
  { id: 'beginner', label: 'Beginner Guides' },
  { id: 'advanced', label: 'Advanced Strategies' },
  { id: 'walkthrough', label: 'Walkthroughs' },
  { id: 'tips', label: 'Tips and Tricks' },
  { id: 'glitch', label: 'Glitch and Technique Explanations' },
];

export function guideCategoryLabel(category: GuideCategory): string {
  return GUIDE_CATEGORIES.find((entry) => entry.id === category)?.label ?? 'Guide';
}

export type GuideSort = 'newest' | 'helpful' | 'title';

export function sortGuides(guides: Guide[], sort: GuideSort): Guide[] {
  const copy = [...guides];
  if (sort === 'helpful') {
    return copy.sort(
      (a, b) => b.helpful_count - a.helpful_count || a.title.localeCompare(b.title),
    );
  }
  if (sort === 'title') {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy.sort(
    (a, b) =>
      new Date(b.published_at ?? b.created_at).getTime() -
      new Date(a.published_at ?? a.created_at).getTime(),
  );
}

export function filterGuides(
  guides: Guide[],
  options: { search?: string; category?: GuideCategory | 'all' } = {},
): Guide[] {
  const term = (options.search ?? '').trim().toLowerCase();
  return guides.filter((guide) => {
    if (options.category && options.category !== 'all' && guide.category !== options.category) {
      return false;
    }
    if (!term) return true;
    return (
      guide.title.toLowerCase().includes(term) ||
      (guide.summary ?? '').toLowerCase().includes(term)
    );
  });
}

export function canEditGuide(
  guide: Pick<Guide, 'author_id'>,
  profile: Pick<Profile, 'id' | 'role'> | null | undefined,
): boolean {
  if (!profile) return false;
  return (
    guide.author_id === profile.id ||
    profile.role === 'owner' ||
    profile.role === 'moderator'
  );
}

function isMissingTable(error: { code?: string; message: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        error.code === 'PGRST205' ||
        /guides|guide_sections|schema cache/i.test(error.message)),
  );
}

/** Every guide the signed-in viewer may read, drafts included for the author. */
export async function fetchGameGuides(gameId: string): Promise<{
  guides: Guide[];
  error: string | null;
  migrationMissing: boolean;
}> {
  const { data, error } = await supabase
    .from('guides')
    .select(GUIDE_COLUMNS)
    .eq('game_id', gameId)
    .order('created_at', { ascending: false });

  if (error) {
    return { guides: [], error: isMissingTable(error) ? null : error.message, migrationMissing: isMissingTable(error) };
  }

  const guides = (data as Guide[]) ?? [];
  const authorIds = [...new Set(guides.map((guide) => guide.author_id))];
  if (authorIds.length === 0) return { guides, error: null, migrationMissing: false };

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, role, bio, avatar_url, created_at')
    .in('id', authorIds);
  const byId = new Map(((profiles as Profile[]) ?? []).map((profile) => [profile.id, profile]));
  return {
    guides: guides.map((guide) => ({ ...guide, author: byId.get(guide.author_id) })),
    error: null,
    migrationMissing: false,
  };
}

export async function fetchGuideSections(guideId: string): Promise<{
  sections: GuideSection[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('guide_sections')
    .select(GUIDE_SECTION_COLUMNS)
    .eq('guide_id', guideId)
    .order('sort_order')
    .order('created_at');
  return {
    sections: (data as GuideSection[]) ?? [],
    error: error ? error.message : null,
  };
}

export interface GuideDraft {
  title: string;
  summary: string;
  category: GuideCategory;
  status: 'draft' | 'published';
  cover_image_url: string | null;
  sections: Array<{
    heading: string;
    body: string;
    image_url: string | null;
    video_url: string | null;
  }>;
}

export async function saveGuide(input: {
  guideId?: string | undefined;
  gameId: string;
  authorId: string;
  draft: GuideDraft;
}): Promise<{ guideId: string | null; error: string | null }> {
  const payload = {
    game_id: input.gameId,
    author_id: input.authorId,
    title: input.draft.title.trim(),
    summary: input.draft.summary.trim() || null,
    category: input.draft.category,
    status: input.draft.status,
    cover_image_url: input.draft.cover_image_url?.trim() || null,
  };

  let guideId = input.guideId ?? null;
  if (guideId) {
    const { error } = await supabase.from('guides').update(payload).eq('id', guideId);
    if (error) return { guideId: null, error: error.message };
  } else {
    const { data, error } = await supabase
      .from('guides')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { guideId: null, error: error.message };
    guideId = (data as { id: string }).id;
  }

  const { error: deleteError } = await supabase
    .from('guide_sections')
    .delete()
    .eq('guide_id', guideId);
  if (deleteError) return { guideId, error: deleteError.message };

  const rows = input.draft.sections
    .filter((section) => section.body.trim() || section.heading.trim())
    .map((section, index) => ({
      guide_id: guideId,
      heading: section.heading.trim() || null,
      body: section.body,
      image_url: section.image_url?.trim() || null,
      video_url: section.video_url?.trim() || null,
      sort_order: index,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from('guide_sections').insert(rows);
    if (error) return { guideId, error: error.message };
  }

  return { guideId, error: null };
}

export async function deleteGuide(guideId: string): Promise<string | null> {
  const { error } = await supabase.from('guides').delete().eq('id', guideId);
  return error ? error.message : null;
}

/** Toggle the viewer's helpful vote. Duplicate votes are ignored. */
export async function setGuideHelpful(
  guideId: string,
  userId: string,
  helpful: boolean,
): Promise<string | null> {
  if (helpful) {
    const { error } = await supabase
      .from('guide_votes')
      .insert({ guide_id: guideId, user_id: userId });
    if (error && error.code !== '23505') return error.message;
    return null;
  }
  const { error } = await supabase
    .from('guide_votes')
    .delete()
    .eq('guide_id', guideId)
    .eq('user_id', userId);
  return error ? error.message : null;
}

export async function fetchHelpfulGuideIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('guide_votes')
    .select('guide_id')
    .eq('user_id', userId);
  if (error) return new Set();
  return new Set(((data as Array<{ guide_id: string }>) ?? []).map((row) => row.guide_id));
}
