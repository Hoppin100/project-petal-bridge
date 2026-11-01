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

export interface Category {
  id: string;
  game_id: string;
  parent_category_id: string | null;
  name: string;
  timing_rules: string | null;
  sort_order: number;
  created_at: string;
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
