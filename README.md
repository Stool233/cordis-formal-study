# Cordis: paper and implementation

English | [中文](README.zh-CN.md)

This project explains how Cordis manages plugin dependencies and cleanup, and checks these behaviors in Cordis and DeepSeek Harness. The reading source is [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1); the checked implementations are two pinned forks.

## Start here

1. [Three requirements from the paper](docs/paper.md): understand dependencies, cleanup order, and provider identity.
2. [Current implementation](docs/implementation.md): locate the code and distinguish the official bases from the checked forks.
3. [Confirmed verification](docs/verification.md): see the checks, results, and their scope.
4. [Run the checks](docs/reproduce.md): run the same check set against both implementations with one command.

## What is confirmed

| Behavior | Cordis fork | Cordis in the Harness fork |
| --- | --- | --- |
| A provider releases its resource after its bound consumer finishes asynchronous cleanup | pass | pass |
| A consumer remains discoverable in the registry during cleanup and is removed afterward | pass | pass |
| A replacement provider triggers a new consumer binding even when it provides the same object | pass | pass |

These six results are concrete implementation regression checks. [Verification](docs/verification.md) explains their paper basis and scope; they do not prove every paper theorem or arbitrary plugin behavior.

## Repositories

| Repository | Contents |
| --- | --- |
| This portal | Paper reading, version lock, shared checks, and reports |
| [Cordis fork](https://github.com/Stool233/cordis) | Framework source and lifecycle fixes |
| [Harness fork](https://github.com/Stool233/deepseek-harness) | Harness source and its Cordis implementation |

[current.lock.json](current.lock.json) records the paper version, implementation commits, and check inventory. The [historical archive](archive/README.md) separately preserves earlier claims, models, tools, and evidence.

This is independent research and does not represent an official Cordis or DeepSeek guarantee.
