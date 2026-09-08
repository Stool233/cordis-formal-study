# arXiv review — 2026-09-09

English | [中文](arxiv-review.zh-CN.md)

The newer paper supports keeping the dependent-cleanup and retirement fixes. It also exposes overstatements in our explanation of publication ordering, recovery, and confluence. The existing passing runs remain evidence for the locked models and observed scenarios; they do not certify the entire arXiv calculus.

This review aligns the study's conclusions with [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1), *A Programming Paradigm for Spatiotemporal Composability*. On the review date, arXiv lists only v1, submitted on 2026-08-26. The review covers the relevant definitions and arguments in §§3.3–3.4, 4, 5.1.3, and 6.1, the five locked TLA+ modules, and the trace generator and recorder. It is a source and claim audit, not an independent proof of every paper theorem or a new model-checking run.

## Decisions

| Study claim | Decision after review |
| --- | --- |
| A provider must retain a committed consumer's resources through that consumer's cleanup. | **Retain.** The guarded unload rule and Theorem 70 support the resource-ordering fix. This ordering follows dependency bindings, not every parent–child relationship. |
| Retiring consumers must remain discoverable until cleanup finishes. | **Retain.** Premature disappearance breaks the implementation's ability to enforce the guard; paper removal also requires an inactive fiber with no bindings or children. |
| Every Active fiber must always have `committed == target`. | **Narrow.** This is a stronger invariant of our publication projection, not Theorem 71. The paper permits a mismatch before L-Leave. |
| Different providers returning equal values are interchangeable. | **Reject.** Target and committed views identify providers; equal values do not establish equal bindings. |
| LIFO and resource-ID restoration prove complete recovery. | **Narrow.** They check the recorded resource abstraction. Theorem 68 additionally depends on inverse witnesses and equivalence of all relevant coeffect tables. |
| Existing confluence checks establish Theorem 80. | **Narrow.** They cover a bounded shutdown product and two assembly samples, with much less state than the paper compares. |
| Pairwise independence can be assumed automatically because the new paper derives it. | **Reject.** Its derivation requires context mediation, per-key commutativity, and stable inverses, outcomes, and continuations. |

The historical 9/13 Cordis and 10/17 Harness mismatches remain exact checker results. They are **not counts of direct counterexamples to arXiv theorems**. In particular, the conditional nature of resolution coherence and the stability requirement for independence were already present in the old paper. Those two corrections fix our interpretation; they are not newly weakened guarantees in v1.

## What changed in the premises

