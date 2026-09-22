import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("Usage: bun scripts/summary.ts results/<timestamp>/raw.json");
const rows = await readFile(path, "utf8").then(JSON.parse) as Array<{
  variant: string;
  scenario: string;
  timing: Record<string, number>;
  heapMountedDelta: number;
  heapDisposedDelta: number;
}>;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const grouped = new Map<string, typeof rows>();
for (const row of rows) {
  const key = `${row.variant}|${row.scenario}`;
  grouped.set(key, [...(grouped.get(key) ?? []), row]);
}

console.log("## Benchmark comparison\n");
console.log(`Raw JSON: \`${path}\`\n`);
console.log("Master and M5 are shown side by side. Lower is better for every metric. Percentages show Master versus M5.\n");
console.log("| Scenario | Metric | Master | M5 | Verdict |");
console.log("|---|---|---:|---:|---|");

const scenarios = [...new Set(rows.map(row => row.scenario))];
const measure = (variant: string, scenario: string, metric: string): number | undefined => {
  const values = grouped.get(`${variant}|${scenario}`);
  if (!values) return undefined;
  if (metric.startsWith("heap")) {
    const field = metric === "heap-mounted" ? "heapMountedDelta" : "heapDisposedDelta";
    return median(values.map(row => row[field]));
  }
  return median(values.map(row => row.timing[metric]));
};
const comparison = (scenario: string, metric: string, divisor: number): { master: string; m5: string; verdict: string } => {
  const master = measure("master", scenario, metric);
  const baseline = measure("m5", scenario, metric);
  const unit = metric.startsWith("heap") ? "KiB" : "ms";
  if (master === undefined && baseline === undefined) return { master: "—", m5: "—", verdict: "⚪ unavailable" };
  if (master === undefined) return { master: "—", m5: `${(baseline! / divisor).toFixed(1)} ${unit}`, verdict: "⚪ M5 only" };
  if (baseline === undefined) return { master: `${(master / divisor).toFixed(1)} ${unit}`, m5: "—", verdict: "⚪ Master only" };
  const change = ((master / baseline) - 1) * 100;
  const verdict = Math.abs(master - baseline) < 0.0001
    ? "⚪ Same"
    : master < baseline
      ? `🟢 Master better (${change.toFixed(1)}%)`
      : `🔴 Master worse (+${change.toFixed(1)}%)`;
  return {
    master: `${(master / divisor).toFixed(1)} ${unit}`,
    m5: `${(baseline / divisor).toFixed(1)} ${unit}`,
    verdict
  };
};
for (const scenario of scenarios) {
  for (const [label, metric, divisor] of [
    ["Mount", "mount", 1],
    ["Update all", "update-all", 1],
    ["Reverse", "reverse", 1],
    ["Unmount", "unmount", 1],
    ["Heap mounted", "heap-mounted", 1024],
    ["Heap after unmount", "heap-disposed", 1024]
  ] as const) {
    const result = comparison(scenario, metric, divisor);
    console.log(`| ${scenario} | ${label} | ${result.master} | ${result.m5} | ${result.verdict} |`);
  }
}
