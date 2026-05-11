const items = [
  ["NIFTY 50", "24,812.30", "+0.62%"],
  ["BANKNIFTY", "52,148.10", "+0.41%"],
  ["NIFTY DEFENCE", "8,724.55", "+2.11%"],
  ["NIFTY PHARMA", "22,488.20", "+1.18%"],
  ["NIFTY PSU", "6,310.80", "+1.74%"],
  ["NIFTY IT", "41,902.40", "-0.34%"],
  ["INDIA VIX", "12.84", "-3.21%"],
  ["NIFTY ENERGY", "44,128.65", "+0.92%"],
  ["NIFTY AUTO", "26,914.05", "+0.58%"],
  ["NIFTY METAL", "9,442.30", "+1.06%"],
];

export function Ticker() {
  const row = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {items.map(([s, p, c]) => {
        const up = c.startsWith("+");
        return (
          <div key={s} className="flex items-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground">{s}</span>
            <span className="text-foreground">{p}</span>
            <span className={up ? "text-success" : "text-destructive"}>{c}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="overflow-hidden border-y border-border bg-card/40">
      <div className="flex w-max animate-ticker py-2">
        {row}
        {row}
      </div>
    </div>
  );
}
