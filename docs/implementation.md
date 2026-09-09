# Current implementation

English | [中文](implementation.zh-CN.md)

“Current” on this page means the research subjects selected by [the lock](../current.lock.json). Verification targets fork commits containing the lifecycle fixes; the official bases identify their source ancestry.

## Locate the code

| Implementation | Checked fork commit | Official base | Source entry |
| --- | --- | --- | --- |
| Cordis | [18c327f](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579) | [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c) | [packages/core/src](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src) |
| Cordis in Harness | [fdcd1ce](https://github.com/Stool233/deepseek-harness/tree/fdcd1ce36a296ab2288bf407fccba4c8fa634963) | [5dda764](https://github.com/deepseek-ai/deepseek-harness/tree/5dda764ed3aa172535a7967b06ff95d9cbfe536a) | [vendor/cordis/src](https://github.com/Stool233/deepseek-harness/tree/fdcd1ce36a296ab2288bf407fccba4c8fa634963/vendor/cordis/src) |

The forks' default branches provide official code and reading entry points; the research implementations are on `codex/upstream-alignment-2026-09-09`. Reproduction reads full commits, so later branch movement does not change the selected subjects.

## Locate the contribution fixes

A fiber manages component activation, exit, and cleanup. On exit it retains the consumer's registry entry, waits for notified dependents to finish cleanup, and then recovers the provider's effects. Service resolution records the fiber providing the service. A replacement provider has a new binding identity even when it returns the same object.

The [contribution guide](contributions.md) explains the TLC findings behind the unload wait and retirement visibility fixes. The [shared supporting checks](../checks/lifecycle.mjs) observe these behaviors through real Context, plugin, dispose, and service operations. They read the provider record to confirm identity without editing runtime code or injecting trace callbacks.

## Dependencies and scope

Cordis core uses npm-locked Cosmokit; Harness uses vendored Cosmokit from the same Harness commit. [package-lock.json](../package-lock.json) fixes the checker and external dependencies. Each report records source trees, checker hashes, and the dependency-lock hash.

The supporting behavior check set covers three lifecycle scenarios in each implementation; the TLC contribution evidence has its own [scope](verification.md). Harness AgentLoop, persistence backends, and the full application suite are outside the six results. [Reproduction](reproduce.md) explains how to run the checks.
