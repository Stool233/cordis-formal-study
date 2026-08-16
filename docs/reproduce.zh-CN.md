# 复现指南

[English](reproduce.md) | 中文

## 环境要求

- 支持 submodule 的 Git
- 带 Corepack 的 Node.js 24
- Java 21
- 首次下载源码、npm/pnpm/Yarn 依赖、TLA+ Tools 和 CommunityModules 时可访问网络

TLA+ runner 用 SHA-256 固定 Tools 1.8.0 和 CommunityModules `202505152026`。JAR 只保留在本地 cache，绝不会被提交或进入 Release asset。

## Clone 与完整性验证

```sh
git clone https://github.com/Stool233/cordis-formal-study.git
cd cordis-formal-study
npm ci
npm run bootstrap:core
npm run verify
```

`bootstrap:core` 初始化 Cordis 与论文，验证 gitlink 和 HEAD，并执行 Cordis immutable Yarn install。由于源码仓库不跟踪生成的 `yarn.lock`，门户会验证 [`locks/cordis.yarn.lock`](../locks/cordis.yarn.lock)，仅在 Cordis 安装或证据命令需要 Yarn 时将其放入源码树，命令结束后删除临时副本；若已有内容相同的 lock 则予以保留，内容不同则拒绝覆盖。`bootstrap:full` 还会初始化 DeepSeek Harness，并执行 frozen pnpm install。

完成 core bootstrap 后，`npm run verify` 会检查所有已提交 gitlink 和已初始化的核心源码集；若 DeepSeek Harness submodule 被有意保持为未初始化，其内容检查会暂缓。完成 full bootstrap 后，使用 `npm run verify -- --full` 要求并验证全部三个源码树。CI 使用 full 形式。

已经初始化的 submodule 必须 clean，且精确位于 lock 中的 commit。bootstrap 不会 reset、checkout、clean 或覆盖它，而是直接失败。如果检查失败，应先手动检查 submodule 并保留自己的工作，再重试。

## 运行证据

```sh
npm run reproduce:core
npm run reproduce:full
npm run reproduce:nightly
```

`reproduce:core` 把 Cordis PR profile 输出到 `.artifacts/cordis-pr`。`reproduce:full` 运行 core profile，再把 vendored/AgentLoop 一致性输出到 `.artifacts/deepseek-harness`。`reproduce:nightly` 把扩大后的 Cordis profile 输出到 `.artifacts/cordis-nightly`。

AgentLoop 场景使用 `mountAgentLoopTestDependencies()`，不需要 API key 或 provider network。它验证装配、依赖解析、quiescence 与完整 teardown。

生成后再次运行 `npm run verify`。验证器会检查完整 `TraceMatched`、精确的场景与前提集合、四个被拒绝的 mutations、required model properties、相对路径，以及匹配的实现 revision。

## CI 触发映射

门户是主要的跨仓触发入口：

| 仓库 / workflow | 触发条件 | 是否运行 TLC | 主要命令 |
| --- | --- | --- | --- |
| 门户 / `Integrity` | 每次 push 和 pull request | 否 | `npm test` 与 `npm run verify -- --full` |
| 门户 / `Conformance` | 手动触发；相关 pull request；`main` 的相关 push | 是 | `npm run reproduce:full` |
| 门户 / `Nightly` | 手动触发；每周一 03:17 UTC | 是，扩大 profile | `npm run reproduce:nightly`，随后运行 `npm run reproduce:full` |
| Cordis / `Paper conformance` | 相关 pull request；Cordis `main` 的相关 push | 是 | `yarn formal:check --quiet` |
| Cordis / `Paper conformance nightly` | 手动触发；workflow 位于默认分支后每天 17:23 UTC | 是，扩大 profile | `yarn formal:nightly --quiet` |
| DeepSeek Harness / `Cordis paper conformance` job | 仅 pull request | 是，vendored 轨迹 | `pnpm test:cordis-paper` |

research 分支有意不把单独 push 当作 Release 触发条件：Cordis 的 PR workflow 只在 `main` 接受 push 事件，DeepSeek Harness 相关 job 也带有 pull-request 条件。在当前个人 fork 布局中，应手动触发门户 `Conformance` workflow，或通过门户 `main` 的固定源码变更触发完整验证主流程。

## 分支专用检查

比较变体时应使用独立 checkout；如果把门户 submodule 切离 lock 固定的一致性 revision，`npm run verify` 会按设计失败。

- 在 `research/paper-trace-baseline` 上，Cordis 运行 `yarn formal:baseline --quiet`；DeepSeek Harness 运行 `pnpm test:cordis-paper`，并让 `CORDIS_FORMAL_ROOT` 指向匹配的 Cordis 基线 checkout。已知 mismatch 必须精确报告；意外通过或新增失败都属于错误。
- 在 `research/paper-conformance` 上，Cordis 运行 `yarn formal:check --quiet`；DeepSeek Harness 对该 Cordis checkout 运行 `pnpm test:cordis-paper`。全部 required 轨迹必须通过，四个 mutations 必须按要求被拒绝。
- 在 `fix/paper-conformance` 上，运行 Cordis 或 DeepSeek Harness 的普通回归、类型、lint 和文档检查。该分支没有 trace sink，因此不直接运行轨迹 refinement。

## 打包 Release 证据

PR、nightly 和 vendored 证据全部存在后运行：

```sh
npm run package -- --version 0.1.0
```

命令会创建：

- `dist/cordis-formal-study-v0.1.0-evidence.tar.gz`
- `dist/SHA256SUMS`

归档包含报告、轨迹、mutation counterexamples 与 failure metadata、provenance、study lock 和文件 manifest；依赖目录、JAR、TLC metadir、PDF 与本机路径会被排除。归档条目顺序和元数据是确定性的。

## 本地 Cordis override

DeepSeek Harness 源码 runner 通常通过 `CORDIS_FORMAL_ROOT` 接收门户 submodule。在门户外开发 Cordis 修改时，同一个 DSH 命令也可指向另一 clean checkout：

```sh
CORDIS_FORMAL_ROOT=/path/to/cordis \
  pnpm --dir sources/deepseek-harness test:cordis-paper
```

这种 override 只属于开发证据。门户 Release 必须使用 lock 固定的 gitlink 与 revision。
