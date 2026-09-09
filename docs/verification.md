# Confirmed verification

English | [中文](verification.zh-CN.md)

Each implementation runs the three direct behavior checks below, and all pass. The [generated report](verification-report.json) is preserved from a [successful CI run](https://github.com/Stool233/cordis-formal-study/actions/runs/34381782064) and records the exact source, checker, runtime, and dependency lock. [Paper reading](paper.md) provides their paper basis.

## What each check asserts

| Check | Input and assertion |
| --- | --- |
| `dependent-cleanup-before-provider-release` | A consumer binds a provider resource. After provider disposal starts, asynchronous consumer cleanup still sees the resource available; the provider release event follows. |
| `retiring-dependent-remains-discoverable` | A barrier pauses consumer cleanup during whole-root shutdown. Disposal has started, but the registry still contains the consumer and the resource stays available. Releasing the barrier allows both to be removed. |
| `replacement-provider-has-distinct-identity` | Two successive providers supply the same object. The consumer activates twice and reads the same value, but observes distinct provider fibers, with cleanup for each binding. |

Each check also confirms that the registry is empty afterward. An assertion failure, timeout, source-tree mismatch, or missing check fails the command. A successful aggregate is generated only after both implementations pass completely.

## Meaning of a pass

The evidence supports the pinned forks' behavior at these inputs and observation points. Registry checks verify an implementation condition for cleanup ordering; they do not identify JavaScript fields directly with paper states.

These are implementation regression results, not formal proofs of general recovery, progress, confluence, or the complete paper calculus. Reports fix the evidence kind as `implementation-behavior-regression` and record `paperTheorems: not-proved-by-these-checks`.

## Automated checks

[Current verification](../.github/workflows/current.yml) runs on main pushes, pull requests, and manual dispatch. It checks pins and documentation, executes all six implementation checks, and uploads JSON reports. This is the only workflow maintained on the mainline.

The report validator also has negative tests: missing, duplicate, and failed results, or changed source, checker, and dependency pins must be rejected. See [Reproduction](reproduce.md) for commands.
