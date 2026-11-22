# SplitRush SQL editor pastes

Convenience copies of `drizzle/migrations/0009_competition_types.sql` and
`drizzle/migrations/0010_guides_and_forums.sql`, split into short files for the
Supabase SQL editor. The files in `drizzle/migrations/` remain the source of
truth.

Each file is safe to re-run (`IF NOT EXISTS`, `CREATE OR REPLACE`,
`DROP ... IF EXISTS`) and ends with an `-- END OF FILE:` marker. If that marker
is not the last line in the editor, the paste was cut off.

> **About `$sr$`:** these files use `$sr$ ... $sr$` as the function-body
> delimiter instead of `$$ ... $$`. Both are valid PostgreSQL, but some editors
> and shells treat `$$` specially. `$sr$` avoids that.

## Run them in this order

| # | File | Adds | Needs first |
|---|---|---|---|
| 1 | `01_competition_types.sql` | Competition type + record columns, `record_submissions`, read/insert policies | Base schema |
| 2 | `02_competition_guards.sql` | Guards that stop speedruns and records from mixing | 1 |
| 3 | `03_record_moderation.sql` | Owner verify/reject/delete/notes functions for records | 1 |
| 4 | `04_category_names.sql` | Identical category names across competition types | 1 |
| 5 | `05_guide_tables.sql` | Guides, sections, helpful votes, grants, RLS | Base schema |
| 6 | `06_guide_policies.sql` | Guide read/write policies | 5 |
| 7 | `07_forum_tables.sql` | Discussions, replies, votes, reports, grants, RLS | Base schema |
| 8 | `08_forum_score_triggers.sql` | Vote score triggers | 7 |
| 9 | `09_forum_guards.sql` | Pin/lock, reply, and accepted-answer guards | 7 |
| 10 | `10_forum_policies.sql` | Forum read/write and report policies | 7 |
| 11 | `11_forum_votes.sql` | `vote_forum_thread` / `vote_forum_post` helpers | 7 |

Only need forums? Run 7, 8, 9, 10, 11. Only need guides? Run 5 and 6.
Only need records? Run 1, 2, 3, 4.

`00_all_in_one.sql` contains everything in one file if your editor handles a
longer paste.

## Troubleshooting

**`unterminated dollar-quoted string at or near "$sr$ ..."`**

The editor received only part of a function. This happens when a paste is cut
off, or when only some text was selected and "Run selection" was used.

1. Open the file again and copy with **Ctrl+A** then **Ctrl+C**. In GitHub use
   **Raw** first.
2. Confirm the last line in the editor is `-- END OF FILE: <filename>`.
3. Clear any text selection before clicking Run, or use the editor shortcut for
   running the whole script.
4. Prefer the smaller numbered file over `00_all_in_one.sql` if this keeps
   happening.

**`relation "..." does not exist`**

A dependency has not run yet. Check the "Needs first" column, for example run
`07_forum_tables.sql` before `08_forum_score_triggers.sql`.

**`must be owner of table ...`**

Run the SQL as the database owner/admin role, not a limited application role.

**An earlier file failed halfway**

Re-run that same file. Every statement checks first, so already-applied parts
are skipped safely, then continue with the next number.
