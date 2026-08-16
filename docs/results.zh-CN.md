# 结果与边界

[English](results.md) | 中文

## 检查的 revision 集合

当前门户固定 Cordis `23f5e7d6e4a0cf451567dad1caad7b4049df6992`、英文论文 `948a07b369c62adb3b12e102458be5c18dfb69b9`，以及 DeepSeek Harness `9a039fe3e17f0bd6fae09bdaae10d2fbfb59a21f`。

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

轨迹 refinement 暴露了 provider/dependent teardown、两层 inverse recovery，以及 lifecycle/committed-view 发布顺序上的差异。实现现已改为：等待 dependent retirement 后再恢复 provider；每个 iterator 内按 LIFO 恢复 inverse resources，同时 join 相互独立的 structural wrappers；先发布 lifecycle state，再暴露与之兼容的 target 或 committed view。论文规格没有为了接受旧顺序而被削弱。

静态 `Plugin.provide` 元数据不会被直接假定成论文 provision。目前的运行时 provision 证据来自受控 `ctx.provide()` episode，并带有稳定 logical key 和 realm identity。因此，`TotalProvision` 只适用于 harness 已闭合全部 provider 的场景。

## 结果不证明什么

这是针对固定 revision、有限状态空间、声明前提和生成轨迹的 refinement 证据。它不证明：

- 任意 opaque 文件、网络、进程或设备 effects 两两独立，且 inverse 一定精确；
- 一条有限 quiescent 轨迹可以证明无界 JavaScript 执行的活性；
- 未被 observation point 或 scenario 表达的插件行为已经覆盖；
- 定理所需的无环依赖、有限名称、有界 iterator、独立性、total provision 或 no-failure 前提为假时，结论仍然成立。

Release workflow 会把 required property 非 `pass`、轨迹行缺失、mutant 被接受，或负前提结果不精确，全部视为阻塞式失败。
