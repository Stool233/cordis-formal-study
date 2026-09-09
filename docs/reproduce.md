# Reproduce the contributions

English | [中文](reproduce.zh-CN.md)

Use Node.js 24 and Java 21. TLC and Community Modules are bundled; no model API key or tool download is needed. Install npm dependencies once at the repository root.

## Replay the selected TLC evidence

```sh
npm ci
npm test
npm run verify
npm run check:contributions -- --output .artifacts/contributions/local
```

The result must be **6 before traces rejected, 6 fixed traces accepted, and 2 negative controls rejected**. Each real capture runs through the original trace checker and the focused unload guard. Inspect `report.json`, `tlc.log`, and `counterexample.json` under the chosen output directory. Any unexpected result fails the command and leaves no successful aggregate.

This command rechecks committed implementation observations; it does not regenerate them. The [contribution lock](../contributions.lock.json) records source commits, trace digests, model digests, and tool versions.

## Regenerate fixed traces from source

Use clean checkouts at Cordis `18c327f4566e8f640737c43a480e6d74a0673579` and Harness `fdcd1ce36a296ab2288bf407fccba4c8fa634963`. Both repositories must include the historical Git objects used by the observation kit. Use separate worktrees if your normal checkouts contain work. Enable Corepack, then run:

```sh
git submodule update --init --recursive
npm run test:tools
npm run reproduce:alignment -- --cordis /path/to/fixed-cordis --deepseek-harness /path/to/fixed-harness
```

This installs locked dependencies, applies pinned observer patches in isolated worktrees, regenerates traces, and executes the kit's checks. The final contribution check requires the six selected fixed traces to match the committed evidence and reruns TLC. Results appear under `.artifacts/alignment/run-*/evidence/`, with a nested `contributions/report.json`. The [alignment workflow](../.github/workflows/upstream-alignment.yml) automates these checkout and toolchain steps.

[study.lock.json](../study.lock.json) fixes the observation kit and its prerequisites; [alignment.lock.json](../alignment.lock.json) fixes the current candidate sources and adapter patches. Their historical model names are internal reproduction inputs, not a catalog of current paper proofs. The complete original pre-fix capture procedure remains recoverable in the [archive](../archive/README.md).

## Run supporting behavior checks

```sh
npm run check:current -- --output .artifacts/current/local
npm run verify -- --report .artifacts/current/local/report.json
```

The command fetches the pinned Git objects and exports source into a temporary directory. Optional `--cordis ../cordis --deepseek-harness ../deepseek-harness` arguments reuse local objects without executing or changing those working trees. All six supporting regressions must pass.

## Update versions deliberately

Review a new paper or implementation version before changing the locks. Regenerate both sides of the relevant defect evidence, inspect the actual failing recovery step, rerun the fixed-source checks and negative controls, then refresh the captures and reports. Do not convert an unrelated mismatch into a confirmed contribution or silently accept changed tool bytes.
