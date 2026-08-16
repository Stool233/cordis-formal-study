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

## Specula's trace-validation techniques and the source of properties

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) is a concrete project-level trace-validation precedent. At the pinned revision `c6aa3dfa41cd4bc7411fae40bd040924c70d9725` (v1.1.0), [Specula](https://github.com/specula-org/Specula) packages a broader five-phase [workflow](https://github.com/specula-org/Specula/blob/c6aa3dfa41cd4bc7411fae40bd040924c70d9725/skills/workflow-overview.md): source analysis, code-faithful TLA+ specification generation, implementation harness and NDJSON trace generation, trace validation plus model checking, and confirmation of candidate bugs in the real system. Its pinned repository also carries an [etcd/raft specification example](https://github.com/specula-org/Specula/blob/c6aa3dfa41cd4bc7411fae40bd040924c70d9725/skills/spec_generation/examples/etcdraft.tla). This study cites the PR as an engineering precedent and Specula as a reusable reference for trace instrumentation, validation, and debugging; neither is a build dependency.

Specula's trace workflow requires an enabled `TraceMatched` property, meaningful post-state validation rather than a `TRUE` stub, cursor-based trace consumption, and layered debugging of the first rejected condition. This study adopts that separation of responsibilities and debugging discipline. `THEOREMS.md` and the observation-point inventory play the instrumentation-mapping role; the trace sink and scenario generator play the harness role; `CordisTrace.tla` performs complete cursor consumption and post-state comparison; saved counterexamples and regression tests support implementation-level confirmation.

The source of properties is intentionally different. Specula's full workflow infers invariants and code-faithful models from system code and related engineering artifacts. [Murat Demirbas's review](https://muratbuffalo.blogspot.com/2026/08/specula-scaling-formal-specifications.html) identifies the resulting circular-confirmation risk: a model inferred from an implementation is not, by itself, an independent statement of that implementation's intended semantics. This study instead derives its abstract properties from the definitions, lemmas, and theorems in the Cordis paper before interpreting implementation traces. `CordisRuntime` projects the code onto that paper-derived machine, so the implementations are validation subjects rather than sources of the properties used to judge them. A mismatch cannot be resolved by relaxing the specification unless the paper supports that change. Specula remains a trace-validation and debugging reference only; it is not a submodule or CI dependency, and Cordis's own `formal/` directory remains the sole executable specification.

## Interpretation rule

The evidence supports a precise statement: for the locked source revisions, finite model configurations, declared premises, and captured deterministic traces, no counterexample was found and each accepted implementation trace refines the checked paper machine. It does not establish correctness of arbitrary plugin side effects, unbounded JavaScript execution, or executions that the scenario generators never observe.
