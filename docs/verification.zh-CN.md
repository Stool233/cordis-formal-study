# 对我们贡献的验证

[English](verification.md) | 中文

TLC 针对[两个缺陷](contributions.zh-CN.md)，检查每份实现的三个拆卸场景。修复前的轨迹被拒绝，修复后的轨迹被接受。[contributions.lock.json](../contributions.lock.json)记录每份轨迹的源码版本和 SHA-256。

[报告](contribution-report.json)来自[从源码重新生成轨迹的 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34390459029)，列出执行的模型和结果。[重放已采集轨迹的 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34390459101)得到相同结果。

## TLC 检查什么

| 检查 | 每份实现修复前 | 每份实现修复后 |
| --- | --- | --- |
| `provider-consumer-reverse-exit` | 拒绝 | 接受 |
| `async-consumer-teardown-guard` | 拒绝 | 接受 |
| `concurrent-root-teardown-guard` | 拒绝 | 接受 |
| 人工提前恢复 provider 的负向对照 | — | 按预期拒绝 |

每个观测场景运行两个模型。[CordisTrace](../formal/CordisTrace.tla)检查观测事件的转换，并施加比当前论文更强的 `Active ⇒ target = committed` 条件。[TeardownOrder](../formal/TeardownOrder.tla)检查卸载守卫：provider 开始恢复时，仍 committed 到它的 consumer 必须已 inactive。

六份上游轨迹都违反这个守卫，六份修复轨迹都满足它并完成重放。两个提前恢复的人工轨迹必须违反同一个不变量。运行器要求出现这一明确的违规，才确认顺序缺陷。解析错误、工具字节不符、超时或其他不变量违规都会让运行失败。CI 上传反例和日志。

`TraceMatched` 表示观测事件满足原检查器的谓词，直到轨迹结束。守卫检查指出导致顺序违规的恢复事件。这些结果针对记录的执行及两个模型的定义。

## 重放与生成轨迹

已提交的修复前轨迹来自对官方 Cordis `f8ea3cd` 和 Harness `5dda764` 的诊断。修复后轨迹来自对 `18c327f` 和 `fdcd1ce` 的[对齐 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34315660644)。每份轨迹记录其来源。重放对这些已提交文件运行 TLC。

`reproduce:alignment` 在隔离 checkout 中为修复源码加入轨迹插桩并执行。它校验观测补丁，生成轨迹，要求选定轨迹与已提交证据一致，然后运行贡献检查。命令还会执行观测工具包中范围更广的模型、轨迹和变异诊断。

## 补充回归

[无插桩检查](../checks/lifecycle.mjs)检查资源可用性、暂停清理期间 consumer 的可发现性和 provider 身份。两份实现的三个检查均通过。[行为报告](verification-report.json)来自[行为 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34390458869)，记录源码树和检查器哈希。这些回归检查修复及相关服务行为。

## CI 与可复现性

[TLC contributions](../.github/workflows/contributions.yml)在推送和 PR 时重放已采集轨迹及负向对照。[Current verification](../.github/workflows/current.yml)执行无插桩检查。[Upstream alignment](../.github/workflows/upstream-alignment.yml)在形式化输入或运行器变化时，从修复源码生成轨迹，也支持手动触发。

TLC 和 Community Modules [按内容哈希保存在仓库中](../tools/README.zh-CN.md)，附带许可证。每个形式化入口都校验并使用这些本地字节。[复现说明](reproduce.zh-CN.md)给出命令和版本更新步骤。
