# Cordis：论文与实现

[English](README.md) | 中文

本项目帮助读者理解 Cordis 如何管理插件依赖与清理，并核对这些行为在 Cordis 和 DeepSeek Harness 中的实现。阅读依据是 [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1)；检查对象是两份已锁定的 fork 实现。

## 从这里开始

1. [论文中的三个关键要求](docs/paper.zh-CN.md)：理解依赖、清理顺序与 provider 身份。
2. [当前实现](docs/implementation.zh-CN.md)：找到对应源码，区分官方基线与本次检查的 fork。
3. [已确认的验证](docs/verification.zh-CN.md)：查看检查内容、结果及适用范围。
4. [自己运行检查](docs/reproduce.zh-CN.md)：用一条命令重跑两端的同一组检查。

## 已确认什么

| 行为 | Cordis fork | Harness 中的 Cordis fork |
| --- | --- | --- |
| 已绑定 consumer 完成异步清理后，provider 才释放资源 | 通过 | 通过 |
| Consumer 正在清理时仍可被 registry 找到，清理后才移除 | 通过 | 通过 |
| 新 provider 即使提供相同对象，consumer 也重新绑定到新身份 | 通过 | 通过 |

这 6 项是具体实现的行为回归检查。论文依据与检查范围见[验证说明](docs/verification.zh-CN.md)；它们不构成论文全部定理或任意插件行为的证明。

## 仓库分工

| 仓库 | 内容 |
| --- | --- |
| 本门户 | 论文阅读、版本锁、共用检查与报告 |
| [Cordis fork](https://github.com/Stool233/cordis) | 框架源码与生命周期修复 |
| [Harness fork](https://github.com/Stool233/deepseek-harness) | Harness 源码及其使用的 Cordis |

[current.lock.json](current.lock.json)记录论文版本、实现提交和检查清单。[历史归档](archive/README.zh-CN.md)单独保存此前的研究主张、模型、工具及证据。

本项目是独立研究，不代表 Cordis 或 DeepSeek 的官方保证。
