# Cordis Formal Study

English | [中文](README.zh-CN.md)

Does Cordis's plugin lifecycle behave as its paper describes? This independent study connects paper-derived TLA+ models with real execution traces from Cordis and DeepSeek Harness, then tests the corresponding runtime fixes.

Start with the findings below. To work with current code, use the [upstream alignment report](docs/upstream-alignment.md); to rerun the original experiment, use the [three-stage reproduction guide](docs/reproduce.md).

## What we found

The original implementations can recover provider resources while consumers are still cleaning up. Traces also expose publication states rejected by our stricter projection, and ordinary tests identify a transitive activation scheduling issue. The [arXiv review](docs/arxiv-review.md) distinguishes paper-supported ordering defects from projection mismatches.

| Historical experiment | Cordis | Harness's vendored Cordis |
| --- | ---: | ---: |
| Trace scenarios rejected by the model | 9 of 13 | 10 of 17 |
| Failing ordinary behavior checks | 4 of 4 | 3 of 4 |
| Accepted traces after the fixes | 13 of 13 | 17 of 17 |
| Semantic mutations rejected | 4 of 4 | 4 of 4 |

These are scenario counts, not independent bug counts or counts of paper-theorem counterexamples. [Results](docs/results.md) explains the mismatches, fixes, and evidence. All historical numbers refer to the revisions in [study.lock.json](study.lock.json).

## Current code and historical evidence

The 2026-09-09 check uses official Cordis `f8ea3cd` and Harness `5dda764`. The two forks have separate migration branches based on those revisions. Their fixes and verification are recorded in [Upstream alignment](docs/upstream-alignment.md).

The original three-stage snapshots remain unchanged. Both exact TLC builds and CommunityModules are now [bundled by hash](tools/README.md), including the recovered historical JAR. Formal commands use these checked files, so replacement of the official release asset no longer affects tool acquisition. The migration retains its separately pinned tool and the historical specification.

The [arXiv v1 review](docs/arxiv-review.md) is complete at the level of conclusions and premises: retain the cleanup fixes, narrow publication/recovery/confluence claims, and keep full arXiv formal validation marked `not-validated`.

## Three stages, three different meanings of success

1. **Baseline — observe the original behavior.** Keep runtime logic and add test observations. Success means reproducing the exact known failures.
2. **Conformance — validate the fix.** Apply corrections and check models, implementation traces, premises, mutations, and ordinary regressions.
3. **Upstream-fix — review the runtime patch.** Keep logic fixes and regressions, remove research instrumentation. Its direct formal status is `not-run`; it points to stage two for formal evidence.

[Reproduction](docs/reproduce.md) gives the commands. [Architecture](docs/architecture.md) records branches, source ownership, and reports.

## Three repositories

| Repository | What to find there |
| --- | --- |
| **This portal** | Findings, exact versions, reproduction commands, and cross-repository reports. |
| [Cordis fork](https://github.com/Stool233/cordis) | The framework, migrated lifecycle fixes, and the pinned executable specification on the conformance branch. |
| [Harness fork](https://github.com/Stool233/deepseek-harness) | Vendored Cordis and integration checks for cleanup, persistence, and AgentLoop. |

The [Cordis paper](https://github.com/cordiverse/paper) supplies the properties. The [locked Cordis formal kit](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal) is the executable specification; the portal does not maintain a competing copy.

## Read the study

| If you want to… | Open |
| --- | --- |
| Understand a concrete failure and its correction | [Results](docs/results.md) |
| See which conclusions the newer paper supports | [arXiv review](docs/arxiv-review.md) |
| Check current upstream and the migrated fixes | [Upstream alignment](docs/upstream-alignment.md) |
| Run the checks yourself | [Reproduction](docs/reproduce.md) |
| Understand models, traces, and applicability | [Method](docs/method.md) |
| Find revisions, runners, reports, and CI responsibilities | [Architecture](docs/architecture.md) |

This is early research, not an official Cordis or DeepSeek assurance. Results cover fixed revisions, finite models, declared premises, and observed schedules. Arbitrary plugin side effects and unbounded execution remain outside that scope; the specification and refinement rules still need independent human review.
