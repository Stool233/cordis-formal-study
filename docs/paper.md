# Three requirements from the paper

English | [中文](paper.zh-CN.md)

The reading source is *A Programming Paradigm for Spatiotemporal Composability*, [arXiv:2608.25512v1](https://arxiv.org/abs/2608.25512v1), 92 pages. The version check on 2026-09-10 returned v1; the [lock](../current.lock.json) records the exact version and PDF hash.

## Dependencies and cleanup

A provider supplies a service, and a consumer declares and uses it. Activation establishes the consumer's dependency binding. Its cleanup code may still need the resource owned by that provider. Stopping new dependencies and reclaiming resources needed by existing dependencies therefore occur at different times.

Retirement means that a component has been asked to leave. Asynchronous cleanup can still be running, so the runtime needs to find the component until that work finishes.

## Correspondence

| Paper requirement | Behavior checked in the implementation | Paper location |
| --- | --- | --- |
| A provider's recovery is guarded by its committed dependents | The provider resource remains available until the consumer finishes asynchronous cleanup | Guarded L-Unload and Theorem 70 in §4 |
| Removal requires an Inactive component with no retained bindings or children | A consumer stays in the runtime registry during cleanup and is removed afterward | O-Remove in §4 |
| Target and committed views record provider identities | Replacing a provider produces a new consumer binding even when the service value is the same | Definition 53 and the lifecycle rules |

See the rules in the [paper](https://arxiv.org/pdf/2608.25512v1). Cordis uses the registry to find consumers whose cleanup the provider must await.

## Applying the conclusions

Locate the checked source through [Implementation](implementation.md), then read the inputs, observation points, and assertions in [Verification](verification.md). The ordering requirement follows established dependency bindings. Applying it to parent and child components or external effects requires establishing those bindings and the theorem premises.

The tests check these behaviors in the implementations and scenarios recorded by the version lock.

The [contribution guide](contributions.md) documents the two cleanup defects. Provider identity helps explain service bindings and has a supporting regression test.
