# Reproduction

English | [中文](reproduce.zh-CN.md)

## Requirements

- Git with submodule support
- Node.js 24 with Corepack
- Java 21
- network access for initial source, npm, pnpm, Yarn, TLA+ Tools, and CommunityModules downloads

The TLA+ runner fixes Tools 1.8.0 and CommunityModules `202505152026` by SHA-256. JARs remain in a local cache and are never committed or included in a release asset.

## Clone and verify

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm ci
npm run bootstrap:core
npm run verify
```

`bootstrap:core` initializes Cordis and the paper, verifies their gitlinks and HEADs, and runs Cordis's immutable Yarn install. Because the source repository does not track its generated `yarn.lock`, the portal verifies [`locks/cordis.yarn.lock`](../locks/cordis.yarn.lock), materializes it only while a Cordis install or evidence command needs Yarn, and removes that temporary copy afterward. A pre-existing identical lock is preserved; different content is rejected rather than overwritten. `bootstrap:full` also initializes DeepSeek Harness and runs its frozen pnpm install.

After a core bootstrap, `npm run verify` checks every committed gitlink and the initialized core source set; DeepSeek Harness content checks are deferred when that submodule is intentionally uninitialized. After a full bootstrap, use `npm run verify -- --full` to require and validate all three source trees. CI uses the full form.

An already initialized submodule must be clean and exactly at the locked commit. Bootstrap fails rather than resetting, checking out, cleaning, or overwriting it. If this check fails, inspect the submodule and preserve your work manually before retrying.

## Run evidence

```sh
npm run reproduce:core
npm run reproduce:full
npm run reproduce:nightly
```

`reproduce:core` writes the Cordis PR-profile output to `.artifacts/cordis-pr`. `reproduce:full` runs the core profile and then writes vendored/AgentLoop conformance to `.artifacts/deepseek-harness`. `reproduce:nightly` writes the expanded Cordis profile to `.artifacts/cordis-nightly`.

The AgentLoop scenario uses `mountAgentLoopTestDependencies()` and does not require an API key or provider network. It verifies assembly, dependency resolution, quiescence, and complete teardown.

Run `npm run verify` again after generation. Present evidence is checked for complete `TraceMatched`, exact scenario and premise sets, four rejected mutations, required model properties, relative paths, and matching implementation revisions.

## CI trigger map

The portal is the primary cross-repository trigger:

| Repository / workflow | Trigger | Runs TLC? | Main command |
| --- | --- | --- | --- |
| Portal / `Integrity` | Every push and pull request | No | `npm test` and `npm run verify -- --full` |
| Portal / `Conformance` | Manual dispatch; relevant pull requests; relevant pushes to `main` | Yes | `npm run reproduce:full` |
| Portal / `Nightly` | Manual dispatch; Mondays at 03:17 UTC | Yes, expanded profile | `npm run reproduce:nightly`, then `npm run reproduce:full` |
| Cordis / `Paper conformance` | Relevant pull requests; relevant pushes to Cordis `main` | Yes | `yarn formal:check --quiet` |
| Cordis / `Paper conformance nightly` | Manual dispatch; daily at 17:23 UTC once the workflow is on the default branch | Yes, expanded profile | `yarn formal:nightly --quiet` |
| DeepSeek Harness / `Cordis paper conformance` job | Pull requests only | Yes, vendored traces | `pnpm test:cordis-paper` |

The research branches are intentionally not release triggers by push alone: Cordis's PR workflow restricts push events to `main`, and the DeepSeek Harness job has a pull-request condition. In the current personal-fork layout, dispatch the portal `Conformance` workflow or change a locked source on portal `main` to run the complete validation path.

## Branch-specific checks

Use standalone checkouts when comparing variants; switching a portal submodule away from its locked conformance revision makes `npm run verify` fail by design.

- On `research/paper-trace-baseline`, Cordis runs `yarn formal:baseline --quiet`. DeepSeek Harness runs `pnpm test:cordis-paper` with `CORDIS_FORMAL_ROOT` pointing to the matching Cordis baseline checkout. Known mismatches must be reported exactly; an unexpected pass or a new failure is an error.
- On `research/paper-conformance`, Cordis runs `yarn formal:check --quiet`; DeepSeek Harness runs `pnpm test:cordis-paper` against that Cordis checkout. All required traces and four mutations must pass or be rejected as specified.
- On `fix/paper-conformance`, run the ordinary Cordis or DeepSeek Harness regression, type, lint, and documentation checks. There is no trace sink on this branch, so it does not run trace refinement directly.

## Package release evidence

After PR, nightly, and vendored evidence all exist:

```sh
npm run package -- --version 0.1.0
```

The command creates:

- `dist/cordis-formal-study-v0.1.0-evidence.tar.gz`
- `dist/SHA256SUMS`

The archive contains reports, traces, mutation counterexamples and failure metadata, provenance, the study lock, and a file manifest. It excludes dependency directories, JARs, TLC metadirectories, PDFs, and machine-local paths. Archive ordering and metadata are deterministic.

## Local Cordis override

DeepSeek Harness's source runner normally receives the portal submodule through `CORDIS_FORMAL_ROOT`. When developing a Cordis change outside this portal, the same DSH command may point to another clean checkout:

```sh
CORDIS_FORMAL_ROOT=/path/to/cordis \
  pnpm --dir sources/deepseek-harness test:cordis-paper
```

Such an override is development evidence only. A portal Release must use the locked gitlink and revision.
