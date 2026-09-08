# Research Process and Results

English | [中文](results.zh-CN.md)

This document follows the three stages of the study to explain what was found, how it was confirmed, how it was corrected, and which source is suitable for later upstream review. [`study.lock.json`](../study.lock.json) is authoritative for exact revisions and expected sets.

## Read the result first

| Stage | Instrumentation | Logic fixes | Expected conclusion |
| --- | --- | --- | --- |
| `baseline` | Present | Absent | The original implementation must reproduce the exact locked mismatches; an unexpected pass is also result drift. |
| `conformance` | Present | Present | TLC models, trace refinement, premise audits, mutations, AgentLoop, and ordinary regressions all pass. |
| `upstream-fix` | Absent | Present | Only the logic patch and ordinary gates are checked; formal status is fixed to `not-run` and points back to stage two. |

This page describes the historical experiment in [study.lock.json](../study.lock.json). The paper revision is `948a07b`, with PDF SHA-256 `4d48478d…a49db97f`. See [Architecture](architecture.md#source-and-stage-topology) for implementation revisions, or [Upstream alignment](upstream-alignment.md) for current-code results.

The [2026-09-09 arXiv review](arxiv-review.md) corrects the interpretation below without changing those results. A rejected trace is a mismatch with the locked checker; it is not automatically a counterexample to a paper theorem.

## What the failures mean

The required resource order is easy to recognize: a consumer finishes using a resource before its provider releases it. The first finding checks that order across asynchronous cleanup.

```mermaid
flowchart LR
  A[Consumer cleanup starts] --> B[Consumer cleanup finishes] --> C[Provider resource recovery]
```

### 1. Provider recovery and retirement ordering

The original implementation could start a provider accumulator's inverse before asynchronous consumer teardown finished. At the same time, a retiring consumer could leave the runtime list too early, preventing concurrent teardown from continuing to discover it. These concrete failures conflict with guarded provider/consumer ordering and the implementation's enforcement of retirement visibility. The newer paper retains the unload guard and episode nesting in Theorem 70; the tests do not establish its more general recovery-equivalence result.

The correction keeps retiring consumers discoverable until lifecycle quiescence and makes provider recovery await notified dependents. Provider/consumer reverse exit, asynchronous and concurrent teardown, dependency loss and return, and AgentLoop assembly confirm the same underlying ordering issue through different paths.

### 2. Publication ordering for lifecycle, target, and committed view

The original implementation could expose a target or committed-provider change before entering the lifecycle state required by our projection. Equal service values could also hide a provider-identity replacement. Provider identity has a direct paper basis, but publication mismatch alone is not a demonstrated violation of Preservation or Resolution coherence: the paper allows an Active fiber's target to change before L-Leave executes.

The correction uses lifecycle transition as a publication barrier: enter the compatible lifecycle state before changing target or committed view, and compare bindings by provider identity rather than value alone. Provider replacement, dependency loss during iteration, dependency return during unload, realm isolation, and confluence traces jointly cover this behavior.

This validates a stricter publication strategy. The [legal intermediate-state example](arxiv-review.md#why-active-can-temporarily-differ-from-target) explains why `Active ⇒ committed == target` cannot be attributed to arXiv Theorem 71 or the old Theorem 64. Historical mismatches retain their fixtures and counts, with this narrower classification.

### 3. Transitive activation scheduling regression

Ordinary regression testing after the first formal correction found that two consecutive deferred cancellation checkpoints could let an awaited provider return while a transitive consumer remained `LOADING`. This is an implementation scheduling issue adjacent to the progress goal; the study does not claim it as a standalone counterexample to a specific paper theorem.

The correction keeps one deferred cancellation checkpoint. Disposal can still invalidate stale activation, while callers awaiting mount observe settled transitive activation. The ordinary regression runs in both conformance and upstream-fix stages.

<details>
<summary>Baseline reference: exact trace mismatches and behavior failures</summary>

## Stage one: reproduce divergence with original runtime logic

The baseline branches add only a synchronous test trace sink, stable logical IDs, scenarios, and expected-failure runners. Runtime lifecycle, resolution, recovery, and scheduling logic remains unchanged. Success means that the actual failure sets exactly equal the lock, not that everything turns green.

### Trace mismatches

The 9 Cordis mismatches are:

1. `provider-consumer-reverse-exit`
2. `async-consumer-teardown-guard`
3. `concurrent-root-teardown-guard`
4. `provider-identity-replacement`
5. `dependency-loss-during-iteration`
6. `dependency-return-during-unload`
7. `isolation-realms`
8. `confluence-left`
9. `confluence-right`

Vendored Cordis reproduces the same set plus `deepseek-agent-loop-assembly`, for 10 mismatches. Every other positive scenario must still pass, and the three negative-premise scenarios must report exactly `not-applicable`. The baseline cannot pass through empty traces, marking every property as expected failure, or ignoring a new mismatch.

### Ordinary behavior failures

| Behavior check | Cordis | Vendored Cordis |
| --- | --- | --- |
| `provider-resources-outlive-asynchronous-consumers` | expected-fail | expected-fail |
| `retiring-consumers-remain-discoverable` | expected-fail | expected-fail |
| `disposal-invalidates-deferred-reload` | expected-fail | pass |
| `awaited-provider-settles-transitive-activation` | expected-fail | expected-fail |

Existing vendored lifecycle hardening already makes `disposal-invalidates-deferred-reload` pass, so its behavior-failure count is 3 rather than 4. The 9/10 and 4/3 figures count affected scenarios or checks, not independent defects.

</details>

## Stage two: establish conformance evidence after correction

The conformance branches retain the same instrumentation and add the corrections above. Passing requires models, implementation traces, and ordinary tests rather than any one report in isolation.

### Bounded models

The fixed PR-profile exploration results are:

| Model | Result | Distinct states | BFS diameter |
| --- | --- | ---: | ---: |
| Effects | pass | 289 | 15 |
| Kernel, failure enabled | pass | 82,710 | 32 |
| Kernel, `NoFailure` | pass | 21,858 | 32 |
| Runtime refinement | pass | 66 | 11 |
| Confluence product | pass | 364,816 | 41 |

The models check study operators for resource locality and LIFO recovery, Preservation, Recovery exactness, Ordering, Resolution coherence, Progress, runtime projection, and canonical terminal equality. These names do not establish equivalence to the general paper theorems. In particular, the product model compares shutdown states, and `RuntimeRefinesPaper` is a conjunction of local invariants rather than a temporal simulation theorem. The [model audit](arxiv-review.md#what-the-existing-models-actually-cover) records the restrictions. Finite traces additionally check quiescence and a scenario `ProgressBound`, not the paper's closed-form step bound or infinite-horizon liveness.

### Implementation evidence

| Evidence | Cordis | Vendored Cordis |
| --- | ---: | ---: |
| Positive trace scenarios | 13 | 17 |
| Complete `TraceMatched` | 13 | 17 |
| Observed write points | 29 | 29 (shared core inventory) |
| Rejected mutants | 4 | 4 |

Every trace must be non-empty, fully consumed, and report `pass` for each declared positive property. Cyclic dependencies, non-independent effects, and non-total provision must report exactly `not-applicable` in their negative-premise scenarios.

The four mutants remove the unload guard, compare targets by value, restore in FIFO order, and permit a stale committed provider. Stage two fails if any mutant is accepted. DeepSeek Harness additionally runs reentrant disposal, pending-effect, asynchronous-cleanup-join, and no-network AgentLoop assembly scenarios.

## Stage three: produce a patch suitable for upstream review

The `fix/paper-conformance` branches retain only lifecycle/scheduling corrections and ordinary regression tests. Gates first require the absence of the trace sink, `formal/` kit, Cordis-paper runner, and related package scripts. They then run:

- Cordis fiber, HMR, and loader regressions, plus build and lint;
- DeepSeek Harness lifecycle and session-persistence regressions, plus build, lint, and bilingual documentation gates.

This stage writes a `cordis.formal-study-ordinary-gates/v1` report whose `formalStatus` must be `not-run`. It does not pretend that source without instrumentation directly produces trace-refinement evidence. The report explicitly references the stage-two Cordis and DeepSeek Harness revisions containing the same logic fixes.

## Investigated but not classified as defects

### Concurrent recovery of independent top-level effects

Within one effect iterator, inverses execute serially in LIFO order. Different top-level wrappers may launch in reverse registration order and join concurrently when `PairwiseIndependent` holds. Cleanup operations requiring strict completion order must share one accumulator rather than depend on global serialization of every wrapper. The implementation and paper premise can be aligned within this boundary, so no defect is claimed.

### `Plugin.provide` and `ctx.provide()`

The paper's static provision set cannot be equated directly with `Plugin.provide` metadata that does not participate in core resolution. This study's provision traces come from controlled `ctx.provide()` episodes with stable logical key, provider identity, and realm. `TotalProvision` therefore applies only where the scenario harness closes the provider set; outside that scope the result is inapplicable or unobserved, not a fabricated pass.

## Evidence boundary

The results say only that the locked revisions satisfy the checked properties in finite models, explicit premises, and captured traces. They do not cover arbitrary opaque file, network, process, or device side effects; prove that arbitrary effects are independent or inverses exact; or turn a finite quiescent trace into an unbounded liveness proof. The [arXiv source review](arxiv-review.md) is complete for these conclusions and identifies the remaining witness, simulation, and model-migration obligations. Independent review of the specification and those arguments remains valuable.

Continue with [Reproduction](reproduce.md) to run the stages. Property provenance and state projection are described in [Method](method.md) and [Architecture](architecture.md).
