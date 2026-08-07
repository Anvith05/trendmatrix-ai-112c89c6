CREATE OR REPLACE FUNCTION public.log_recommendation_to_journal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.journal_entries (
    recommendation_id, symbol, name, sector, kind,
    entry_price, target_price, swing_score, tags, suggested_at
  )
  VALUES (
    NEW.id, NEW.symbol, NEW.name, NEW.sector,
    COALESCE((SELECT kind FROM public.stock_universe WHERE symbol = NEW.symbol LIMIT 1), 'stock'),
    COALESCE(NEW.entry_price, NEW.ltp, 0),
    CASE WHEN NEW.entry_price IS NOT NULL THEN NEW.entry_price * 1.10 ELSE NULL END,
    NEW.swing_score, NEW.tags, NEW.recommended_at
  )
  ON CONFLICT (recommendation_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

UPDATE public.journal_entries
SET target_price = entry_price * 1.10
WHERE status = 'in_progress' AND entry_price > 0;