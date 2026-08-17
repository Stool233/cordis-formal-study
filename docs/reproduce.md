# Reproduction

English | [中文](reproduce.zh-CN.md)

This guide is the public interface to the three research stages. Read [Research process and results](results.md) first if you only need to understand the conclusions.

## Environment and bootstrap

Requirements are Node.js 24, Java 21, Git, and Corepack. Initial bootstrap fetches six pinned implementation revisions and dependencies, so it needs network access. The minimal AgentLoop scenario itself makes no external model or network call.

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm ci
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
| Conformance | Relevant PR, relevant `main` push, manual | PR/push runs `bootstrap:study` + `reproduce:study`; manual dispatch selects any stage or the default `study`. |
| Nightly | Monday 03:17 UTC, manual | Full three-stage study, then `reproduce:nightly`. |
| Release | `v*` tag | Full study, nightly, integrity, evidence packaging, and GitHub Release. |

Pushing only a Cordis or DeepSeek Harness research branch does not trigger the portal's complete cross-repository study. Portal Conformance and Nightly are the primary entry points.

## Release evidence

After the full study and nightly pass:

```sh
npm run package -- --version 0.1.0
```

This writes `dist/cordis-formal-study-v0.1.0-evidence.tar.gz` and `dist/SHA256SUMS`. The archive includes baseline counterexamples, conformance models/traces/mutations, upstream-fix ordinary gates, nightly evidence, and aggregate reports. It excludes checkouts, dependencies, JARs, TLC temporary directories, PDFs, and machine paths.

## Common failures

- **Dirty checkout or wrong HEAD:** preserve your work or use a fresh clone; bootstrap will not reset it.
- **Changed baseline mismatch set:** first confirm the locked revision. If it is correct, the change is new evidence to investigate, not a count to update blindly.
- **Tool download failure:** first execution needs GitHub access; downloaded content must still match the locked SHA-256.
- **`not-applicable` in a positive scenario:** positive required properties must pass; only the three dedicated negative-premise scenarios may report exact `not-applicable`.
- **Instrumentation found in upstream-fix:** remove the research trace/formal file or script rather than disabling the check.
