# Reproducible formal tools

English | [中文](README.zh-CN.md)

Formal commands select JARs from this checkout by the SHA-256 values in the version locks. The checkout supplies every TLC and Community Modules file needed at runtime.

## Bundled artifacts

| Use | Artifact | SHA-256 prefix |
| --- | --- | --- |
| Observation kit compatibility check | TLC, built 2026-08-11 | `ab323b79802a` |
| TLC contribution replay and upstream alignment | TLC, built 2026-09-04 | `b658b4e504fd` |
| Both toolchains | Community Modules `202505152026` | `044e8ecdfbca` |

[artifacts.json](artifacts.json) records full hashes, byte sizes, upstream build commits, original URLs, and recovery provenance. The three JARs occupy about 13.2 MiB and are stored as ordinary Git files.

The August TLC build was recovered from [successful CI run 31922162491](https://github.com/Stool233/cordis-formal-study/actions/runs/31922162491), artifact `9256716215`. Both copies in that artifact match the original study hash. The September build and Community Modules came from local copies matching their locks. Runtime commands use the copies committed here.

## Selection and verification

[toolchain.mjs](../scripts/lib/toolchain.mjs) matches the tool name, version, and full hash against the selected lock, then verifies the file bytes. It passes absolute paths to the observation kit through:

```text
CORDIS_TLA_TOOLS_JAR
CORDIS_TLA_COMMUNITY_JAR
```

The kit checks the hashes again before running Java. Each bundled filename contains its full hash. Explicit environment overrides must also match the selected hash; a missing, corrupted, or different version of the file stops the run. Restore the matching artifact from Git to resolve such a failure.

TLC contribution replay and Upstream alignment use this resolver, including for the Harness subprocess. Set the same variables when invoking an old fork's runner directly. Installing dependencies and fetching source require network access when local copies are unavailable.

## Checks

```sh
npm test
npm run test:tools
npm run verify
```

`npm test` checks tool selection, invalid files, overrides, and manifest validation. `test:tools` requires Java 21. It disables fetch in the kit process, writes incorrect bytes to legacy cache filenames, parses all five modules with each toolchain, and runs a TLC model with two states. Upstream alignment runs this check before generating traces. `verify` hashes every bundled artifact.

## Updating a tool

1. Acquire the intended build and verify its digest, metadata, and notices. Save it under its full SHA-256 filename and record its provenance in `artifacts.json`.
2. Update the intended experiment's tool version and hash. Keep artifacts referenced by existing locks.
3. Run the offline checks and the affected experiment's model, trace, mutation, and behavior checks. Review the results, then commit the artifact and lock together.

The upstream [`v1.8.0` publishing workflow](https://github.com/tlaplus/tlaplus/blob/master/.github/workflows/main.yml) replaces assets under the same tag. Select a build by the full hash recorded in the manifest.

## Licenses

The repository preserves the original JAR bytes and embedded notices. It also includes copies of the [TLA+ MIT license](licenses/tlaplus-MIT.txt), [Community Modules license](licenses/CommunityModules-LICENSE), [Commons Math license](licenses/tlaplus-CommonsMath-LICENSE.txt), [Commons Math notice](licenses/tlaplus-CommonsMath-NOTICE.txt), [JLine notice](licenses/tlaplus-jline-LICENSE.txt), [EPL-2.0 license](licenses/tlaplus-META-INF-LICENSE.md), and [TLA+ notice](licenses/tlaplus-License.txt). Each bundled component retains its original license.
