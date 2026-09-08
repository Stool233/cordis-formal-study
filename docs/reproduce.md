# Reproduction

English | [中文](reproduce.zh-CN.md)

This guide covers the current migration and the original three-stage study. Read [Research process and results](results.md) first if you only need to understand the conclusions.

## Choose the experiment

| Goal | Entry point | Version authority |
| --- | --- | --- |
| Verify the fixes migrated to current upstream | `npm run reproduce:alignment` | [alignment.lock.json](../alignment.lock.json) |
| Rerun the original three-stage study | `npm run reproduce:study` | [study.lock.json](../study.lock.json) |

Both paths need Node.js 24, Java 21, Git, and Corepack. They test different source snapshots and tool hashes; their reports are kept separately.

## Set up the portal

For a fresh checkout:

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm ci
```

If you already have the portal, run `npm ci` in its root. Run the remaining commands there.

## Current migration

Clone the two forks beside the portal if they are not already present:

```sh
git clone --branch codex/upstream-alignment-2026-09-09 https://github.com/Stool233/cordis.git ../cordis
git clone --branch codex/upstream-alignment-2026-09-09 https://github.com/Stool233/deepseek-harness.git ../deepseek-harness
```

Use the exact candidate commits. Save any local edits before changing revisions:

```sh
git -C ../cordis checkout --detach 18c327f4566e8f640737c43a480e6d74a0673579
git -C ../deepseek-harness checkout --detach fdcd1ce36a296ab2288bf407fccba4c8fa634963
npm run reproduce:alignment -- --cordis ../cordis --deepseek-harness ../deepseek-harness
```

The command rejects dirty or wrong-revision inputs. It installs locked dependencies, creates separate worktrees, applies hash-checked observation patches, and extracts the historical specification into a private run directory. Only that specification copy receives the newer TLC hash; the historical lock and source snapshots remain unchanged.

Success requires all four original behavior assertions in each trace-free implementation, the PR models, 29 Cordis observation points, 13 Cordis traces, 17 Harness traces, and rejection of four mutations for each implementation. Original behavior assertions remain intact; their expected failure set becomes empty for the fixed candidates.

The final line prints `.artifacts/alignment/run-<id>/evidence/report.json`. It records the paper, tool, source revisions, source trees, and patch hashes. An interrupted or failed run has no passing aggregate report. Worktrees and dependencies sit outside the evidence directory.

Repository tests, builds, lint, and documentation checks are separate from this formal command. Their commands are in the [Cordis fork guide](https://github.com/Stool233/cordis/blob/main/docs/formal-study.md) and [Harness fork guide](https://github.com/Stool233/deepseek-harness/blob/master/docs/cordis-study.md); measured results belong to [Upstream alignment](upstream-alignment.md).

## Historical experiment: tool availability

The original TLC 1.8.0 asset was replaced upstream. A fresh historical formal run currently stops at its pinned hash check. A local JAR is usable only if it matches the original hash; changing that hash would create a different experiment. See [the tool comparison](upstream-alignment.md#changed-tlc-release-asset).

The instructions below preserve the original experiment. `reproduce:upstream-fix` runs ordinary checks and does not require TLC.

## Historical bootstrap

Initial bootstrap fetches six pinned implementation revisions and dependencies, so it needs network access. The minimal AgentLoop scenario itself makes no external model or network call.

```sh
npm run bootstrap:study
```

`bootstrap:study`:

1. initializes the three browsable conformance/paper submodules and verifies gitlinks, HEADs, dirty state, and the paper hash;
2. reads the six complete `baseline`, `conformance`, and `upstream-fix` SHAs from `study.lock.json`;
3. creates detached checkouts under `.artifacts/checkouts/<repository>/<revision>/`;
4. temporarily injects the pinned `locks/cordis.yarn.lock` for immutable Cordis installs and uses frozen pnpm installs for DeepSeek Harness;
5. confirms every checkout remains clean and at the exact HEAD after installation.

An existing checkout that is dirty, at the wrong HEAD, or not a Git checkout is rejected. The tool never resets, checks out over, or overwrites user work.

## Reproduce stage one: original implementation divergence

```sh
npm run reproduce:baseline
```

The runner generates traces for Cordis and vendored Cordis, runs `CordisTrace.tla`, and executes baseline behavior probes. It exits zero only when all of these hold:

- Cordis has exactly the locked 9 trace mismatches and 4 behavior failures;
- vendored Cordis has exactly 10 trace mismatches and 3 behavior failures;
- all other positive scenarios pass and the three negative premises report exactly `not-applicable`;
- every trace is non-empty and every mismatch has failure metadata and a TLC counterexample;
- revisions, scenario sets, and report-relative paths match.

An expected mismatch unexpectedly passing, a new or missing mismatch, an empty trace, or revision drift fails the command. Exit zero here means “the expected divergence was reproduced,” not “the original implementation conforms to the paper.”

## Reproduce stage two: complete evidence after correction

```sh
npm run reproduce:conformance
```

This runs:

- Cordis PR-profile TLA+ syntax, bounded models, 29-point observation coverage, 13 core traces, and 4 mutations;
- Cordis fiber, HMR, and loader regressions, plus build and lint;
- 17 complete vendored traces, 4 mutations, three vendored hardening paths, and offline AgentLoop assembly;
- DeepSeek Harness lifecycle and session-persistence regressions, plus build, lint, and doc-sync;
- required-property `pass`, exact negative-premise `not-applicable`, complete `TraceMatched`, and portable-report validation.

The stage fails if a required positive property is `not-applicable` or `unobserved`, any mutant survives, or any ordinary gate fails.

## Reproduce stage three: trace-free upstream patch

```sh
npm run reproduce:upstream-fix
```

The command first confirms that both fix checkouts contain no trace sink, Cordis `formal/` kit, paper-conformance runner, or related package script. It then runs the ordinary tests, build, lint, and DSH documentation gates relevant to the correction.

The report's `formalStatus` is fixed to `not-run`. It also records the stage-two revisions and evidence paths carrying the same logic fixes, avoiding the false claim that source without instrumentation directly passed TLC trace validation.

## Reproduce the whole study

```sh
npm run reproduce:study
npm run verify -- --full
```

`reproduce:study` runs baseline → conformance → upstream-fix. Its output is:

```text
.artifacts/
├── checkouts/
│   ├── cordis/<revision>/
│   └── deepseekHarness/<revision>/
├── stages/
│   ├── 01-baseline/
│   │   ├── cordis/
│   │   └── deepseek-harness/
│   ├── 02-conformance/
│   │   ├── cordis/
│   │   └── deepseek-harness/
│   └── 03-upstream-fix/
│       └── ordinary-gates-report.json
├── study-report.json
└── study-report.md
```

`study-report.json` uses `cordis.formal-study-report/v1` for automation. `study-report.md` provides a bilingual reader summary. Neither contains machine-local absolute paths.

<details>
<summary>Reference: low-level profiles, CI, and release packaging</summary>

## Low-level stage-two profiles

Existing commands remain available:

| Command | Purpose |
| --- | --- |
| `npm run bootstrap:core` | Initialize the browsable Cordis and paper submodules and install Cordis. |
| `npm run bootstrap:full` | Also initialize the browsable DeepSeek Harness submodule. |
| `npm run reproduce:core` | Run the Cordis PR formal profile on the conformance submodule. |
| `npm run reproduce:full` | Also run vendored conformance and AgentLoop. |
| `npm run reproduce:nightly` | Run layered exhaustive BFS and fixed-seed expanded simulations on the stage-two Cordis checkout. |

These are lower-level stage-two profiles and do not replace the three-stage `reproduce:study` command.

## CI trigger map

| Workflow | Trigger | Work performed |
| --- | --- | --- |
| Integrity | Every push and PR | `npm ci`, unit tests, lock/gitlink/schema/document integrity; no TLC. |
| Upstream alignment | Relevant PR, relevant `main` push, manual | Check out candidates from `alignment.lock.json`, run `reproduce:alignment`, and publish its evidence. |
| Conformance | Relevant PR, relevant `main` push, manual | PR/push runs `bootstrap:study` + `reproduce:study`; manual dispatch selects any stage or the default `study`. |
| Nightly | Monday 03:17 UTC, manual | Full three-stage study, then `reproduce:nightly`. |
| Release | `v*` tag | Full study, nightly, integrity, evidence packaging, and GitHub Release. |

Pushing only a Cordis or DeepSeek Harness research branch does not trigger the portal's cross-repository checks. Upstream alignment verifies the current migration; Conformance and Nightly reproduce the historical study and currently stop at the original TLC hash check.

## Release evidence

After the full study and nightly pass:

```sh
npm run package -- --version 0.1.0
```

This writes `dist/cordis-formal-study-v0.1.0-evidence.tar.gz` and `dist/SHA256SUMS`. The archive includes baseline counterexamples, conformance models/traces/mutations, upstream-fix ordinary gates, nightly evidence, and aggregate reports. It excludes checkouts, dependencies, JARs, TLC temporary directories, PDFs, and machine paths.

</details>

## Common failures

- **Dirty checkout or wrong HEAD:** preserve your work or use a fresh clone; bootstrap will not reset it.
- **Changed baseline mismatch set:** first confirm the locked revision. If it is correct, the change is new evidence to investigate, not a count to update blindly.
- **Tool download failure:** first execution needs GitHub access; downloaded content must still match the locked SHA-256.
- **`not-applicable` in a positive scenario:** positive required properties must pass; only the three dedicated negative-premise scenarios may report exact `not-applicable`.
- **Instrumentation found in upstream-fix:** remove the research trace/formal file or script rather than disabling the check.
