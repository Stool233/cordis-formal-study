# 论文中的三个关键要求

[English](paper.md) | 中文

阅读对象是 *A Programming Paradigm for Spatiotemporal Composability*，[arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1)，92 页。2026-09-10 核对版本入口时仍为 v1；精确版本与 PDF 哈希记录在[版本锁](../current.lock.json)中。

## 先理解依赖与清理

Provider 提供服务，consumer 声明并使用服务。Consumer 激活时形成依赖绑定；它的清理代码可能仍需访问这个绑定对应的 provider 资源。因此，“停止接受新的依赖”和“回收现有依赖需要的资源”是两个不同的时点。

Retirement 表示组件已被要求退出。组件仍可能有异步清理工作，运行时需要继续找到它，直到这些工作结束。

## 对应关系

| 论文要求 | 实现中核对的行为 | 原文位置 |
| --- | --- | --- |
| Provider 的恢复受其 committed dependent 的状态约束 | Consumer 完成异步清理前，provider 资源保持可用 | §4 的 guarded L-Unload 与 Theorem 70 |
| 移除要求组件已 Inactive，并且没有保留的绑定和子节点 | 正在清理的 consumer 保留在运行时 registry 中，清理后移除 | §4 的 O-Remove 规则 |
| Target 与 committed view 记录 provider 身份 | 替换 provider 时，即使服务值相同，也观察到新的 provider 绑定 | Definition 53 与生命周期规则 |

这些对应关系来自[论文原文](https://arxiv.org/pdf/2608.25512v1)。Registry 的可发现性是实现执行依赖清理顺序所需的条件；论文并不规定 JavaScript registry 的具体数据结构。

## 怎样使用这些结论

先按[实现说明](implementation.zh-CN.md)定位被检查的源码，再看[验证说明](verification.zh-CN.md)中的输入、时点与断言。清理顺序沿已建立的依赖绑定成立，不能直接推广到任意父子组件或没有声明的外部副作用。

本项目确认上述规则与具体回归场景的对应关系。行为测试的成功范围是锁定实现和给定场景，完整演算的形式化证明不在这组检查中。
