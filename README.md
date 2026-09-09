# Cordis: TLC findings and fixes

English | [中文](README.zh-CN.md)

This study uses TLC to expose lifecycle defects in Cordis and the Cordis implementation in DeepSeek Harness, then verifies the fixes. The active reading source is [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1); [the version lock](current.lock.json) identifies the official bases and fixed fork implementations.

## Our confirmed contributions

| Finding | Observable defect | Fix |
| --- | --- | --- |
| Wait for dependent cleanup | A provider starts resource recovery while its bound consumer is still unloading | Await notified dependents before recovering provider effects |
| Retain retiring consumers | Concurrent root disposal removes an unloading consumer from the runtime list, allowing the provider's wait to miss it | Keep the consumer discoverable until cleanup quiesces |

These are two related implementation defects, reproduced in both implementations. Three teardown scenarios per implementation provide the evidence. The [contribution guide](docs/contributions.md) connects the concrete events, TLC counterexamples, source fixes, and verification.

## Start here

1. [Findings and fixes](docs/contributions.md): what our TLC workflow actually found.
2. [Current paper](docs/paper.md) and [implementation](docs/implementation.md): the relevant rules and selected source.
3. [Verification evidence](docs/verification.md): rejected upstream traces, accepted fixed traces, and negative controls.
4. [Reproduce](docs/reproduce.md): replay the evidence or regenerate fixed traces from source.

## Repositories and scope

This portal owns the models, captured traces, tool pins, reproduction commands, and reports. The [Cordis fork](https://github.com/Stool233/cordis) and [Harness fork](https://github.com/Stool233/deepseek-harness) carry the fixes on `codex/upstream-alignment-2026-09-09`; their default branches provide official source and reading guides.

Ordinary behavior regressions supplement the TLC evidence. Passing tests, artificial mutations, and unrelated historical trace mismatches are not additional defect discoveries. The selected evidence does not prove the complete paper calculus.

The [archive](archive/README.md) preserves the broader historical claims and experiment history. The confirmed contributions and their executable evidence remain on the mainline. This is independent research, not an official Cordis or DeepSeek guarantee.
