# 可复现的形式化工具

[English](README.md) | 中文

形式化命令按版本锁中的 SHA-256，从当前 checkout 选择 JAR。运行所需的 TLC 和 Community Modules 文件都由 checkout 提供。

## 保存的工具

| 用途 | 工具 | SHA-256 前缀 |
| --- | --- | --- |
| 观测工具包兼容检查 | TLC，构建于 2026-08-11 | `ab323b79802a` |
| TLC 贡献重放与上游对齐 | TLC，构建于 2026-09-04 | `b658b4e504fd` |
| 两套工具链 | Community Modules `202505152026` | `044e8ecdfbca` |

[artifacts.json](artifacts.json)记录完整哈希、字节数、上游构建提交、原始 URL 和恢复来源。三份 JAR 合计约 13.2 MiB，作为普通 Git 文件保存。

8 月的 TLC 构建从[成功 CI 31922162491](https://github.com/Stool233/cordis-formal-study/actions/runs/31922162491)的产物 `9256716215` 恢复，其中两份副本均匹配原研究哈希。9 月的构建和 Community Modules 来自匹配版本锁的本地副本。运行命令使用提交到本仓库的文件。

## 选择与校验

[toolchain.mjs](../scripts/lib/toolchain.mjs)按工具名、版本和完整哈希匹配选定的版本锁，然后校验文件字节。它通过以下变量将绝对路径传给观测工具包：

```text
CORDIS_TLA_TOOLS_JAR
CORDIS_TLA_COMMUNITY_JAR
```

工具包在运行 Java 前再次检查哈希。每份 JAR 的文件名包含完整哈希。显式环境变量覆盖也必须匹配所选哈希；文件缺失、损坏或版本不符都会让运行停止。发生这些错误时，从 Git 恢复匹配的文件。

TLC 贡献重放和 Upstream alignment 使用这个解析器，包括 Harness 子进程。直接调用旧 fork 的 runner 时，设置相同变量。本地副本不可用时，安装依赖和获取源码需要网络访问。

## 检查

```sh
npm test
npm run test:tools
npm run verify
```

`npm test` 检查工具选择、无效文件、环境变量覆盖和 manifest 校验。`test:tools` 需要 Java 21：它在工具包进程中禁用 fetch，向旧缓存文件名写入错误字节，用两套工具链分别解析五个模块，并运行一个包含两个状态的 TLC 模型。Upstream alignment 在生成轨迹前执行这项检查。`verify` 校验每份工具文件的哈希。

## 更新工具

1. 获取指定构建，核对 digest、元数据和许可声明。以完整 SHA-256 命名保存文件，并在 `artifacts.json` 记录来源。
2. 更新目标实验的工具版本和哈希。保留现有版本锁引用的文件。
3. 运行离线检查和受影响实验的模型、轨迹、变异及行为检查。审阅结果后，将工具文件与版本锁一起提交。

上游 [`v1.8.0` 发布 workflow](https://github.com/tlaplus/tlaplus/blob/master/.github/workflows/main.yml)会替换同一 tag 下的资产。通过 manifest 记录的完整哈希选择构建。

## 许可证

仓库保留 JAR 原始字节和内嵌声明，并附带 [TLA+ MIT 许可](licenses/tlaplus-MIT.txt)、[Community Modules 许可](licenses/CommunityModules-LICENSE)、[Commons Math 许可](licenses/tlaplus-CommonsMath-LICENSE.txt)、[Commons Math 声明](licenses/tlaplus-CommonsMath-NOTICE.txt)、[JLine 声明](licenses/tlaplus-jline-LICENSE.txt)、[EPL-2.0 许可](licenses/tlaplus-META-INF-LICENSE.md)和 [TLA+ 声明](licenses/tlaplus-License.txt)的副本。每个组件保留其原有许可。
