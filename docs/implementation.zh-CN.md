# 当前实现

[English](implementation.md) | 中文

[版本锁](../current.lock.json)选定包含生命周期修复的 fork 提交，并记录它们基于的官方提交。

## 到哪里看代码

| 实现 | 检查的 fork 提交 | 官方基线 | 源码入口 |
| --- | --- | --- | --- |
| Cordis | [18c327f](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579) | [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c) | [packages/core/src](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src) |
| Harness 中的 Cordis | [fdcd1ce](https://github.com/Stool233/deepseek-harness/tree/fdcd1ce36a296ab2288bf407fccba4c8fa634963) | [5dda764](https://github.com/deepseek-ai/deepseek-harness/tree/5dda764ed3aa172535a7967b06ff95d9cbfe536a) | [vendor/cordis/src](https://github.com/Stool233/deepseek-harness/tree/fdcd1ce36a296ab2288bf407fccba4c8fa634963/vendor/cordis/src) |

两个 fork 的默认分支提供官方代码与阅读入口；研究实现位于 `codex/upstream-alignment-2026-09-09`。复现读取版本锁中的完整提交 ID。

## 定位贡献对应的修复

Fiber 管理组件的激活、退出与清理。退出时，它保留 consumer 的 registry 条目，等待已通知的 dependent 完成清理，然后恢复 provider 的 effect。服务解析记录提供该服务的 fiber；新 provider 是新的绑定身份，即使它返回相同对象。

[贡献说明](contributions.zh-CN.md)解释 provider 为什么需要等待，以及 retirement 如何影响 consumer 发现。[行为检查](../checks/lifecycle.mjs)在导出的源码上执行 Context、plugin、dispose 和服务访问，并读取 provider 记录来检查身份。

## 依赖与范围

Cordis core 使用 npm 锁定的 Cosmokit；Harness 使用同一 Harness 提交中的 vendored Cosmokit。检查器与外部依赖版本由 [package-lock.json](../package-lock.json)固定。每次报告记录源码 tree、检查器哈希和依赖锁哈希。

六项行为结果覆盖每份 Cordis 实现的三个生命周期场景。[验证说明](verification.zh-CN.md)介绍 TLC 模型和证据，[复现指南](reproduce.zh-CN.md)给出运行命令。
