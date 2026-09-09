# 可复现的形式化工具

[English](README.md) | 中文

形式化命令使用当前 Git checkout 中的 JAR，并按现有版本锁的 SHA-256 选择，不在执行时下载 TLC 或 CommunityModules。因此，上游替换 release 资产、Actions 缓存丢失或无法访问 release 服务器，都不会改变选中的工具。

## 固定保存的资产

| 使用流程 | 资产 | SHA-256 前缀 |
| --- | --- | --- |
| 冻结的观测工具包与离线兼容检查 | TLC，构建于 2026-08-11 | `ab323b79802a` |
| TLC 贡献重放与当前上游对齐 | 2026-09-04 构建的 TLC | `b658b4e504fd` |
| 两套工具链共用 | CommunityModules `202505152026` | `044e8ecdfbca` |

[artifacts.json](artifacts.json)记录完整哈希、字节数、上游构建 commit、原始 URL 与恢复来源。三份 JAR 合计约 13.2 MiB，作为普通 Git 文件保存；checkout 即包含它们，不需要 Git LFS、release 下载或缓存恢复。证据 release 归档仍排除 JAR。

历史 TLC 从[早期成功的 CI](https://github.com/Stool233/cordis-formal-study/actions/runs/31922162491)产物 `9256716215` 中恢复，产物内的两份副本都匹配原始研究哈希。迁移 TLC 与 CommunityModules 来自本地保留副本，均匹配各自版本锁。旧 CI 产物仅作为来源记录，不是运行依赖；其后续过期不会影响已入库的副本。

没有为适应 release 替换而修改 [study.lock.json](../study.lock.json) 或 [alignment.lock.json](../alignment.lock.json)。锁定的论文、模型、实现版本和历史生成报告也保持不变。

## 如何选择与校验

[toolchain.mjs](../scripts/lib/toolchain.mjs)按工具名称、版本和完整哈希匹配所选 lock，先验证文件内容，再将 kit 已支持的环境变量传给每个形式化子进程：

```text
CORDIS_TLA_TOOLS_JAR
CORDIS_TLA_COMMUNITY_JAR
```

锁定 kit 会在运行 Java 前再次验证哈希。历史与迁移 TLC 使用不同的哈希文件名，可以在同一 checkout 中共存；缓存里陈旧的 `tla2tools-1.8.0.jar` 不会被使用。仍支持显式环境变量覆盖，但文件必须匹配选中的哈希。覆盖文件缺失、损坏或版本错误都会失败，不会静默回退。

入口仓库将配置传入 Harness 子进程以及直接执行的 Cordis 命令。TLC 贡献重放和 Upstream alignment 使用同一个解析器。直接调用旧 fork 的 runner 时仍需显式提供这些环境变量，才能避开其原始下载路径。

尚未安装的依赖及源码 checkout 仍需要通常的网络访问；本次消除的是形式化工具获取对网络的依赖。

## 检查方式

```sh
npm test
npm run test:tools
npm run verify
```

`npm test` 覆盖锁选择、文件缺失或损坏、错误覆盖与 manifest 边界。`test:tools` 需要 Java 21：它在真实 kit 进程中禁止 fetch，将旧缓存文件名写入错误内容，分别使用两套固定工具解析五个模块，并运行一个两状态 TLC 冒烟模型。Upstream alignment 在重新生成轨迹前运行该检查。`verify` 校验每份入库资产的哈希。

## 有意升级工具

1. 获取指定上游构建，核对 digest、构建元数据和许可说明；以完整 SHA-256 保存文件，并将来源加入 `artifacts.json`。
2. 只修改目标实验的工具 pin，显式记录迁移；保留历史锁仍使用的资产。
3. 运行离线检查，以及受影响实验的完整模型、轨迹、mutation 和普通门禁。评审差异后，将新资产与版本锁一起提交。

流程不会自动采纳新 release 哈希。上游 [`v1.8.0` 发布 workflow](https://github.com/tlaplus/tlaplus/blob/master/.github/workflows/main.yml)会删除并替换同一 tag 下的资产；该 URL 用于记录来源，不代表内容不可变。

## 许可证

JAR 原始字节与内嵌声明均保留。同时附带上游 [TLA+ MIT 许可](licenses/tlaplus-MIT.txt)、[CommunityModules 许可](licenses/CommunityModules-LICENSE)，以及随包的 [Commons Math 许可](licenses/tlaplus-CommonsMath-LICENSE.txt)、[Commons Math 声明](licenses/tlaplus-CommonsMath-NOTICE.txt)、[JLine 声明](licenses/tlaplus-jline-LICENSE.txt)、[内嵌 EPL-2.0 许可](licenses/tlaplus-META-INF-LICENSE.md)、[TLA+ 声明](licenses/tlaplus-License.txt)。这些第三方文件保留其原有许可，不适用门户文档许可。
