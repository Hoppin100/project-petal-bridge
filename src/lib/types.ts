export type Role = 'member' | 'moderator' | 'owner';

export interface Profile {
  id: string;
  username: string;
  role: Role;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  blurb: string | null;
  page_url: string | null;
  source: string | null;
  is_featured: boolean;
  is_hidden: boolean;
  created_at: string;
}

/**
 * A category is one competition inside a game. The competition type belongs to
 * the category, never to the game, so a single game can run speedrun boards and
 * record boards side by side.
 */
export type CompetitionType = 'speedrun' | 'record';

export interface Category {
  id: string;
  game_id: string;
  parent_category_id: string | null;
  name: string;
  timing_rules: string | null;
  sort_order: number;
  created_at: string;
  competition_type: CompetitionType;
  /** Measurement unit for record competitions, e.g. "Kills". */
  record_unit: string | null;
  record_description: string | null;
  record_rules: string | null;
  /** Records are highest-wins by default; some boards are lower-is-better. */
  record_higher_is_better: boolean;
}

export interface GameRequest {
  id: string;
  requester_id: string;
  game_name: string;
  game_url: string;
  status: 'pending' | 'reviewed' | 'declined';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export type RunStatus = 'pending' | 'verified' | 'rejected';

export interface Run {
  id: string;
  game_id: string;
  category_id: string;
  runner_id: string;
  time_ms: number;
  platform: string;
  video_url: string;
  video_id: string | null;
  video_start_seconds: number | null;
  video_end_seconds: number | null;
  status: RunStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  // joined fields (optional)
  runner?: Profile;
  game?: Game;
  category?: Category;
}

export type RecordSubmissionStatus = 'pending' | 'verified' | 'rejected';

export interface RecordSubmission {
  id: string;
  game_id: string;
  category_id: string;
  submitter_id: string;
  value_numeric: number;
  platform: string;
  video_url: string;
  video_id: string | null;
  video_start_seconds: number | null;
  video_end_seconds: number | null;
  status: RecordSubmissionStatus;
  rejection_reason: string | null;
  moderator_notes: string | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  // joined fields (optional)
  submitter?: Profile;
  game?: Game;
  category?: Category;
}

export type Recommendation =
  | 'likely_consistent'
  | 'needs_review'
  | 'potential_concern';

export type EvidenceBasis =
  | 'video_analysis'
  | 'metadata'
  | 'statistical'
  | 'incomplete';

export interface AiAssessment {
  id: string;
  run_id: string;
  recommendation: Recommendation;
  confidence: number | null;
  explanation: string;
  evidence_basis: EvidenceBasis;
  observed_evidence: string | null;
  speculation: string | null;
  model_version: string;
  input_evidence: Record<string, unknown>;
  reference_example_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ReferenceExample {
  id: string;
  run_id: string;
  game_id: string;
  category_id: string;
  label: 'verified' | 'rejected';
  notes: string | null;
  marked_by: string;
  created_at: string;
  // joined fields
  run?: Run;
}

export interface GameRule {
  id: string;
  game_id: string;
  category_id: string | null;
  rule_text: string;
  sort_order: number;
  created_at: string;
}

export interface AssessmentHistoryEntry {
  id: string;
  run_id: string;
  action: string;
  detail: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Guides
 * ------------------------------------------------------------------ */

export type GuideCategory = 'beginner' | 'advanced' | 'walkthrough' | 'tips' | 'glitch';
export type GuideStatus = 'draft' | 'published';

export interface Guide {
  id: string;
  game_id: string;
  author_id: string;
  title: string;
  summary: string | null;
  category: GuideCategory;
  status: GuideStatus;
  cover_image_url: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // joined fields (optional)
  author?: Profile | undefined;
}

export interface GuideSection {
  id: string;
  guide_id: string;
  heading: string | null;
  body: string;
  image_url: string | null;
  video_url: string | null;
  sort_order: number;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Game forums
 * ------------------------------------------------------------------ */

export type ForumCategory = 'general' | 'help' | 'strategies' | 'questions' | 'tips';
export type ForumReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface ForumThread {
  id: string;
  game_id: string;
  author_id: string;
  title: string;
  body: string;
  category: ForumCategory;
  is_pinned: boolean;
  is_locked: boolean;
  is_solved: boolean;
  accepted_post_id: string | null;
  score: number;
  created_at: string;
  updated_at: string;
  // joined fields (optional)
  author?: Profile | undefined;
  reply_count?: number | undefined;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  parent_post_id: string | null;
  author_id: string;
  body: string;
  score: number;
  created_at: string;
  updated_at: string;
  // joined fields (optional)
  author?: Profile | undefined;
  replies?: ForumPost[] | undefined;
}

export interface ForumReport {
  id: string;
  reporter_id: string;
  thread_id: string | null;
  post_id: string | null;
  reason: string;
  status: ForumReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

