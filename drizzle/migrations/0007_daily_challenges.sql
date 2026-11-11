CREATE TABLE public.daily_challenges (
  challenge_date date PRIMARY KEY,
  game_id uuid NOT NULL,
  game_slug text NOT NULL,
  game_title text NOT NULL,
  game_cover_url text,
  game_page_url text,
  category_id uuid NOT NULL,
  category_name text NOT NULL,
  subcategory_id uuid,
  subcategory_name text,
  record_id uuid NOT NULL,
  record_time_ms bigint NOT NULL CHECK (record_time_ms > 0),
  record_video_url text NOT NULL,
  record_holder_username text NOT NULL,
  rules text,
  higher_is_better boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.daily_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.get_daily_challenge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
  v_reset_at timestamptz;
  v_candidate record;
  v_challenge public.daily_challenges%ROWTYPE;
BEGIN
  v_reset_at := ((v_today + 1)::timestamp AT TIME ZONE 'UTC');

  SELECT *
  INTO v_challenge
  FROM public.daily_challenges
  WHERE challenge_date = v_today;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'challenge_date', v_today,
      'next_reset_at', v_reset_at,
      'challenge', to_jsonb(v_challenge)
    );
  END IF;

  WITH eligible_categories AS (
    SELECT c.id AS category_id, c.game_id
    FROM public.categories c
    JOIN public.games g ON g.id = c.game_id
    LEFT JOIN public.categories parent
      ON parent.id = c.parent_category_id
      AND parent.game_id = c.game_id
    WHERE NOT g.is_hidden
      AND (
        (
          c.parent_category_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.categories child
            WHERE child.parent_category_id = c.id
              AND child.game_id = c.game_id
          )
        )
        OR (
          parent.parent_category_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.categories child
            WHERE child.parent_category_id = c.id
              AND child.game_id = c.game_id
          )
        )
      )
      AND EXISTS (
        SELECT 1
        FROM public.runs r
        WHERE r.game_id = c.game_id
          AND r.category_id = c.id
          AND r.status = 'verified'
      )
  ),
  selected_game AS (
    SELECT game_id
    FROM eligible_categories
    GROUP BY game_id
    ORDER BY random()
    LIMIT 1
  ),
  selected_category AS (
    SELECT ec.game_id, ec.category_id
    FROM eligible_categories ec
    JOIN selected_game sg ON sg.game_id = ec.game_id
    ORDER BY random()
    LIMIT 1
  ),
  selected_record AS (
    SELECT r.*
    FROM public.runs r
    JOIN selected_category sc
      ON sc.game_id = r.game_id
      AND sc.category_id = r.category_id
    WHERE r.status = 'verified'
    ORDER BY random()
    LIMIT 1
  )
  SELECT
    g.id AS game_id,
    g.slug AS game_slug,
    g.title AS game_title,
    g.cover_url AS game_cover_url,
    g.page_url AS game_page_url,
    c.id AS category_id,
    COALESCE(parent.name, c.name) AS category_name,
    CASE WHEN parent.id IS NOT NULL THEN c.id END AS subcategory_id,
    CASE WHEN parent.id IS NOT NULL THEN c.name END AS subcategory_name,
    r.id AS record_id,
    r.time_ms AS record_time_ms,
    r.video_url AS record_video_url,
    p.username AS record_holder_username,
    NULLIF(
      concat_ws(
        E'\n\n',
        NULLIF(parent.timing_rules, ''),
        NULLIF(c.timing_rules, ''),
        game_rules.rule_text
      ),
      ''
    ) AS rules,
    lower(g.slug) = 'bike-universe' OR lower(g.title) = 'bike universe'
      AS higher_is_better
  INTO v_candidate
  FROM selected_record r
  JOIN public.games g ON g.id = r.game_id
  JOIN public.categories c ON c.id = r.category_id AND c.game_id = r.game_id
  LEFT JOIN public.categories parent
    ON parent.id = c.parent_category_id
    AND parent.game_id = c.game_id
  JOIN public.profiles p ON p.id = r.runner_id
  CROSS JOIN LATERAL (
    SELECT string_agg(gr.rule_text, E'\n' ORDER BY gr.sort_order, gr.created_at, gr.id) AS rule_text
    FROM public.game_rules gr
    WHERE gr.game_id = g.id
      AND (gr.category_id IS NULL OR gr.category_id = c.id OR gr.category_id = parent.id)
  ) game_rules;

  IF FOUND THEN
    INSERT INTO public.daily_challenges (
      challenge_date,
      game_id,
      game_slug,
      game_title,
      game_cover_url,
      game_page_url,
      category_id,
      category_name,
      subcategory_id,
      subcategory_name,
      record_id,
      record_time_ms,
      record_video_url,
      record_holder_username,
      rules,
      higher_is_better
    )
    VALUES (
      v_today,
      v_candidate.game_id,
      v_candidate.game_slug,
      v_candidate.game_title,
      v_candidate.game_cover_url,
      v_candidate.game_page_url,
      v_candidate.category_id,
      v_candidate.category_name,
      v_candidate.subcategory_id,
      v_candidate.subcategory_name,
      v_candidate.record_id,
      v_candidate.record_time_ms,
      v_candidate.record_video_url,
      v_candidate.record_holder_username,
      v_candidate.rules,
      v_candidate.higher_is_better
    )
    ON CONFLICT (challenge_date) DO NOTHING;
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.daily_challenges
  WHERE challenge_date = v_today;

  RETURN jsonb_build_object(
    'challenge_date', v_today,
    'next_reset_at', v_reset_at,
    'challenge', CASE
      WHEN FOUND THEN to_jsonb(v_challenge)
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_challenge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_challenge() TO anon, authenticated;
