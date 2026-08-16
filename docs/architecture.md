# Architecture

English | [中文](architecture.zh-CN.md)

## Ownership

The study has one executable-specification authority: [the locked Cordis `formal/` directory](https://github.com/Stool233/cordis/tree/23f5e7d6e4a0cf451567dad1caad7b4049df6992/formal). The portal does not copy TLA+ modules. It owns source pinning, integrity checks, orchestration, bilingual explanation, and release evidence packaging.

```text
Cordis paper ───────> Cordis TLA+ abstract machines ───────> bounded TLC reports
                              ▲
                              │ complete post-state refinement
                              │
upstream Cordis ── trace sink ┤
vendored Cordis ── trace sink ┘

declared theorem premises ─────────────────────────────────> applicability report
```

DeepSeek Harness carries only its implementation-side trace hook, vendored hardening, extra scenarios, and a runner that consumes the pinned Cordis kit. [Specula](https://github.com/specula-org/Specula) is referenced only for implementation instrumentation, trace generation and validation, TLC feedback, and mismatch debugging; it is not the source of Cordis properties or invariants. The [etcd/raft trace-validation precedent](method.md#why-trace-validation) remains the concrete engineering starting point. Neither is a build dependency.

## Source topology

The three entries under `sources/` are git submodules. Their committed gitlinks must equal the full revisions in [`study.lock.json`](../study.lock.json):

- `sources/cordis` comes from the personal fork because it contains the authoritative formalization and implementation fixes;
- `sources/paper` comes directly from the upstream English-paper repository;
- `sources/deepseek-harness` comes from the personal fork because it contains the vendored trace hook and conformance scenarios.

The lock also records each upstream baseline and the mapping from the original research commit to its Stool233-authored replacement. This preserves provenance without presenting rewritten personal-fork history as an upstream commit.

## Evidence flow

The PR profile first runs schema and source integrity checks, then the Cordis syntax check, bounded models, observation coverage, upstream traces, and four mutations. Full conformance adds the vendored implementation and an offline AgentLoop assembly. The nightly profile expands model constants and adds simulation only when a completed BFS has insufficient diameter.

Each implementation scenario is recorded twice in distinct temporary roots. The two file trees must be byte-identical before one is copied to the requested output root. `CordisTrace.tla` then consumes every line with a cursor. A passing aggregate result requires a non-empty trace, complete consumption, and `pass` for every required property.

Negative premise scenarios are separate. Cyclic dependencies, non-independent effects, and non-total provision must report exactly the expected `not-applicable` result. They are not failed positive scenarios and cannot be counted as passes.

## Portable report interface

`cordis.paper-*-report/v1` and `cordis.paper-failure/v1` references are normalized POSIX paths relative to the evidence output root. Absolute Unix, macOS, Windows, or UNC paths are rejected throughout JSON and NDJSON. Failure commands replace local directories with `${OUTPUT}`, `${FORMAL_ROOT}`, `${IMPLEMENTATION_ROOT}`, and `${TOOL_CACHE}`.

Release packaging selects only JSON and NDJSON evidence, source provenance, the study lock, and a content manifest. It excludes JARs, dependency installations, TLC metadirectories, PDFs, and machine paths. The tar/gzip writer normalizes entry order, metadata, ownership, modes, and timestamps so equivalent evidence creates the same bytes.

## Integrity gates

`npm run verify` checks the JSON Schema, every gitlink/lock equality, initialized submodules and their exact clean HEADs, paper hash, personal-fork commit identity, tool hashes, source observation/scenario counts, bilingual documents, local links, license boundaries, and any evidence directories already present. `npm run verify -- --full` additionally requires DeepSeek Harness to be initialized and checks its Cordis pin and source inventory; CI uses this full form.

Bootstrap never repairs an initialized submodule. A dirty worktree or mismatched HEAD is an error, because resetting it could destroy work and would hide a provenance mismatch. Only an uninitialized submodule is initialized from the committed gitlink.
