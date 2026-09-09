# Reproducible formal tools

English | [中文](README.zh-CN.md)

Formal commands use JARs stored in this Git checkout and selected by the existing locks' SHA-256 values. They do not download TLC or CommunityModules at execution time. Replacing an upstream release asset, losing an Actions cache, or running without access to the release server therefore does not change the selected tools.

## Bundled artifacts

| Used by | Artifact | SHA-256 prefix |
| --- | --- | --- |
| Historical baseline, conformance, core/full, nightly, and release | TLC, built 2026-08-11 | `ab323b79802a` |
| Current upstream alignment | TLC, built 2026-09-04 | `b658b4e504fd` |
| Both toolchains | CommunityModules `202505152026` | `044e8ecdfbca` |

[artifacts.json](artifacts.json) records full hashes, byte sizes, upstream build commits, original URLs, and recovery provenance. The three JARs occupy about 13.2 MiB. They are ordinary Git files, so a checkout includes them without Git LFS, a release download, or a cache restore. The evidence release archive still excludes JARs.

The historical TLC was recovered from [an earlier successful CI run](https://github.com/Stool233/cordis-formal-study/actions/runs/31922162491), artifact `9256716215`. Both copies inside that artifact match the original study hash. The migration TLC and CommunityModules were retained locally and match their locks. That old CI artifact is a provenance reference, not a runtime dependency; its eventual expiry does not affect these bundled copies.

Neither [study.lock.json](../study.lock.json) nor [alignment.lock.json](../alignment.lock.json) was changed to accommodate the release replacements. The locked paper, models, implementation revisions, and generated historical reports also remain unchanged.

## Selection and verification

[toolchain.mjs](../scripts/lib/toolchain.mjs) chooses the artifact whose tool name, version, and complete hash match the selected lock. It verifies its bytes before passing these existing kit settings to every formal subprocess:

```text
CORDIS_TLA_TOOLS_JAR
CORDIS_TLA_COMMUNITY_JAR
```

The locked kit verifies each hash again before Java runs. The historical and alignment TLC files have different hash-based names and can coexist in one checkout; a stale `tla2tools-1.8.0.jar` in a cache is unused. Explicit environment overrides remain supported, but must match the selected hash. A missing, corrupted, or wrong-version override fails rather than falling back silently.

The portal passes this configuration through the Harness subprocess as well as direct Cordis commands. Conformance, Upstream alignment, Nightly, and Release use the same resolver. Direct invocation of an old fork's runner outside the portal still needs these settings to avoid that runner's original download path.

Dependencies and source checkout still need their usual access when not already installed; only formal-tool acquisition is made independent of the network.

## Checks

```sh
npm test
npm run test:tools
npm run verify -- --full
```

`npm test` covers lock selection, missing/corrupted files, incorrect overrides, and manifest boundaries. `test:tools` requires Java 21. It denies fetches in the actual kit process, poisons the old cache filenames, parses all five modules with each pinned toolchain, and runs a two-state TLC smoke model. Both formal CI workflows run this check before reproduction. `verify` hashes every bundled artifact and confirms that both locks are covered.

## Updating a tool deliberately

1. Acquire the intended upstream build and verify its digest, build metadata, and notices. Save it under its full SHA-256 filename and add its provenance to `artifacts.json`.
2. Update only the intended experiment's tool pin and record the migration explicitly. Preserve artifacts still used by historical locks.
3. Run the offline checks and the affected experiment's full model, trace, mutation, and ordinary gates. Review differences before committing the new artifact and pin together.

There is no automatic adoption of a new release hash. The upstream [`v1.8.0` publishing workflow](https://github.com/tlaplus/tlaplus/blob/master/.github/workflows/main.yml) deletes and replaces assets under the same tag; that URL identifies provenance, not immutable bytes.

## Licenses

The original JAR bytes and embedded notices are retained. Copies of the upstream [TLA+ MIT license](licenses/tlaplus-MIT.txt), [CommunityModules license](licenses/CommunityModules-LICENSE), and bundled [Commons Math license](licenses/tlaplus-CommonsMath-LICENSE.txt), [Commons Math notice](licenses/tlaplus-CommonsMath-NOTICE.txt), [JLine notice](licenses/tlaplus-jline-LICENSE.txt), [embedded EPL-2.0 license](licenses/tlaplus-META-INF-LICENSE.md), and [TLA+ notice](licenses/tlaplus-License.txt) accompany the artifacts. These third-party files retain their original licenses rather than the portal documentation license.
