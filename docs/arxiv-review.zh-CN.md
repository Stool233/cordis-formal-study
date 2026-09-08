# arXiv 论文审阅 — 2026-09-09

[English](arxiv-review.md) | 中文

新版论文支持保留 dependent cleanup 与 retirement 修复，同时暴露了我们在发布顺序、恢复与合流说明中的过度表述。已有通过结果仍然支持锁定模型与已观察场景，不能据此宣称整个 arXiv 演算已获验证。

本次将研究结论对齐到 [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1)，*A Programming Paradigm for Spatiotemporal Composability*。审阅当日，arXiv 仅列出 2026-08-26 提交的 v1。范围包括 §§3.3–3.4、4、5.1.3、6.1 的相关定义与论证、五个锁定 TLA+ 模块，以及轨迹生成器和 recorder。这是原文与结论审计，不是对论文全部定理的独立证明，也不是一次新的模型检查。

## 结论如何调整

| 原研究中的主张 | 审阅后的判断 |
| --- | --- |
| Consumer 完成清理前，provider 必须保留它已绑定的资源。 | **保留。** 带 guard 的 unload 规则与 Theorem 70 支持资源顺序修复。这个顺序沿依赖绑定成立，不适用于所有父子关系。 |
| Retiring consumer 必须在清理完成前保持可发现。 | **保留。** 过早消失会使实现无法执行 guard；论文的移除规则也要求 fiber 已 Inactive、没有绑定和子节点。 |
| 每个 Active fiber 在所有时刻都必须满足 `committed == target`。 | **收窄。** 这是本研究发布投影的更强不变量，不是 Theorem 71。论文允许 L-Leave 前暂时不相等。 |
| 不同 provider 返回相同值，就可以视为同一绑定。 | **不成立。** Target 与 committed view 记录 provider 身份；值相等不足以说明绑定相同。 |
| LIFO 与 resource ID 恢复足以证明完整恢复。 | **收窄。** 它们验证所记录的资源抽象；Theorem 68 还要求 inverse 见证及相关 coeffect 表的观测等价。 |
| 已有合流检查建立了 Theorem 80。 | **收窄。** 它们覆盖有界关闭乘积模型与两条装配样本，比较的状态远少于论文。 |
| 新版已经推导出独立性，因此实现可以自动假定独立。 | **不成立。** 推导要求操作经 context 中介、每个 key 有交换性见证，且 inverse、结果与 continuation 保持稳定。 |

历史 Cordis 9/13、Harness 10/17 的 mismatch 仍是精确的检查器结果，**不是 arXiv 定理反例的数量**。其中，resolution coherence 的条件性、独立性对稳定性的要求，在旧论文中就已存在。这两处修订纠正的是我们的解释，不是 v1 新近削弱了保证。

## 前提发生了什么变化

