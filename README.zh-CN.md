# Cordis 形式化研究

[English](README.md) | 中文

> **研究状态——早期进行中。** 完整 TLA+ 规格、论文定理映射和 refinement 规则仍需人工审阅与独立复核。

这是一个独立、非官方、可复现的研究门户，用来研究 Cordis 论文、上游实现，以及 DeepSeek Harness 使用的 vendored Cordis。研究把 TLA+ 有界模型检查、确定性实现轨迹验证和定理前提显式审计组合成一条证据链。

唯一权威的可执行规格仍位于[固定 revision 的 Cordis `formal/` 目录](https://github.com/Stool233/cordis/tree/fe45fb4d1e89fd6c8ae24399f601a3da9356da8a/formal)。本门户负责固定并解释源码版本、运行证据流程和打包可移植结果，不复制或分叉规格。

## 研究背景

本研究受 [etcd/raft PR #113「TLA+ Trace validation」](https://github.com/etcd-io/raft/pull/113) 启发。该实践将两类相互衔接的检查结合起来：由 TLC 检查算法模型，再通过执行轨迹检查实现是否遵循模型，从而建立形式化规格与实际代码之间的一致性证据。

[Specula](https://github.com/specula-org/Specula) 提供了一套从代码分析、规格生成和实现插桩，到轨迹验证、模型检查和缺陷确认的自动化流程。其完整流程会从系统代码及相关工程材料中推断不变量并生成代码忠实的 TLA+ 规格；[Murat Demirbas 对 Specula 的评论](https://muratbuffalo.blogspot.com/2026/08/specula-scaling-formal-specifications.html)指出，由实现归纳出的模型不能单独充当判断同一实现是否符合预期语义的独立依据。本研究有意采用不同的规格来源：Cordis 论文中的定义、引理和定理决定待检查的抽象性质，Cordis 与 DeepSeek Harness 中的实现仅作为验证对象。我们主要借鉴 Specula 的实现插桩、轨迹生成、TLA+ 轨迹验证，以及 TLC 驱动的检查与反例定位方法。

具体而言：

- 以 Cordis 论文规格为优先来源，由 TLC 在有限边界内探索生命周期、恢复、解析、进展和合流抽象状态机；
- Cordis 仅在测试时输出确定性 NDJSON 观测，使用逻辑序号并携带完整抽象后状态；
- refinement mapping 只允许明确列举且有界的 silent step 或实现步骤合并；
- 上游 Cordis 与 DeepSeek Harness vendored Cordis 运行同一套一致性场景和语义 mutation；
- 有限轨迹无法建立的前提单独审计；前提为假时报告 `not-applicable`，不得伪装成通过。

详细方法与适配选择见[方法](docs/method.zh-CN.md)，证据流见[架构](docs/architecture.zh-CN.md)。

## 三分支隔离

现在两个实现仓库都将观测、修复验证和上游评审三个关注点分开保存：

| 变体 | Cordis | DeepSeek Harness | 用途 |
| --- | --- | --- | --- |
| 仅轨迹基线 | [`6626624`](https://github.com/Stool233/cordis/tree/66266245a8dbbaf26f0b9ace45d320edce700eda) | [`cdbe25a`](https://github.com/Stool233/deepseek-harness/tree/cdbe25a0a62096ddb57af3e7e1c98b6a352fcbdd) | 在不修改运行时逻辑的前提下加入确定性轨迹观测和预期失败检查。 |
| 轨迹加修复 | [`fe45fb4`](https://github.com/Stool233/cordis/tree/fe45fb4d1e89fd6c8ae24399f601a3da9356da8a) | [`7797ad8`](https://github.com/Stool233/deepseek-harness/tree/7797ad835a239bf5b8a229f2eb1d5cf7d8e4c773) | 应用修复，并要求 TLC 轨迹、普通回归、前提审计和 mutations 全部通过；门户固定这一对源码。 |
| 仅逻辑修复 | [`3120ba9`](https://github.com/Stool233/cordis/tree/3120ba9928bd5fe37e34f50e521077121000f050) | [`6bb3cdd`](https://github.com/Stool233/deepseek-harness/tree/6bb3cdd9ca9b5dcb1019a6a9caf0307ef89c27f3) | 只包含运行时修复和普通测试，不含 trace sink 或 formal runner，供后续向上游提议改动。 |

仅轨迹基线目前把 Cordis 的 9 个受影响场景和 vendored 版本的 10 个受影响场景记录为预期 mismatch。它们是同一底层偏差在不同场景中的表现，并不表示发现了 9 个或 10 个独立缺陷。“仅逻辑修复”分支按设计不能直接生成轨迹 refinement 证据；相同修复也存在于“轨迹加修复”分支中，并已在那里通过形式化检查。

## 固定的源码快照

| 来源 | 角色 | 固定 revision |
| --- | --- | --- |
| [`Stool233/cordis`](https://github.com/Stool233/cordis/tree/fe45fb4d1e89fd6c8ae24399f601a3da9356da8a) | 权威 TLA+ 工具包和上游实现 | `fe45fb4d1e89fd6c8ae24399f601a3da9356da8a` |
| [`cordiverse/paper`](https://github.com/cordiverse/paper/tree/948a07b369c62adb3b12e102458be5c18dfb69b9) | 英文论文 | `948a07b369c62adb3b12e102458be5c18dfb69b9` |
| [`Stool233/deepseek-harness`](https://github.com/Stool233/deepseek-harness/tree/7797ad835a239bf5b8a229f2eb1d5cf7d8e4c773) | vendored Cordis 与离线 AgentLoop 验证目标 | `7797ad835a239bf5b8a229f2eb1d5cf7d8e4c773` |

[`study.lock.json`](study.lock.json) 是机器可读的事实来源。它记录上游基线、个人 fork revision、论文、依赖锁与工具链哈希、场景数、required properties、mutations 和 observation points；git submodule 链接提供与之匹配且可直接浏览的源码快照。

## 快速开始

环境要求为 Node.js 24 和 Java 21。TLA+ Tools 与 CommunityModules 会按需下载，并按照 lock 中的哈希验证。

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm run bootstrap:core
npm run verify
npm run reproduce:core
```

运行 `npm run bootstrap:full` 和 `npm run reproduce:full` 可加入 DeepSeek Harness vendored 实现，以及不需要密钥、不访问网络的最小 AgentLoop 装配。bootstrap 遇到已经初始化但 dirty 或 HEAD 错误的 submodule 会直接失败，绝不会 reset 用户工作。

完整命令和 Release 证据打包方式见[复现指南](docs/reproduce.zh-CN.md)，当前有限验证结果和解释边界见[结果](docs/results.zh-CN.md)。

## 验证在哪里运行

可执行规格位于 Cordis，但跨仓端到端验证的主要 CI 入口是本门户的 **Conformance** workflow。它可手动触发，也会在相关 pull request 和 `main` 的相关 push 上运行，然后用锁定的“轨迹加修复”源码对执行 `npm run reproduce:full`。**Integrity** 在每次 push 和 pull request 上运行，但不执行 TLC。**Nightly** 在每周一 03:17 UTC 定时运行，也可手动触发，并加入扩大后的模型 profile。

Cordis 仓库还会在相关 pull request 和其 `main` push 上执行 PR profile formal workflow；DeepSeek Harness 会在 pull request 中执行 vendored conformance job。因此，仅向 research 分支 push 并不等于触发了 Release 级跨仓验证；主入口仍是门户 workflow。精确的事件与命令对应关系见[复现指南](docs/reproduce.zh-CN.md#ci-触发映射)。

## 证据边界

通过表示固定 revision 在所检查的有限 TLA+ 配置和已采集轨迹中满足目标性质。它不是对任意 JavaScript 插件、任意外部副作用、全部调度或无界执行的无条件证明。有限轨迹可以提供安全性、quiescence 和步数上界证据，但不能单独证明无限时域活性。
