# Architecture

English | [中文](architecture.zh-CN.md)

## Ownership and evidence flow

The study has one executable-specification authority: [the `formal/` directory at the Cordis conformance revision](https://github.com/Stool233/cordis/tree/112f71c2ecba8dc3b39d7e3f4c25834f0ef9337b/formal). The portal does not copy TLA+ modules. It owns version pinning, stage checkouts, orchestration, report validation, documentation, and Release packaging.

```text
Cordis paper ──> paper-driven TLA+ machines ──> bounded TLC model reports
                           ▲
                           │ complete post-state refinement
                           │
baseline implementation ─ trace ──> locked counterexample set
conformance implementation trace ──> all accepted + mutations rejected

same logic fixes ───────────────────> upstream-fix ordinary gates (formalStatus: not-run)
explicit paper premises ────────────> pass or exact not-applicable
```

Properties flow from paper to specification, which then judges implementations. DeepSeek Harness contributes only the vendored implementation, extra scenarios, and a runner consuming the Cordis kit. Specula contributes only trace-instrumentation, validation, and debugging references.

## Source and stage topology

The three gitlinks under `sources/` provide browsable snapshots:

- `sources/cordis` pins conformance Cordis `112f71c2…`;
- `sources/paper` pins upstream English paper `948a07b3…`;
- `sources/deepseek-harness` pins conformance DeepSeek Harness `8a85249f…`.

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

## Report interfaces

The paper kit continues to use `cordis.paper-trace/v1`, `cordis.paper-*-report/v1`, and `cordis.paper-failure/v1`. The portal adds:

- `cordis.formal-study-ordinary-gates/v1` for upstream-fix commands, instrumentation absence, and stage-two rationale;
- `cordis.formal-study-report/v1` to aggregate the three ordered stages, SHAs, statuses, counts, and report references.

Every JSON/NDJSON reference is a normalized POSIX path relative to `.artifacts` or its evidence output root. Absolute Unix, macOS, Windows, and UNC paths are rejected. `.artifacts/study-report.md` is a reader summary generated from the same aggregate data.

## Integrity and CI

`npm run verify` checks lock schemas, stage order and revision mapping, gitlinks, clean submodules and stage checkouts, paper hash, personal commit identity, Cordis/DSH pins, observation/scenario inventories, report paths, and bilingual links. If stage evidence exists, verify revalidates its semantics.

The Integrity workflow runs no TLC. Conformance runs one manually selected stage or defaults to the full study on pull requests and relevant `main` pushes. Nightly runs all three stages before expanding the model on the conformance Cordis checkout. Release reruns and packages evidence from the same locked sources.

## Release selection boundary

The archive allowlists baseline JSON/NDJSON counterexamples, conformance models/traces/mutations, upstream-fix ordinary reports, nightly evidence, aggregate reports, the lock, and Cordis provenance. It excludes `.artifacts/checkouts`, bare caches, `node_modules`, JARs, TLC metadirectories, PDFs, and machine paths. The manifest must cover payloads from all three stages and nightly; `SHA256SUMS` covers the final gzip.
