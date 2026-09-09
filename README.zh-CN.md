# Cordis 形式化研究

[English](README.md) | 中文

Cordis 插件的生命周期行为，是否与论文描述一致？本研究把论文导出的 TLA+ 模型与 Cordis、DeepSeek Harness 的真实执行轨迹连接起来，再验证相应的运行时修复。

先从下文了解发现。查看当前代码，请读[上游对齐报告](docs/upstream-alignment.zh-CN.md)；重跑原始实验，请读[三阶段复现指南](docs/reproduce.zh-CN.md)。

## 我们发现了什么

原实现可能在 consumer 尚未完成清理时回收 provider 资源。轨迹还暴露了被本研究较严格投影拒绝的发布状态，普通测试则发现传递激活调度问题。[arXiv 审阅](docs/arxiv-review.zh-CN.md)区分了有论文依据的顺序缺陷与投影 mismatch。

| 历史实验 | Cordis | Harness 中的 vendored Cordis |
| --- | ---: | ---: |
| 被模型拒绝的轨迹场景 | 13 条中的 9 条 | 17 条中的 10 条 |
| 失败的普通行为检查 | 4 项中的 4 项 | 4 项中的 3 项 |
| 修复后被接受的轨迹 | 13 条全部 | 17 条全部 |
| 被拒绝的语义 mutation | 4 个全部 | 4 个全部 |

这里统计的是场景，不是独立缺陷或论文定理反例的数量。[研究结果](docs/results.zh-CN.md)解释 mismatch、修复与证据。历史数字均对应 [study.lock.json](study.lock.json) 中的固定版本。

## 当前代码与历史证据

2026-09-09 的检查取得官方 Cordis `f8ea3cd` 与 Harness `5dda764`。两个 fork 各自建立了基于这些版本的迁移分支，修复与验证记录见[上游对齐](docs/upstream-alignment.zh-CN.md)。

原始三阶段快照保持不变。两份精确 TLC 构建及 CommunityModules 现已[按哈希随仓库保存](tools/README.zh-CN.md)，包括已找回的历史 JAR。形式化命令使用这些经校验的文件，官方替换 release 资产不再影响工具获取。迁移实验仍使用单独固定的工具与历史规格。

[arXiv v1 审阅](docs/arxiv-review.zh-CN.md)已完成结论与前提对齐：保留 cleanup 修复，收窄发布、恢复与合流主张；完整 arXiv 形式化验证仍标记为 `not-validated`。

## 三个阶段，三种成功含义

1. **Baseline：观察原始行为。** 保留运行逻辑，加入测试观测。成功表示精确复现已知失败。
2. **Conformance：验证修复。** 加入修正，检查模型、实现轨迹、前提、mutation 与普通回归。
3. **Upstream-fix：评审运行时补丁。** 保留逻辑修复与回归，移除研究插桩。直接形式化状态为 `not-run`，形式化证据指向第二阶段。

[复现指南](docs/reproduce.zh-CN.md)提供命令，[架构](docs/architecture.zh-CN.md)记录分支、源码归属与报告。

## 三个仓库如何分工

| 仓库 | 在哪里找到什么 |
| --- | --- |
| **本研究门户** | 研究发现、精确版本、复现命令与跨仓报告。 |
| [Cordis fork](https://github.com/Stool233/cordis) | 框架实现、迁移后的生命周期修复，以及 conformance 分支上的固定可执行规格。 |
| [Harness fork](https://github.com/Stool233/deepseek-harness) | Vendored Cordis，以及 cleanup、persistence、AgentLoop 的集成检查。 |

[Cordis 论文](https://github.com/cordiverse/paper)决定待检查的性质。[固定的 Cordis formal kit](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal)是可执行规格；门户不另行维护一套规格。

## 按目的阅读

| 你想做什么 | 打开 |
| --- | --- |
| 理解具体失败及修复 | [研究结果](docs/results.zh-CN.md) |
| 查看新版论文支持哪些研究结论 | [arXiv 审阅](docs/arxiv-review.zh-CN.md) |
| 查看当前上游与迁移后的修复 | [上游对齐](docs/upstream-alignment.zh-CN.md) |
| 自己运行检查 | [复现指南](docs/reproduce.zh-CN.md) |
| 理解模型、轨迹与适用前提 | [方法](docs/method.zh-CN.md) |
| 查找版本、runner、报告与 CI 分工 | [架构](docs/architecture.zh-CN.md) |

这是早期独立研究，不是 Cordis 或 DeepSeek 的官方保证。结果覆盖固定版本、有限模型、声明的前提与已观察的调度；任意插件副作用和无界执行不在范围内，规格与 refinement 规则仍需独立人工复核。
