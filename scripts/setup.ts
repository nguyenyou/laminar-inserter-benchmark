import { mkdir } from 'node:fs/promises';
import revisions from '../revisions.json';
process.chdir(new URL('..', import.meta.url).pathname);
async function run(args: string[]) {
  const result = Bun.spawn(args, { stdout: 'inherit', stderr: 'inherit' });
  if (await result.exited !== 0) throw new Error(`Failed: ${args.join(' ')}`);
}
await mkdir('.deps', { recursive: true });
for (const [name, pin] of Object.entries(revisions)) {
  const path = `.deps/${name}`;
  if (!await Bun.file(`${path}/.git/HEAD`).exists()) {
    await run(['git', 'clone', '--depth=1', '--no-checkout', pin.repo, path]);
  }
  await run(['git', '-C', path, 'fetch', '--depth=1', 'origin', pin.commit]);
  await run(['git', '-C', path, 'checkout', '--detach', pin.commit]);
}
