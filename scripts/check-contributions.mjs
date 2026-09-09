#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { delimiter, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileDigest, root } from './lib/current.mjs'
import { classifyTlc, earlyRecoveryControl, loadContributions, readCapture, unsafeRecovery, validateContributionReport } from './lib/contributions.mjs'
import { formalToolEnvironment } from './lib/toolchain.mjs'

const execute = promisify(execFile)
const args = process.argv.slice(2)
function option(flag) {
  const index = args.indexOf(flag)
  if (index < 0) return undefined
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `${flag} requires a path`)
  return resolve(args[index + 1])
}

async function main() {
  if (args.includes('--help')) {
    console.log('Usage: npm run check:contributions -- [--output <directory>] [--fixed-evidence <alignment evidence directory>]')
    console.log('Runs TLC on pinned before/fixed captures and early-recovery negative controls. --fixed-evidence additionally requires freshly generated alignment traces to match the pinned captures.')
    return
  }
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--output', '--fixed-evidence'].includes(args[i]), `unknown option: ${args[i]}`)
    option(args[i])
  }
  const manifest = await loadContributions()
  assert.equal(process.versions.node.split('.')[0], '24', 'Use Node.js 24')
  const toolEnv = await formalToolEnvironment(manifest.toolchain)
  const fixedEvidence = option('--fixed-evidence')
  if (fixedEvidence) {
    const alignment = JSON.parse(await readFile(join(fixedEvidence, 'report.json'), 'utf8'))
    assert.equal(alignment.status, 'pass')
    assert.equal(alignment.alignmentLockSha256, await fileDigest(join(root, 'alignment.lock.json')))
  }
  const base = join(root, '.artifacts/contributions')
  await mkdir(base, { recursive: true })
  const output = option('--output') ?? await mkdtemp(join(base, 'run-'))
  await mkdir(output, { recursive: true })
  await rm(join(output, 'report.json'), { force: true })
  const java = await execute('java', ['-version'])
  assert.match(java.stderr, /version "21\./, 'Use Java 21')
  const results = []
  async function tlc(model, trace, label, expected) {
    const directory = join(output, label, model)
    await rm(directory, { recursive: true, force: true })
    await mkdir(directory, { recursive: true })
    let result
    try {
      const run = await execute('java', [
        '-XX:+UseParallelGC', '-cp', Object.values(toolEnv).join(delimiter),
        'tlc2.TLC', '-workers', '1', '-deadlock',
        '-metadir', join(directory, 'states'), '-dumpTrace', 'json', join(directory, 'counterexample.json'), '-noGenerateSpecTE',
        '-config', join(root, 'formal', `${model}.cfg`), join(root, 'formal', `${model}.tla`),
      ], { env: { ...process.env, JSON: trace }, timeout: 120_000, maxBuffer: 8_000_000 })
      result = { code: 0, timedOut: false, ...run }
    } catch (error) {
      result = { code: error.code, timedOut: error.killed === true, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message }
    }
    const log = `${result.stdout}\n${result.stderr}`
    await writeFile(join(directory, 'tlc.log'), log.split(root).join('<STUDY_ROOT>'))
    const property = model === 'TeardownOrder' ? 'DependencySafeRecovery' : 'TraceMatched'
    classifyTlc(result, expected, property)
    if (expected === 'rejected') {
      const counterexample = JSON.parse(await readFile(join(directory, 'counterexample.json'), 'utf8'))
      assert.ok(counterexample.counterexample, 'TLC must emit the counterexample, not just a failure message')
    }
    return { model, property, result: expected, log: `${label}/${model}/tlc.log`, ...(expected === 'rejected' ? { counterexample: `${label}/${model}/counterexample.json` } : {}) }
  }
  for (const capture of manifest.captures) {
    const path = fixedEvidence && capture.stage === 'fixed'
      ? join(fixedEvidence, capture.repository, 'traces', `${capture.scenario}.ndjson`)
      : join(root, capture.path)
    const rows = await readCapture(capture, path)
    const witness = unsafeRecovery(rows)
    assert.equal(witness !== null, capture.stage === 'before', 'the selected defect must reproduce only before the fix')
    const label = `${capture.repository}/${capture.stage}/${capture.scenario}`
    const expected = capture.stage === 'before' ? 'rejected' : 'accepted'
    const checks = []
    for (const model of ['TeardownOrder', 'CordisTrace']) checks.push(await tlc(model, path, label, expected))
    results.push({ ...capture, witness, checks })
    console.log(`${label}: ${expected}${witness ? ` at recovery event ${witness.sequence}` : ''}`)
  }
  const controls = []
  for (const repository of ['cordis', 'deepseekHarness']) {
    const capture = manifest.captures.find(c => c.repository === repository && c.stage === 'fixed' && c.scenario === 'async-consumer-teardown-guard')
    const rows = earlyRecoveryControl(await readCapture(capture))
    const label = `${repository}/negative-control`
    const path = join(output, `${repository}-early-recovery.ndjson`)
    await writeFile(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
    assert.ok(unsafeRecovery(rows))
    controls.push({ repository, kind: 'synthetic-early-recovery', check: await tlc('TeardownOrder', path, label, 'rejected') })
    console.log(`${label}: rejected`)
  }
  const report = {
    schema: 'cordis.contribution-verification/v1', checkedAt: new Date().toISOString(), status: 'pass',
    evidenceKind: 'tlc-replay-of-observed-implementation-traces',
    sourceExecution: fixedEvidence ? 'fixed-captures-matched-fresh-alignment' : 'recorded-captures',
    paperTheorems: 'not-proved-by-trace-replay',
    lockSha256: await fileDigest(join(root, 'contributions.lock.json')),
    checkerSha256: Object.fromEntries(await Promise.all(['scripts/check-contributions.mjs', 'scripts/lib/contributions.mjs', 'scripts/lib/toolchain.mjs'].map(async p => [p, await fileDigest(join(root, p))]))),
    runtime: { node: process.versions.node, java: java.stderr.trim() }, toolchain: manifest.toolchain,
    contributions: manifest.contributions, results, controls,
  }
  await validateContributionReport(report, manifest)
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`TLC contributions: 6 before rejected, 6 fixed accepted, 2 negative controls rejected. ${join(output, 'report.json')}`)
}

try { await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
