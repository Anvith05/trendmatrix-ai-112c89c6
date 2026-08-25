select cron.unschedule('trendmatrix-risk-scan') where exists (select 1 from cron.job where jobname = 'trendmatrix-risk-scan');
select cron.schedule(
  'trendmatrix-risk-scan',
  '*/30 * * * *',
  $$ select net.http_post(
       url := 'https://project--f97a64e9-f022-4343-9cb3-f440af86fda4.lovable.app/api/public/run-risk-scan',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);