The old recovery argument used an explicit independence hypothesis. The new argument derives the needed relationships from a restricted component interface and treats provider–consumer entanglement separately. Checking that a plugin calls `ctx.effect()` does not establish that interface. [Definitions 42–46 and Theorem 47, pp. 27–30](https://arxiv.org/pdf/2608.25512v1#page=27); [Definitions 55–56 and Lemma 57, pp. 38–39](https://arxiv.org/pdf/2608.25512v1#page=38); [Definition 65 and Lemmas 66–67, pp. 44–45](https://arxiv.org/pdf/2608.25512v1#page=44).

| Required argument | What the study currently establishes | Consequence |
| --- | --- | --- |
| Reads and writes are mediated by declared coeffect keys; instantiation is the designated exception. | Controlled scenarios declare their dependency/provision sets. The recorder does not track all JavaScript reads or external state. | General plugins need a separate confinement argument. |
| Each shared key has an observational equivalence respected by its operations, inverses, and continuations. | Traces compare logical keys, provider IDs, lifecycle fields, and resource IDs. Service values, operation results, and inverse functions are omitted. | Equality of our snapshots cannot establish the paper's equivalence. |
| Shared-key operations commute, including repeated use of the same operation; returned outcomes and continuations remain stable. | The Effects model checks exchange of disjoint tagged resource additions and removals. It does not encode the full operation algebra. | `PairwiseIndependent` remains a scenario assumption. Ordered middleware or observable allocation handles need their own witnesses. |
| Every yielded inverse satisfies its recovery witness. | Scenarios exercise registered cleanup and LIFO behavior. | Unregistered effects or partially failed operations do not acquire a recovery proof from those tests. |
| Provision/dependency overlap is handled by the lifecycle guard. | The kernel and trace checks model committed dependents and guarded recovery. | Do not replace the entangled-step argument with a blanket claim that all effects commute. |

The existing six flags remain useful, with these limits:

| Existing flag | Aligned reading |
| --- | --- |
| `AcyclicDependencies` | Theorem 73 uses the precedence relation defined by provision/dependency overlap, including potential providers; an acyclic observed call sequence is insufficient. |
| `FiniteNames` | Finitely many names over the whole sequence, not merely a finite live registry at each instant. |
| `BoundedIterator` | A common bound on iterator length; an observed finite prefix does not establish it generally. |
| `PairwiseIndependent` | A conservative closed-scenario premise. Keep it until context, witness, respect, and entanglement obligations are represented. |
| `TotalProvision` | Required by the confluence result. The kernel's simplified resolver already treats an Active provider as providing every declared key. |
| `NoFailure` | Retain for confluence. Failure is an extension in §4.4, not a reason to accept failed executions as confluent. |

Negative-premise scenarios validate the checker's applicability behavior. They do not prove that every positive runtime execution satisfies all six flags or the additional interface conditions.

## Why Active can temporarily differ from target

Take an Active provider P offering key `k`, and an Active consumer C committed to `k → P`. Let both be children of the root. The following is a legal paper sequence:

| After this step | P | C | C target | C committed |
| --- | --- | --- | --- | --- |
| Initial settled state | Active | Active | `k → P` | `k → P` |
| O-Retire(P) | Active, retired | Active | `k → P` | `k → P` |
| L-Leave(P) | Unloading, retired | **Active** | **⊥** | **`k → P`** |
| L-Leave(C) | Unloading, retired | Unloading | ⊥ | `k → P` |

O-Retire writes P's retirement flag. L-Leave hides P's table from resolution for new activations but preserves the table and C's committed view. C may take L-Leave in a later step. P's L-Unload remains blocked until C completes its own unload. The highlighted state respects the paper's well-formedness and ordering; it is a counterexample to our *unconditional interpretation*, not to the paper. [Orchestration and lifecycle rules, pp. 34–37](https://arxiv.org/pdf/2608.25512v1#page=34).

Theorem 71 constrains L-Iter/L-Finish while a transition is installing effects and admits the diverted-iteration recovery alternative. It does not assert equality in every Active intermediate state. The old Theorem 64 already had that conditional structure. [Theorem 71, p. 48](https://arxiv.org/pdf/2608.25512v1#page=48).

Our kernel instead closes cascading leaves inside `CascadeLeaves`, and its `ResolutionCoherence` requires equality whenever a fiber is Active. The trace checker's `FiberWellFormed` imposes the same equality. These are checks of a more restrictive publication strategy. A mismatch needs classification against the event-to-paper mapping before it can be called a runtime violation. The lifecycle publication patch can remain as that strategy; provider-identity comparison has the separate basis in Definition 53 and its explanation on pp. 35–36.

## Recovery, progress, and confluence

**Recovery compares observable tables.** Definition 51 includes bindings held by Reloading and Unloading fibers, as well as Active fibers. Theorem 68 compares tables after withdrawing one episode with application of the same recorded foreign maps to the earlier state. The stronger reading as an executable history in which that episode never began requires that children instantiated in the episode take no steps during it. Corollary 69 also establishes emptiness of the recovered fiber's table. This is not restoration of every control field or external emission. [Theorem 68 and Corollary 69, pp. 46–47](https://arxiv.org/pdf/2608.25512v1#page=46); [system boundary, §6.1, pp. 70–71](https://arxiv.org/pdf/2608.25512v1#page=70).

Our resource inventory does not retain coeffect values or operation outcomes. LIFO recovery and an empty inventory are therefore useful concrete checks, but do not prove exact observational restoration of arbitrary coeffects, filesystem state, network traffic, or compensation policies.

**Progress counts paper lifecycle steps.** The old Theorem 66 used `(K + 4)(V(n) + 1)`; the new Theorem 73 uses `(K + 3)(V(n) + 1)` for the six core lifecycle rules. It concerns lifecycle-only sequences under acyclic precedence, bounded iterators, and finitely many names. Our `ProgressBound` checks a scenario event budget. NDJSON writes and individual inverse operations have different granularity and cannot be substituted into the formula. TLA+ fairness excludes endless stuttering in our specifications; it is not a replacement for the paper's premises or a proof about a host receiving new orchestration forever. [Theorem 73, pp. 49–50](https://arxiv.org/pdf/2608.25512v1#page=49).

**Confluence compares more than shutdown.** Theorem 80 fixes the initial state and ordered orchestration inputs, assumes the component discipline, acyclic precedence, and total provision, and compares quiescent states up to name renaming and the paper's state equivalence. Its canonical construction includes surviving Active fibers. [Theorem 80, pp. 54–55](https://arxiv.org/pdf/2608.25512v1#page=54).

The product model requires both sides to stop and every component to be Inactive before testing `CanonicalTerminalEquality`. The two implementation samples do finish with Active fibers, but use different insertion orders (`P_A, C_A, P_B, C_B` versus `P_B, P_A, C_B, C_A`) and compare recorder snapshots. They exercise two assembly permutations; they do not quantify over all legal schedules with the theorem's fixed inputs or compare the full paper state. See the locked [generator](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/harness/generate.ts) and [recorder](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/harness/recorder.ts).

## What the existing models actually cover

All source references below identify the unchanged [Cordis formal kit at `d06ee04`](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal).

| Source | Audited boundary |
| --- | --- |
| [CordisEffects.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisEffects.tla) | Tagged-resource recovery and restricted exchange identities; no general outcome/continuation algebra. |
| [CordisKernel.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisKernel.tla) | Bounded topology, disjoint dependency/provision sets within each fiber, non-overlapping provisions, dependencies on already declared providers, rank constraints, simplified total provision, and cascaded leaves. Its retirement action also retires direct children immediately. These restrictions and compound steps need an explicit mapping to the paper. |
| [CordisRuntime.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisRuntime.tla) | `RuntimeRefinesPaper` conjoins local projection invariants. It is not a temporal simulation theorem connecting a concrete machine to an instance of the kernel. |
| [CordisTrace.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisTrace.tla) | Full consumption of recorded projected states using its own event predicates; the module does not instantiate the kernel's transition relation. |
| [CordisConfluence.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisConfluence.tla) | Fixed provider/consumer/sibling product with equality after shutdown. |

These are substantive checks, but names such as `RecoveryExactness`, `ResolutionCoherence`, and `RuntimeRefinesPaper` are study operator names, not certificates of the corresponding general paper statements. Their state counts and mutation results remain unchanged.

## Extensions and follow-on proof obligations

Fixed realms can be represented by `(key, realm)` if the same discipline and witnesses hold. Changing realms or configuration during a fiber's lifetime is treated as revision: retire, deactivate, remove, and insert a new generation. A loader shortcut needs an endpoint-equivalence argument, not a claim that arbitrary in-place mutation is a core rule. Failure requires recovery of the successfully accumulated prefix and inhibits re-entry until revision; the current upstream failed-fiber guard remains necessary. [§4.4, pp. 56–57](https://arxiv.org/pdf/2608.25512v1#page=56).

To make a future executable specification claim the arXiv results, the remaining work is concrete:

1. Model the nine core rules and the failure extension separately. Represent legitimate Active/target mismatch, partial provision, and deferred child retirement; state how runtime microsteps and the existing compound actions map to them.
2. Define key-level observations and witnesses, covering mixed forward/inverse exchange, stable outcomes and continuations, and the entangled provider–consumer cases. Trace omission needs a relation that the operations respect, not just stable IDs.
3. Prove or check an explicit simulation relation for the runtime and trace machines. Retain the historical mismatch fixtures, then classify each rejection under the new relation before changing expectations.
4. Add confluence cases with the same ordered orchestration and surviving Active fibers, and count paper steps separately when checking the new progress bound. Handle realm/configuration revision and failure with their stated scope.

Those are model-migration obligations, not reasons to withdraw the observed cleanup regressions. This review completes the conclusion alignment; it does not silently replace the historical specification.

## Version and evidence record

| Record | Exact source |
| --- | --- |
| Historical paper | `cordiverse/paper@948a07b369c62adb3b12e102458be5c18dfb69b9`, 88 pages; [original PDF](https://github.com/cordiverse/paper/blob/948a07b369c62adb3b12e102458be5c18dfb69b9/paper.pdf). |
| Reviewed paper | `arXiv:2608.25512v1`, 92 pages; [official version](https://arxiv.org/abs/2608.25512v1). |
| Official repository pointer | [`cordiverse/paper@0d43a6f`](https://github.com/cordiverse/paper/tree/0d43a6f18004a7b5bf9662c31aa08c3712d232ec). |
| Historical evidence | [study.lock.json](../study.lock.json), with the five modules and recorded scenario sets. |
| Current implementation evidence | [alignment.lock.json](../alignment.lock.json) and [alignment-report.json](alignment-report.json), still against the historical specification. |

```text
Historical PDF SHA-256
4d48478dc0b6222d9f74d7db10ee776449b1209eb112632336544d32a49db97f
arXiv v1 PDF SHA-256
390775dbc9debdcf2ed1b076eed013387ca057630be3cb594617b2b742e48cf0
```

PDF page references are one-based. The PDFs were hashed, the relevant text compared, and the lifecycle rules and resolution-coherence formula visually checked. The locked models, reports, implementation revisions, and expected failure sets were not edited. `latestPaperFormalStatus` remains `not-validated`; the separate review status in the [alignment snapshot](upstream-alignment.json) records completed conclusion review. [Results](results.md) and [Method](method.md) now use this narrower interpretation.
