# Cordis Formal Study

English | [中文](README.zh-CN.md)

> **Research status — early-stage work in progress.** The complete TLA+ specification, paper-to-theorem mapping, and refinement rules still require human audit and independent review.

An independent, unofficial, reproducible study of the Cordis paper, its upstream implementation, and the vendored Cordis used by DeepSeek Harness. The study combines bounded TLA+ model checking, deterministic implementation-trace validation, and explicit theorem-premise audits.

The authoritative executable specification remains in [the locked Cordis `formal/` directory](https://github.com/Stool233/cordis/tree/23f5e7d6e4a0cf451567dad1caad7b4049df6992/formal). This portal pins and explains the source revisions, runs the evidence pipeline, and packages portable results; it does not duplicate or fork the specification.

## Background

This study is motivated by [etcd/raft PR #113, “TLA+ Trace validation”](https://github.com/etcd-io/raft/pull/113). That work connects two complementary checks: TLC checks the algorithm model, while execution traces check whether the implementation follows the model. Together they provide evidence relating a formal specification to running code.

[Specula](https://github.com/specula-org/Specula) provides an automated workflow from code analysis, specification generation, and implementation instrumentation through trace validation, model checking, and bug confirmation. Its full workflow infers invariants and code-faithful TLA+ specifications from system code and related engineering artifacts; as [Murat Demirbas's review of Specula](https://muratbuffalo.blogspot.com/2026/08/specula-scaling-formal-specifications.html) observes, a model inferred from an implementation cannot by itself serve as independent evidence that the same implementation satisfies its intended semantics. This study deliberately uses a different source of specification authority: definitions, lemmas, and theorems in the Cordis paper determine the abstract properties under validation, while the Cordis and DeepSeek Harness implementations remain subjects of validation. We primarily borrow Specula's ideas for implementation instrumentation, trace generation, TLA+ trace validation, and TLC-driven checking and counterexample diagnosis.

In this adaptation:

- the Cordis paper is the specification priority, and TLC explores bounded abstract machines for its lifecycle, recovery, resolution, progress, and confluence properties;
- Cordis emits test-only, deterministic NDJSON observations with logical sequence numbers and complete abstract post-states;
- a refinement mapping permits only explicitly bounded silent or merged implementation steps;
- upstream Cordis and DeepSeek Harness's vendored Cordis run the same conformance scenarios and semantic mutations;
- assumptions that finite traces cannot establish are audited and reported as `not-applicable`, never promoted to passes.

See [Method](docs/method.md) for the detailed methodology and adaptation choices, and [Architecture](docs/architecture.md) for the evidence flow.

## Pinned source snapshot

| Source | Role | Locked revision |
| --- | --- | --- |
| [`Stool233/cordis`](sources/cordis/) | Authoritative TLA+ kit and upstream implementation | `23f5e7d6e4a0cf451567dad1caad7b4049df6992` |
| [`cordiverse/paper`](sources/paper/) | English paper | `948a07b369c62adb3b12e102458be5c18dfb69b9` |
| [`Stool233/deepseek-harness`](sources/deepseek-harness/) | Vendored Cordis and offline AgentLoop target | `9a039fe3e17f0bd6fae09bdaae10d2fbfb59a21f` |

[`study.lock.json`](study.lock.json) is the machine-readable source of truth. It records upstream baselines, fork revisions, paper, dependency-lock and toolchain hashes, scenario counts, required properties, mutations, and observation points. Git submodule links provide the matching browsable snapshots.

## Quick start

Requirements are Node.js 24 and Java 21. TLA+ Tools and CommunityModules are downloaded on demand and verified against the hashes in the lock file.

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm run bootstrap:core
npm run verify
npm run reproduce:core
```

Use `npm run bootstrap:full` and `npm run reproduce:full` to add the DeepSeek Harness vendored implementation and the keyless, no-network AgentLoop assembly. Bootstrap refuses initialized submodules that are dirty or at the wrong commit; it never resets user work.

Detailed commands and release packaging are in [Reproduction](docs/reproduce.md). Current bounded results and interpretation limits are in [Results](docs/results.md).

## Evidence boundary

Passing results mean that the locked revisions satisfy the checked properties in the finite TLA+ configurations and captured traces. They are not an unconditional proof about every JavaScript plugin, arbitrary external side effects, every scheduler, or unbounded execution. Finite traces provide safety, quiescence, and bounded-step evidence; they do not by themselves prove infinite-horizon liveness.
