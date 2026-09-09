# Three requirements from the paper

English | [中文](paper.zh-CN.md)

The reading source is *A Programming Paradigm for Spatiotemporal Composability*, [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1), 92 pages. The version entry still listed v1 when checked on 2026-09-10; the [lock](../current.lock.json) records the exact version and PDF hash.

## Dependencies and cleanup

A provider supplies a service, and a consumer declares and uses it. Activation establishes the consumer's dependency binding. Its cleanup code may still need the resource owned by that provider. Stopping new dependencies and reclaiming resources needed by existing dependencies therefore occur at different times.

Retirement means that a component has been asked to leave. Asynchronous cleanup can still be running, so the runtime needs to find the component until that work finishes.

## Correspondence

| Paper requirement | Behavior checked in the implementation | Paper location |
| --- | --- | --- |
| A provider's recovery is guarded by its committed dependents | The provider resource remains available until the consumer finishes asynchronous cleanup | Guarded L-Unload and Theorem 70 in §4 |
| Removal requires an Inactive component with no retained bindings or children | A consumer stays in the runtime registry during cleanup and is removed afterward | O-Remove in §4 |
| Target and committed views record provider identities | Replacing a provider produces a new consumer binding even when the service value is unchanged | Definition 53 and the lifecycle rules |

These correspondences are grounded in the [paper](https://arxiv.org/pdf/2608.25512v1). Registry discoverability is an implementation condition needed to enforce dependency cleanup order; the paper does not prescribe a JavaScript registry data structure.

## Applying the conclusions

Locate the checked source through [Implementation](implementation.md), then read the inputs, observation points, and assertions in [Verification](verification.md). Cleanup order applies along established dependency bindings; it does not directly generalize to arbitrary parent-child relationships or undeclared external effects.

This project confirms the correspondence between these rules and concrete regression scenarios. Passing behavior tests cover the pinned implementations and given scenarios; a formal proof of the full calculus is outside this check set.
