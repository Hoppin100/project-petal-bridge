ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_game_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS categories_main_name_key
  ON public.categories (game_id, name)
  WHERE parent_category_id IS NULL;
