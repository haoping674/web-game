-- Apply once to the Neon database with `npm run db:migrate` (safe to rerun).
CREATE TABLE IF NOT EXISTS arcade_scores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  board text NOT NULL CHECK (board IN ('fruit-classic', 'color-time', 'color-removed', 'ashbound-souls')),
  submission_id uuid NOT NULL UNIQUE,
  player_name text NOT NULL CHECK (char_length(btrim(player_name)) BETWEEN 1 AND 20),
  score integer NOT NULL,
  sort_score integer GENERATED ALWAYS AS (CASE WHEN board = 'color-time' THEN score ELSE -score END) STORED,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- statement-breakpoint
-- Replace the original ten-floor cap on existing databases as well as fresh ones.
ALTER TABLE arcade_scores DROP CONSTRAINT IF EXISTS arcade_scores_check;
-- statement-breakpoint
ALTER TABLE arcade_scores ADD CONSTRAINT arcade_scores_check
  CHECK (CASE WHEN board = 'color-time' THEN score BETWEEN 0 AND 30
    WHEN board = 'ashbound-souls' THEN score BETWEEN 1 AND 2147483647 ELSE score BETWEEN 0 AND 170 END);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS arcade_scores_ranking ON arcade_scores (board, sort_score, created_at, id);

-- statement-breakpoint
CREATE OR REPLACE FUNCTION arcade_submit_score(p_board text, p_score integer, p_name text, p_submission uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_sort integer;
  v_rank integer;
  v_accepted boolean := false;
  v_existing arcade_scores%ROWTYPE;
  v_entries jsonb;
BEGIN
  -- Ashbound is retired; existing rows remain as historical records.
  IF p_board NOT IN ('fruit-classic', 'color-time', 'color-removed') OR p_board IS NULL
    OR p_score IS NULL OR p_name IS NULL OR p_submission IS NULL
    OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 20 OR p_name ~ '[[:cntrl:]<>]'
    OR NOT (CASE WHEN p_board = 'color-time' THEN p_score BETWEEN 0 AND 30 ELSE p_score BETWEEN 0 AND 170 END)
  THEN RAISE EXCEPTION 'Invalid leaderboard submission'; END IF;

  -- Serialize qualification + insertion per board. The following statements see
  -- committed writes after the lock under PostgreSQL's default READ COMMITTED.
  PERFORM pg_advisory_xact_lock(71023, hashtext(p_board));
  v_sort := CASE WHEN p_board = 'color-time' THEN p_score ELSE -p_score END;
  SELECT * INTO v_existing FROM arcade_scores WHERE submission_id = p_submission;
  IF FOUND THEN
    IF v_existing.board <> p_board OR v_existing.score <> p_score OR v_existing.player_name <> btrim(p_name)
      THEN RAISE EXCEPTION 'Submission already used'; END IF;
    v_accepted := true;
    SELECT count(*)::integer + 1 INTO v_rank FROM arcade_scores WHERE board = p_board
      AND (sort_score, created_at, id) < (v_existing.sort_score, v_existing.created_at, v_existing.id);
  ELSE
    -- Existing equal scores come first; rank 11 never qualifies, even on a tie.
    SELECT count(*)::integer + 1 INTO v_rank FROM (
      SELECT 1 FROM arcade_scores WHERE board = p_board AND sort_score <= v_sort LIMIT 10
    ) ahead;
    IF v_rank <= 10 THEN
      INSERT INTO arcade_scores (board, submission_id, player_name, score) VALUES (p_board, p_submission, btrim(p_name), p_score);
      v_accepted := true;
    END IF;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('rank', ranked.position, 'name', ranked.player_name, 'score', ranked.score) ORDER BY ranked.position), '[]'::jsonb)
    INTO v_entries FROM (
      SELECT player_name, score, row_number() OVER (ORDER BY sort_score, created_at, id) AS position
      FROM arcade_scores WHERE board = p_board ORDER BY sort_score, created_at, id LIMIT 10
    ) ranked;
  RETURN jsonb_build_object('accepted', v_accepted, 'eligible', v_rank <= 10, 'rank', v_rank, 'entries', v_entries);
END;
$$;
