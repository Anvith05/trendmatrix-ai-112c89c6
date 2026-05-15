
-- Add kind column to stock_universe (stock | etf)
ALTER TABLE public.stock_universe ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'stock';

-- Journal entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid,
  symbol text NOT NULL,
  name text,
  sector text,
  kind text NOT NULL DEFAULT 'stock',
  entry_price numeric NOT NULL,
  target_price numeric,
  current_price numeric,
  peak_price numeric,
  status text NOT NULL DEFAULT 'in_progress',
  suggested_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  last_checked_at timestamptz,
  swing_score integer,
  tags text[],
  UNIQUE (recommendation_id)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal public read" ON public.journal_entries;
CREATE POLICY "journal public read" ON public.journal_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "journal public insert" ON public.journal_entries;
CREATE POLICY "journal public insert" ON public.journal_entries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "journal public update" ON public.journal_entries;
CREATE POLICY "journal public update" ON public.journal_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_journal_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_kind ON public.journal_entries(kind);

-- Trigger: auto-log every new recommendation into journal
CREATE OR REPLACE FUNCTION public.log_recommendation_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.journal_entries (
    recommendation_id, symbol, name, sector, kind,
    entry_price, target_price, swing_score, tags, suggested_at
  )
  VALUES (
    NEW.id, NEW.symbol, NEW.name, NEW.sector,
    COALESCE((SELECT kind FROM public.stock_universe WHERE symbol = NEW.symbol LIMIT 1), 'stock'),
    COALESCE(NEW.entry_price, NEW.ltp, 0),
    CASE WHEN NEW.entry_price IS NOT NULL THEN NEW.entry_price * 1.30 ELSE NULL END,
    NEW.swing_score, NEW.tags, NEW.recommended_at
  )
  ON CONFLICT (recommendation_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_recommendation_to_journal ON public.recommendations;
CREATE TRIGGER trg_log_recommendation_to_journal
AFTER INSERT ON public.recommendations
FOR EACH ROW EXECUTE FUNCTION public.log_recommendation_to_journal();

-- Backfill existing recommendations
INSERT INTO public.journal_entries (
  recommendation_id, symbol, name, sector, kind,
  entry_price, target_price, swing_score, tags, suggested_at, status, closed_at
)
SELECT
  r.id, r.symbol, r.name, r.sector,
  COALESCE((SELECT kind FROM public.stock_universe WHERE symbol = r.symbol LIMIT 1), 'stock'),
  COALESCE(r.entry_price, r.ltp, 0),
  CASE WHEN r.entry_price IS NOT NULL THEN r.entry_price * 1.30 ELSE NULL END,
  r.swing_score, r.tags, r.recommended_at,
  'in_progress', NULL
FROM public.recommendations r
ON CONFLICT (recommendation_id) DO NOTHING;
