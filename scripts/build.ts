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
  if (variant === 'master') {
    const path = '.deps/airstream/src/main/scala/com/raquo/airstream/ownership/Owner.scala';
    let source = await Bun.file(path).text();
    source = source.replace(
      '  protected val subscriptions: JsResilientIterator[Subscription] =\n    new JsResilientIterator\n',
      '  protected val subscriptions: JsResilientIterator[Subscription] =\n    new JsResilientIterator\n\n  private var isKillingSubscriptions = false\n'
    );
    source = source.replace(
      '  protected def killSubscriptions(): Unit = {\n    if (FeatureFlags',
      '  protected def killSubscriptions(): Unit = {\n    isKillingSubscriptions = true\n    if (FeatureFlags'
    );
    source = source.replace(
      '    subscriptions.clear()\n  }\n\n  // @TODO[API]',
      '    subscriptions.clear()\n    isKillingSubscriptions = false\n  }\n\n  // @TODO[API]'
    );
    source = source.replace(
      '  private[ownership] def onKilledExternally(subscription: Subscription): Unit = {\n    val removed = subscriptions.remove(subscription)',
      '  private[ownership] def onKilledExternally(subscription: Subscription): Unit = {\n    if (!isKillingSubscriptions) {\n      val removed = subscriptions.remove(subscription)'
    );
    source = source.replace(
      '    if (!removed) {\n      throw new Exception("Can not remove Subscription from Owner: subscription not found.")\n    }\n  }',
      '      if (!removed) {\n        throw new Exception("Can not remove Subscription from Owner: subscription not found.")\n      }\n    }\n  }'
    );
    await Bun.write(path, source);
  }
  const child = Bun.spawn(['scala-cli', '--power', 'package', variant, '--server=false', '--js', '--js-module-kind', 'none', '--js-mode', 'release', '--main-class', 'perf.Bench', '-o', `out/${variant}.js`, '-f'], { stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`Build failed: ${variant}`);
}
await Bun.write('out/revisions.json', JSON.stringify(revisions));
