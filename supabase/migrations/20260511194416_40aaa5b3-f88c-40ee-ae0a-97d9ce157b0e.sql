
-- Stock universe
CREATE TABLE public.stock_universe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  yahoo_symbol text NOT NULL,
  name text NOT NULL,
  sector text NOT NULL,
  exchange text NOT NULL DEFAULT 'NSE',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_universe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "universe public read" ON public.stock_universe FOR SELECT USING (true);

-- Agent runs log
CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  scanned int NOT NULL DEFAULT 0,
  ranked int NOT NULL DEFAULT 0,
  error text
);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs public read" ON public.agent_runs FOR SELECT USING (true);

-- Rankings (latest per symbol per run)
CREATE TABLE public.rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  sector text,
  ltp numeric,
  change_pct numeric,
  monthly_score int NOT NULL DEFAULT 0,
  weekly_score int NOT NULL DEFAULT 0,
  sector_score int NOT NULL DEFAULT 0,
  history_score int NOT NULL DEFAULT 0,
  fundamental_score int NOT NULL DEFAULT 0,
  macro_score int NOT NULL DEFAULT 0,
  rs_score int NOT NULL DEFAULT 0,
  volume_score int NOT NULL DEFAULT 0,
  swing_score int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'watch',
  reasoning jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rankings_run_idx ON public.rankings(run_id, swing_score DESC);
CREATE INDEX rankings_symbol_idx ON public.rankings(symbol, created_at DESC);
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rankings public read" ON public.rankings FOR SELECT USING (true);

-- Price cache
CREATE TABLE public.price_cache (
  symbol text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_cache public read" ON public.price_cache FOR SELECT USING (true);

-- Training examples enrichment
ALTER TABLE public.training_examples
  ADD COLUMN IF NOT EXISTS features jsonb,
  ADD COLUMN IF NOT EXISTS tags text[];

-- Seed universe
INSERT INTO public.stock_universe (symbol, yahoo_symbol, name, sector) VALUES
  ('HAL','HAL.NS','Hindustan Aeronautics','Defence'),
  ('BEL','BEL.NS','Bharat Electronics','Defence'),
  ('BDL','BDL.NS','Bharat Dynamics','Defence'),
  ('MAZDOCK','MAZDOCK.NS','Mazagon Dock','Defence'),
  ('COCHINSHIP','COCHINSHIP.NS','Cochin Shipyard','Defence'),
  ('GRSE','GRSE.NS','Garden Reach Shipbuilders','Defence'),
  ('DATAPATTNS','DATAPATTNS.NS','Data Patterns','Defence'),
  ('PARAS','PARAS.NS','Paras Defence','Defence'),
  ('SUNPHARMA','SUNPHARMA.NS','Sun Pharma','Pharma'),
  ('DRREDDY','DRREDDY.NS','Dr Reddys','Pharma'),
  ('CIPLA','CIPLA.NS','Cipla','Pharma'),
  ('DIVISLAB','DIVISLAB.NS','Divis Labs','Pharma'),
  ('LUPIN','LUPIN.NS','Lupin','Pharma'),
  ('AUROPHARMA','AUROPHARMA.NS','Aurobindo Pharma','Pharma'),
  ('IRFC','IRFC.NS','Indian Railway Finance','PSU'),
  ('RVNL','RVNL.NS','Rail Vikas Nigam','PSU'),
  ('PFC','PFC.NS','Power Finance Corp','PSU'),
  ('RECLTD','RECLTD.NS','REC Ltd','PSU'),
  ('NTPC','NTPC.NS','NTPC','PSU'),
  ('COALINDIA','COALINDIA.NS','Coal India','PSU'),
  ('TITAGARH','TITAGARH.NS','Titagarh Rail','Railways'),
  ('JUPITERWAG','JWL.NS','Jupiter Wagons','Railways'),
  ('IRCTC','IRCTC.NS','IRCTC','Railways'),
  ('RAILTEL','RAILTEL.NS','Railtel','Railways'),
  ('IRCON','IRCON.NS','Ircon Intl','Railways'),
  ('LT','LT.NS','Larsen & Toubro','Capital Goods'),
  ('SIEMENS','SIEMENS.NS','Siemens','Capital Goods'),
  ('ABB','ABB.NS','ABB India','Capital Goods'),
  ('BHEL','BHEL.NS','BHEL','Capital Goods'),
  ('CUMMINSIND','CUMMINSIND.NS','Cummins India','Capital Goods'),
  ('GMRINFRA','GMRINFRA.NS','GMR Infra','Infrastructure'),
  ('IRB','IRB.NS','IRB Infra','Infrastructure'),
  ('NCC','NCC.NS','NCC Ltd','Infrastructure'),
  ('KEC','KEC.NS','KEC Intl','Infrastructure'),
  ('RELIANCE','RELIANCE.NS','Reliance Industries','Energy'),
  ('ONGC','ONGC.NS','ONGC','Energy'),
  ('IOC','IOC.NS','Indian Oil','Energy'),
  ('HDFCBANK','HDFCBANK.NS','HDFC Bank','Banking'),
  ('ICICIBANK','ICICIBANK.NS','ICICI Bank','Banking'),
  ('SBIN','SBIN.NS','State Bank of India','Banking'),
  ('AXISBANK','AXISBANK.NS','Axis Bank','Banking'),
  ('TATASTEEL','TATASTEEL.NS','Tata Steel','Manufacturing'),
  ('JSWSTEEL','JSWSTEEL.NS','JSW Steel','Manufacturing'),
  ('HINDALCO','HINDALCO.NS','Hindalco','Manufacturing'),
  ('TCS','TCS.NS','TCS','IT'),
  ('INFY','INFY.NS','Infosys','IT'),
  ('WIPRO','WIPRO.NS','Wipro','IT'),
  ('HINDUNILVR','HINDUNILVR.NS','Hindustan Unilever','FMCG'),
  ('ITC','ITC.NS','ITC','FMCG'),
  ('NESTLEIND','NESTLEIND.NS','Nestle India','FMCG'),
  ('M&M','M%26M.NS','Mahindra & Mahindra','Auto'),
  ('TATAMOTORS','TATAMOTORS.NS','Tata Motors','Auto'),
  ('MARUTI','MARUTI.NS','Maruti Suzuki','Auto'),
  ('BAJAJ-AUTO','BAJAJ-AUTO.NS','Bajaj Auto','Auto')
ON CONFLICT (symbol) DO NOTHING;
