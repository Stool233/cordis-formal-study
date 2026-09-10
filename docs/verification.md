# Verification of our contributions

English | [中文](verification.zh-CN.md)

TLC checks three teardown scenarios per implementation for the [two defects](contributions.md). It rejects the traces before the fix and accepts those after the fix. [contributions.lock.json](../contributions.lock.json) records each trace's source revision and SHA-256.

The [report](contribution-report.json) comes from [CI that regenerates traces from source](https://github.com/Stool233/cordis-formal-study/actions/runs/34390459029). It lists the executed models and results. [CI that replays captured traces](https://github.com/Stool233/cordis-formal-study/actions/runs/34390459101) produces the same outcomes.

## What TLC checks

| Check | Before, per implementation | Fixed, per implementation |
| --- | --- | --- |
| `provider-consumer-reverse-exit` | rejected | accepted |
| `async-consumer-teardown-guard` | rejected | accepted |
| `concurrent-root-teardown-guard` | rejected | accepted |
| Synthetic control that starts provider recovery early | — | rejected, as intended |

Each captured scenario runs through two models. [CordisTrace](../formal/CordisTrace.tla) checks the observed event transitions and imposes `Active ⇒ target = committed`, a condition stronger than the current paper requires. [TeardownOrder](../formal/TeardownOrder.tla) checks the unload guard: when provider recovery starts, a consumer still committed to that provider must be inactive.

The six upstream traces violate this guard; all six fixed traces satisfy it and complete replay. Two synthetic traces that start recovery early must violate the same invariant. The runner requires that specific violation to confirm the ordering defect. Parser errors, incorrect tool bytes, timeouts, or a different invariant violation fail the run. CI uploads the counterexamples and logs.

`TraceMatched` means that the recorded events satisfy the original checker's predicates through the end of the trace. The guard check identifies the recovery event responsible for the ordering failure. These results concern the recorded executions under the two model definitions.

## Replaying and generating traces

The committed captures before the fix come from diagnostics on official Cordis `f8ea3cd` and Harness `5dda764`. Captures after the fix come from [alignment CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34315660644) on `18c327f` and `fdcd1ce`. Each capture records its origin. Replay runs TLC on these committed files.

`reproduce:alignment` executes the fixed source in isolated checkouts with trace instrumentation. It verifies the observer patches, generates traces, and requires the selected traces to match the committed captures before running the contribution checks. The command also runs the observation kit's broader model, trace, and mutation diagnostics.

## Supporting regressions

The [checks without instrumentation](../checks/lifecycle.mjs) test resource availability, consumer discoverability during paused cleanup, and provider identity. Both implementations pass all three. The [behavior report](verification-report.json) from [behavior CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34390458869) records source trees and checker hashes. These regressions exercise the repairs and related service behavior.

## CI and reproducibility

[TLC contributions](../.github/workflows/contributions.yml) replays captured traces and controls on pushes and pull requests. [Current verification](../.github/workflows/current.yml) executes the checks without instrumentation. [Upstream alignment](../.github/workflows/upstream-alignment.yml) generates traces from the fixed source when formal inputs or the runner change, and supports manual dispatch.

TLC and Community Modules are [stored in the repository by content hash](../tools/README.md), with their licenses. Every formal entry point verifies and uses those local bytes. [Reproduction](reproduce.md) gives the commands and the steps for updating versions.
