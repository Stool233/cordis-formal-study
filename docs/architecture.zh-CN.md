# 架构

[English](architecture.md) | 中文

## 权威归属

本研究只有一个可执行规格权威：[固定 revision 的 Cordis `formal/` 目录](https://github.com/Stool233/cordis/tree/23f5e7d6e4a0cf451567dad1caad7b4049df6992/formal)。门户不复制 TLA+ 模块，只负责源码固定、完整性检查、运行编排、双语解释和 Release 证据打包。

```text
Cordis 论文 ───────> Cordis TLA+ 抽象机器 ───────> 有界 TLC 报告
                            ▲
                            │ 完整后状态 refinement
                            │
上游 Cordis ── trace sink ──┤
vendored Cordis ─ trace sink ┘

显式定理前提 ───────────────────────────────────> 适用性报告
```

DeepSeek Harness 只携带实现侧 trace hook、vendored 加固、额外场景，以及消费固定 Cordis 工具包的 runner。[Specula](https://github.com/specula-org/Specula) 在这里仅作为实现插桩、轨迹生成与验证、TLC 反馈和 mismatch 调试的参考，不是 Cordis 性质或不变量的来源。[etcd/raft 轨迹验证先例](method.zh-CN.md#为什么需要轨迹验证)仍是具体工程起点。两者都不是构建依赖。

## 源码拓扑

`sources/` 下三个目录都是 git submodule。其已提交 gitlink 必须等于 [`study.lock.json`](../study.lock.json) 中的完整 revision：

- `sources/cordis` 来自个人 fork，因为其中包含权威形式化规格和实现修复；
- `sources/paper` 直接来自上游英文论文仓库；
- `sources/deepseek-harness` 来自个人 fork，因为其中包含 vendored trace hook 和一致性场景。

lock 还记录每个上游 baseline，以及原始研究提交到 Stool233 身份重写提交的映射。这样既保留来源，也不会把个人 fork 的重写历史描述成上游原 commit。

## 证据流

PR profile 先运行 schema 和源码完整性检查，再运行 Cordis 语法检查、有界模型、观测覆盖、上游轨迹和四个 mutations。full conformance 增加 vendored 实现和离线 AgentLoop 装配。nightly profile 扩大模型常量，仅在完整 BFS 直径不足时补充 simulation。

每个实现场景会在两个不同临时根中分别记录。两棵文件树必须逐字节相同，之后才会把其中一份复制到指定 output root。`CordisTrace.tla` 随后用游标消费每一行。聚合结果要通过，轨迹必须非空、被完整消费，而且所有 required property 都是 `pass`。

负前提场景独立处理。循环依赖、非独立 effects 和非 total provision 必须精确报告预期的 `not-applicable`。它们不是失败的正向场景，也不能被计为 pass。

## 可移植报告接口

`cordis.paper-*-report/v1` 与 `cordis.paper-failure/v1` 中的引用，必须是相对于 evidence output root 的规范化 POSIX 路径。全部 JSON 和 NDJSON 都拒绝 Unix、macOS、Windows 或 UNC 绝对路径。失败命令用 `${OUTPUT}`、`${FORMAL_ROOT}`、`${IMPLEMENTATION_ROOT}` 和 `${TOOL_CACHE}` 替换本机目录。

Release 打包只选择 JSON/NDJSON 证据、源码 provenance、study lock 和内容 manifest；JAR、依赖安装、TLC metadir、PDF 和本机路径全部排除。tar/gzip writer 会规范化条目顺序、元数据、owner、mode 和时间戳，使等价证据生成相同字节。

## 完整性门禁

`npm run verify` 检查 JSON Schema、全部 gitlink/lock 相等、已初始化 submodule 的精确 clean HEAD、论文哈希、个人 fork 提交身份、工具哈希、源码观测点/场景数量、双语文档、本地链接、许可证边界，以及已经存在的任何证据目录。`npm run verify -- --full` 还要求 DeepSeek Harness 已初始化，并检查其 Cordis pin 与源码清单；CI 使用 full 形式。

bootstrap 绝不会修复已经初始化的 submodule。dirty worktree 或错误 HEAD 会直接报错，因为 reset 可能破坏用户工作，也会掩盖 provenance 不一致。只有尚未初始化的 submodule 才会按照已提交 gitlink 初始化。
