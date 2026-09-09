# 复现指南

[English](reproduce.md) | 中文

本指南提供当前迁移与原始三阶段研究的复现入口。若只想理解结果，先阅读[研究过程与结果](results.zh-CN.md)。

## 先选择实验

| 目的 | 入口 | 版本依据 |
| --- | --- | --- |
| 验证已迁移到当前上游的修复 | `npm run reproduce:alignment` | [alignment.lock.json](../alignment.lock.json) |
| 重跑原始三阶段研究 | `npm run reproduce:study` | [study.lock.json](../study.lock.json) |

两条路径都需要 Node.js 24、Java 21、Git 和 Corepack。它们检查不同的源码快照与工具哈希，报告分别保存。

TLC 与 CommunityModules 来自[当前 checkout 中经哈希校验的文件](../tools/README.zh-CN.md)，两条路径均不下载这些工具，也不依赖 Actions 缓存。显式 `CORDIS_TLA_TOOLS_JAR` / `CORDIS_TLA_COMMUNITY_JAR` 覆盖必须匹配所选 lock；取消陈旧覆盖即可使用入库文件。

## 初始化门户

首次使用时：

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm ci
```

如果已有门户仓库，在其根目录执行 `npm ci`。后续命令也从这里执行。

## 本次迁移

如果两个 fork 尚未存在，将它们 clone 到门户旁边：

```sh
git clone --branch codex/upstream-alignment-2026-09-09 https://github.com/Stool233/cordis.git ../cordis
git clone --branch codex/upstream-alignment-2026-09-09 https://github.com/Stool233/deepseek-harness.git ../deepseek-harness
```

使用精确的候选提交。切换版本前，先保存自己的本地改动：

```sh
git -C ../cordis checkout --detach 18c327f4566e8f640737c43a480e6d74a0673579
git -C ../deepseek-harness checkout --detach fdcd1ce36a296ab2288bf407fccba4c8fa634963
npm run reproduce:alignment -- --cordis ../cordis --deepseek-harness ../deepseek-harness
```

命令拒绝 dirty 或版本错误的输入。它安装固定依赖，创建独立 worktree，应用经哈希校验的观测补丁，并把历史规格提取到独立运行目录。只有该规格副本使用较新的 TLC 哈希；历史 lock 与源码快照保持不变。

成功要求两份无插桩实现的原始四项行为断言全部通过，PR 模型、29 个 Cordis 观测点、13 条 Cordis 轨迹与 17 条 Harness 轨迹通过，且每份实现的四个 mutation 均被拒绝。原始行为断言保持原样；修复候选的预期失败集合改为空。

这些检查针对历史规格。[arXiv 审阅](arxiv-review.zh-CN.md)解释性质名称的含义及剩余模型义务；重跑此命令不等于验证新版完整演算。

最后一行输出 `.artifacts/alignment/run-<id>/evidence/report.json`。报告记录论文、工具、源码版本、源码 tree 与补丁哈希。中断或失败的运行不会产生通过的聚合报告。Worktree 与依赖位于 evidence 目录之外。

仓库测试、build、lint 和文档检查独立于这个形式化命令。命令见 [Cordis fork 指南](https://github.com/Stool233/cordis/blob/main/docs/formal-study.zh-CN.md)和 [Harness fork 指南](https://github.com/Stool233/deepseek-harness/blob/master/docs/cordis-study.zh.md)，实际结果见[上游对齐](upstream-alignment.zh-CN.md)。

## 历史实验：工具可用性

上游替换过原始 TLC 1.8.0 资产，但已从早期成功的 CI 产物恢复其精确字节，并按原哈希提交入库。历史命令现在自动选择该文件。[工具指南](../tools/README.zh-CN.md)记录来源、双重哈希校验与离线测试；历史工具 pin 没有变化。

下列命令保留原始实验。`reproduce:upstream-fix` 仅运行普通检查，不依赖 TLC。

## 历史实验初始化

首次 bootstrap 会取得六个固定实现 revision 并安装依赖，因此需要网络。场景中的最小 AgentLoop 本身不调用外部模型或网络服务。

```sh
npm run bootstrap:study
```

`bootstrap:study` 会：

1. 初始化三个可浏览的 conformance/paper submodules，并验证 gitlink、HEAD、dirty 状态和论文哈希；
2. 从 `study.lock.json` 读取 `baseline`、`conformance` 和 `upstream-fix` 的六个完整 SHA；
3. 在 `.artifacts/checkouts/<repository>/<revision>/` 创建 detached checkout；
4. 向 Cordis checkout 临时注入固定 `locks/cordis.yarn.lock` 并执行 immutable install，对 DeepSeek Harness 执行 frozen pnpm install；
5. 安装完成后再次确认 checkout clean 且 HEAD 精确匹配。

已有 checkout 如果 dirty、HEAD 错误，或不是 Git checkout，会立即失败。工具不会 reset、checkout 或覆盖用户工作。

## 复现阶段一：原实现的不一致

```sh
npm run reproduce:baseline
```

runner 对 Cordis 和 vendored Cordis 分别生成轨迹，运行 `CordisTrace.tla`，并执行 baseline 行为 probes。命令只有在以下条件全部满足时才返回 0：

- Cordis 恰好出现 lock 中的 9 条轨迹 mismatch 和 4 项行为失败；
- vendored Cordis 恰好出现 10 条轨迹 mismatch 和 3 项行为失败；
- 其他正向场景通过，三项负前提精确为 `not-applicable`；
- 每条轨迹非空，所有 mismatch 都有 failure metadata 与 TLC counterexample；
- revision、场景集合和报告中的相对路径均匹配。

预期 mismatch 意外通过、新增 mismatch、遗漏 mismatch、空轨迹或 revision 漂移都会使命令失败。这里的退出码 0 表示“成功复现预期不一致”，不是“原实现符合论文”。

## 复现阶段二：逻辑修复后的完整证据

```sh
npm run reproduce:conformance
```

该命令运行：

- Cordis PR profile 的 TLA+ 语法、有界模型、29 个观测点覆盖、13 条核心轨迹和 4 个 mutations；
- Cordis fiber、HMR、loader 普通回归，以及 build/lint；
- vendored Cordis 的 17 条完整轨迹、4 个 mutations、三条本地加固路径和离线 AgentLoop 装配；
- DeepSeek Harness lifecycle、session-persistence 回归，以及 build/lint/doc-sync；
- required properties 的 `pass`、负前提的精确 `not-applicable`、完整 `TraceMatched` 和可移植报告检查。

任一 required property 为 `not-applicable`/`unobserved`、任一 mutant 未被拒绝，或任一普通门禁失败，阶段二都会失败。

## 复现阶段三：无插桩上游补丁

```sh
npm run reproduce:upstream-fix
```

该命令先确认两个 fix checkout 不含 trace sink、Cordis `formal/`、paper conformance runner 或相关 package script，再运行与阶段二修复相关的普通测试、build、lint 和 DSH 文档门禁。

输出报告的 `formalStatus` 固定为 `not-run`。报告同时记录阶段二中承载相同逻辑修复的 revision 与证据路径，避免把“没有形式化工具”误写为“直接通过 TLC”。

## 一次复现完整研究

```sh
npm run reproduce:study
npm run verify -- --full
```

`reproduce:study` 按 baseline → conformance → upstream-fix 顺序执行。输出结构为：

```text
.artifacts/
├── checkouts/
│   ├── cordis/<revision>/
│   └── deepseekHarness/<revision>/
├── stages/
│   ├── 01-baseline/
│   │   ├── cordis/
│   │   └── deepseek-harness/
│   ├── 02-conformance/
│   │   ├── cordis/
│   │   └── deepseek-harness/
│   └── 03-upstream-fix/
│       └── ordinary-gates-report.json
├── study-report.json
└── study-report.md
```

`study-report.json` 使用 `cordis.formal-study-report/v1`，用于自动化；`study-report.md` 用双语摘要说明三个阶段的结果。两者都不包含本机绝对路径。

<details>
<summary>参考：底层 profile、CI 与 Release 打包</summary>

## 阶段二的低层 profile

为保持已有使用方式，以下命令继续存在：

| 命令 | 用途 |
| --- | --- |
| `npm run bootstrap:core` | 只初始化可浏览的 Cordis 与 paper submodules，并安装 Cordis。 |
| `npm run bootstrap:full` | 再初始化可浏览的 DeepSeek Harness submodule。 |
| `npm run reproduce:core` | 在 conformance submodule 上运行 Cordis PR formal profile。 |
| `npm run reproduce:full` | 再运行 vendored conformance 与 AgentLoop。 |
| `npm run reproduce:nightly` | 在阶段二 Cordis checkout 上运行分层完整 BFS 与固定 seed 的扩大边界 simulation。 |

这些是阶段二的底层 profile，不代替三阶段的 `reproduce:study`。

## CI 触发映射

| Workflow | 触发 | 执行内容 |
| --- | --- | --- |
| Integrity | 每次 push 与 PR | `npm ci`、单元测试、lock/gitlink/schema/文档完整性；不执行 TLC。 |
| Upstream alignment | 相关 PR、`main` 的相关 push、手动 | 按 `alignment.lock.json` 取得候选，执行 `reproduce:alignment` 并发布证据。 |
| Conformance | 相关 PR、`main` 的相关 push、手动 | PR/push 默认运行 `bootstrap:study` + `reproduce:study`；手动可选四个阶段入口。 |
| Nightly | 每周一 03:17 UTC、手动 | 完整三阶段，然后 `reproduce:nightly`。 |
| Release | `v*` tag | 完整三阶段、nightly、完整性检查、证据打包和 GitHub Release。 |

只向 Cordis 或 DeepSeek Harness 的 research 分支 push 不等于触发门户的跨仓检查。Upstream alignment 验证当前迁移，Conformance 与 Nightly 复现历史研究。所有形式化 workflow 都使用入库资产，并在复现前运行 `test:tools`。

## Release 证据

在完整研究和 nightly 已成功后运行：

```sh
npm run package -- --version 0.1.0
```

生成 `dist/cordis-formal-study-v0.1.0-evidence.tar.gz` 和 `dist/SHA256SUMS`。证据包含 baseline 反例、conformance 模型/轨迹/mutations、upstream-fix 普通门禁、nightly 和聚合报告；不包含 checkouts、依赖、JAR、TLC 临时目录、PDF 或本机路径。

</details>

## 常见失败

- **checkout dirty 或错误 HEAD**：保存自己的改动，或自行使用一个新 clone；bootstrap 不会替你 reset。
- **baseline mismatch 集合变化**：先检查是否用了 lock 中的 revision。若 revision 正确，这代表需要调查的新证据，不能直接更新计数掩盖。
- **工具下载失败**：首次运行需要访问 GitHub；下载内容仍必须通过 lock 中的 SHA-256。
- **`not-applicable` 出现在正向场景**：正向 required property 必须为 `pass`；只有三个专门的负前提场景允许精确的 `not-applicable`。
- **upstream-fix 报告插桩残留**：删除研究 trace/formal 文件或 scripts，不能把检测规则关闭。
