CREATE TABLE public.recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  name text,
  sector text,
  ltp numeric,
  entry_price numeric,
  swing_score integer NOT NULL DEFAULT 0,
  monthly_score integer NOT NULL DEFAULT 0,
  weekly_score integer NOT NULL DEFAULT 0,
  history_score integer NOT NULL DEFAULT 0,
  volume_score integer NOT NULL DEFAULT 0,
  rs_score integer NOT NULL DEFAULT 0,
  tags text[],
  reasoning jsonb,
  status text NOT NULL DEFAULT 'active',
  outcome text,
  recommended_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_recommendations_status ON public.recommendations(status, recommended_at DESC);
CREATE UNIQUE INDEX idx_recommendations_active_symbol
  ON public.recommendations(symbol) WHERE status = 'active';

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendations public read"
  ON public.recommendations FOR SELECT
  USING (true);
