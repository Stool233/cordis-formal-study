# 已确认的验证

[English](verification.md) | 中文

两端各运行以下三项直接行为检查，全部通过。[生成的报告](verification-report.json)取自[已通过的 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/34381782064)，记录精确源码、检查器、运行时和依赖锁。论文依据见[论文阅读](paper.zh-CN.md)。

## 检查具体断言什么

| 检查 | 输入与断言 |
| --- | --- |
| `dependent-cleanup-before-provider-release` | Consumer 绑定 provider 资源；停止 provider 后，异步 consumer 清理仍读到可用资源，随后才出现 provider 释放事件。 |
| `retiring-dependent-remains-discoverable` | 整体关闭时用 barrier 暂停 consumer 清理；consumer 已开始 dispose，但 registry 仍包含它，资源仍可用；释放 barrier 后，条目与资源均被清理。 |
| `replacement-provider-has-distinct-identity` | 先后安装两个提供相同对象的 provider；consumer 发生两次激活，读取相同值，但观察到不同的 provider fiber，且每次绑定都有对应清理。 |

每项检查最后还确认 registry 已清空。任何断言失败、执行超时、源码 tree 不符或检查缺失都会导致命令失败；只有两端全部通过，才生成成功的聚合报告。

## 怎样理解“通过”

证据支持锁定 fork 在这些输入与观察时点上的行为。退休组件的 registry 检查用于验证清理顺序在实现中的执行条件；它不把 JavaScript 内部字段直接等同于论文状态。

这组结果是实现回归证据，不是一般恢复、进展、合流或完整论文演算的形式化证明。报告将证据类型固定为 `implementation-behavior-regression`，并记录 `paperTheorems: not-proved-by-these-checks`。

## 自动检查

[Current verification](../.github/workflows/current.yml)在主线 push、PR 和手动触发时运行。它校验版本与文档，执行两端的 6 项行为检查，并上传 JSON 报告。主线只维护这一条 CI。

检查报告的验证器也接受负向测试：漏项、重复项、失败结果，以及被改动的源码、脚本或依赖锁都必须被拒绝。运行方法见[复现指南](reproduce.zh-CN.md)。
