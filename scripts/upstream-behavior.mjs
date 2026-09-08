#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareBehaviorProbe } from './lib/behavior-probe.mjs'
import { validateBaselineBehaviorReport } from './lib/evidence.mjs'
import { loadStudyLock } from './lib/integrity.mjs'
import { git, readJson, run, sha256, studyRoot } from './lib/system.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  const value = index < 0 ? undefined : process.argv[index + 1]
  assert.ok(value && !value.startsWith('--'), `${name} requires a value`)
  return value
}

const definitions = [
  {
    key: 'cordis',
    argument: '--cordis',
    probe: 'formal/harness/baseline-behavior.ts',
    originalImport: '../../packages/core/src/index.ts',
    implementation: 'packages/core/src/index.ts',
  },
  {
    key: 'deepseekHarness',
    argument: '--deepseek-harness',
    probe: 'scripts/cordis-paper-baseline-behavior.ts',
    originalImport: '../vendor/cordis/src/index.ts',
    implementation: 'vendor/cordis/src/index.ts',
  },
]

async function inspect(root) {
  assert.equal(await git(['rev-parse', '--show-toplevel'], root), root, `${root} must be a checkout root`)
  assert.equal(await git(['status', '--porcelain=v1', '--untracked-files=all'], root), '', `${root} must be clean`)
  return git(['rev-parse', 'HEAD'], root)
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('usage: node scripts/upstream-behavior.mjs --cordis <clean-checkout> --deepseek-harness <clean-checkout> [--expect-fixed] [--output <directory>]')
    console.log('Default: reproduce exact historical failures. --expect-fixed: require all four original behavior assertions to pass in each implementation. Neither mode runs TLC.')
    return
  }
  const lock = await loadStudyLock()
  const fixed = process.argv.includes('--expect-fixed')
  const output = resolve(process.argv.includes('--output') ? option('--output') : join(studyRoot, '.artifacts/upstream/behavior'))
  const targets = definitions.map(definition => ({ ...definition, root: resolve(option(definition.argument)) }))
  for (const target of targets) target.revision = await inspect(target.root)
  await mkdir(output, { recursive: true })
  await rm(join(output, 'report.json'), { force: true })
  const temporary = await mkdtemp(join(tmpdir(), 'cordis-upstream-behavior-'))
  const repositories = {}
  try {
    for (const target of targets) {
      const baseline = lock.researchStages[0].repositories[target.key]
      const sourceRoot = resolve(studyRoot, lock.repositories[target.key].path)
      const source = await git(['show', `${baseline.revision}:${target.probe}`], sourceRoot)
      const probe = join(temporary, `${target.key}.mts`)
      const redirected = prepareBehaviorProbe(source, target.originalImport, pathToFileURL(resolve(target.root, target.implementation)).href, fixed)
      await writeFile(probe, redirected)
      const reportFile = `${target.key}-behavior-report.json`
      await rm(join(output, reportFile), { force: true })
      await run(join(target.root, 'node_modules/.bin/tsx'), [
        '--tsconfig', join(target.root, 'tsconfig.json'), probe,
        '--revision', target.revision, '--output', join(output, reportFile),
      ], { cwd: target.root, quiet: true })
      const report = await readJson(join(output, reportFile))
      validateBaselineBehaviorReport(report, { revision: target.revision, behaviorFailures: fixed ? [] : baseline.behaviorFailures })
      assert.equal(report.results.length, 4, 'probe must run all four behavior assertions')
      assert.equal(await inspect(target.root), target.revision, 'checkout changed during the probe')
      repositories[target.key] = {
        upstream: lock.repositories[target.key].upstream,
        revision: target.revision,
        probeRevision: baseline.revision,
        probe: target.probe,
        probeSourceSha256: sha256(`${source}\n`),
        executedProbeSha256: sha256(redirected),
        probeEdits: fixed ? ['implementation-import', 'expected-failure-list', 'implementation-role'] : ['implementation-import'],
        implementationSourceTree: await git(['rev-parse', `${target.revision}:${target.implementation.replace(/\/index\.ts$/, '')}`], target.root),
        report: reportFile,
        behaviorFailures: report.results.filter(result => result.status === 'expected-fail').map(result => result.name),
      }
    }
    await writeFile(join(output, 'report.json'), `${JSON.stringify({
      schema: 'cordis.formal-study-upstream-behavior/v1',
      checkedAt: new Date().toISOString(),
      status: fixed ? 'all-behavior-assertions-pass' : 'historical-behavior-failures-reproduced',
      formalStatus: 'not-run',
      repositories,
    }, null, 2)}\n`)
    console.log(fixed
      ? 'migration behavior: all four assertions pass in each implementation; formalStatus: not-run'
      : 'upstream behavior: historical failures reproduced (Cordis 4, vendored Cordis 3); formalStatus: not-run')
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

try {
  await main()
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
