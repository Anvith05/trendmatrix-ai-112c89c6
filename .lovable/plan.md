# Independent trade-cycle tracking

## Goal
Treat every recommendation as its own permanent trade cycle, even when the same stock is suggested many times.

## Changes
- Use the unique recommendation ID as the trade identity from Top Picks through Journal closure.
- Stop merging or hiding closed Journal rows by symbol, entry price, or close date. Every completed recommendation remains a separate TP Hit or Loser row.
- Allow a symbol to be suggested again only after its current trade has closed; the new suggestion creates a new Journal row without changing any older row.
- During outcome refresh, calculate the +10% target, historical peak, first target-hit date, and holding time separately from each row's own suggestion date and entry price.
- Close and archive only the recommendation linked to that exact Journal row.
- Display a short trade reference in Journal so repeated DIVISLAB/HAL cycles are visibly distinguishable by their own suggestion date, entry, target, close date, and result.

## Data safeguards
- Add database checks/indexes so one recommendation can create exactly one Journal row while many recommendations for the same symbol remain valid.
- Repair only genuine duplicate Journal rows that share the same recommendation ID; never collapse legitimate repeated trades.

## Verification
- Test two sequential DIVISLAB-style cycles: first recommendation hits TP, a later recommendation opens independently, and its later TP creates a second permanent TP Hit row.
- Confirm the first row never changes when the second trade is created, updated, or closed.
- Confirm an in-progress trade still blocks another simultaneous suggestion for the same symbol.
