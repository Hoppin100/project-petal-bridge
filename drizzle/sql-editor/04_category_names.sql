-- SplitRush SQL editor paste 4 of 11
-- 4 of 11 - allows identical category names across competition types
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 01_competition_types.sql.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

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

-- END OF FILE: 04_category_names.sql
