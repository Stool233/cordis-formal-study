# Cordis: TLC findings and fixes

English | [中文](README.zh-CN.md)

We used TLC to find two lifecycle defects in Cordis and the Cordis implementation in DeepSeek Harness. This repository records the counterexamples, fixes, and verification results. The study uses [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1) and the implementations listed in [current.lock.json](current.lock.json).

## Our contributions

| Problem | Fix |
| --- | --- |
| A provider starts resource recovery while its bound consumer is still unloading | Await notified dependents before recovering provider effects |
| Concurrent root disposal removes an unloading consumer from the runtime list, causing the provider's wait to miss it | Keep the consumer in the list until cleanup finishes |

Both defects occur in both implementations. Three teardown scenarios per implementation reproduce them. The [contribution guide](docs/contributions.md) shows the failing events and the code that repairs each problem.

## Start here

1. [Findings and fixes](docs/contributions.md): inspect the problems found through TLC.
2. [Current paper](docs/paper.md) and [implementation](docs/implementation.md): read the cleanup rules and locate the source.
3. [Verification](docs/verification.md): inspect the traces, counterexamples, and results.
4. [Reproduce](docs/reproduce.md): replay the evidence or generate traces from the fixed source.

## Repositories

This repository contains the models, captured traces, tool versions, reproduction commands, and reports. The [Cordis fork](https://github.com/Stool233/cordis) and [Harness fork](https://github.com/Stool233/deepseek-harness) carry the fixes on `codex/upstream-alignment-2026-09-09`. Their default branches provide official source and reading guides.

The findings apply to the recorded scenarios and declared dependency bindings. Behavior regressions check resource availability, registry membership, and provider identity. The [archive](archive/README.md) contains earlier claims, reviews, and experiments.
