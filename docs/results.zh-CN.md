# 结果与边界

[English](results.md) | 中文

## 检查的 revision 集合

当前门户固定 Cordis `fe45fb4d1e89fd6c8ae24399f601a3da9356da8a`、英文论文 `948a07b369c62adb3b12e102458be5c18dfb69b9`，以及 DeepSeek Harness `7797ad835a239bf5b8a229f2eb1d5cf7d8e4c773`。

## 基线对比

仅轨迹分支保留上游和 vendored 运行时逻辑。预期失败 runner 记录 Cordis 的 9 个受影响轨迹场景和 vendored 版本的 10 个受影响场景。普通回归还独立暴露出上游 Cordis 的 4 项失败和 vendored 基线的 3 项失败：provider 资源在异步 consumer 完成前被撤回；并发 root disposal 期间，正在退休的 consumer 过早消失；已等待的 provider 返回时，传递激活尚未结算。上游 Cordis 还无法在 disposal 抢先于延迟激活时 drain pending effect，而 vendored 基线此前已有的生命周期加固已能通过该项。

这些数字表示受影响的场景和检查数量，并不是独立缺陷数量。多个场景会通过不同的依赖、identity、realm 或 confluence 路径到达同一个生命周期顺序 mismatch。

## 有界模型结果

PR profile 已在等价的固定文件树上通过以下 TLC 探索：

| 模型 | 结果 | Distinct states | BFS 直径 |
| --- | --- | ---: | ---: |
| Effects | pass | 289 | 15 |
| Kernel，failure enabled | pass | 82,710 | 32 |
| Kernel，`NoFailure` | pass | 21,858 | 32 |
| Runtime refinement | pass | 66 | 11 |
| Confluence product | pass | 364,816 | 41 |

模型报告覆盖 `WriteLocality`、`LifoRecovery`、`RecoveryExactness`、`IndependentExchangeInvariant`、`Preservation`、`Ordering`、`ResolutionCoherence`、`Progress`、`RuntimeRefinesPaper`、`CanonicalTerminalEquality` 和 `EventuallyCanonical`。实现轨迹另外检查 `ProgressBound`。

## 轨迹与 mutation 结果

lock 中有 13 条核心轨迹和四条 DeepSeek Harness 额外轨迹，因此 vendored 版本共运行 17 条。每条 required 正向轨迹必须非空、字节稳定、被 `TraceMatched` 完整消费，且不能出现 `not-applicable` 或 `unobserved`。三项负前提审计必须返回精确预期的 `not-applicable`。

源码声明的 29 个写入观测点全部得到覆盖。以下四个 mutant 均会被拒绝：

| Mutation | 必须检测到的问题 |
| --- | --- |
| 移除 unload guard | provider inverse 在 dependent teardown 完成前开始。 |
| 按值比较 target | 相同值掩盖 provider identity 已改变。 |
| 使用 FIFO 恢复 | effect accumulator 违反 LIFO 恢复。 |
| 保留 stale committed provider | 已失效 provider 仍在 committed view 中可见。 |

## 发现的实现偏差

轨迹 refinement 确认了两项与论文有关的实现偏差。第一，provider recovery 可能在异步 dependent teardown 完成前开始，而且过早从 runtime list 移除会隐藏并发退休的 consumer。第二，依赖 target 与 committed view 的变化可能先于兼容的生命周期转换而变得可观察。实现现在会保留正在退休的 consumer 直至 quiescence，在 provider recovery 前等待已通知的 dependents，并先发布生命周期转换，再暴露不兼容的 target 或 committed view。论文规格没有为了接受旧顺序而被削弱。

普通回归在首次形式化通过后又发现一项相邻的调度缺陷：连续两个激活检查点会使已等待的 provider 返回时，传递 consumer 仍处于 `LOADING`。修正后的实现只保留一个延迟取消检查点，因此 disposal 仍可使 stale activation 失效，而传递激活会在已等待的 mount 返回前结算。

独立顶层 effect recovery 已经过调查，但不归类为论文偏差。每个 effect iterator 内的 recovery 是串行 LIFO；不同顶层 wrapper 在显式 `PairwiseIndependent` 前提下按注册逆序启动并并发 join。因此，session-persistence admission 与 backend closure 这类需要完成顺序的 cleanup 操作会共享同一个 accumulator，而不是依赖全局 wrapper 串行化。

静态 `Plugin.provide` 元数据不会被直接假定成论文 provision。目前的运行时 provision 证据来自受控 `ctx.provide()` episode，并带有稳定 logical key 和 realm identity。因此，`TotalProvision` 只适用于 harness 已闭合全部 provider 的场景。

## 结果不证明什么

这是针对固定 revision、有限状态空间、声明前提和生成轨迹的 refinement 证据。它不证明：

- 任意 opaque 文件、网络、进程或设备 effects 两两独立，且 inverse 一定精确；
- 一条有限 quiescent 轨迹可以证明无界 JavaScript 执行的活性；
- 未被 observation point 或 scenario 表达的插件行为已经覆盖；
- 定理所需的无环依赖、有限名称、有界 iterator、独立性、total provision 或 no-failure 前提为假时，结论仍然成立。

Release workflow 会把 required property 非 `pass`、轨迹行缺失、mutant 被接受，或负前提结果不精确，全部视为阻塞式失败。
