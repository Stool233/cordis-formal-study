# Results and limits

English | [中文](results.zh-CN.md)

## Checked revision set

The current portal locks Cordis at `23f5e7d6e4a0cf451567dad1caad7b4049df6992`, the English paper at `948a07b369c62adb3b12e102458be5c18dfb69b9`, and DeepSeek Harness at `9a039fe3e17f0bd6fae09bdaae10d2fbfb59a21f`.

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

Trace refinement exposed ordering differences in provider/dependent teardown, two-level inverse recovery, and lifecycle/committed-view publication. The implementation was changed to wait for dependent retirement before provider recovery, recover inverse resources LIFO within each iterator while joining independent structural wrappers, and publish lifecycle state before compatible targets or committed views. The paper specification was not weakened to accept the earlier ordering.

Static `Plugin.provide` metadata is not treated as paper provision by assumption. The current runtime provision evidence comes from controlled `ctx.provide()` episodes with stable logical key and realm identity. `TotalProvision` therefore applies only where the harness closes that world.

## What the result does not prove

This is refinement evidence for locked revisions, bounded state spaces, declared premises, and generated traces. It does not prove:

- pairwise independence or exact inverse behavior for arbitrary opaque file, network, process, or device effects;
- liveness of an unbounded JavaScript execution from a finite quiescent trace;
- coverage of plugin behavior not represented by an observation point or scenario;
- correctness when acyclic dependency, finite-name, bounded-iterator, independence, total-provision, or no-failure premises required by a theorem are false.

The release workflow treats any required property other than `pass`, any missing trace line, any accepted mutant, or any imprecise negative-premise result as a blocking failure.
