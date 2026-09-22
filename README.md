# Laminar inserter benchmark

Reproducible memory and performance measurements for Laminar dynamic inserters.

The benchmark compares a pinned Laminar `master` revision with the published `18.0.0-M5` baseline. It runs the same widget scenarios in headless Chromium, records operation timings, V8 heap usage after forced collection, DOM counters, machine details, and exact source revisions.

## Requirements

- macOS or Linux
- Git
- [Bun](https://bun.sh/)
- Scala CLI 1.16 or newer
- Chromium supported by Playwright

## Run

```sh
bun run setup
bun run build
bun run bench 2000 15
```

`setup` downloads the exact revisions in `revisions.json`. `build` produces release-mode Scala.js bundles. `bench` runs three warmup rounds followed by the requested measured rounds and writes JSON to `results/<timestamp>/`.

Use a small smoke run first:

```sh
bun run bench 50 2
```

GitHub Actions runs the same benchmark through the manually dispatched **Inserter benchmark** workflow. Its run summary contains median timing and heap tables, and the raw JSON is downloadable from the run's artifact.

The benchmark intentionally reports raw measurements instead of declaring a winner. Compare medians across repeated runs on the same machine; browser timing is sensitive to CPU load and power state. The baseline uses the published `18.0.0-M5` artifacts, while the current variant compiles the pinned source revision.

Scenarios beginning with `elem-` use dynamic inserters inside list items. `item-` scenarios exercise dynamic inserters as list items, including nested `child <--` and `children <--` groups.
