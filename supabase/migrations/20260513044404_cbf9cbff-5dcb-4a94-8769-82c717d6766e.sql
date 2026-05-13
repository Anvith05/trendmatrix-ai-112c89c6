
-- Removal feedback for picks
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_image_path text;

CREATE POLICY "recommendations public update"
ON public.recommendations FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Agent feedback / chat with consolidation agent
CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','rule')),
  message text NOT NULL,
  context jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_feedback public read"   ON public.agent_feedback FOR SELECT USING (true);
CREATE POLICY "agent_feedback public insert" ON public.agent_feedback FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS agent_feedback_agent_created_idx
  ON public.agent_feedback (agent, created_at DESC);
