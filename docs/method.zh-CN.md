# 方法

[English](method.md) | 中文

## 性质从哪里来

本研究先阅读 Cordis 论文，再观察代码。论文中的定义、引理和定理决定抽象状态、允许的转换和待检查的性质；`THEOREMS.md` 将论文页码、TLA+ operator、实现观测点与适用前提连接起来。代码只负责提供待解释的实现状态和轨迹，不能反过来决定用什么性质判断自己。

这一顺序避免自证循环：如果规格完全由同一实现归纳，再用它证明实现符合规格，所得结论缺少独立的语义来源。发现 mismatch 后，先判断论文模型、refinement mapping 或实现哪一层有误；只有论文依据支持时才修改规格。确认是实现偏差时，保留最小反例并修复实现。

## 三层证据

### 1. 论文抽象机器的有界模型检查

`CordisEffects.tla`、`CordisKernel.tla`、`CordisRuntime.tla` 和 `CordisConfluence.tla` 分别检查效应恢复、论文生命周期规则、实现 refinement 与多调度终态。TLC 在 PR 和 nightly 两组有限常量下检查安全不变量、死锁、排名上界和在显式公平性下的有界活性目标。

有界通过表示该配置中没有找到反例，不等于任意规模的无条件证明。nightly 扩大 fiber、binding、iteration 和注册深度；只有 BFS 完成但直径不足时才补充 simulation。

### 2. 实现轨迹 refinement

测试专用 trace sink 在 root context 内同步记录 lifecycle、target、committed view、fiber 创建/退休/移除、effect iteration landing、inverse 和 service provision/withdrawal。recorder 使用稳定逻辑 ID 和逻辑序号，不记录时间戳。每条 `cordis.paper-trace/v1` NDJSON 记录携带完整抽象后状态。

`CordisTrace.tla` 用游标逐条消费轨迹。异步 iterator launch 可以作为严格受限的 stuttering；landing 对应论文 transition。实现的多个微步骤也可以映射为一个论文步骤，但 silent 解释必须由观测事件和有限辅助状态约束。`TraceMatched` 只有在全部记录被消费、每个完整后状态匹配时才通过，不能退化为 `TRUE`。

### 3. 前提审计

`AcyclicDependencies`、`FiniteNames`、`BoundedIterator`、`PairwiseIndependent`、`TotalProvision` 和 `NoFailure` 是显式前提。有限轨迹不能自动证明所有前提，因此循环依赖、非独立 effects 和非 total provision 使用独立负场景。前提为假时，依赖性质必须报告 `not-applicable`，不能计为 pass。

## 观测完整性与敏感性

源码门禁固定 29 个 lifecycle、epoch/target、committed store、`uid`、registry 与 service store 写入点，防止新写入绕过 trace sink。每个场景在两个临时根生成证据并要求字节一致，报告引用只能使用相对 POSIX 路径。

四个 semantic mutations 用于证明验证器不是恒真：移除 unload guard、按值而非 provider identity 比较 target、FIFO 恢复和 stale committed provider 都必须被模型或轨迹拒绝。

## 三阶段诊断纪律

baseline 只加入观测，保存原逻辑及其精确反例；conformance 加入修复并要求形式化与普通门禁一起通过；upstream-fix 去除研究插桩，只保留补丁和回归。这样可以分别回答：原实现是否真的被规格拒绝、修复是否被同一证据接受、以及上游评审实际需要查看哪些产品代码。

upstream-fix 不直接产生形式化结论。其 `formalStatus` 固定为 `not-run`，并通过精确 revision 指向阶段二中的同逻辑修复。该关系由 lock 和报告校验，而不是只写在说明文字中。

## etcd/raft 与 Specula 的借鉴范围

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) 是本研究的直接工程先例：它把“模型本身是否满足性质”和“实现轨迹是否被模型接受”拆成相互衔接的义务，并讨论了动作粒度、stuttering、happens-before 与模型过时等实际问题。

[Specula](https://github.com/specula-org/Specula) 把从代码分析、规格生成到插桩、轨迹验证、模型检查和缺陷确认组织成自动化流程。其固定 v1.1.0 revision `c6aa3dfa41cd4bc7411fae40bd040924c70d9725` 在本研究中只作为轨迹生成、验证和调试参考。[Murat Demirbas 的评论](https://muratbuffalo.blogspot.com/2026/08/specula-scaling-formal-specifications.html)指出，由实现归纳的模型本身不能单独成为同一实现符合预期语义的独立证据。

因此，本研究不采用“从 Cordis 代码推导待验证不变量”这一部分。实际借鉴的是 instrumentation mapping、确定性 NDJSON、游标消费、完整 `TraceMatched`、TLC 反馈和分层定位第一处 mismatch。Cordis 论文是性质来源，Cordis `formal/` 是可执行规格权威，Specula 不是 submodule、构建依赖或 CI 依赖。

## 解释规则

一项 `pass` 表示：在 lock 固定的 revision、有限模型常量、声明前提和已采集轨迹内，没有发现反例，且接受的实现轨迹 refine 到论文驱动的机器。它不推广到任意插件外部副作用、未观测执行或无界活性。
