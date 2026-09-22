import { mkdir } from 'node:fs/promises';
import revisions from '../revisions.json';
process.chdir(new URL('..', import.meta.url).pathname);
for (const [name, pin] of Object.entries(revisions)) {
  const result = Bun.spawnSync(['git', '-C', `.deps/${name}`, 'rev-parse', 'HEAD']);
  if (result.exitCode || result.stdout.toString().trim() !== pin.commit) throw new Error(`Run bun run setup: ${name} revision mismatch`);
  const dirty = Bun.spawnSync(['git', '-C', `.deps/${name}`, 'status', '--porcelain', '--untracked-files=no']);
  if (dirty.exitCode || dirty.stdout.length) throw new Error(`Dirty dependency: ${name}`);
}
await mkdir('out', { recursive: true });
for (const variant of ['m5', 'master']) {
  const child = Bun.spawn(['scala-cli', '--power', 'package', variant, '--server=false', '--js', '--js-module-kind', 'none', '--js-mode', 'release', '--main-class', 'perf.Bench', '-o', `out/${variant}.js`, '-f'], { stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`Build failed: ${variant}`);
}
await Bun.write('out/revisions.json', JSON.stringify(revisions));
