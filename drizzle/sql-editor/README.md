# SplitRush SQL editor pastes

These files are convenience copies of the canonical migrations for pasting into
the Supabase SQL editor (or any other SQL console). They contain the same SQL as
`drizzle/migrations/0009_competition_types.sql` and
`drizzle/migrations/0010_guides_and_forums.sql`, split into short files.

The files in `drizzle/migrations/` are still the source of truth. These copies
exist because a few small pastes are easier to retry than one long script.

## Two ways to apply them

**Option A - one paste**

Open `00_all_in_one.sql`, copy the whole file, paste it into the SQL editor, and
run it once. This is migrations 0009 and 0010 in the correct order.

**Option B - seven small pastes**

Run these in filename order. Each file is self-contained and safe to re-run.

| # | File | What it does | Needs |
|---|---|---|---|
| 1 | `01_competition_types.sql` | Competition type + record columns, `record_submissions`, read/insert policies | Base schema |
| 2 | `02_competition_guards.sql` | Guards that stop speedruns and records from mixing; blocks type changes after submissions exist | 1 |
| 3 | `03_record_moderation.sql` | Owner verify/reject/delete/notes functions for records | 1 |
| 4 | `04_category_names.sql` | Allows identical category names across competition types | 1 |
| 5 | `05_guides.sql` | Guides, sections, helpful votes, and permissions | Base schema |
| 6 | `06_forums.sql` | Discussions, replies, votes, reports, pin/lock guards, and permissions | Base schema |
| 7 | `07_forum_votes.sql` | `vote_forum_thread` / `vote_forum_post` helpers | 6 |

## Copying tips

- Open the file and use **Ctrl+A**, **Ctrl+C** (or **Raw** in GitHub, then copy
  the whole page). Do not hand-select lines; a missing semicolon is the usual
  cause of a failed paste.
- Each file uses `IF NOT EXISTS`, `CREATE OR REPLACE`, and `DROP ... IF EXISTS`,
  so re-running a file after a partial failure is safe.
- If the editor reports that something already exists, that part was applied
  already. Continue with the next numbered file.
- `02_competition_guards.sql` requires `01_competition_types.sql` first because
  it references `categories.competition_type` and `record_submissions`.
- `07_forum_votes.sql` requires `06_forums.sql` first because it references
  `forum_votes`.
- These files only add the competition, guide, and forum features. They do not
  delete or rewrite existing runs, categories, profiles, or games.

## After the SQL

1. Check the owner account can see the new tabs, guides, and forums.
2. Publish in Lovable.
3. Set `OWNER_ONLY_PREVIEW = false` in `src/lib/preview.ts` and push, so
   everyone sees the new layout.
