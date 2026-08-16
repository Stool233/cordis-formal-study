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
