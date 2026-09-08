# Upstream alignment — 2026-09-09

English | [中文](upstream-alignment.zh-CN.md)

The lifecycle fixes have been migrated to official Cordis `f8ea3cd` and Harness `5dda764`, and the current candidates pass the shared historical specification. The original three-stage snapshots remain unchanged.

## Migration results

| Check | Cordis | DeepSeek Harness |
| --- | ---: | ---: |
| Original behavior assertions on trace-free source | 4 / 4 pass | 4 / 4 pass |
| Accepted implementation traces | 13 / 13 | 17 / 17 |
| Semantic mutations rejected | 4 / 4 | 4 / 4 |
| Ordinary regressions | 248 tests, 24 files | 265 tests, 6 files |
| Build and lint | pass | pass |
| Repository documentation / hygiene checks | Local Markdown checks pass | 34 / 16 checks pass |

All five PR model configurations pass, and the Cordis observation audit covers 29 write points. The candidate commits are [`18c327f`](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579) and [`fdcd1ce`](https://github.com/Stool233/deepseek-harness/tree/fdcd1ce36a296ab2288bf407fccba4c8fa634963), both on `codex/upstream-alignment-2026-09-09`.

[alignment.lock.json](../alignment.lock.json) identifies every source and observation patch. The [generated aggregate](alignment-report.json) records the executed checks; the [full snapshot](upstream-alignment.json) also preserves the upstream comparison. Run the migration through [Reproduction](reproduce.md#current-migration).

This result uses the historical paper-derived model with an explicitly recorded newer TLC artifact. It is not a successful replay of the original tool lock. The separate [arXiv v1 review](arxiv-review.md) is complete for conclusions and premises: it retains the cleanup fixes and narrows publication, recovery, and confluence claims. Full formal validation of the arXiv calculus remains `not-validated`.

The checked-in aggregate is a summary copy; its relative report paths refer to the reproduced `evidence/` directory. The [current CI workflow](../.github/workflows/upstream-alignment.yml) publishes that evidence separately from historical workflows.

## How the fixes fit current code

- **Cordis core:** retain the upstream failed-fiber guard, then port dependent cleanup ordering, retirement visibility, lifecycle publication, and the single activation checkpoint.
- **Cordis loader:** use the owning tree's lifecycle state when classifying self-disposal. Current HMR already snapshots old fibers before draining them, so its old logic patch is unnecessary.
- **Harness:** port the vendored lifecycle fix while preserving reentrant cleanup and lazy config resolution. Session persistence uses its current handle-owned drain and close mechanism; the old coordinator patch is unnecessary.

The new ordinary regressions reject the original code: four Cordis cases and two Harness cases fail before patching. The standalone behavior probes also reproduce the Harness transitive-activation failure outside Vitest. The migrated implementations pass all original behavior assertions.

Harness's JSONL tests initially lacked the current native POSIX-lock addon. After `pnpm run build:native-system`, all 175 JSONL tests pass; together with lifecycle, configuration reload, HMR, and AgentLoop checks, the selected suite totals 265. These checks make no external model API calls.

## Source revisions

| Source | Fetched revision | Changes since the study baseline |
| --- | --- | --- |
| Cordis `main` | [`f8ea3cd50f1a5724e8e715995bcde131c9c12b2c`](https://github.com/cordiverse/cordis/commit/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c) | 21 commits, 63 changed files. |
| DeepSeek Harness `master` | [`5dda764ed3aa172535a7967b06ff95d9cbfe536a`](https://github.com/deepseek-ai/deepseek-harness/commit/5dda764ed3aa172535a7967b06ff95d9cbfe536a) | 3,796 commits; the `vendor/cordis/src` Git tree is identical to the study baseline. |
| Paper `main` | [`0d43a6f18004a7b5bf9662c31aa08c3712d232ec`](https://github.com/cordiverse/paper/commit/0d43a6f18004a7b5bf9662c31aa08c3712d232ec) | 3 commits; the repository PDF was removed and replaced with an arXiv reference. |

The portal started this comparison at `c00023c`. All six historical research branch tips still match the lock. Pristine upstream sources are detached worktrees under `.artifacts/upstream/<repository>/<revision>/`; separate worktrees with `observed` in their names contain experimental instrumentation.

## Unmodified upstream and historical controls

| Check | Observed result |
| --- | --- |
| Portal tests | 13 passed. |
| Current Cordis ordinary gates | 243 tests across `core hmr loader include timer`; core build, full build, and lint passed. |
| Current Harness ordinary gates | 29 lifecycle and current session storage contract tests passed; build, lint, and all 34 doc-sync gates passed. The historical persistence/preparations/write-behind test files no longer exist. |
| Current uninstrumented behavior probes | Exactly 4 Cordis and 3 vendored historical failures reproduced. Only implementation imports were redirected; assertions and expected failure sets were retained. |
| Current Cordis trace diagnostic | 9 mismatches among 13 scenarios; 29 observation points accepted. The new upstream `_error` re-entry guard was retained. |
| Current vendored trace diagnostic | 10 mismatches among 17 scenarios, including the current AgentLoop assembly. No study runtime fixes were added. |
| Locked specification with current TLC | All 5 PR bounded model configurations passed. |
| Historical Cordis conformance control | 13 traces passed; all 4 mutants rejected. |
| Historical Harness conformance control | 17 traces passed; all 4 mutants rejected, using its locked scenarios and implementation. |
| Historical upstream-fix stage | 76 Cordis and 153 Harness tests passed, along with both builds/lints and Harness doc-sync. The stage retained `formalStatus: "not-run"`. |
| Original full study reproduction | Stopped at the TLC download hash check; no successful aggregate study report was produced. |

The behavior findings remain premature provider recovery, premature disappearance of retiring consumers, and unsettled transitive activation, plus Cordis's deferred reload disposal problem. Passing ordinary tests does not eliminate these findings.

## Changed TLC release asset

The official [`v1.8.0` release metadata](https://api.github.com/repos/tlaplus/tlaplus/releases/tags/v1.8.0) records `tla2tools.jar` as updated on `2026-09-04T17:12:07Z`. Its downloaded SHA-256 agrees with the current GitHub asset digest but differs from the study pin:

```text
locked:   ab323b79802aedc3203b3f9af37c6aca3ed43f4e0225b36f2aa77b26de46c05f
current:  b658b4e504fdf0b721caf7066320f6b6fe5805f4dd2f717d0e47baba4097205e
```

CommunityModules still matches its pinned hash. Other local TLC copies did not match the original pin. The original runner correctly rejected the changed download.

Diagnostics used specification copies under `.artifacts/upstream/toolchain-diagnostic/`, updating only the TLC hash in the runner and provenance. Models, scenarios, and expected assertions were retained. Outputs are separate from historical stage evidence: **these are diagnostics with a different toolchain, not successful reproduction of the original lock**.

This machine uses a separately downloaded, SHA-256-verified Temurin 21 under `.artifacts/toolchains/`; add its `Contents/Home/bin` to `PATH` before TLC runs. Historical reproduction additionally requires a JAR matching the original hash.

## Paper cross-reference

The locked PDF has 88 pages. The current reference is [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1), 92 pages, SHA-256 `390775dbc9debdcf2ed1b076eed013387ca057630be3cb594617b2b742e48cf0`. This table maps topics and locations, not equivalence of statements or premises.

| Locked result | arXiv v1 result and PDF page |
| --- | --- |
| Theorem 7 | Theorem 7, p. 11 |
| Theorem 16 | Theorem 16, p. 15 |
| Theorem 20 / Corollary 21 | Theorem 43 and its proof, p. 28 |
| Lemma 54 | Lemma 59, pp. 40–41 |
| Lemmas 55 / 56 / 57 | Lemmas 60 / 61 / 62, pp. 41 / 42 / 42 |
| Theorem 59 | Theorem 64, p. 43 |
| Theorem 61 / Corollary 62 | Theorem 68 / Corollary 69, pp. 46–47 |
| Theorem 63 | Theorem 70, pp. 47–48 |
| Theorem 64 | Theorem 71, p. 48 |
| Theorem 66 | Theorem 73, pp. 49–50 |
| Theorem 73 | Theorem 80, pp. 54–55 |

The [completed review](arxiv-review.md) records the statement and premise differences. Independence now depends on context discipline and per-key witnesses, with a separate entangled-step argument; recovery compares observable tables. The new progress bound is `(K + 3)(V(n) + 1)`. Failure moves to §4.4 and remains outside confluence. `PairwiseIndependent` and `NoFailure` stay in the study.

Two existing overstatements also need correction: the paper permits Active/target mismatch before L-Leave, and our confluence product only compares shutdown states. The implementation assembly samples cover two insertion orders, not the full theorem. The historical mismatch counts and current passing reports remain exact results of the locked checker; their property names are not certificates of general arXiv theorems.

## Repeat the behavior check

Run `npm run bootstrap:study` first to obtain the baseline probe Git objects. Prepare clean target checkouts with their dependencies installed, then run:

```sh
npm run check:upstream:behavior -- \
  --cordis .artifacts/upstream/cordis/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c \
  --deepseek-harness .artifacts/upstream/deepseekHarness/5dda764ed3aa172535a7967b06ff95d9cbfe536a \
  --output .artifacts/upstream/behavior-5dda764
```

The command checks HEAD and cleanliness before and after execution and records probe revisions, source trees, and failures. Exit 0 means exact reproduction of historical behavior failures. A newly fixed failure, additional failure, or runtime error fails the audit. It does not run TLC or claim conformance.

Current Cordis workspace versions require a separate dependency lock; directly injecting the historical Yarn lock fails immutable installation. The [lock patch](../locks/cordis-upstream-2026-09-09.patch) aligns workspace declarations while retaining other resolutions. In a fresh checkout of the recorded Cordis revision, copy `locks/cordis.yarn.lock`, apply this patch, then run `corepack yarn install --immutable`. The reconstructed SHA-256 must be `63c466e312539eb356da77419002e931b4a54dc769f2fb562f66932d61bed537`; this reconstruction was checked. Historical stages retain their original lock.

Logs are under `.artifacts/logs/`. Evidence under `.artifacts/upstream/` includes `behavior-5dda764/`, `model-diagnostic/`, `cordis-trace-diagnostic/`, `deepseekHarness-latest-trace-diagnostic/`, `conformance-control/`, and `deepseekHarness-conformance-control/`. The historical ordinary-gate report remains under `.artifacts/stages/03-upstream-fix/`.
