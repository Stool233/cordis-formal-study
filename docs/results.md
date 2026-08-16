# Results and limits

English | [中文](results.zh-CN.md)

## Checked revision set

The current portal locks Cordis at `fe45fb4d1e89fd6c8ae24399f601a3da9356da8a`, the English paper at `948a07b369c62adb3b12e102458be5c18dfb69b9`, and DeepSeek Harness at `7797ad835a239bf5b8a229f2eb1d5cf7d8e4c773`.

## Baseline comparison

The trace-only branches preserve the upstream and vendored runtime logic. Their expected-failure runners record nine affected Cordis trace scenarios and ten affected vendored scenarios. Ordinary regressions independently expose four failures in upstream Cordis and three in the vendored baseline: provider resources are withdrawn before asynchronous consumers finish, retiring consumers disappear too early during concurrent root disposal, and transitive activation has not settled when an awaited provider returns; upstream Cordis also fails to drain a pending effect when disposal wins deferred activation, while the vendored baseline's earlier lifecycle hardening already passes that case.

These counts are affected scenarios and checks, not counts of independent defects. Several scenarios reach the same lifecycle-order mismatch through different dependency, identity, realm, or confluence paths.

## Bounded model results

The pull-request profile passed the following TLC explorations in the equivalent locked tree:

| Model | Result | Distinct states | BFS diameter |
| --- | --- | ---: | ---: |
| Effects | pass | 289 | 15 |
| Kernel, failures enabled | pass | 82,710 | 32 |
| Kernel, `NoFailure` | pass | 21,858 | 32 |
| Runtime refinement | pass | 66 | 11 |
| Confluence product | pass | 364,816 | 41 |

The model reports cover `WriteLocality`, `LifoRecovery`, `RecoveryExactness`, `IndependentExchangeInvariant`, `Preservation`, `Ordering`, `ResolutionCoherence`, `Progress`, `RuntimeRefinesPaper`, `CanonicalTerminalEquality`, and `EventuallyCanonical`. Implementation traces additionally check `ProgressBound`.

## Trace and mutation results

The locked scenario inventory contains 13 core traces and four additional DeepSeek Harness traces, for 17 vendored runs. Every required positive trace must be non-empty, byte-stable, completely consumed by `TraceMatched`, and contain no `not-applicable` or `unobserved` result. Three negative-premise audits must return the exact expected `not-applicable` status.

All 29 declared source-write observation points are covered. The following four mutants are rejected:

| Mutation | Required detection |
| --- | --- |
| Remove the unload guard | Provider inverse starts before dependent teardown completes. |
| Compare targets by value | Equal values hide a change in provider identity. |
| Recover in FIFO order | The effect accumulator violates LIFO recovery. |
| Retain a stale committed provider | An invalid provider remains visible in the committed view. |

## Implementation deviations found

Trace refinement confirmed two paper-relevant implementation deviations. First, provider recovery could begin before asynchronous dependent teardown completed, and early runtime-list removal could hide a concurrently retiring consumer. Second, dependency target and committed-view changes could become observable before the compatible lifecycle transition. The implementation now retains retiring consumers until quiescence, waits notified dependents before provider recovery, and publishes lifecycle transitions before incompatible target or committed views. The paper specification was not weakened to accept the earlier ordering.

Ordinary regressions found an adjacent scheduling defect after the first formal pass: two consecutive activation checkpoints allowed an awaited provider to return while a transitive consumer remained `LOADING`. The corrected implementation keeps one deferred cancellation checkpoint, so disposal can still invalidate stale activation while transitive activation settles before the awaited mount returns.

Independent top-level effect recovery was investigated but is not classified as a paper deviation. Recovery is serial LIFO inside each effect iterator; separate top-level wrappers start in reverse registration order and join concurrently under the explicit `PairwiseIndependent` premise. Cleanup operations that require completion order, such as session-persistence admission and backend closure, therefore share one accumulator rather than relying on global wrapper serialization.

Static `Plugin.provide` metadata is not treated as paper provision by assumption. The current runtime provision evidence comes from controlled `ctx.provide()` episodes with stable logical key and realm identity. `TotalProvision` therefore applies only where the harness closes that world.

## What the result does not prove

This is refinement evidence for locked revisions, bounded state spaces, declared premises, and generated traces. It does not prove:

- pairwise independence or exact inverse behavior for arbitrary opaque file, network, process, or device effects;
- liveness of an unbounded JavaScript execution from a finite quiescent trace;
- coverage of plugin behavior not represented by an observation point or scenario;
- correctness when acyclic dependency, finite-name, bounded-iterator, independence, total-provision, or no-failure premises required by a theorem are false.

The release workflow treats any required property other than `pass`, any missing trace line, any accepted mutant, or any imprecise negative-premise result as a blocking failure.
