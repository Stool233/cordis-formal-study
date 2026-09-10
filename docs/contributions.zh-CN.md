# 通过 TLC 确认的贡献

[English](contributions.md) | 中文

我们记录实现轨迹，用 TLC 检查，发现并修复了两个相关的生命周期缺陷。[证据清单](../contributions.lock.json)记录轨迹及其[实现版本](implementation.zh-CN.md)。论文的清理规则说明了声明依赖绑定下应满足的顺序。

## Provider 过早开始恢复资源

Consumer 绑定 provider 服务后，会安装可能异步完成的清理逻辑。销毁 provider 时，它的资源必须一直可用，直到 consumer 清理完成。未修改的实现在 consumer 处于 `Unloading`、保留 committed provider 绑定时，就开始恢复 provider 资源。

Cordis `async-consumer-teardown-guard` 轨迹中，provider 在事件 **5** 开始恢复；consumer 到事件 **14** 才完成清理。Harness 对应事件为 **3** 和 **10**。`provider-consumer-reverse-exit` 场景通过副作用恢复的顺序暴露同一缺陷。

修复记录被通知的 dependent，在恢复 provider 的 disposables 前等待它们结束。源码见 Cordis 的[销毁逻辑](https://github.com/Stool233/cordis/blob/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src/fiber.ts)和 Harness 的[内置实现](https://github.com/Stool233/deepseek-harness/blob/fdcd1ce36a296ab2288bf407fccba4c8fa634963/vendor/cordis/src/fiber.ts)。

## Retirement 隐藏了正在清理的 consumer

销毁根节点时，consumer 和 provider 可能同时进入退出流程。Consumer 刚开始退出就移出运行时列表，会让依赖发现过程看不到它正在进行的清理。Provider 的等待因此漏掉这个 consumer，过早开始恢复。

Cordis `concurrent-root-teardown-guard` 中，consumer 在事件 **4** 进入 retirement。它仍在卸载时，provider 在 **12** 开始恢复，在 **20** 撤销服务，而 consumer 到 **23** 才完成清理。Harness 对应事件为 **4**、**10**、**16**、**18**。可以在[修复前轨迹](../evidence/contributions/)中查看这些事件。

修复让 consumer 在清理结束前一直保留在运行时列表中，使 provider 的等待能够找到它。回归测试用屏障暂停清理，直接检查 registry 成员身份。轨迹记录生命周期和恢复事件，registry 断言检查影响这些事件顺序的实现机制。

## 修复的验证证据

| 证据 | 确认的事实 |
| --- | --- |
| 未修改上游源码的观测轨迹 | 修复前存在顺序问题 |
| TLC 反例 | 观测到的恢复步骤违反被检查的规则 |
| 修复源码的观测轨迹 | 相同场景按要求的顺序完成 |
| 提前开始恢复的负向对照 | 检查器能拒绝危险顺序 |
| 运行时回归 | 清理期间资源保持可用，consumer 保留在 registry 中 |

[验证说明](verification.zh-CN.md)记录两个缺陷在两份实现中的结果。场景用于复现缺陷，人工负向对照用于检查模型能否拒绝提前恢复。Provider 身份有一项补充回归测试。

论文的 guarded **L-Unload**、**Theorem 70** 和 retirement/removal 规则描述了相应前提下的顺序要求。我们的结果覆盖记录的执行及其声明的绑定。[论文阅读](paper.zh-CN.md)说明这些规则与被检查行为的对应关系。
