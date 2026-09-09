# Architecture

English | [中文](architecture.zh-CN.md)

This reference maps versions, source directories, runners, and reports. Start with [Results](results.md) for the findings or [Reproduction](reproduce.md) for commands.

## Two version records

| Record | Owns | Relationship |
| --- | --- | --- |
| [study.lock.json](../study.lock.json) | Original paper, six stage commits, tools, and outcomes | Historical snapshot; unchanged. |
| [alignment.lock.json](../alignment.lock.json) | Current upstream bases, migrated candidates, observation patches, and TLC artifact | Separate current-code experiment. |

## Ownership and evidence flow

The study has one executable-specification authority: [the `formal/` directory at the Cordis conformance revision](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal). The portal does not copy TLA+ modules. It owns version pinning, stage checkouts, orchestration, report validation, documentation, and Release packaging.

```text
Cordis paper ──> paper-driven TLA+ machines ──> bounded TLC model reports
                           ▲
                           │ complete projected-state checks
                           │
baseline implementation ─ trace ──> locked counterexample set
conformance implementation trace ──> all accepted + mutations rejected

same logic fixes ───────────────────> upstream-fix ordinary gates (formalStatus: not-run)
explicit paper premises ────────────> pass or exact not-applicable
```

Properties flow from paper to specification, which then judges implementations. DeepSeek Harness contributes only the vendored implementation, extra scenarios, and a runner consuming the Cordis kit. Specula contributes only trace-instrumentation, validation, and debugging references.

The arrows describe intended provenance, not a proved simulation chain. The [arXiv audit](arxiv-review.md) identifies restrictions in the models and the separate trace machine; accepted projected states alone do not establish equivalence to the paper calculus.

## Source and stage topology

The historical branch matrix is:

