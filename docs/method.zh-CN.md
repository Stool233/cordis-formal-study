# 方法

[English](method.md) | 中文

## 为什么需要轨迹验证

TLC 可以探索 TLA+ 抽象机器的有限状态空间，但模型检查通过并不等于生产代码实现了同一台机器。普通实现测试能够验证若干预期结果，却通常没有定义从每个相关运行时状态到抽象状态的完整投影。

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) 是弥合这一缺口的主要工程先例。它区分算法正确性与实现一致性，在实现中观测算法相关状态和转换，再由轨迹规格约束模型检查器沿实现真实运行的路径前进。若核心状态机拒绝某个状态或转换，就得到规格与实现不一致的证据。该 PR 说明其思路来自 [Microsoft CCF 的共识轨迹验证](https://github.com/microsoft/CCF/tree/main/tla/consensus)。

这个先例的重要价值在于，其评审讨论没有把轨迹验证简化为日志回放，而是指出了真正困难的部分：

- 轨迹被拒绝并不能自动判定是实现错误还是模型过时；
- 分布式观测必须保留足够的 happens-before 信息，才能讨论全局行为；
- 规格动作与实现操作不必具有完全相同的粒度；
- stuttering 和 nondeterminism 必须被有意建模；
- 插桩应尽量低风险、只在测试时开启，并且其他维护者也能复现。

## 如何用于 Cordis 与 DeepSeek Harness

Cordis 与 Raft 不同。关键交错发生在同一 JavaScript runtime 内的 fibers、依赖解析、异步 effect iterators、retirement 和 inverse execution 之间，而不是复制节点之间。在受控场景中，一个 root-context 逻辑序号因此足够表达顺序：所有与论文有关的观测都通过同一个测试专用 sink 同步发出。recorder 使用稳定逻辑 ID，不使用墙上时钟；同一场景在两个不同临时目录中必须生成逐字节相同的 NDJSON。

这项研究还以一篇包含明确定义、引理和定理的论文为起点，因此论文是规格优先来源。确认不匹配属于实现偏差后，工作流保留最小反例并修复实现；不能仅为了接受当前行为而放宽规格。

迁移后的方法有三层证据：

1. TLC 在有界 PR 与 nightly 配置中检查 `CordisEffects`、`CordisKernel`、`CordisRuntime` 和 `CordisConfluence`。
2. `CordisTrace` 用游标完整消费每条非空 `cordis.paper-trace/v1` NDJSON，并比较每一步的完整抽象后状态。上游与 vendored Cordis 共享核心场景。
3. `AcyclicDependencies`、`FiniteNames`、`BoundedIterator`、`PairwiseIndependent`、`TotalProvision` 和 `NoFailure` 都是显式前提。前提为假时，依赖它的结论报告 `not-applicable`。

refinement mapping 允许 async iterator launch 作为 stuttering，也允许特定实现操作合并为一次论文转换。这些 silent interpretation 必须绑定具体观测事件和有限辅助状态。`uid = null`、runtime list removal 与 lifecycle transition timing 不能成为任意未观测行为的借口。

## 本研究增加的更强检查

以下设计不只是采用轨迹验证的宽泛想法：

- 每条记录都携带完整抽象后状态，而不仅是事件标签；
- AST/源码门禁清点 lifecycle、epoch/target、committed state、`uid`、registry 和 service 的 29 个写入点；
- 四个语义 mutant 必须被拒绝，证明验证器能识别 unload ordering、provider identity、LIFO recovery 和 stale committed provider 错误；
- confluence 在两种生命周期调度下比较 canonical terminal state；
- 报告引用只能是相对 output root 的 POSIX 路径，并且两个临时根中的生成结果必须逐字节相同；
- 有限实现轨迹只报告 quiescence 与 progress bound，不声称自己证明了无限时域活性。

## 从 etcd 实践到 Specula 工作流

[etcd/raft PR #113](https://github.com/etcd-io/raft/pull/113) 与 [Specula](https://github.com/specula-org/Specula) 不是两套独立方法。前者是面向一个具体项目的 trace-validation 工程实践；Specula 在本研究固定的 revision `c6aa3dfa41cd4bc7411fae40bd040924c70d9725`（v1.1.0）中，通过[工作流说明](https://github.com/specula-org/Specula/blob/c6aa3dfa41cd4bc7411fae40bd040924c70d9725/skills/workflow-overview.md)把这类实践系统化为五个可复用的阶段：源码分析、TLA+ 规格生成、实现 harness 与 NDJSON 轨迹生成、轨迹验证与模型检查，以及在真实系统中确认候选缺陷。固定仓库还收录了 [etcd/raft 规格示例](https://github.com/specula-org/Specula/blob/c6aa3dfa41cd4bc7411fae40bd040924c70d9725/skills/spec_generation/examples/etcdraft.tla)。这些证据共同支持“具体实践→系统方法”的关系，但不能说明 PR #113 本身由 Specula 项目产出。

Specula 的轨迹工作流要求启用 `TraceMatched` property，进行有意义的后状态验证而不是使用 `TRUE` 占位，通过游标完整消费轨迹，并从第一项被拒绝的条件开始分层调试。本研究采用了这套职责划分和调试纪律：`THEOREMS.md` 与观测点清单承担 instrumentation mapping 的角色；trace sink 与场景生成器承担 harness 的角色；`CordisTrace.tla` 完成游标消费和完整后状态比较；保存的反例与回归测试用于实现层确认。

有一项权威规则是有意不同的：etcd 先例与 Specula 都从忠于现有实现的模型出发，而本研究把 Cordis 论文作为语义优先来源，并用 `CordisRuntime` refinement 隔离实现细节。因此，本研究采用的是 Specula 对这类实践的系统化方法，而不是其运行时：Specula 不是 submodule 或 CI 依赖，其仓库没有被修改，Cordis 自己的 `formal/` 目录仍是唯一权威的可执行规格。

## 结论解释规则

证据支持的是精确且有限的陈述：对于 lock 固定的源码 revision、有限模型配置、声明的前提和已采集的确定性轨迹，验证没有发现反例，并且每条被接受的实现轨迹都 refine 到所检查的论文机器。它不证明任意插件外部副作用、无界 JavaScript 执行，或场景生成器从未观测到的执行一定正确。
