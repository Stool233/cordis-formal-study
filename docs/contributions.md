# Findings established through TLC

English | [中文](contributions.zh-CN.md)

We found and repaired two related lifecycle defects by recording implementation traces and checking them with TLC. The [evidence](../contributions.lock.json) identifies the traces and [implementation versions](implementation.md). The paper's cleanup rules explain the required ordering under declared dependency bindings.

## Provider recovery starts too early

A consumer binds a provider service and installs cleanup that can finish asynchronously. Disposing the provider must leave its resources available until the consumer finishes that cleanup. In the unmodified implementations, provider recovery starts while the consumer is `Unloading` with its committed provider binding.

In the Cordis `async-consumer-teardown-guard` trace, provider recovery starts at event **5**; consumer cleanup finishes at event **14**. In the Harness trace, the corresponding events are **3** and **10**. The `provider-consumer-reverse-exit` scenario exposes the same defect through the order of effect recovery.

The fix records notified dependents and awaits them before recovering the provider's disposables. See the Cordis [disposal code](https://github.com/Stool233/cordis/blob/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src/fiber.ts) and the Harness [vendored implementation](https://github.com/Stool233/deepseek-harness/blob/fdcd1ce36a296ab2288bf407fccba4c8fa634963/vendor/cordis/src/fiber.ts).

## Retirement hides a consumer during cleanup

Disposing the root can retire a consumer and its provider concurrently. Removing the consumer from the runtime list as soon as disposal starts hides its ongoing cleanup from dependency discovery. The provider's wait then misses that consumer and recovery proceeds too early.

In Cordis `concurrent-root-teardown-guard`, the consumer retires at event **4**. Provider recovery starts at **12** while that consumer is still unloading; the service is withdrawn at **20**, before consumer cleanup finishes at **23**. Harness shows the same failure at events **4**, **10**, **16**, and **18**. Inspect these events in the [traces before the fix](../evidence/contributions/).

The fix keeps the consumer in the runtime list until cleanup finishes, so the provider's wait can find it. A regression test pauses cleanup at a barrier and checks registry membership directly. The trace records the lifecycle and recovery events; the registry assertion checks the implementation mechanism behind their order.

## Evidence for the fixes

| Evidence | What it establishes |
| --- | --- |
| Captures from unmodified official source | The ordering problem occurs before the fix |
| TLC counterexamples | The observed recovery step violates the checked rule |
| Captures from fixed source | The same scenarios complete with the required ordering |
| Controls that start recovery early | The checker rejects the dangerous ordering |
| Runtime regressions | Resources stay available during cleanup and the consumer stays in the registry |

The [verification guide](verification.md) records results for these two defects across both implementations. The scenarios reproduce the defects, and synthetic controls check the model's ability to reject early recovery. Provider identity has a supporting regression test.

The paper's guarded **L-Unload**, **Theorem 70**, and retirement/removal rules describe the relevant ordering under their stated premises. Our results cover the recorded executions and their declared bindings. See [paper reading](paper.md) for the correspondence between those rules and the checked behaviors.
