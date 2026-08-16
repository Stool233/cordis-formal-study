# Method

English | [中文](method.zh-CN.md)

## Why trace validation

TLC can explore a finite state space of an abstract TLA+ machine, but passing that check does not establish that production code implements the same machine. Ordinary implementation tests can show selected outcomes, but usually do not define a total projection from every relevant runtime state to the abstract state.

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) provides the main engineering precedent for closing this gap. Its proposal distinguishes algorithm correctness from implementation alignment, instruments algorithm-relevant states and transitions, and lets a trace specification constrain the model checker to the path taken by an implementation execution. A state or transition rejected by the core state machine is evidence of a specification/implementation mismatch. The PR credits [Microsoft CCF's consensus trace validation](https://github.com/microsoft/CCF/tree/main/tla/consensus) as its starting point.

The precedent is useful because its review discussion identifies the hard parts rather than treating trace validation as log replay:

- a rejected trace does not decide whether the implementation is wrong or the model is stale;
- distributed observation must preserve enough happens-before information to reason about global behaviors;
- specification actions and implementation operations need not have identical granularity;
- stuttering and nondeterminism must be represented deliberately;
- instrumentation should be low-risk, test-only where possible, and reproducible by maintainers other than its author.

## Adaptation to Cordis and DeepSeek Harness

Cordis differs from Raft. Its important interleavings occur among fibers, dependency resolution, async effect iterators, retirement, and inverse execution within a JavaScript runtime, rather than among replicated nodes. This makes a root-context logical sequence sufficient for the controlled scenarios: every paper-relevant observation is emitted synchronously through one test-only sink. The recorder uses stable logical IDs and no wall-clock timestamps, so the same scenario must produce byte-identical NDJSON in distinct temporary roots.

The study also starts from a paper with named definitions, lemmas, and theorems. The paper is therefore the specification priority. When a mismatch is confirmed as an implementation deviation, the workflow retains the minimal counterexample and fixes the implementation. It does not relax the specification merely to accept current behavior.

The adaptation has three evidence layers:

1. `CordisEffects`, `CordisKernel`, `CordisRuntime`, and `CordisConfluence` are checked by TLC in bounded PR and nightly configurations.
2. `CordisTrace` cursor-consumes each non-empty `cordis.paper-trace/v1` NDJSON stream and compares every complete abstract post-state. Upstream and vendored Cordis share the core scenarios.
3. `AcyclicDependencies`, `FiniteNames`, `BoundedIterator`, `PairwiseIndependent`, `TotalProvision`, and `NoFailure` are explicit assumptions. A false premise yields `not-applicable` for dependent claims.

The refinement mapping permits stuttering for an async-iterator launch and permits selected implementation operations to merge into one paper transition. These silent interpretations are tied to concrete observation events and bounded auxiliary state. `uid = null`, runtime-list removal, and lifecycle transition timing are not accepted as arbitrary unobserved behavior.

## Stronger checks added here

Several choices go beyond merely adopting the broad trace-validation idea:

- each record carries the complete abstract post-state, rather than only an event label;
- an AST/source gate inventories 29 write points for lifecycle, epoch/target, committed state, `uid`, registries, and services;
- four semantic mutants must be rejected, proving the validator is sensitive to unload ordering, provider identity, LIFO recovery, and stale committed providers;
- confluence compares canonical terminal states under two lifecycle schedules;
- report references are output-relative POSIX paths, and generation in two temporary roots must be byte-identical;
- finite implementation traces report quiescence and a progress bound but do not claim an infinite-horizon liveness proof.

## From the etcd practice to the Specula workflow

The etcd/raft PR and [Specula](https://github.com/specula-org/Specula) are not independent methods. The PR is a concrete project-level instance of trace validation. At the pinned revision `c6aa3dfa41cd4bc7411fae40bd040924c70d9725` (v1.1.0), Specula's [workflow overview](https://github.com/specula-org/Specula/blob/c6aa3dfa41cd4bc7411fae40bd040924c70d9725/skills/workflow-overview.md) systematizes this class of practice into five reusable phases: source analysis, TLA+ specification generation, implementation harness and NDJSON trace generation, trace validation plus model checking, and confirmation of candidate bugs in the real system. The pinned repository also carries an [etcd/raft specification example](https://github.com/specula-org/Specula/blob/c6aa3dfa41cd4bc7411fae40bd040924c70d9725/skills/spec_generation/examples/etcdraft.tla). Together these establish a concrete-practice-to-systematic-method relationship; they do not show that PR #113 itself was produced by the Specula project.

Specula's trace workflow requires an enabled `TraceMatched` property, meaningful post-state validation rather than a `TRUE` stub, cursor-based trace consumption, and layered debugging of the first rejected condition. This study adopts that separation of responsibilities and debugging discipline. `THEOREMS.md` and the observation-point inventory play the instrumentation-mapping role; the trace sink and scenario generator play the harness role; `CordisTrace.tla` performs complete cursor consumption and post-state comparison; saved counterexamples and regression tests support implementation-level confirmation.

One authority rule is intentionally different: both the etcd precedent and Specula start from code-faithful models of an implementation, whereas this study gives the Cordis paper semantic priority and puts implementation details behind `CordisRuntime` refinement. The study therefore uses Specula's systematized methodology, not its runtime: Specula is not a submodule or CI dependency, its repository is not modified, and Cordis's own `formal/` directory remains the sole executable specification.

## Interpretation rule

The evidence supports a precise statement: for the locked source revisions, finite model configurations, declared premises, and captured deterministic traces, no counterexample was found and each accepted implementation trace refines the checked paper machine. It does not establish correctness of arbitrary plugin side effects, unbounded JavaScript execution, or executions that the scenario generators never observe.
