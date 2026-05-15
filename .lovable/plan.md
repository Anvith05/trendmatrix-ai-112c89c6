## Goals
1. Fix **Top Sector Picks** so it ranks by the *Sector AI agent's* sector score (e.g., Defence, Railways), not by averaging recommendations.
2. Add **Sector ETFs** (NIFTYPHARMA-BeES, NIFTYIT-BeES, CPSE ETF for Defence/PSU, etc.) into the universe so agents can suggest ETFs when a sector breaks out — appears in Picks + Journal alongside stocks.
3. New **/journal** page that auto-logs every recommendation with:
   - Suggested date, entry price
   - Status auto-updated by a server fn (`updateJournalOutcomes`) that polls quotes:
     - **Winner**: price ≥ entry × 1.30
     - **Loser**: after 365d, price < entry and target never hit
     - **In progress**: otherwise
   - Two sections (Overall picks log / Sector ETF + sector picks log)
   - Win rate, loser rate, in-progress count, best/worst trade
4. Restore visible **Backtest** panel on `/agents` (weekly consolidation backtest already exists in code but isn't rendering — wire it back into the agent card).
5. Run all 8 agents over **sector indices** too (not only stocks). Sector-sync agent picks top sectors → master agent surfaces matching ETF as a "sector play" pick.

## Technical changes

**DB migration**
- `journal_entries` table: `id, symbol, name, sector, kind ('stock'|'etf'), entry_price, target_price, suggested_at, status ('in_progress'|'winner'|'loser'), closed_at, peak_price, current_price, last_checked_at`. RLS public read + service-role writes.
- Trigger on `recommendations` insert → upsert into `journal_entries` (status = in_progress).
- Seed `stock_universe` with sector ETFs: NIFTYBEES, BANKBEES, ITBEES, PHARMABEES, CPSEETF, GOLDBEES, NIFTYPSU, INFRABEES, NIFTYAUTO ETFs; mark `kind='etf'` (add `kind` column to `stock_universe`).

**Backend (`src/lib/market.functions.ts`, `agents.server.ts`)**
- `getTopSectors()`: aggregate latest `rankings` by sector → return top 3 by avg `sector_score` (the agent's own score, not derived). Used by both Picks and Journal.
- `runAgents`: include ETFs in scan; for ETFs skip `fundamental` (info-only) but run weekly/monthly/sector/macro normally.
- `updateJournalOutcomes()`: server fn iterating `in_progress` entries, fetching latest quote, applying 30%/365d rules.
- Hook into recommendation creation to insert journal rows.

**UI**
- `src/routes/picks.tsx`: rewrite `sectorBuckets` to use `getTopSectors` (sector_score ranking); add an "ETF play" badge on ETF rows.
- `src/routes/journal.tsx` (new): two sections (Overall / Sector & ETF), KPI strip (win rate %, loser rate %, in-progress, avg gain), table with date/entry/current/%/status, "Refresh outcomes" button calling `updateJournalOutcomes`.
- `src/routes/agents.tsx`: render the existing `WeeklyBacktest` component inside the Weekly agent card (it's defined but not mounted).
- `SiteNav`: add "Journal" link.

## Out of scope for this turn
- Email alerts on winner/loser
- Cron schedule for `updateJournalOutcomes` (manual button now; can add pg_cron later)

Approve and I'll implement in this order: migration → ETF seed → backend fns → Journal route → Picks fix → Backtest re-mount → nav.