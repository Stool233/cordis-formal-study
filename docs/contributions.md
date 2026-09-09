# Findings established through TLC

English | [中文](contributions.zh-CN.md)

The contribution is finding and repairing concrete lifecycle defects through observed traces and TLC. The [selected evidence](../contributions.lock.json) covers two related defects in both [pinned implementations](implementation.md). The current paper supplies the interpretation of cleanup ordering; a violation by an implementation does not refute a theorem under its premises.

## Provider recovery starts too early

A consumer binds a provider service and installs cleanup that can finish asynchronously. Disposing the provider must leave its resources available until the consumer finishes that cleanup. In the unmodified implementations, provider recovery starts while the consumer remains `Unloading` with its committed provider binding.

In the retained Cordis `async-consumer-teardown-guard` trace, provider recovery starts at event **5**; consumer cleanup finishes at event **14**. In the Harness trace, the corresponding events are **3** and **10**. The related `provider-consumer-reverse-exit` scenario exposes the same ordering defect through reverse effect recovery.

The fix records notified dependents and awaits them before recovering the provider's disposables. See the Cordis [disposal code](https://github.com/Stool233/cordis/blob/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src/fiber.ts) and the Harness [vendored implementation](https://github.com/Stool233/deepseek-harness/blob/fdcd1ce36a296ab2288bf407fccba4c8fa634963/vendor/cordis/src/fiber.ts).

## Retirement hides a consumer that still needs cleanup

Whole-root disposal can retire a consumer and its provider concurrently. Removing that consumer from the runtime list as soon as disposal starts hides ongoing cleanup from dependency discovery. The provider can then proceed even when a wait exists for the consumers it can still find.

In Cordis `concurrent-root-teardown-guard`, the consumer retires at event **4**. Provider recovery starts at **12** while that consumer is still unloading; the service is withdrawn at **20**, before consumer cleanup finishes at **23**. Harness shows the same failure at events **4**, **10**, **16**, and **18**. These are directly inspectable [before traces](../evidence/contributions/), not merely aggregate failure counts.

The fix retains the consumer's runtime membership until its cleanup settles. It complements the unload wait: the wait must discover the retiring consumer. A separate registry barrier regression checks this implementation mechanism; the projected trace alone does not expose every JavaScript registry mutation.

## Evidence chain and limits

| Evidence | Role |
| --- | --- |
| Unmodified official-source captures | Establish that the ordering problem exists before the fix |
| TLC counterexamples | Reject the offending observed recovery step |
| Fixed-source captures | Exercise the same scenarios on the current selected forks |
| Early-recovery negative controls | Show that the focused checker still rejects the dangerous ordering |
| Uninstrumented runtime regressions | Check resource availability and registry membership without observer callbacks |

The [verification guide](verification.md) owns the runnable evidence and results. Each contribution appears in both implementations; scenarios and synthetic controls are not separate discovered bugs. Provider identity remains a useful supporting regression, but this contribution set does not claim a separately discovered identity defect.

The paper's guarded **L-Unload**, **Theorem 70**, and retirement/removal rules support this reading. The theorem concerns declared bindings and its stated premises; our finite implementation traces do not establish arbitrary effects, general progress, confluence, or a refinement of the whole current calculus. See [paper reading](paper.md).
