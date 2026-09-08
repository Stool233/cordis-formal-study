# 研究过程与结果

[English](results.md) | 中文

本文按研究发生的三个阶段解释“发现了什么、如何确认、如何修复，以及哪一份代码适合后续上游评审”。精确 revision 和预期集合以 [`study.lock.json`](../study.lock.json) 为准。

## 先读结论

| 阶段 | 插桩 | 逻辑修复 | 预期结论 |
| --- | --- | --- | --- |
| `baseline` | 有 | 无 | 原实现必须精确复现锁定的 mismatch；意外通过也算研究结果漂移。 |
| `conformance` | 有 | 有 | TLC 模型、轨迹 refinement、前提审计、mutations、AgentLoop 和普通回归全部通过。 |
| `upstream-fix` | 无 | 有 | 只验证逻辑补丁和普通门禁；形式化状态固定为 `not-run`，并指回阶段二。 |

本文描述 [study.lock.json](../study.lock.json) 中的历史实验。论文版本为 `948a07b`，PDF SHA-256 为 `4d48478d…a49db97f`。实现版本见[架构](architecture.zh-CN.md#源码与阶段拓扑)，当前代码的结果见[上游对齐](upstream-alignment.zh-CN.md)。

[2026-09-09 arXiv 审阅](arxiv-review.zh-CN.md)修正了下文的解释，没有修改这些实验结果。轨迹被拒绝表示它与锁定检查器不一致，不自动等于某条论文定理的反例。

## 这些失败意味着什么

资源顺序可以直观理解：consumer 先用完资源，再由 provider 释放资源。第一项发现检查的，就是异步清理是否遵守这个顺序。

```mermaid
flowchart LR
  A[Consumer 开始清理] --> B[Consumer 完成清理] --> C[Provider 回收资源]
```

### 1. Provider recovery 与 retirement ordering

原实现可以在异步 consumer teardown 完成前启动 provider accumulator 的 inverse。与此同时，正在退休的 consumer 可能过早离开 runtime list，使并发 teardown 无法继续被 provider 发现。这些具体失败违反有 guard 的 provider/consumer 顺序，也破坏实现对 retirement 可见性的保障。新版 Theorem 70 保留 unload guard 与 episode 嵌套要求；这些测试并未建立更一般的恢复等价结论。

修复保留 retiring consumer，直到其生命周期达到 quiescence；provider 在恢复自己的 accumulator 前等待已通知 dependents 退出。`provider-consumer-reverse-exit`、异步与并发 teardown、依赖丢失/恢复和 AgentLoop 装配从同一底层顺序问题的不同路径确认修复。

### 2. Lifecycle、target 与 committed view 的发布顺序

原实现可能先暴露 target 或 committed provider 的变化，之后才进入本研究投影要求的 lifecycle 状态。相同服务值还可能掩盖 provider identity 已经替换。Provider 身份有直接论文依据，但仅凭发布 mismatch，不能认定违反 Preservation 或 Resolution coherence：论文允许 Active fiber 的 target 先改变，随后才执行 L-Leave。

修复把 lifecycle 转换作为发布屏障：先进入兼容状态，再更新 target 或 committed view；绑定稳定性按 provider identity 而不是仅按值比较。provider replacement、iteration 中依赖丢失、unloading 中依赖恢复、realm 隔离与 confluence 轨迹共同覆盖该行为。

这验证的是一种更严格的发布策略。[合法中间状态示例](arxiv-review.zh-CN.md#为什么-active-可以暂时不同于-target)说明了为何不能把 `Active ⇒ committed == target` 归给 arXiv Theorem 71 或旧 Theorem 64。历史 mismatch 的样本和数量保留，分类按此收窄。

### 3. 传递激活调度回归

普通回归在第一次形式化修复之后发现：连续两个延迟取消检查点会让已等待的 provider 返回时，传递 consumer 仍停留在 `LOADING`。这是一项与进展目标相邻的实现调度问题，但本研究不把它单独宣称为某条论文定理的反例。

修复只保留一个延迟取消检查点。这样 disposal 仍能让 stale activation 失效，而已等待 mount 的调用方会看到传递激活已经结算。对应普通测试在 conformance 和 upstream-fix 阶段都运行。

<details>
<summary>Baseline 参考：精确轨迹 mismatch 与行为失败清单</summary>

## 阶段一：在原运行逻辑上复现不一致

baseline 分支只加入同步、测试专用的 trace sink、稳定逻辑 ID、场景和预期失败 runner。运行时生命周期、解析、恢复和调度逻辑保持原样。验证成功的标准不是“全部绿色”，而是实际失败集合与 lock 完全一致。

### 轨迹 mismatch

Cordis 的 9 条 mismatch 是：

1. `provider-consumer-reverse-exit`
2. `async-consumer-teardown-guard`
3. `concurrent-root-teardown-guard`
4. `provider-identity-replacement`
5. `dependency-loss-during-iteration`
6. `dependency-return-during-unload`
7. `isolation-realms`
8. `confluence-left`
9. `confluence-right`

vendored Cordis 复现同一组 mismatch，并增加 `deepseek-agent-loop-assembly`，共 10 条。其余正向场景仍必须通过；三项负前提仍必须精确报告 `not-applicable`。因此，baseline 不允许通过空轨迹、把全部性质标成预期失败，或忽略新出现的 mismatch。

### 普通行为失败

| 行为检查 | Cordis | Vendored Cordis |
| --- | --- | --- |
| `provider-resources-outlive-asynchronous-consumers` | expected-fail | expected-fail |
| `retiring-consumers-remain-discoverable` | expected-fail | expected-fail |
| `disposal-invalidates-deferred-reload` | expected-fail | pass |
| `awaited-provider-settles-transitive-activation` | expected-fail | expected-fail |

vendored 基线此前已有的本地生命周期加固使 `disposal-invalidates-deferred-reload` 通过，因此其行为失败数是 3 而不是 4。9/10 和 4/3 都是场景或检查数量，不代表独立缺陷数量。

</details>

## 阶段二：修复后建立一致性证据

conformance 分支保留同一套插桩并加入上述逻辑修复。通过条件包含模型、实现轨迹和普通测试，而不是只看某一个报告。

### 有界模型

PR profile 的固定探索结果为：

| 模型 | 结果 | Distinct states | BFS 直径 |
| --- | --- | ---: | ---: |
| Effects | pass | 289 | 15 |
| Kernel，failure enabled | pass | 82,710 | 32 |
| Kernel，`NoFailure` | pass | 21,858 | 32 |
| Runtime refinement | pass | 66 | 11 |
| Confluence product | pass | 364,816 | 41 |

模型检查资源局部性与 LIFO 恢复、Preservation、Recovery exactness、Ordering、Resolution coherence、Progress、runtime 投影和 canonical terminal equality 等研究 operator。这些名称不表示它们等价于一般论文定理。尤其是乘积模型比较关闭状态，`RuntimeRefinesPaper` 是局部不变量合取，而非时序模拟定理。[模型审计](arxiv-review.zh-CN.md#现有模型实际覆盖什么)记录具体限制。有限轨迹另检查 quiescence 与场景 `ProgressBound`，并未验证论文的闭式步骤上界或无限时域活性。

### 实现证据

| 证据 | Cordis | Vendored Cordis |
| --- | ---: | ---: |
| 正向轨迹场景 | 13 | 17 |
| 完整 `TraceMatched` | 13 | 17 |
| 观测写入点 | 29 | 29（同一核心清单） |
| 被拒绝 mutants | 4 | 4 |

每条轨迹必须非空、完整消费，并对每个声明的正向性质报告 `pass`。循环依赖、非独立 effects 和非 total provision 三项负前提必须分别精确报告 `not-applicable`。

四个 mutant 分别移除 unload guard、按值比较 target、改成 FIFO 恢复，以及允许 stale committed provider。任一 mutant 未被拒绝都会使阶段二失败。DeepSeek Harness 还运行重入 dispose、pending effect、异步 cleanup join 和无网络 AgentLoop 装配。

## 阶段三：形成可上游评审的补丁

`fix/paper-conformance` 分支从研究成果中只保留生命周期/调度逻辑修复和普通回归测试。门禁首先检查以下内容不存在：trace sink、`formal/` 工具包、Cordis paper runner，以及相应 package scripts。随后运行：

- Cordis fiber、HMR、loader 回归，以及 build 和 lint；
- DeepSeek Harness lifecycle、session-persistence 回归，以及 build、lint 和双语文档门禁。

该阶段生成 `cordis.formal-study-ordinary-gates/v1` 报告，`formalStatus` 必须是 `not-run`。它不假装一份没有插桩的源码能直接产生轨迹 refinement 证据；报告明确指向阶段二中包含相同逻辑修复的 Cordis 与 DeepSeek Harness revisions。

## 已调查但未归类为缺陷

### 独立顶层 effect 的并发恢复

单个 effect iterator 内的 inverse 按 LIFO 串行执行。不同顶层 wrapper 在 `PairwiseIndependent` 前提成立时，可以按注册逆序启动并并发 join。需要严格完成顺序的 cleanup 必须进入同一个 accumulator，而不能依赖所有顶层 wrapper 全局串行。现有实现和论文前提在这一边界内可以一致解释，因此没有作为缺陷修复。

### `Plugin.provide` 与 `ctx.provide()`

论文中的静态 provision 集合不能直接等同于尚未参与核心解析逻辑的 `Plugin.provide` 元数据。本研究的 provision 轨迹来自受控 `ctx.provide()` episode，并记录稳定 logical key、provider identity 和 realm。因此 `TotalProvision` 只对场景 harness 已闭合的 provider 集合适用；超出该范围会报告不适用或未覆盖，而不是伪造通过。

## 结论边界

结果只说明固定 revisions 在有限模型、显式前提和已采集轨迹上满足已检查性质。它不覆盖任意 opaque 文件、网络、进程或设备副作用，不证明任意 effect 都独立或 inverse 都精确，也不把有限 quiescent 轨迹当作无界活性证明。[arXiv 原文审阅](arxiv-review.zh-CN.md)已完成上述结论对齐，并列明剩余 witness、simulation 与模型迁移义务。规格及相关论证仍值得独立复核。

下一步可按[复现指南](reproduce.zh-CN.md)运行三个阶段；更底层的性质来源和状态投影见[方法](method.zh-CN.md)与[架构](architecture.zh-CN.md)。
