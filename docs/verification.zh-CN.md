# 对我们贡献的验证

[English](verification.md) | 中文

主线证据围绕[两个通过 TLC 发现的缺陷](contributions.zh-CN.md)。每份实现的三个拆卸场景，都表现为修复前被拒绝、修复后被接受。[contributions.lock.json](../contributions.lock.json)将每份轨迹与源码版本及 SHA-256 绑定；[报告](contribution-report.json)记录实际执行的模型和结果。

## TLC 检查什么

| 检查 | 每份实现修复前 | 每份实现修复后 |
| --- | --- | --- |
| `provider-consumer-reverse-exit` | 拒绝 | 接受 |
| `async-consumer-teardown-guard` | 拒绝 | 接受 |
| `concurrent-root-teardown-guard` | 拒绝 | 接受 |
| 人工提前恢复 provider 的负向对照 | — | 按预期拒绝 |

每个观测场景分别运行两个模型。[CordisTrace](../formal/CordisTrace.tla)原样保留最初的观测轨迹检查器。[TeardownOrder](../formal/TeardownOrder.tla)独立检查卸载守卫：开始恢复时，仍 committed 到该 provider 的 consumer 必须已 inactive。这个聚焦模型不施加旧检查器更强的 `Active ⇒ target = committed` 条件。

六份上游轨迹都违反这个明确的守卫；六份修复轨迹都满足它，并完成重放。两个提前恢复的人工轨迹必须违反同一个不变量。解析错误、工具字节不符、超时或其他不变量失败，都不能算作成功复现缺陷。运行产物包含反例和日志。

原检查器的投影约束强于当前论文。它的 `TraceMatched` 表示观测事件被相应谓词完整消费，并不表示实现细化了整篇论文的 kernel。独立的守卫检查明确指出这组贡献真正对应的失败原因。

## 轨迹重放与重新执行源码

提交到仓库的修复前轨迹来自对官方 Cordis `f8ea3cd` 与 Harness `5dda764` 保留的诊断。修复轨迹来自对 `18c327f` 和 `fdcd1ce` 的[成功对齐 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34315660644)。每份轨迹都记录来源。重放会重新运行 TLC，但不会执行源码来重新产生这些观测。

`reproduce:alignment` 会在隔离的插桩 checkout 中重新生成修复实现的轨迹，校验观测补丁，并要求选定轨迹与已提交证据一致，然后复验贡献。它保留完整工具包的模型、轨迹和变异检查作为诊断；这些数量不额外计入贡献。冻结的工具包用于实现观测，并不是当前论文完整演算的形式化。

## 补充回归

[无插桩检查](../checks/lifecycle.mjs)直接检查资源可用性、暂停清理期间 consumer 的可发现性和 provider 身份。两份实现的三个检查均通过；[行为报告](verification-report.json)记录源码树和检查器哈希。它们支持修复并防止相邻行为回归；测试通过或人工变异被拒绝，不算新的缺陷发现。

## CI 与可复现性

[TLC contributions](../.github/workflows/contributions.yml)在推送和 PR 时重放选定轨迹与负向对照。[Current verification](../.github/workflows/current.yml)重新执行无插桩检查。[Upstream alignment](../.github/workflows/upstream-alignment.yml)在形式化输入或运行器变化时重新生成修复轨迹，也支持手动触发。

TLC 和 Community Modules [按内容哈希随仓库保存](../tools/README.zh-CN.md)，附带许可证并严格校验字节。这些入口不会查询会滚动替换的官方发布资产。[复现说明](reproduce.zh-CN.md)给出命令和版本更新流程。
