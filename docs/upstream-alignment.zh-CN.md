# 上游对齐 — 2026-09-09

[English](upstream-alignment.md) | 中文

生命周期修复已迁移到官方 Cordis `f8ea3cd` 与 Harness `5dda764`，新版候选通过了共用的历史规格检查。原始三阶段快照保持不变。

下文记录的通过发生在 TLC 资产再次被替换之前。由此导致的 [CI 失败](#论文审阅后的-ci-核对)已通过[固定保存精确锁定资产](../tools/README.zh-CN.md)处理，其中包含找回的原始 TLC。下文保留当时的运行结果。

## 迁移验证结果

| 检查 | Cordis | DeepSeek Harness |
| --- | ---: | ---: |
| 无插桩源码上的原始行为断言 | 4 / 4 通过 | 4 / 4 通过 |
| 被接受的实现轨迹 | 13 / 13 | 17 / 17 |
| 被拒绝的语义 mutation | 4 / 4 | 4 / 4 |
| 普通回归 | 24 个文件，248 项 | 6 个文件，265 项 |
| Build 与 lint | 通过 | 通过 |
| 仓库文档 / hygiene 检查 | 本地 Markdown 检查通过 | 34 / 16 项通过 |

五项 PR 模型配置全部通过，Cordis 观测审计覆盖 29 个写入点。候选提交为 [`18c327f`](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579) 与 [`fdcd1ce`](https://github.com/Stool233/deepseek-harness/tree/fdcd1ce36a296ab2288bf407fccba4c8fa634963)，均位于 `codex/upstream-alignment-2026-09-09`。

[alignment.lock.json](../alignment.lock.json)标识全部源码与观测补丁。[生成的聚合报告](alignment-report.json)记录实际检查，[完整快照](upstream-alignment.json)还保留上游对比。运行本次迁移，请看[复现指南](reproduce.zh-CN.md#本次迁移)。

这些结果使用历史论文导出的模型，并显式记录较新的 TLC 资产，不是原始工具 lock 的成功重放。独立的 [arXiv v1 审阅](arxiv-review.zh-CN.md)已完成结论与前提对齐：保留 cleanup 修复，收窄发布、恢复与合流主张。完整 arXiv 演算的形式化验证仍为 `not-validated`。

仓库中的聚合 JSON 是摘要副本，其中的相对报告路径指向复现生成的 `evidence/` 目录。[本次迁移的 CI](../.github/workflows/upstream-alignment.yml)独立于历史 workflow 发布这些证据。

## 修复如何适配当前代码

- **Cordis core：**保留上游的失败 fiber 保护，再移植 dependent cleanup 顺序、retirement 可见性、生命周期发布与单一激活检查点。
- **Cordis loader：**按所属树的生命周期判断 self-disposal。当前 HMR 已在 drain 前保存旧 fiber，旧逻辑补丁已不需要。
- **Harness：**移植 vendored 生命周期修复，保留重入 cleanup 与延迟 config 解析。Session persistence 直接使用当前 handle 的 drain / close 机制，旧 coordinator 补丁已不需要。

新回归能拒绝原代码：未修复时，Cordis 四项用例与 Harness 两项用例失败。独立行为 probe 还在 Vitest 之外复现 Harness 的传递激活失败。迁移后的实现通过全部原始行为断言。

Harness 的 JSONL 测试首次运行缺少当前版本要求的原生 POSIX 锁模块。执行 `pnpm run build:native-system` 后，175 项 JSONL 测试全部通过；加上生命周期、配置重载、HMR 与 AgentLoop 检查，共覆盖 265 项。这些检查不调用外部模型 API。

## 取得的版本

| 对象 | 本次取得的官方版本 | 相对研究基线 |
| --- | --- | --- |
| Cordis `main` | [`f8ea3cd50f1a5724e8e715995bcde131c9c12b2c`](https://github.com/cordiverse/cordis/commit/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c) | 新增 21 个提交，63 个文件变化。 |
| DeepSeek Harness `master` | [`5dda764ed3aa172535a7967b06ff95d9cbfe536a`](https://github.com/deepseek-ai/deepseek-harness/commit/5dda764ed3aa172535a7967b06ff95d9cbfe536a) | 新增 3,796 个提交；`vendor/cordis/src` 的 Git tree 与研究基线完全相同。 |
| 论文 `main` | [`0d43a6f18004a7b5bf9662c31aa08c3712d232ec`](https://github.com/cordiverse/paper/commit/0d43a6f18004a7b5bf9662c31aa08c3712d232ec) | 新增 3 个提交；移除仓库内 PDF，改为链接 arXiv。 |

开始本次核对时，学习门户基线为 `c00023c`。两个 fork 的历史 baseline、conformance、upstream-fix 分支均仍指向 lock 中的 revision。官方最新源码保存在 `.artifacts/upstream/<repository>/<revision>/` 的独立 detached worktree；实验插桩保存在名称包含 `observed` 的独立目录中。

## 未修改上游与历史对照

| 检查 | 本次结果 | 含义 |
| --- | --- | --- |
| 门户单元测试 | 13 项通过 | 原有 lock、报告、阶段与证据校验仍有效。 |
| 最新 Cordis 普通门禁 | `core hmr loader include timer` 共 243 项通过；core build、完整 build、lint 通过 | 覆盖本次上游变更涉及的主要包。 |
| 最新 Harness 普通门禁 | lifecycle 与新的 session storage contract 共 29 项通过；build、lint、34 项 doc-sync 门禁通过 | 旧的 persistence、preparations、write-behind 测试文件已移除，需要使用当前测试入口。 |
| 最新实现行为 probes | Cordis 4 项、vendored Cordis 3 项历史失败精确复现 | probes 只替换实现导入地址，断言和预期失败集合沿用锁定 baseline。 |
| 最新 Cordis 插桩诊断 | 13 条轨迹中 9 条 mismatch；29 个观测点通过 | 使用旧论文模型和下述新版 TLC；保留上游新增的 `_error` 重入保护。 |
| 最新 vendored Cordis 插桩诊断 | 17 条轨迹中 10 条 mismatch，包括当前 AgentLoop 装配场景 | vendored 插桩从 baseline 移植，运行逻辑未加入研究修复。 |
| 旧规格在新版 TLC 上的诊断 | 5 组 PR 有界模型通过 | 只确认旧模型可在新工具上运行。 |
| 历史 Cordis conformance 对照组 | 13 条轨迹通过，4 个 mutant 全部被拒绝 | 新工具仍能区分原有正、负样本。 |
| 历史 Harness conformance 对照组 | 17 条轨迹通过，4 个 mutant 全部被拒绝 | 使用其锁定 revision 的场景与实现。 |
| 历史 upstream-fix 阶段 | Cordis 76 项、Harness 153 项测试通过；两者 build/lint 及 Harness doc-sync 通过 | `npm run reproduce:upstream-fix` 成功，`formalStatus` 仍为 `not-run`。 |
| 原版完整三阶段复现 | 在 TLC 下载哈希检查处停止 | 没有生成本次“完整研究通过”的聚合报告。 |

行为失败仍为 provider 资源过早回收、retiring consumer 过早不可发现、传递激活没有在等待 provider 后收敛，以及仅 Cordis 出现的 deferred reload 未被 dispose 正确取消。普通测试通过与这些历史问题仍存在可以同时成立。

## TLC 下载发生了变化

首次对比时，TLA+ 官方 [`v1.8.0` release 元数据](https://api.github.com/repos/tlaplus/tlaplus/releases/tags/v1.8.0)显示，`tla2tools.jar` 资产更新时间为 `2026-09-04T17:12:07Z`。当时下载内容的 SHA-256 与研究 lock 不同：

```text
历史锁定：ab323b79802aedc3203b3f9af37c6aca3ed43f4e0225b36f2aa77b26de46c05f
迁移锁定：b658b4e504fdf0b721caf7066320f6b6fe5805f4dd2f717d0e47baba4097205e
```

该次哈希经实际下载与当时的 GitHub 资产 digest 双重核对。CommunityModules 的固定哈希仍一致。本机找到的其他 TLC 文件均不匹配原始哈希。

原 runner 正确拒绝了新文件。未修改上游的对照检查使用 `.artifacts/upstream/toolchain-diagnostic/` 中的规格副本，只更新 runner 和 provenance 的工具哈希；TLA+ 模型、场景与期望断言保持不变，输出也与历史三阶段目录隔离。因此这些结果是**新版工具链上的诊断证据**，不能冒充原 lock 的成功复现。

本机使用独立安装并校验 SHA-256 的 Temurin 21，位于 `.artifacts/toolchains/`。运行 TLC 前，将其 `Contents/Home/bin` 加入 `PATH`；这也适用于后续提供原始哈希 JAR 后的历史复现。

### 论文审阅后的 CI 核对

提交 `dc6d4db` 的 [Integrity](https://github.com/Stool233/cordis-formal-study/actions/runs/34263588196)通过。[Upstream alignment](https://github.com/Stool233/cordis-formal-study/actions/runs/34263588233)通过原始行为断言与 29 点观测审计，随后在 TLC 下载哈希校验处停止，尚未执行模型。[历史 Conformance](https://github.com/Stool233/cordis-formal-study/actions/runs/34263588132)也在同一下载检查处受阻，其预期哈希不同。

官方资产现记录 `updated_at: 2026-09-08T17:57:45Z`。本地重新下载的哈希与 GitHub digest、本次 CI 观测一致：

```text
4c7bb1f6b050d56c197ee9ddd6e57fe521eae175f5043c9fb98b169f7b2d5407
```

这是第三份资产，不匹配任何一份锁定 JAR。此前[迁移成功的运行](https://github.com/Stool233/cordis-formal-study/actions/runs/34257716674)仍是其记录工具链的证据。两份锁与通过的聚合报告均未改写。复现需要取得对应资产，或显式记录并单独验证一次工具链迁移；重复全新下载不能消除这个 mismatch。

随后从 [CI 运行 31922162491](https://github.com/Stool233/cordis-formal-study/actions/runs/31922162491)找回了精确的历史资产。它与保留的迁移资产、CommunityModules 现已按完整哈希提交入库。[工具获取流程](../tools/README.zh-CN.md)为两条路径及 Harness 子进程提供这些文件，不再访问滚动 release。测试在禁止下载、旧缓存损坏的情况下，两套固定 kit 仍能解析全部模块并运行 TLC。历史版本锁与报告均保持不变。

## 论文对应关系

锁定论文为 88 页；当前官方入口是 [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1)，92 页。新 PDF 的 SHA-256 为 `390775dbc9debdcf2ed1b076eed013387ca057630be3cb594617b2b742e48cf0`。以下是主题与位置索引，**不表示两个版本的命题及前提等价**。

| 研究中引用的结果 | arXiv v1 对应位置（PDF 页） |
| --- | --- |
| Theorem 7：recovery invariance | Theorem 7，11 页 |
| Theorem 16：reverse recovery | Theorem 16，15 页 |
| Theorem 20 / Corollary 21：independent withdrawal / permutation | Theorem 43 及其证明，28 页 |
| Lemma 54：locality | Lemma 59，40–41 页 |
| Lemma 55 / 56 / 57：observational invariance、equivariance、vestigial entries | Lemma 60 / 61 / 62，41 / 42 / 42 页 |
| Theorem 59：preservation | Theorem 64，43 页 |
| Theorem 61 / Corollary 62：recovery exactness / terminal recovery | Theorem 68 / Corollary 69，46–47 页 |
| Theorem 63：ordering | Theorem 70，47–48 页 |
| Theorem 64：resolution coherence | Theorem 71，48 页 |
| Theorem 66：progress | Theorem 73，49–50 页 |
| Theorem 73：confluence | Theorem 80，54–55 页 |

[已完成的审阅](arxiv-review.zh-CN.md)记录了命题与前提差异。独立性依赖 context discipline 与每个 key 的见证，并单独处理 entangled steps；recovery 比较可观察的表。新进展界为 `(K + 3)(V(n) + 1)`。Failure 移到 §4.4，仍不属于合流范围；研究保留 `PairwiseIndependent` 与 `NoFailure`。

两处既有过度表述也已修正：论文允许 L-Leave 前存在 Active/target mismatch；现有合流乘积模型只比较关闭状态，实现装配样本覆盖两个插入顺序，均不等于完整定理。历史 mismatch 数量和当前通过报告仍是锁定检查器的精确结果，其中的性质名称不是一般 arXiv 定理的证书。

## 复跑行为核对

先完成 `npm run bootstrap:study`，取得 baseline probe 所在的 Git 对象。为待检查的源码建立干净 checkout 并安装其依赖，然后运行：

```sh
npm run check:upstream:behavior -- \
  --cordis .artifacts/upstream/cordis/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c \
  --deepseek-harness .artifacts/upstream/deepseekHarness/5dda764ed3aa172535a7967b06ff95d9cbfe536a \
  --output .artifacts/upstream/behavior-5dda764
```

该命令在执行前后检查 HEAD 与 clean 状态，记录 probe revision、源码 tree、失败名称及报告。返回 0 仅表示精确复现历史失败；失败被修复、新增失败或运行错误都会使命令失败。它不执行 TLC，不声称实现符合论文。

本次最新 Cordis 的 workspace 版本已变化，原 `locks/cordis.yarn.lock` 不能直接用于 immutable install。[锁文件差异](../locks/cordis-upstream-2026-09-09.patch)只对齐 workspace 依赖声明，保留其余依赖解析。对新建的本次 Cordis checkout，可以先复制原锁文件，再应用该 patch，最后执行 `corepack yarn install --immutable`。结果的 SHA-256 必须为 `63c466e312539eb356da77419002e931b4a54dc769f2fb562f66932d61bed537`；已实际重建核对。历史三阶段仍使用原锁文件。

原始日志位于 `.artifacts/logs/`。本次证据位于 `.artifacts/upstream/`：`behavior-5dda764/`、`model-diagnostic/`、`cordis-trace-diagnostic/`、`deepseekHarness-latest-trace-diagnostic/`、`conformance-control/`、`deepseekHarness-conformance-control/`；历史无插桩门禁报告仍在 `.artifacts/stages/03-upstream-fix/`。
