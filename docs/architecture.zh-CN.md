# 架构

[English](architecture.md) | 中文

## 权威归属与证据流

本研究只有一个可执行规格权威：[Cordis conformance revision 的 `formal/` 目录](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal)。门户不复制 TLA+ 模块；它负责版本固定、阶段 checkout、运行编排、报告校验、文档和 Release 打包。

```text
Cordis 论文 ──> 论文驱动的 TLA+ 机器 ──> TLC 有界模型报告
                         ▲
                         │ 完整后状态 refinement
                         │
baseline 实现 ── trace ──┤──> 锁定的反例集合
conformance 实现 ─ trace ┘──> 全部接受 + mutations 被拒绝

相同逻辑修复 ─────────────────> upstream-fix 普通门禁（formalStatus: not-run）
显式论文前提 ─────────────────> pass 或精确 not-applicable
```

性质从论文流向规格，再由规格判断实现。DeepSeek Harness 只提供 vendored 实现、附加场景和消费 Cordis kit 的 runner；Specula 只提供轨迹插桩/验证/调试参考。

## 源码与阶段拓扑

`sources/` 中的三个 gitlinks 提供可浏览快照：

- `sources/cordis` 固定 conformance Cordis `d06ee04a…`；
- `sources/paper` 固定上游英文论文 `948a07b3…`；
- `sources/deepseek-harness` 固定 conformance DeepSeek Harness `4b002125…`。

完整研究不在 submodule 上切换分支。`bootstrap:study` 从 `researchStages` 与 `branchMatrix` 读取六个 SHA，通过个人 fork 取得 commit，然后在下列位置创建 detached worktree：

```text
.artifacts/checkouts/
├── cordis/
│   ├── <baseline-sha>/
│   ├── <conformance-sha>/
│   └── <upstream-fix-sha>/
└── deepseekHarness/
    ├── <baseline-sha>/
    ├── <conformance-sha>/
    └── <upstream-fix-sha>/
```

裸对象缓存位于 `.artifacts/repositories/`，不会进入 Release。已有 checkout 只能以 exact clean HEAD 被复用；错误或 dirty 状态直接失败。Cordis 的依赖锁只在命令执行期间临时加入，随后移除，保证 worktree 恢复 clean。

## 阶段运行器

### Baseline

Cordis baseline runner 生成 13 条核心轨迹并把锁定的 9 条归为 `expected-fail`。DSH runner 用同一 Cordis `CordisTrace.tla` 消费 vendored 轨迹，在 17 条中锁定 10 条 mismatch。门户还解析行为报告，要求失败集合精确为 4/3，并检查每条 mismatch 的 trace、failure metadata 和 counterexample。

### Conformance

Cordis runner 顺序执行 portable-report 自测、TLA+ 语法、PR 模型、29 点源码覆盖、13 条轨迹和 4 个 mutations。DSH runner 对 vendored Cordis 运行 17 条轨迹、mutations 和 AgentLoop。门户再运行相关普通门禁并验证 required properties、`TraceMatched` 与负前提状态。

### Upstream-fix

门户先用 tracked-file inventory 和 package scripts 检查研究插桩不存在，再运行 Cordis 与 DSH 普通门禁。阶段报告只引用阶段二形式化证据，不调用 `formal/` runner，也不把 `formalStatus` 写成 pass。

## 报告接口

论文工具包继续使用 `cordis.paper-trace/v1`、`cordis.paper-*-report/v1` 和 `cordis.paper-failure/v1`。门户新增：

- `cordis.formal-study-ordinary-gates/v1`：记录 upstream-fix 的普通命令、无插桩状态和阶段二依据；
- `cordis.formal-study-report/v1`：聚合三个有序阶段的 SHA、状态、计数和报告引用。

所有 JSON/NDJSON 引用使用相对于 `.artifacts` 或各 evidence output root 的规范化 POSIX 路径。绝对 Unix、macOS、Windows 和 UNC 路径都会被拒绝。`.artifacts/study-report.md` 是由同一聚合数据生成的阅读摘要。

## 完整性与 CI

`npm run verify` 检查 lock schema、阶段顺序与 revision 映射、gitlink、clean submodule/checkouts、论文哈希、个人提交身份、Cordis/DSH pin、观测点与场景清单、报告路径和双语链接。若任何阶段证据已经存在，verify 也会重新验证其语义。

Integrity workflow 不执行 TLC。Conformance 根据手动选择执行单阶段，或在 PR/`main` push 默认执行完整研究。Nightly 先执行三阶段，再在 conformance Cordis checkout 上运行分层完整 BFS 与固定 seed 的扩大边界抽样。Release 在同一固定源码上重跑并打包。

## Release 选择边界

归档只允许 baseline JSON/NDJSON 反例、conformance 模型/轨迹/mutations、upstream-fix 普通报告、nightly、聚合报告、lock 和 Cordis provenance。它排除 `.artifacts/checkouts`、裸缓存、`node_modules`、JAR、TLC metadir、PDF 和任何本机路径。manifest 必须覆盖三个阶段和 nightly 的每个 payload，`SHA256SUMS` 校验最终 gzip。
