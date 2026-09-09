# 运行当前检查

[English](reproduce.md) | 中文

需要 Node.js 24、npm、Git 和 tar。首次运行需要访问 npm 与两个 fork 的 Git 仓库；不需要模型 API key、Corepack、Java 或 TLC。

## 从干净 checkout 开始

在本仓库根目录运行：

```sh
npm ci
npm test
npm run verify
npm run check:current
```

最后一条命令自动获取[版本锁](../current.lock.json)指定的提交，导出待检查源码，并对两端执行同一组检查。正常输出包括 `Current verification: 6 / 6 passed` 和报告路径。

## 使用已有的本地 Git 仓库

```sh
npm run check:current -- --cordis ../cordis --deepseek-harness ../deepseek-harness
```

这两个路径只用于提供锁定提交的 Git 对象。命令不执行或修改它们的工作区，也不要求它们当前检出的分支等于研究分支。如果本地仓库没有该提交，可以先获取它，或省略路径让命令自动获取。

## 查看报告

可以指定输出目录，并校验刚生成的报告：

```sh
npm run check:current -- --output .artifacts/current/local
npm run verify -- --report .artifacts/current/local/report.json
```

聚合报告只在两端全部通过后生成；失败运行不会沿用该目录中的旧聚合报告。报告列出论文、Node 版本和运行平台、源码提交及 tree、检查器与依赖锁哈希、各项结果。仓库保留的[确认报告](verification-report.json)使用相同格式。

`npm test`检查锁与报告验证器的拒绝路径；`npm run verify`检查文档、版本锁和已记录报告。CI 还会重新执行真实实现检查，见[验证说明](verification.zh-CN.md)。

## 更新研究对象

更换论文版本或源码时，更新版本锁和阅读说明，核对相关规则与实现，再重跑这组检查并更新确认报告。某次通过只适用于报告中记录的输入与版本。

旧研究有独立的[归档入口](../archive/README.zh-CN.md)。
