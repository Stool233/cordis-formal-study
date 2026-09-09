# 通过 TLC 确认的贡献

[English](contributions.md) | 中文

这里的贡献是：通过实际观测轨迹和 TLC 发现具体生命周期缺陷，并完成修复。[选定证据](../contributions.lock.json)覆盖[两份锁定实现](implementation.zh-CN.md)中的两个相关问题。当前论文用于解释依赖清理顺序；实现违反这个顺序，并不等于推翻在相应前提下成立的论文定理。

## Provider 过早开始恢复资源

Consumer 绑定 provider 服务后，会安装可能异步完成的清理逻辑。销毁 provider 时，应让它的资源一直可用，直到 consumer 清理完成。未修改的实现却在 consumer 仍处于 `Unloading`、保留 committed provider 绑定时，就开始恢复 provider 资源。

保留的 Cordis `async-consumer-teardown-guard` 轨迹中，provider 在事件 **5** 开始恢复；consumer 到事件 **14** 才完成清理。Harness 对应事件为 **3** 和 **10**。相关的 `provider-consumer-reverse-exit` 场景从副作用的逆向恢复顺序暴露同一问题。

修复记录被通知的 dependent，在恢复 provider 的 disposables 前等待它们结束。源码见 Cordis 的[销毁逻辑](https://github.com/Stool233/cordis/blob/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src/fiber.ts)和 Harness 的[内置实现](https://github.com/Stool233/deepseek-harness/blob/fdcd1ce36a296ab2288bf407fccba4c8fa634963/vendor/cordis/src/fiber.ts)。

## Retirement 隐藏了尚未完成清理的 consumer

销毁整个根节点时，consumer 和 provider 可能同时进入退出流程。如果 consumer 刚开始退出就从运行时列表移除，依赖发现过程就看不到它仍在进行的清理。即使 provider 会等待它能找到的 consumer，这个 consumer 也可能被漏掉。

Cordis `concurrent-root-teardown-guard` 中，consumer 在事件 **4** 进入 retirement。它仍在卸载时，provider 在 **12** 开始恢复，在 **20** 撤销服务，而 consumer 到 **23** 才完成清理。Harness 对应事件为 **4**、**10**、**16**、**18**。这些事实可以直接检查[修复前轨迹](../evidence/contributions/)，不依赖汇总失败数量。

修复让 consumer 在清理结束前一直保留运行时成员身份。这与卸载等待配合：等待过程必须能发现正在退出的 consumer。另一个使用 registry 屏障的行为回归检查这一实现机制；投影轨迹本身并未暴露 JavaScript registry 的每一次修改。

## 证据链与边界

| 证据 | 作用 |
| --- | --- |
| 未修改上游源码的观测轨迹 | 确认修复前确实存在顺序问题 |
| TLC 反例 | 拒绝有问题的观测恢复步骤 |
| 修复后的源码轨迹 | 在当前选定 fork 上执行相同场景 |
| 提前恢复的负向对照 | 确认聚焦后的检查器仍能拒绝危险顺序 |
| 无插桩运行时回归 | 直接检查资源可用性和 registry 成员身份 |

[验证说明](verification.zh-CN.md)维护可执行证据与结果。每个贡献在两份实现中出现；多个场景和人工负向对照不各算一个新发现。Provider 身份仍是有用的补充回归，但这组贡献不单独主张发现了身份缺陷。

论文的 guarded **L-Unload**、**Theorem 70** 和 retirement/removal 规则支持上述解释。定理针对声明的绑定及其前提；这里有限的实现轨迹并未证明任意副作用、一般进展、合流性或完整当前演算的 refinement。见[论文阅读](paper.zh-CN.md)。