旧版恢复论证显式假设独立性；新版从受限制的组件接口推导所需关系，并单独处理 provider–consumer 的 entanglement（依赖交叠）。仅检查插件调用了 `ctx.effect()`，不能证明它满足这个接口约束。[Definitions 42–46、Theorem 47，27–30 页](https://arxiv.org/pdf/2608.25512v1#page=27)；[Definitions 55–56、Lemma 57，38–39 页](https://arxiv.org/pdf/2608.25512v1#page=38)；[Definition 65、Lemmas 66–67，44–45 页](https://arxiv.org/pdf/2608.25512v1#page=44)。

| 所需论证 | 本研究目前建立的证据 | 对结论的影响 |
| --- | --- | --- |
| 读写通过已声明的 coeffect key 完成；实例化是指定例外。 | 受控场景声明 dependency/provision 集合，recorder 不跟踪全部 JavaScript 读取或外部状态。 | 一般插件还需要单独论证 confinement。 |
| 每个共享 key 都有操作、inverse、continuation 尊重的观测等价关系。 | 轨迹比较逻辑 key、provider ID、生命周期字段与 resource ID；不记录服务值、操作结果或 inverse 函数。 | 快照相等不能建立论文的等价关系。 |
| 共享 key 的操作可交换，包括同一操作重复使用；返回结果与 continuation 稳定。 | Effects 模型检查不相交标签资源的增加与移除交换，未编码完整操作代数。 | `PairwiseIndependent` 仍是场景前提；有序 middleware 或可观察的分配句柄需另给见证。 |
| 每个返回的 inverse 满足恢复见证。 | 场景检查已注册 cleanup 与 LIFO 行为。 | 未注册效应或失败操作已造成的部分影响，不会因此获得恢复证明。 |
| Provision/dependency 交叠由生命周期 guard 处理。 | Kernel 与轨迹检查表示 committed dependent 和有 guard 的恢复。 | 不能用“所有 effect 都交换”替代 entangled-step 论证。 |

原有六个前提标记仍有用途，但必须按以下范围解释：

| 原有标记 | 对齐后的解释 |
| --- | --- |
| `AcyclicDependencies` | Theorem 73 使用 provision/dependency 交叠定义的 precedence 关系，包含可能的 provider；仅观察到无环调用序列不够。 |
| `FiniteNames` | 整条序列曾经使用的名字有限，而非每一时刻的存活 registry 有限。 |
| `BoundedIterator` | Iterator 长度存在共同上界；观察到一个有限前缀不能证明一般情况。 |
| `PairwiseIndependent` | 保守的封闭场景前提。在 context、witness、respect、entanglement 义务被表达前继续保留。 |
| `TotalProvision` | 合流结论需要此条件；kernel 的简化解析器已经把 Active provider 视作提供全部声明 key。 |
| `NoFailure` | 合流仍保留此条件。Failure 移到 §4.4 扩展，不意味着失败执行也可计为合流通过。 |

负前提场景验证的是检查器如何处理“不适用”。它们不能证明每次正向运行都满足全部六项前提或新增接口条件。

## 为什么 Active 可以暂时不同于 target

设 Active provider P 提供 `k`，Active consumer C 已绑定 `k → P`，两者都是 root 的子节点。以下是论文允许的序列：

| 执行此步骤后 | P | C | C target | C committed |
| --- | --- | --- | --- | --- |
| 初始稳定状态 | Active | Active | `k → P` | `k → P` |
| O-Retire(P) | Active，已 retired | Active | `k → P` | `k → P` |
| L-Leave(P) | Unloading，已 retired | **Active** | **⊥** | **`k → P`** |
| L-Leave(C) | Unloading，已 retired | Unloading | ⊥ | `k → P` |

O-Retire 写入 P 的 retirement 标记。L-Leave 让 P 的表退出供新激活使用的解析视图，却保留其实际表与 C 的 committed view。C 可以到后续步骤才执行 L-Leave；在 C 完成自身 unload 前，P 的 L-Unload 始终受阻。加粗状态符合论文的 well-formedness 与 ordering，它反驳的是我们的**无条件解释**，并未反驳论文。[Orchestration 与 lifecycle 规则，34–37 页](https://arxiv.org/pdf/2608.25512v1#page=34)。

Theorem 71 约束安装效应期间的 L-Iter/L-Finish，并允许 diverted iteration 随后恢复的分支，不要求每一个 Active 中间状态都相等。旧 Theorem 64 已经具有这种条件结构。[Theorem 71，48 页](https://arxiv.org/pdf/2608.25512v1#page=48)。

我们的 kernel 将级联 leave 合并进 `CascadeLeaves`，其 `ResolutionCoherence` 对所有 Active fiber 都要求相等；轨迹检查器的 `FiberWellFormed` 也如此。这是在检查一种更受限的发布策略。必须先对照事件到论文的映射，才能把某次拒绝归类为运行时违反论文。生命周期发布补丁可作为这项策略保留；provider identity 比较则另有 Definition 53 及 35–36 页说明的支持。

## 恢复、进展与合流

**恢复比较可观察的表。** Definition 51 的投影包括 Reloading、Unloading 与 Active fiber 持有的绑定。Theorem 68 比较“撤销某个 episode 后的表”与“把同一批已记录的其他 fiber 映射应用到较早状态后的表”。若要进一步把它理解为一条“该 episode 从未开始”的可执行历史，还要求该 episode 内实例化的子节点没有在期间执行步骤。Corollary 69 另保证被恢复 fiber 的表为空。这不等于恢复全部控制字段或撤销外部 emission。[Theorem 68、Corollary 69，46–47 页](https://arxiv.org/pdf/2608.25512v1#page=46)；[系统边界 §6.1，70–71 页](https://arxiv.org/pdf/2608.25512v1#page=70)。

我们的资源清单不保留 coeffect 值与操作结果。因此，LIFO 恢复和清单清空是有用的具体检查，却不能证明任意 coeffect、文件系统、网络活动或补偿策略都实现精确观测恢复。

**进展计算论文的生命周期步骤。** 旧 Theorem 66 的界为 `(K + 4)(V(n) + 1)`，新 Theorem 73 针对六条核心生命周期规则使用 `(K + 3)(V(n) + 1)`，前提包括只执行生命周期步骤、precedence 无环、iterator 有界及名字总数有限。现有 `ProgressBound` 检查场景事件预算；NDJSON 写入与单个 inverse 操作的粒度不同，不能直接代入该公式。TLA+ fairness 用于排除规格中的无限 stuttering，不能替代论文前提，也不证明一个持续接收新 orchestration 的宿主最终停止。[Theorem 73，49–50 页](https://arxiv.org/pdf/2608.25512v1#page=49)。

**合流比较的范围大于关闭终态。** Theorem 80 固定初始状态与有序 orchestration 输入，要求组件约束、无环 precedence 和 total provision，并在名字重命名与论文状态等价下比较 quiescent 状态。其规范构造包括最终仍 Active 的 fiber。[Theorem 80，54–55 页](https://arxiv.org/pdf/2608.25512v1#page=54)。

现有乘积模型只有在两边都停止、所有组件均 Inactive 时才检查 `CanonicalTerminalEquality`。两条实现样本确实以 Active fiber 结尾，但插入顺序不同（`P_A, C_A, P_B, C_B` 对 `P_B, P_A, C_B, C_A`），比较的是 recorder 快照。它们检查两个装配排列，没有量化定理固定输入下的全部合法调度，也未比较完整论文状态。参见锁定的[生成器](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/harness/generate.ts)与 [recorder](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/harness/recorder.ts)。

## 现有模型实际覆盖什么

以下源码均指向未修改的 [Cordis formal kit `d06ee04`](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal)。

| 源码 | 审阅确认的边界 |
| --- | --- |
| [CordisEffects.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisEffects.tla) | 标签资源恢复及受限交换等式，不含一般 outcome/continuation 代数。 |
| [CordisKernel.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisKernel.tla) | 有界拓扑、每个 fiber 内 dependency/provision 集合不相交、各 provision 集合不重叠、依赖已声明的 provider、rank 限制、简化 total provision 与合并的级联 leave。其 retirement 还立即退休直接子节点；这些限制与复合步骤需要显式映射到论文。 |
| [CordisRuntime.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisRuntime.tla) | `RuntimeRefinesPaper` 是局部投影不变量的合取，并不是连接具体机器与 kernel 实例的时序模拟定理。 |
| [CordisTrace.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisTrace.tla) | 用自身事件谓词完整消费记录的投影状态；该模块未实例化 kernel 的转换关系。 |
| [CordisConfluence.tla](https://github.com/Stool233/cordis/blob/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal/CordisConfluence.tla) | 固定 provider/consumer/sibling 乘积模型，比较关闭之后的相等性。 |

这些检查有实质内容，但 `RecoveryExactness`、`ResolutionCoherence`、`RuntimeRefinesPaper` 等名称是研究 operator 名称，不是相应一般论文命题的证书。它们的状态计数与 mutation 结果保持原样。

## 扩展与后续证明义务

固定 realm 可投影为 `(key, realm)`，前提是仍满足相同约束与见证。Fiber 存活期间修改 realm 或配置，论文按 revision 处理：retire、deactivate、remove，再插入新一代 fiber。Loader 的快捷路径需要证明端点等价，不能把任意原地修改当成核心规则。Failure 要求恢复成功累积的前缀，并在 revision 前抑制重新进入；当前上游的失败 fiber 保护仍有必要。[§4.4，56–57 页](https://arxiv.org/pdf/2608.25512v1#page=56)。

若要让后续可执行规格明确声称验证 arXiv 结果，剩余工作是：

1. 分开表示九条核心规则与 failure 扩展，允许合法的 Active/target mismatch、partial provision 与延后的子节点退休；给出运行时微步骤、现有复合动作与论文规则的映射。
2. 定义 key 级观测与见证，覆盖 forward/inverse 混合交换、结果与 continuation 稳定性，以及 entangled provider–consumer 情形。省略轨迹字段需要操作尊重某个等价关系，仅有稳定 ID 不够。
3. 为 runtime 与 trace 机器建立显式 simulation relation 的证明或检查。保留历史 mismatch 样本，先按新关系逐项分类，再决定是否调整预期。
4. 增加有相同有序 orchestration、终态仍有 Active fiber 的合流用例；检查新进展界时单独计算论文步骤。Realm/configuration revision 与 failure 按各自范围处理。

这些是模型迁移义务，不是撤回已观察 cleanup 回归的理由。本次已完成结论对齐，没有静默替换历史规格。

## 版本与证据记录

| 记录 | 精确来源 |
| --- | --- |
| 历史论文 | `cordiverse/paper@948a07b369c62adb3b12e102458be5c18dfb69b9`，88 页；[原 PDF](https://github.com/cordiverse/paper/blob/948a07b369c62adb3b12e102458be5c18dfb69b9/paper.pdf)。 |
| 本次审阅论文 | `arXiv:2608.25512v1`，92 页；[官方版本](https://arxiv.org/abs/2608.25512v1)。 |
| 官方仓库入口 | [`cordiverse/paper@0d43a6f`](https://github.com/cordiverse/paper/tree/0d43a6f18004a7b5bf9662c31aa08c3712d232ec)。 |
| 历史证据 | [study.lock.json](../study.lock.json)，含五个模块与固定场景集合。 |
| 当前实现证据 | [alignment.lock.json](../alignment.lock.json) 与 [alignment-report.json](alignment-report.json)，仍针对历史规格。 |

```text
历史 PDF SHA-256
4d48478dc0b6222d9f74d7db10ee776449b1209eb112632336544d32a49db97f
arXiv v1 PDF SHA-256
390775dbc9debdcf2ed1b076eed013387ca057630be3cb594617b2b742e48cf0
```

PDF 页码从 1 起计。已核对两份 PDF 哈希、比较相关原文，并目视核对生命周期规则与 resolution coherence 公式。锁定模型、报告、实现版本和预期失败集合均未修改。`latestPaperFormalStatus` 保留 `not-validated`；[对齐快照](upstream-alignment.json)中的独立 review 状态记录结论审阅完成。[研究结果](results.zh-CN.md)与[方法](method.zh-CN.md)已采用本页收窄后的解释。
