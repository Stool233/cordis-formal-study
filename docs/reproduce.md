# Run the current checks

English | [中文](reproduce.zh-CN.md)

You need Node.js 24, npm, Git, and tar. The first run needs access to npm and the two fork repositories. No model API key, Corepack, Java, or TLC is required.

## Start from a clean checkout

Run these commands at the repository root:

```sh
npm ci
npm test
npm run verify
npm run check:current
```

The last command fetches the commits in [the lock](../current.lock.json), exports the selected source, and executes the same checks against both implementations. Successful output includes `Current verification: 6 / 6 passed` and the report path.

## Use existing local Git repositories

```sh
npm run check:current -- --cordis ../cordis --deepseek-harness ../deepseek-harness
```

These paths supply Git objects for the locked commits. The command neither executes nor modifies their working trees, and their checked-out branches need not be the research branches. If a repository lacks the commit, fetch it first or omit the path to let the command fetch automatically.

## Inspect the report

Choose an output directory and validate the newly generated report:

```sh
npm run check:current -- --output .artifacts/current/local
npm run verify -- --report .artifacts/current/local/report.json
```

The aggregate is generated only when both implementations pass. A failed run does not reuse that directory's old aggregate. Reports list the paper, Node version and platform, source commits and trees, checker and dependency-lock hashes, and individual results. The repository's [confirmed report](verification-report.json) uses the same format.

`npm test` checks lock and report rejection paths; `npm run verify` checks documentation, pins, and recorded evidence. CI also reruns the real implementation checks; see [Verification](verification.md).

## Update the research subjects

When changing paper or source versions, update the lock and reading notes, review the relevant rules and implementation, rerun the checks, and refresh the confirmed report. A pass applies only to its recorded inputs and versions.

The earlier study has a separate [archive entry](../archive/README.md).