| Role / branch | Cordis revision | Harness revision |
| --- | --- | --- |
| Baseline: `research/paper-trace-baseline` | [`48c4604`](https://github.com/Stool233/cordis/tree/48c4604005b80b4e4fd7706088f5b721a16ea8de) | [`59c8608`](https://github.com/Stool233/deepseek-harness/tree/59c86088a75c4afe99d28244baedaa159231c46c) |
| Conformance: `research/paper-conformance` | [`d06ee04`](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b) | [`4b00212`](https://github.com/Stool233/deepseek-harness/tree/4b00212558e33a0fee5dacb740621db16b1d43dc) |
| Upstream-fix: `fix/paper-conformance` | [`3120ba9`](https://github.com/Stool233/cordis/tree/3120ba9928bd5fe37e34f50e521077121000f050) | [`6bb3cdd`](https://github.com/Stool233/deepseek-harness/tree/6bb3cdd9ca9b5dcb1019a6a9caf0307ef89c27f3) |

The three gitlinks under `sources/` provide browsable snapshots:

- `sources/cordis` pins conformance Cordis `d06ee04a…`;
- `sources/paper` pins upstream English paper `948a07b3…`;
- `sources/deepseek-harness` pins conformance DeepSeek Harness `4b002125…`.

The full study never switches branches inside submodules. `bootstrap:study` reads six SHAs from `researchStages` and `branchMatrix`, fetches them from the personal forks, and creates detached worktrees at:

```text
.artifacts/checkouts/
├── cordis/
│   ├── <baseline-sha>/
│   ├── <conformance-sha>/
│   └── <upstream-fix-sha>/
└── deepseekHarness/
    ├── <baseline-sha>/
    ├── <conformance-sha>/
    └── <upstream-fix-sha>/
```

Bare object caches live under `.artifacts/repositories/` and never enter a Release. An existing checkout is reused only at the exact clean HEAD; wrong or dirty state fails. The Cordis dependency lock is added only for command execution and then removed so the worktree returns clean.

## Stage runners

### Baseline

The Cordis baseline runner generates 13 core traces and classifies the locked 9 as `expected-fail`. The DSH runner uses the same Cordis `CordisTrace.tla` to consume vendored traces and locks 10 mismatches among 17. The portal also parses behavior reports, requires exact 4/3 failure sets, and checks each mismatch's trace, failure metadata, and counterexample.

### Conformance

The Cordis runner performs portable-report self-tests, TLA+ syntax, PR models, 29-point source coverage, 13 traces, and 4 mutations. The DSH runner executes 17 vendored traces, mutations, and AgentLoop. The portal then runs relevant ordinary gates and validates required properties, `TraceMatched`, and negative-premise statuses.

### Upstream-fix

The portal first uses tracked-file inventory and package scripts to require the absence of research instrumentation, then runs ordinary Cordis and DSH gates. Its report references stage-two formal evidence. It invokes no `formal/` runner and cannot claim a passing `formalStatus`.

## Current migration runner

[reproduce-alignment.mjs](../scripts/reproduce-alignment.mjs) checks clean fork inputs against the alignment lock, installs dependencies, and creates separate worktrees under `.artifacts/alignment/run-<id>/`. Each observation patch is hashed before application and checked again after execution.

The runner extracts the historical Cordis kit from its pinned Git tree. It changes the TLC hash only in that copy's runner and provenance. Models, premises, and refinement rules keep their historical source. The separate [arXiv review](arxiv-review.md) has aligned conclusions and premises; migration to an executable arXiv specification remains outstanding.

The `evidence/` directory contains original behavior assertions, bounded models, trace and mutation reports, provenance, and `cordis.formal-study-alignment-report/v1`. Its aggregate identifies source trees and patch hashes. Ordinary repository checks are recorded separately in the alignment report. Current migration outputs are not inputs to the historical release packager.

## Report interfaces

The paper kit continues to use `cordis.paper-trace/v1`, `cordis.paper-*-report/v1`, and `cordis.paper-failure/v1`. The portal adds:

- `cordis.formal-study-ordinary-gates/v1` for upstream-fix commands, instrumentation absence, and stage-two rationale;
- `cordis.formal-study-report/v1` to aggregate the three ordered stages, SHAs, statuses, counts, and report references.

Every JSON/NDJSON reference is a normalized POSIX path relative to `.artifacts` or its evidence output root. Absolute Unix, macOS, Windows, and UNC paths are rejected. `.artifacts/study-report.md` is a reader summary generated from the same aggregate data.

## Integrity and CI

[Upstream alignment](../.github/workflows/upstream-alignment.yml) runs the current migration on relevant pushes, pull requests, or manual dispatch. It checks out the exact two fork candidates, runs behavior/model/trace/mutation checks, and uploads only the evidence directory. Historical Conformance, Nightly, and Release retain their original experiment. All formal entry points use [bundled artifacts](../tools/README.md), checked against the selected lock before passing their paths to the unchanged kit's own checksum verifier.

`npm run verify` checks lock schemas, stage order and revision mapping, gitlinks, clean submodules and stage checkouts, paper and bundled-tool hashes, personal commit identity, Cordis/DSH pins, observation/scenario inventories, report paths, and bilingual links. If stage evidence exists, verify revalidates its semantics.

The Integrity workflow runs no TLC. Conformance runs one manually selected stage or defaults to the full study on pull requests and relevant `main` pushes. Nightly runs all three stages before running layered exhaustive and fixed-seed sampled model bounds on the conformance Cordis checkout. Release reruns and packages evidence from the same locked sources.

## Release selection boundary

The archive allowlists baseline JSON/NDJSON counterexamples, conformance models/traces/mutations, upstream-fix ordinary reports, nightly evidence, aggregate reports, the lock, and Cordis provenance. It excludes `.artifacts/checkouts`, bare caches, `node_modules`, JARs, TLC metadirectories, PDFs, and machine paths. The manifest must cover payloads from all three stages and nightly; `SHA256SUMS` covers the final gzip.
