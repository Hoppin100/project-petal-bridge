<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- SplitRush pages live in `src/views/` and are mounted by thin TanStack route files; links are plain `<a href="/...">` intercepted in `__root.tsx` so legacy markup routes client-side.
- Owner permissions come from `public.user_roles` (`is_owner()`); `profiles.role` is a trigger-maintained, client-read-only mirror for display.
- Run assessment runs in the `runVerification` server function (`src/lib/verify-run.functions.ts`), not an edge function.
- Screens that need a session or an owner must check the auth store's `loading` flag before rendering a sign-in or "owners only" message: on a hard page load the stored session is still null for a moment, and skipping that check flashes an access-denied screen (or opens the sign-in dialog) in front of someone who is already signed in.
