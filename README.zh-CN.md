# Cordis：TLC 发现的问题与修复

[English](README.md) | 中文

我们通过 TLC 发现了 Cordis 及 DeepSeek Harness 内置 Cordis 的两个生命周期缺陷。本仓库记录反例、修复和验证结果。研究依据 [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1)，检查的实现版本见 [current.lock.json](current.lock.json)。

## 我们的贡献

| 问题 | 修复 |
| --- | --- |
| 已绑定的 consumer 仍在卸载，provider 就开始回收资源 | Provider 恢复副作用前，等待已通知的 dependent 完成清理 |
| 并发销毁根节点时，正在卸载的 consumer 过早移出运行时列表，provider 的等待因此漏掉它 | Consumer 清理结束后再移出列表 |

两个缺陷均出现在两份实现中，每份实现用三个拆卸场景复现。[贡献说明](docs/contributions.zh-CN.md)展示违规事件和对应的源码修复。

## 从这里开始

1. [发现与修复](docs/contributions.zh-CN.md)：查看通过 TLC 发现的问题。
2. [当前论文](docs/paper.zh-CN.md)与[当前实现](docs/implementation.zh-CN.md)：阅读清理规则，定位源码。
3. [验证说明](docs/verification.zh-CN.md)：查看轨迹、反例和结果。
4. [复现方法](docs/reproduce.zh-CN.md)：重放证据，或从修复源码生成轨迹。

## 仓库分工

本仓库保存模型、观测轨迹、工具版本、复现命令和报告。[Cordis fork](https://github.com/Stool233/cordis) 与 [Harness fork](https://github.com/Stool233/deepseek-harness) 的 `codex/upstream-alignment-2026-09-09` 分支包含修复，默认分支提供上游源码和阅读指南。

研究结论适用于记录的场景及其声明的依赖绑定。行为回归检查资源可用性、registry 成员身份和 provider 身份。[归档](archive/README.zh-CN.md)保存此前的主张、审阅和实验。
