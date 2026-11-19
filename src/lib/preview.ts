import { useAuth } from '@/lib/auth';

/**
 * New, unpublished UI is shown to the owner only.
 *
 * SplitRush is connected to Lovable, and the live site keeps serving the last
 * published build until the owner publishes again. Anything that exists in
 * `main` but not on the live site is kept behind this flag so visitors on an
 * owner's signed-in session can try it, while everyone else sees the published
 * experience.
 *
 * Once the update is published, set `OWNER_ONLY_PREVIEW` to `false` (or delete
 * this module and its call sites) to show it to everyone.
 */
export const OWNER_ONLY_PREVIEW = true;

export function useOwnerPreview(): boolean {
  const { profile } = useAuth();
  return !OWNER_ONLY_PREVIEW || profile?.role === 'owner';
}
