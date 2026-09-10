# 复现我们的贡献

[English](reproduce.md) | 中文

使用 Node.js 24 和 Java 21。Checkout 包含 TLC 和 Community Modules。先在仓库根目录安装 npm 依赖。

## 重放选定的 TLC 证据

```sh
npm ci
npm test
npm run verify
npm run check:contributions -- --output .artifacts/contributions/local
```

预期结果是：**6 份修复前轨迹被拒绝，6 份修复轨迹被接受，2 个负向对照被拒绝**。每份真实轨迹都会运行原始检查器和聚焦卸载守卫。可以在指定输出目录查看 `report.json`、`tlc.log` 和 `counterexample.json`。只有全部预期结果得到确认，命令才会写入成功汇总；任何非预期结果都会让运行失败。

这个命令对已提交的实现观测运行 TLC。[贡献锁](../contributions.lock.json)记录源码提交、轨迹哈希、模型哈希和工具版本。

## 从源码重新生成修复轨迹

准备干净 checkout：Cordis 为 `18c327f4566e8f640737c43a480e6d74a0673579`，Harness 为 `fdcd1ce36a296ab2288bf407fccba4c8fa634963`。两份仓库都需要包含观测工具所用的历史 Git 对象。日常 checkout 若有工作内容，请使用独立 worktree。启用 Corepack 后执行：

```sh
git submodule update --init --recursive
npm run test:tools
npm run reproduce:alignment -- --cordis /path/to/fixed-cordis --deepseek-harness /path/to/fixed-harness
```

命令安装锁定依赖，在隔离 worktree 应用固定观测补丁，重新生成轨迹并执行工具包检查。最后的贡献检查要求六份选定修复轨迹与已提交证据一致，再运行 TLC。结果位于 `.artifacts/alignment/run-*/evidence/`，贡献报告为其中的 `contributions/report.json`。[对齐 workflow](../.github/workflows/upstream-alignment.yml)自动完成 checkout 和工具链准备。

[study.lock.json](../study.lock.json)锁定观测工具包及其前置条件；[alignment.lock.json](../alignment.lock.json)锁定当前修复源码和适配补丁。这些版本锁记录复现使用的模型和观测代码。[归档](../archive/README.zh-CN.md)记录最初采集修复前轨迹的过程。

## 执行补充行为检查

```sh
npm run check:current -- --output .artifacts/current/local
npm run verify -- --report .artifacts/current/local/report.json
```

命令获取锁定 Git 对象，将源码导出到临时目录执行。可附加 `--cordis ../cordis --deepseek-harness ../deepseek-harness` 从本地仓库读取 Git 对象；执行使用临时目录中导出的源码。六个补充回归必须全部通过。

## 审阅后再更新版本

修改版本锁前，先审阅新论文或新实现。重新生成相关问题两侧的证据，检查实际违规恢复步骤，执行修复源码验证和负向对照，再更新轨迹与报告。每项贡献都需要实现缺陷及其修复的证据。采用新的工具哈希前，先审阅字节变化。
