import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { platform, arch, cpus } from 'node:os';
import revisions from '../revisions.json';
process.chdir(new URL('..', import.meta.url).pathname);
const n = Number(process.argv[2] ?? 2000);
const rounds = Number(process.argv[3] ?? 15);
if (!Number.isInteger(n) || n < 4 || !Number.isInteger(rounds) || rounds < 1) throw new Error('Usage: bun run bench [items >= 4] [rounds >= 1]');
if (JSON.stringify(await Bun.file('out/revisions.json').json()) !== JSON.stringify(revisions)) throw new Error('Build is missing or revisions changed; run bun run build');
const common = ['elem-static-text', 'elem-text-inserter', 'elem-child-inserter', 'elem-builder-leaf'];
const extra = ['item-child-val', 'item-child-map', 'item-children-val', 'item-static-seq', 'item-builder-leaf'];
const stamp = new Date().toISOString().replaceAll(':', '-');
const directory = `results/${stamp}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const metadata = { timestamp: stamp, revisions, n, rounds, warmups: 3, bun: Bun.version, chromium: browser.version(), platform: platform(), arch: arch(), cpu: cpus()[0]?.model, scala: '3.9.0', scalaJS: '1.22.0', optimization: 'release', sharedAirstream: true };
await Bun.write(`${directory}/metadata.json`, JSON.stringify(metadata, null, 2));
const records: object[] = [];
try {
  for (const scenario of [...common, ...extra]) {
    for (const variant of common.includes(scenario) ? ['m5', 'master'] : ['master']) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const cdp = await page.context().newCDPSession(page);
      await page.addScriptTag({ path: `out/${variant}.js` });
      async function heap() {
        await cdp.send('HeapProfiler.collectGarbage');
        return (await cdp.send('Runtime.getHeapUsage')).usedSize;
      }
      for (let round = -3; round < rounds; round++) {
        const baseline = await heap();
        const mount = await page.evaluate(({scenario, n}) => (window as any).bench.mount(scenario, n), {scenario, n});
        const mounted = await heap();
        const dom = await cdp.send('Memory.getDOMCounters');
        const timing: Record<string, number> = { mount };
        for (const op of ['reemit', 'update-all', 'update-one', 'select-one', 'append', 'prepend', 'remove-mid', 'reverse']) {
          timing[op] = await page.evaluate(({op, n}) => (window as any).bench.update(op, n), {op, n});
        }
        timing.unmount = await page.evaluate(() => (window as any).bench.unmount());
        await page.evaluate(() => (window as any).bench.dispose());
        const disposed = await heap();
        if (errors.length) throw new Error(`${variant}/${scenario}: ${errors.join('\n')}`);
        if (round >= 0) records.push({ variant, scenario, round, n, timing, heapBaseline: baseline, heapMounted: mounted, heapDisposed: disposed, heapMountedDelta: mounted - baseline, heapDisposedDelta: disposed - baseline, dom });
      }
      console.log(`${variant}: ${scenario} completed`);
      await Bun.write(`${directory}/raw.json`, JSON.stringify(records, null, 2));
      await page.close();
    }
  }
} finally { await browser.close(); }
console.log(`Raw measurements and environment: ${directory}`);
