# Cordis：TLC 发现的问题与修复

[English](README.md) | 中文

本项目通过 TLC 流程发现 Cordis 及 DeepSeek Harness 内置 Cordis 的生命周期缺陷，并验证相应修复。当前阅读对象是 [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1)；[版本锁](current.lock.json)明确记录上游基线和包含修复的 fork 实现。

## 我们确认的贡献

| 发现 | 实际问题 | 修复 |
| --- | --- | --- |
| 等待依赖方清理 | 已绑定的 consumer 仍在卸载，provider 就开始回收资源 | Provider 恢复副作用前，等待已通知的 dependent 完成清理 |
| 保留正在退出的 consumer | 并发销毁根节点时，正在卸载的 consumer 过早从运行时列表移除，provider 的等待因此漏掉它 | Consumer 清理结束前保持可发现性 |

这是两个相关的实现缺陷，均在两份实现中复现。每份实现的三个拆卸场景提供证据。[贡献说明](docs/contributions.zh-CN.md)串起具体事件、TLC 反例、源码修复和复验结果。

## 从这里开始

1. [发现与修复](docs/contributions.zh-CN.md)：我们的 TLC 流程实际发现了什么。
2. [当前论文](docs/paper.zh-CN.md)与[当前实现](docs/implementation.zh-CN.md)：相关规则和被检查的源码。
3. [验证证据](docs/verification.zh-CN.md)：上游轨迹被拒绝、修复轨迹被接受，以及负向对照。
4. [复现方法](docs/reproduce.zh-CN.md)：重放证据，或从源码重新生成修复后的轨迹。

## 仓库分工与范围

本入口仓库维护模型、原始轨迹、工具版本、复现命令和报告。[Cordis fork](https://github.com/Stool233/cordis) 与 [Harness fork](https://github.com/Stool233/deepseek-harness) 的 `codex/upstream-alignment-2026-09-09` 分支承载修复；默认分支提供上游源码和阅读入口。

普通行为回归是 TLC 证据的补充。测试通过、人工变异被拒绝、其他历史轨迹不匹配，都不单独算作新的缺陷发现。这些选定证据也不构成整篇论文演算的证明。

[归档](archive/README.zh-CN.md)保留范围更广的历史主张和实验过程；已确认的贡献及可执行证据继续保留在主线。本项目是独立研究，不代表 Cordis 或 DeepSeek 的官方保证。
