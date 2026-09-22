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

console.log("## Benchmark results\n");
console.log(`Raw JSON: \`${path}\`\n`);
console.log("| Variant | Scenario | Mount (ms) | Update all (ms) | Reverse (ms) | Unmount (ms) | Heap mounted (KiB) | Heap after unmount (KiB) |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|");
for (const [key, values] of grouped) {
  const [variant, scenario] = key.split("|");
  const value = (name: string) => median(values.map(row => row.timing[name]));
  console.log(`| ${variant} | ${scenario} | ${value("mount").toFixed(2)} | ${value("update-all").toFixed(2)} | ${value("reverse").toFixed(2)} | ${value("unmount").toFixed(2)} | ${(median(values.map(row => row.heapMountedDelta)) / 1024).toFixed(1)} | ${(median(values.map(row => row.heapDisposedDelta)) / 1024).toFixed(1)} |`);
}
