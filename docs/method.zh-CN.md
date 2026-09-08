# 方法

[English](method.md) | 中文

本研究分别回答两个问题：有限模型是否满足论文导出的性质，实际实现的一次可观察执行是否遵守该模型？两个答案不能互相替代。

## 本文术语

| 术语 | 在本研究中的含义 |
| --- | --- |
| Specification（规格） | 本研究对论文规则的可执行解释，包括抽象选择与限制。 |
| Model checking（模型检查） | TLC 遍历有限状态空间，寻找反例。 |
| Trace refinement（轨迹精化） | 记录的投影状态与步骤被轨迹机器接受；与论文的对应关系是另一项义务。 |
| Premise audit（前提审计） | 显式检查某项性质成立所需的假设。 |
| Semantic mutation（语义变异） | 故意构造的无效轨迹，检查器必须拒绝它。 |

[研究结果](results.zh-CN.md)提供了具体的资源顺序例子。本文解释这些证据是如何建立的。

## 性质从哪里来

Cordis 论文提供预期语义，研究据此选择有限抽象与可执行解释。锁定 kit 的 `THEOREMS.md` 连接历史论文页码、TLA+ operator、观测点与前提；[arXiv 审阅](arxiv-review.zh-CN.md)审计这一解释，指出限制与过度表述。代码提供待解释的实现状态和轨迹；检查器通过本身不能证明该解释忠实表达了论文。

这一顺序避免自证循环：如果规格完全由同一实现归纳，再用它证明实现符合规格，所得结论缺少独立的语义来源。发现 mismatch 后，先判断论文模型、refinement mapping 或实现哪一层有误；只有论文依据支持时才修改规格。确认是实现偏差时，保留最小反例并修复实现。

## 三层证据

### 1. 研究抽象机器的有界模型检查

`CordisEffects.tla`、`CordisKernel.tla`、`CordisRuntime.tla` 和 `CordisConfluence.tla` 分别检查资源恢复、受限制的生命周期规则、局部 runtime 投影不变量，以及多调度下关闭状态的相等性。TLC 在 PR 和 nightly 两组有限常量下检查安全不变量、死锁、排名上界和在显式公平性下的有界活性目标。`RuntimeRefinesPaper` 未编码时序模拟定理；合流乘积模型要求所有组件 Inactive 才算终态。

有界通过表示该配置中没有找到反例，不等于任意规模的无条件证明。nightly 采用分层边界：扩大的 effect 模型和各个 kernel 维度运行完整 BFS，组合后的五 fiber runtime、kernel 和 confluence 边界则分别运行精确 100,000 条固定 seed 的 simulation 轨迹。报告将每项结果标记为 `exhaustive` 或 `simulation`；`Progress`、`EventuallyCanonical` 等时序性质只接受已完成的 BFS 证据。

### 2. 实现轨迹 refinement

测试专用 trace sink 在 root context 内同步记录 lifecycle、target、committed view、fiber 创建/退休/移除、effect iteration landing、inverse 和 service provision/withdrawal。recorder 使用稳定逻辑 ID 和逻辑序号，不记录时间戳。每条 `cordis.paper-trace/v1` NDJSON 记录携带完整抽象后状态。

`CordisTrace.tla` 用自身事件谓词逐条消费轨迹。异步 launch、landing 与发布写入的解释由观测事件和有限辅助状态约束。`TraceMatched` 只有在全部记录被消费、每个完整投影后状态匹配时才通过，不能退化为 `TRUE`。该模块未实例化 kernel 转换关系，因此仅凭接受结果，不能宣称已经检查了对论文规则的 simulation。

Provider ID 与 resource ID 保留了有用观测，但轨迹省略 coeffect 值、操作结果、inverse 函数和 continuation。论文的观测等价还要求这些操作尊重所选关系。此外，轨迹对 Active/target 无条件相等的要求强于论文，见[合法中间状态](arxiv-review.zh-CN.md#为什么-active-可以暂时不同于-target)。

### 3. 前提审计

`AcyclicDependencies`、`FiniteNames`、`BoundedIterator`、`PairwiseIndependent`、`TotalProvision` 和 `NoFailure` 是显式前提。有限轨迹不能自动证明所有前提，因此循环依赖、非独立 effects 和非 total provision 使用独立负场景。前提为假时，依赖性质必须报告 `not-applicable`，不能计为 pass。

arXiv 论证还要求 context 中介操作、inverse 与交换性见证，以及观测等价下的稳定性。六个标记未编码全部这些义务。`PairwiseIndependent`、`NoFailure` 继续保留；[前提审计](arxiv-review.zh-CN.md#前提发生了什么变化)解释其当前含义。轨迹 `ProgressBound` 是事件预算，不是 Theorem 73 的 `(K + 3)(V(n) + 1)` 上界检查。

## 观测完整性与敏感性

源码门禁固定 29 个 lifecycle、epoch/target、committed store、`uid`、registry 与 service store 写入点，防止新写入绕过 trace sink。每个场景在两个临时根生成证据并要求字节一致，报告引用只能使用相对 POSIX 路径。

四个 semantic mutations 用于证明验证器不是恒真：移除 unload guard、按值而非 provider identity 比较 target、FIFO 恢复和 stale committed provider 都必须被模型或轨迹拒绝。

## 三阶段诊断纪律

baseline 只加入观测，保存原逻辑及其精确反例；conformance 加入修复并要求形式化与普通门禁一起通过；upstream-fix 去除研究插桩，只保留补丁和回归。这样可以分别回答：原实现是否真的被规格拒绝、修复是否被同一证据接受、以及上游评审实际需要查看哪些产品代码。

upstream-fix 不直接产生形式化结论。其 `formalStatus` 固定为 `not-run`，并通过精确 revision 指向阶段二中的同逻辑修复。该关系由 lock 和报告校验，而不是只写在说明文字中。

<details>
<summary>背景：从 etcd/raft 与 Specula 借鉴什么</summary>

## etcd/raft 与 Specula 的借鉴范围

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) 是本研究的直接工程先例：它把“模型本身是否满足性质”和“实现轨迹是否被模型接受”拆成相互衔接的义务，并讨论了动作粒度、stuttering、happens-before 与模型过时等实际问题。

[Specula](https://github.com/specula-org/Specula) 把从代码分析、规格生成到插桩、轨迹验证、模型检查和缺陷确认组织成自动化流程。其固定 v1.1.0 revision `c6aa3dfa41cd4bc7411fae40bd040924c70d9725` 在本研究中只作为轨迹生成、验证和调试参考。[Murat Demirbas 的评论](https://muratbuffalo.blogspot.com/2026/08/specula-scaling-formal-specifications.html)指出，由实现归纳的模型本身不能单独成为同一实现符合预期语义的独立证据。

因此，本研究不采用“从 Cordis 代码推导待验证不变量”这一部分。实际借鉴的是 instrumentation mapping、确定性 NDJSON、游标消费、完整 `TraceMatched`、TLC 反馈和分层定位第一处 mismatch。Cordis 论文是性质来源，Cordis `formal/` 是可执行规格权威，Specula 不是 submodule、构建依赖或 CI 依赖。

</details>

## 解释规则

一项 `pass` 表示：在 lock 固定的 revision、有限模型常量、声明前提和已采集轨迹内，没有发现反例，且轨迹机器接受了记录的投影。把结果转移到论文还需要单独的 simulation 与 witness 论证。它不推广到任意插件外部副作用、未观测执行或无界活性。[arXiv 审阅](arxiv-review.zh-CN.md)记录已完成的结论对齐及剩余模型义务。
