#!/usr/bin/env node

import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { validateEvidenceOutput, validateModelReport, assertPortableEvidence } from './lib/evidence.mjs'
import { loadStudyLock } from './lib/integrity.mjs'
import { exists, git, readJson, run, sha256, sha256File, studyRoot, relativePosix } from './lib/system.mjs'

const keys = ['cordis', 'deepseekHarness']
const flags = { cordis: '--cordis', deepseekHarness: '--deepseek-harness' }
const defaults = { cordis: '../cordis', deepseekHarness: '../deepseek-harness' }

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  assert.ok(value && !value.startsWith('--'), `${name} requires a value`)
  return value
}

async function cleanCheckout(root, revision) {
  assert.equal(await git(['rev-parse', '--show-toplevel'], root), root, 'expected a checkout root')
  assert.equal(await git(['rev-parse', 'HEAD'], root), revision, `${root}: wrong revision; see alignment.lock.json`)
  assert.equal(await git(['status', '--porcelain=v1', '--untracked-files=all'], root), '', `${root}: save local changes before reproduction`)
}

async function install(key, root, alignment, historical) {
  if (key === 'deepseekHarness') {
    await run('corepack', ['pnpm', 'install', '--frozen-lockfile'], { cwd: root, env: { CI: 'true' }, quiet: true })
    return
  }
  const target = join(root, 'yarn.lock')
  const preserve = await exists(target)
  if (!preserve) {
    assert.equal(await sha256File(resolve(studyRoot, historical.bootstrap.cordis.lockPath)), historical.bootstrap.cordis.sha256)
    await copyFile(resolve(studyRoot, historical.bootstrap.cordis.lockPath), target)
    try {
      await run('git', ['apply', resolve(studyRoot, alignment.cordisDependencyLock.patch)], { cwd: root, quiet: true })
    } catch (error) {
      await rm(target)
      throw error
    }
  }
  try {
    assert.equal(await sha256File(target), alignment.cordisDependencyLock.sha256, 'current Cordis dependency lock differs; refusing to replace it')
    await run('corepack', ['yarn', 'install', '--immutable'], { cwd: root, quiet: true })
  } finally {
    if (!preserve) await rm(target)
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('usage: npm run reproduce:alignment -- [--cordis ../cordis] [--deepseek-harness ../deepseek-harness]')
    console.log('Requires the clean fork revisions in alignment.lock.json and Node 24 / Java 21. Installs dependencies, then runs original behavior assertions, bounded models, observed traces, and mutations. Ordinary repository tests/build/docs are separate.')
    return
  }
  const historical = await loadStudyLock()
  const alignment = await readJson(join(studyRoot, 'alignment.lock.json'))
  assert.equal(alignment.schema, 'cordis.formal-study-alignment-lock/v1')
  assert.equal(alignment.historicalStudyLockSha256, await sha256File(join(studyRoot, 'study.lock.json')))
  assert.equal(alignment.specificationRevision, historical.repositories.cordis.revision)
  assert.equal(alignment.harnessScenarioRevision, historical.repositories.deepseekHarness.revision)
  const roots = Object.fromEntries(keys.map(key => [key, resolve(option(flags[key], defaults[key]))]))
  const patches = [alignment.cordisDependencyLock, ...keys.map(key => alignment.repositories[key].instrumentation)]
  for (const patch of patches) {
    assert.equal(await sha256File(resolve(studyRoot, patch.patch)), patch.patchSha256, `${patch.patch}: patch hash mismatch`)
  }
  for (const key of keys) {
    const config = alignment.repositories[key]
    assert.match(config.revision, /^[a-f0-9]{40}$/)
    await cleanCheckout(roots[key], config.revision)
    await git(['merge-base', '--is-ancestor', config.upstreamRevision, config.revision], roots[key])
  }
  for (const config of Object.values(historical.repositories)) {
    const sourceRoot = resolve(studyRoot, config.path)
    if (await exists(join(sourceRoot, '.git'))) await cleanCheckout(sourceRoot, config.revision)
  }
  await run('git', ['submodule', 'update', '--init', '--', 'sources/cordis', 'sources/deepseek-harness', 'sources/paper'])
  const kitSource = resolve(studyRoot, historical.repositories.cordis.path)
  await cleanCheckout(kitSource, alignment.specificationRevision)
  const harnessSource = resolve(studyRoot, historical.repositories.deepseekHarness.path)
  await cleanCheckout(harnessSource, alignment.harnessScenarioRevision)

  const directory = join(studyRoot, '.artifacts/alignment')
  await mkdir(directory, { recursive: true })
  const root = await mkdtemp(join(directory, 'run-'))
  const output = join(root, 'evidence')
  const kit = join(root, 'kit')
  await mkdir(output)
  await mkdir(kit)
  const archive = join(root, 'formal.tar')
  await run('git', ['archive', '--format=tar', '--output', archive, alignment.specificationRevision, 'formal'], { cwd: kitSource, quiet: true })
  await run('tar', ['-xf', archive, '-C', kit], { quiet: true })
  await rm(archive)
  const runner = join(kit, 'formal/tools/run.mjs')
  const oldHash = historical.toolchain.tlaTools.sha256
  const source = await readFile(runner, 'utf8')
  assert.equal(source.split(oldHash).length, 2, 'unexpected TLC runner pin')
  await writeFile(runner, source.replace(oldHash, alignment.tlaTools.sha256))
  const provenancePath = join(kit, 'formal/provenance.json')
  const provenance = await readJson(provenancePath)
  assert.equal(provenance.toolchain.tlaTools.sha256, oldHash)
  provenance.toolchain.tlaTools.sha256 = alignment.tlaTools.sha256
  await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + '\n')
  await copyFile(provenancePath, join(output, 'provenance.json'))

  const observed = {}
  for (const key of keys) {
    console.log(`alignment: preparing ${key}`)
    const config = alignment.repositories[key]
    await install(key, roots[key], alignment, historical)
    observed[key] = join(root, 'checkouts', key)
    await mkdir(join(root, 'checkouts'), { recursive: true })
    await run('git', ['worktree', 'add', '--detach', observed[key], config.revision], { cwd: roots[key], quiet: true })
    await run('git', ['apply', '--index', resolve(studyRoot, config.instrumentation.patch)], { cwd: observed[key], quiet: true })
    await install(key, observed[key], alignment, historical)
    await cleanCheckout(roots[key], config.revision)
  }
  const scenario = join(observed.deepseekHarness, 'scripts/cordis-paper-scenarios.ts')
  assert.equal(await sha256File(scenario), alignment.harnessScenarioSha256, 'Harness scenarios differ from the locked experiment')

  console.log('alignment: checking unchanged behavior assertions on the trace-free sources')
  await run(process.execPath, ['scripts/upstream-behavior.mjs', '--expect-fixed', '--cordis', roots.cordis, '--deepseek-harness', roots.deepseekHarness, '--output', join(output, 'behavior')])
  await mkdir(join(kit, 'packages'), { recursive: true })
  await symlink(join(observed.cordis, 'packages/core'), join(kit, 'packages/core'), 'dir')
  await run(process.execPath, [join(kit, 'formal/tools/verify-observation.mjs')])
  const cache = join(studyRoot, '.artifacts/tool-cache')
  const formal = async (command, extra = []) => run(process.execPath, [runner, command, '--cache', cache, '--quiet', ...extra])
  console.log('alignment: checking the historical specification with the recorded TLC artifact')
  await formal('portable')
  await formal('syntax', ['--output', join(output, 'models')])
  await formal('model', ['--output', join(output, 'models')])
  const model = await readJson(join(output, 'models/model-report.json'))
  validateModelReport(model, historical.evidence.requiredProperties, 'pr', historical.evidence.nightlyModel)
  await assertPortableEvidence(join(output, 'models'))

  const repositories = {}
  for (const key of keys) {
    console.log(`alignment: checking ${key} traces and mutations`)
    const config = alignment.repositories[key]
    const destination = join(output, key)
    const role = key === 'cordis' ? 'upstream' : 'vendored'
    await formal('trace', [
      '--implementation-root', join(observed[key], config.packagePath),
      '--trace-runtime-root', observed[key],
      '--implementation-name', key === 'cordis' ? 'cordis-migrated' : 'deepseek-harness-vendored-cordis-migrated',
      '--implementation-role', role, '--revision', config.revision,
      '--output', destination,
      ...(key === 'deepseekHarness' ? ['--scenario-module', scenario] : []),
    ])
    await formal('mutation', ['--output', destination])
    const evidence = await validateEvidenceOutput(destination, historical, { role, revision: config.revision })
    const diff = await git(['diff', 'HEAD', '--binary'], observed[key])
    assert.equal(sha256(diff + '\n'), config.instrumentation.patchSha256, `${key}: instrumentation changed during execution`)
    assert.equal(await git(['ls-files', '--others', '--exclude-standard'], observed[key]), '', `${key}: unexpected untracked source files`)
    await cleanCheckout(roots[key], config.revision)
    repositories[key] = { revision: config.revision, upstreamRevision: config.upstreamRevision, sourceTree: await git(['rev-parse', `${config.revision}:${config.packagePath}/src`], roots[key]), instrumentationSha256: config.instrumentation.patchSha256, ...evidence, report: `${key}/conformance-report.json` }
  }
  const report = {
    schema: 'cordis.formal-study-alignment-report/v1',
    checkedAt: new Date().toISOString(), status: 'pass',
    alignmentLockSha256: await sha256File(join(studyRoot, 'alignment.lock.json')),
    historicalStudyLockSha256: alignment.historicalStudyLockSha256,
    specificationRevision: alignment.specificationRevision,
    paper: provenance.paper, tlaTools: alignment.tlaTools,
    latestPaperFormalStatus: 'not-validated',
    ordinaryRepositoryGates: 'not-run-by-this-command',
    observations: historical.evidence.observationPointCount,
    behavior: 'behavior/report.json', models: 'models/model-report.json', repositories,
  }
  await assertPortableEvidence(output)
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`alignment: PASS; ${relativePosix(studyRoot, join(output, 'report.json'))}`)
}

try {
  await main()
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
