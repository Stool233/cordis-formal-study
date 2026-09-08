# Method

English | [中文](method.zh-CN.md)

This study asks two questions: does a finite model satisfy the paper-derived properties, and does an observed implementation execution follow that model? Neither answer replaces the other.

## Terms used in the study

| Term | Meaning here |
| --- | --- |
| Specification | The study's executable interpretation of paper rules, including its abstraction choices and restrictions. |
| Model checking | TLC explores a finite state space and looks for a counterexample. |
| Trace refinement | Recorded projected states and steps are accepted by the trace machine; correspondence to the paper is a separate obligation. |
| Premise audit | An explicit check of the assumptions under which a property applies. |
| Semantic mutation | A deliberately invalid trace that the checker must reject. |

Read [Results](results.md) for a concrete resource-ordering example. This page explains how its evidence is constructed.

## Source of properties

The Cordis paper supplies intended semantics; the study chooses finite abstractions and an executable interpretation. The locked kit's `THEOREMS.md` connects historical paper pages, TLA+ operators, observation points, and premises. The [arXiv review](arxiv-review.md) audits that interpretation and identifies restrictions and overstatements. Code supplies implementation states and traces; a passing checker does not itself establish that the interpretation faithfully represents the paper.

That ordering avoids circular confirmation. If a specification is inferred entirely from the same implementation and then used to prove that implementation conforms, the conclusion lacks an independent source of intended semantics. After a mismatch, the study distinguishes errors in the paper model, refinement mapping, and implementation. The specification changes only when supported by the paper; a confirmed implementation deviation keeps its minimal counterexample and is corrected in code.

## Three evidence layers

### 1. Bounded model checking of study machines

`CordisEffects.tla`, `CordisKernel.tla`, `CordisRuntime.tla`, and `CordisConfluence.tla` check resource recovery, restricted lifecycle rules, local runtime projection invariants, and equality after shutdown across schedules. TLC checks safety invariants, deadlock, ranking bounds, and bounded liveness objectives under explicit fairness in PR and nightly finite configurations. `RuntimeRefinesPaper` does not encode a temporal simulation theorem; the confluence product's terminal condition requires every component to be Inactive.

A bounded pass means no counterexample was found in that configuration, not an unconditional proof at arbitrary scale. Nightly uses layered bounds: expanded effects and individual kernel dimensions receive exhaustive BFS, while the combined five-fiber runtime, kernel, and confluence bounds receive exactly 100,000 fixed-seed simulation traces per run. Reports identify each result as `exhaustive` or `simulation`. Temporal properties such as `Progress` and `EventuallyCanonical` are accepted only from completed BFS runs.

### 2. Implementation-trace refinement

A test-only trace sink synchronously records lifecycle, target, committed view, fiber creation/retirement/removal, effect-iteration landing, inverses, and service provision/withdrawal within a root context. The recorder uses stable logical IDs and sequence numbers without timestamps. Each `cordis.paper-trace/v1` NDJSON record carries a complete abstract post-state.

`CordisTrace.tla` cursor-consumes each record using its own event predicates. Asynchronous launches, landings, and publication writes receive constrained interpretations using observations and finite auxiliary state. `TraceMatched` passes only after all records and complete projected post-states match; it cannot degrade to `TRUE`. The module does not instantiate the kernel transition relation, so this acceptance alone is not a checked simulation of the paper's rules.

Provider IDs and resource IDs preserve useful observations, but the trace omits coeffect values, operation outcomes, inverse functions, and continuations. The paper's observational equivalence requires those operations to respect the chosen relation. Also, the trace's unconditional Active/target equality is stronger than the paper; see the [legal intermediate state](arxiv-review.md#why-active-can-temporarily-differ-from-target).

### 3. Premise audit

`AcyclicDependencies`, `FiniteNames`, `BoundedIterator`, `PairwiseIndependent`, `TotalProvision`, and `NoFailure` are explicit premises. Finite traces cannot establish all of them automatically, so cyclic dependency, non-independent effect, and non-total provision use dedicated negative scenarios. A false premise must produce `not-applicable` for dependent claims and cannot count as a pass.

The arXiv argument additionally requires context-mediated operations, inverse and commutativity witnesses, and stability under observational equivalence. The six flags do not encode all those obligations. `PairwiseIndependent` and `NoFailure` remain in place; the [premise audit](arxiv-review.md#what-changed-in-the-premises) explains their current meaning. The trace's `ProgressBound` is an event budget, not a check of Theorem 73's `(K + 3)(V(n) + 1)` bound.

## Observation completeness and sensitivity

A source gate fixes 29 write points for lifecycle, epoch/target, committed store, `uid`, registry, and service store so new writes cannot bypass observation. Each scenario generates evidence under two temporary roots and requires byte identity. Report references must be relative POSIX paths.

Four semantic mutations show that validation is not vacuous. Removing the unload guard, comparing targets by value rather than provider identity, restoring FIFO, and permitting a stale committed provider must all be rejected by models or traces.

## Three-stage diagnostic discipline

Baseline adds observation only and preserves exact counterexamples from original logic. Conformance adds corrections and requires formal and ordinary gates together. Upstream-fix removes research instrumentation and keeps only the patch and regressions. The stages separately answer whether the specification truly rejects the original, whether the same evidence accepts the correction, and which product code an upstream reviewer needs to inspect.

Upstream-fix does not directly produce a formal conclusion. Its `formalStatus` is fixed to `not-run`, with exact revisions pointing to the same logic fixes in stage two. Lock and report validators enforce this relationship rather than leaving it as prose.

<details>
<summary>Background: what we borrow from etcd/raft and Specula</summary>

## Borrowed scope from etcd/raft and Specula

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) is the direct engineering precedent. It separates whether a model satisfies its properties from whether implementation traces are accepted by that model, and discusses practical issues such as action granularity, stuttering, happens-before information, and stale models.

[Specula](https://github.com/specula-org/Specula) organizes code analysis, specification generation, instrumentation, trace validation, model checking, and bug confirmation into an automated workflow. Its pinned v1.1.0 revision `c6aa3dfa41cd4bc7411fae40bd040924c70d9725` is used here only as a trace-generation, validation, and debugging reference. [Murat Demirbas's review](https://muratbuffalo.blogspot.com/2026/08/specula-scaling-formal-specifications.html) notes that a model inferred from an implementation cannot alone be independent evidence that the same implementation satisfies intended semantics.

The study therefore does not adopt the step of deriving Cordis invariants from Cordis code. It borrows instrumentation mapping, deterministic NDJSON, cursor consumption, complete `TraceMatched`, TLC feedback, and layered diagnosis of the first mismatch. The Cordis paper is the property source, Cordis `formal/` is the executable-specification authority, and Specula is neither a submodule, build dependency, nor CI dependency.

</details>

## Interpretation rule

A `pass` means that no counterexample was found for the locked revision, finite model constants, declared premises, and captured traces, and that the trace machine accepted the recorded projection. A separate simulation and witness argument is required to transfer that result to the paper. It does not generalize to arbitrary plugin side effects, unobserved executions, or unbounded liveness. The [arXiv review](arxiv-review.md) records completed conclusion alignment and the remaining model obligations.
