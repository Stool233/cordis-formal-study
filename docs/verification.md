# Verification of our contributions

English | [中文](verification.zh-CN.md)

The main evidence concerns the [two TLC-discovered defects](contributions.md). For each implementation, three captured teardown scenarios are rejected before the fix and accepted after the fix. [contributions.lock.json](../contributions.lock.json) binds every trace to its source revision and SHA-256; the [report](contribution-report.json) records the executed models and results.

## What TLC checks

| Check | Before, per implementation | Fixed, per implementation |
| --- | --- | --- |
| `provider-consumer-reverse-exit` | rejected | accepted |
| `async-consumer-teardown-guard` | rejected | accepted |
| `concurrent-root-teardown-guard` | rejected | accepted |
| Synthetic early-provider-recovery control | — | rejected, as intended |

Each captured scenario runs through two models. [CordisTrace](../formal/CordisTrace.tla) preserves the original observed-trace checker unchanged. [TeardownOrder](../formal/TeardownOrder.tla) independently checks the unload guard: at a recovery-start event, a consumer still committed to that provider must be inactive. The focused model does not impose the old checker's stronger `Active ⇒ target = committed` condition.

The six upstream traces violate this focused guard; all six fixed traces satisfy it and complete replay. Two synthetic early-recovery traces must violate that exact invariant. Parser errors, wrong tool bytes, timeouts, and unrelated invariant failures cannot count as successful defect reproduction. Counterexamples and logs are uploaded with the run.

The original checker has stronger projection constraints than the current paper. Its `TraceMatched` result means the recorded events were consumed by its predicates, not that the implementation refines the entire paper kernel. The focused guard makes the contribution's specific failure reason explicit.

## Capture replay and fresh source execution

The committed before captures come from the retained diagnostics on official Cordis `f8ea3cd` and Harness `5dda764`. Fixed captures come from [successful alignment CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34315660644) on `18c327f` and `fdcd1ce`. Their origin is recorded alongside each capture. Replay runs TLC again on those recorded bytes; it does not execute source to recreate the observations.

`reproduce:alignment` regenerates the fixed implementation traces in isolated instrumented checkouts, verifies the observer patches, and compares the selected traces with the committed captures before replaying the contribution checks. It retains the broader kit's model, trace, and mutation checks as diagnostics; their counts are not additional contribution claims. The frozen kit is an implementation-observation tool, not a formalization of the full current paper.

## Supporting regressions

The [uninstrumented checks](../checks/lifecycle.mjs) exercise actual resource availability, consumer discoverability during paused cleanup, and provider identity. Both implementations pass all three; the [behavior report](verification-report.json) records source trees and checker hashes. These checks support the fixes and guard adjacent behavior. A passing test or an artificial mutant is not a new defect discovery.

## CI and reproducibility

[TLC contributions](../.github/workflows/contributions.yml) replays selected captures and controls on pushes and pull requests. [Current verification](../.github/workflows/current.yml) reruns the uninstrumented checks. [Upstream alignment](../.github/workflows/upstream-alignment.yml) regenerates fixed traces when the formal inputs or runner change, and supports manual dispatch.

TLC and Community Modules are [bundled by content hash](../tools/README.md), with licenses and strict byte checks. Rolling official release assets are not consulted by these entry points. [Reproduction](reproduce.md) gives the commands and version-update procedure.
