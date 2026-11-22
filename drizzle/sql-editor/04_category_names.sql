-- SplitRush SQL editor paste 4 of 7
-- Replaces the main-category unique index so the same name is allowed once per competition type. Subcategory duplicates were already allowed by migration 0006.
--
-- Paste this ENTIRE file into the Supabase SQL editor and run it once.
-- Safe to re-run: statements use IF NOT EXISTS / DROP ... IF EXISTS.
-- Requires the base SplitRush schema and the earlier numbered files
-- in this folder (see README.md for the order).

-- Guides and game forums.
--
-- Prerequisite: 0009_competition_types.sql (the categories index below uses
-- `competition_type`). Nothing here touches existing run or record data.

-- Identical category names are allowed as long as the competition type differs.
-- Subcategory duplicates were already allowed by 0006.
DROP INDEX IF EXISTS public.categories_main_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_main_name_key
  ON public.categories (game_id, competition_type, name)
  WHERE parent_category_id IS NULL;
