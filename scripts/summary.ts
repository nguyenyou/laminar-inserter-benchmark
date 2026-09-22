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
console.log("Lower is better for every metric. 🟢 marks the better result, 🔴 the worse result, and ⚪ means the comparison is unavailable. Percentages show master versus M5.\n");
console.log("| Scenario | Mount | Update all | Reverse | Unmount | Heap mounted | Heap after unmount |");
console.log("|---|---:|---:|---:|---:|---:|---:|");

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
const cell = (scenario: string, metric: string, divisor: number): string => {
  const master = measure("master", scenario, metric);
  const baseline = measure("m5", scenario, metric);
  if (master === undefined) return "⚪ master only";
  if (baseline === undefined) return `⚪ ${(master / divisor).toFixed(1)}`;
  const change = ((master / baseline) - 1) * 100;
  const icon = Math.abs(master - baseline) < 0.0001 ? "⚪" : master < baseline ? "🟢" : "🔴";
  return `${icon} ${ (master / divisor).toFixed(1)} ms (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`;
};
for (const scenario of scenarios) {
  console.log(`| ${scenario} | ${cell(scenario, "mount", 1)} | ${cell(scenario, "update-all", 1)} | ${cell(scenario, "reverse", 1)} | ${cell(scenario, "unmount", 1)} | ${cell(scenario, "heap-mounted", 1024).replace(" ms", " KiB")} | ${cell(scenario, "heap-disposed", 1024).replace(" ms", " KiB")} |`);
}
