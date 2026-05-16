
CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  from_date date NOT NULL,
  to_date date NOT NULL,
  total_trades int NOT NULL DEFAULT 0,
  winners int NOT NULL DEFAULT 0,
  losers int NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  avg_return numeric NOT NULL DEFAULT 0,
  notes text
);
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest_runs public read" ON public.backtest_runs FOR SELECT USING (true);
CREATE POLICY "backtest_runs public insert" ON public.backtest_runs FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.backtest_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  sector text,
  entry_date date NOT NULL,
  entry_price numeric NOT NULL,
  exit_date date,
  exit_price numeric,
  peak_price numeric,
  return_pct numeric,
  bars_held int,
  outcome text NOT NULL DEFAULT 'winner',
  pattern text,
  base_range_pct numeric,
  marked_wrong boolean NOT NULL DEFAULT false,
  wrong_reason text,
  wrong_marked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bt_trades_run_idx ON public.backtest_trades(run_id);
CREATE INDEX IF NOT EXISTS bt_trades_symbol_idx ON public.backtest_trades(symbol);
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest_trades public read" ON public.backtest_trades FOR SELECT USING (true);
CREATE POLICY "backtest_trades public insert" ON public.backtest_trades FOR INSERT WITH CHECK (true);
CREATE POLICY "backtest_trades public update" ON public.backtest_trades FOR UPDATE USING (true) WITH CHECK (true);
