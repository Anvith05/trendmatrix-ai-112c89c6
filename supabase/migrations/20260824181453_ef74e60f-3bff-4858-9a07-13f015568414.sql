CREATE TABLE public.risk_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  risk_score INT NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  headline TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  headlines JSONB NOT NULL DEFAULT '[]'::jsonb,
  market JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual'
);
GRANT SELECT ON public.risk_reports TO anon;
GRANT SELECT ON public.risk_reports TO authenticated;
GRANT ALL ON public.risk_reports TO service_role;
ALTER TABLE public.risk_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Risk reports are public to read" ON public.risk_reports FOR SELECT USING (true);
CREATE INDEX risk_reports_created_at_idx ON public.risk_reports (created_at DESC);