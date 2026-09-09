import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileDigest, loadLock, readJson, repositoryKeys, root } from './current.mjs'

export const scenarios = ['provider-consumer-reverse-exit', 'async-consumer-teardown-guard', 'concurrent-root-teardown-guard']
export const modelFiles = ['formal/CordisTrace.tla', 'formal/CordisTrace.cfg', 'formal/TeardownOrder.tla', 'formal/TeardownOrder.cfg']

export async function loadContributions() {
  const lock = await loadLock()
  const manifest = await readJson(resolve(root, 'contributions.lock.json'))
  assert.equal(manifest.schema, 'cordis.confirmed-contributions/v1')
  assert.equal(manifest.currentLockSha256, await fileDigest(resolve(root, 'current.lock.json')))
  assert.deepEqual(manifest.contributions, [
    { id: 'await-dependent-cleanup', scenarios: scenarios.slice(0, 2) },
    { id: 'retain-retiring-consumers', scenarios: scenarios.slice(2) },
  ])
  assert.deepEqual(Object.keys(manifest.modelSha256), modelFiles)
  for (const path of modelFiles) assert.equal(await fileDigest(resolve(root, path)), manifest.modelSha256[path], `${path} changed; review the model and evidence together`)
  const expected = repositoryKeys.flatMap(repository => ['before', 'fixed'].flatMap(stage => scenarios.map(scenario => `${repository}/${stage}/${scenario}`)))
  assert.deepEqual(manifest.captures.map(c => `${c.repository}/${c.stage}/${c.scenario}`), expected)
  for (const capture of manifest.captures) {
    assert.equal(capture.path, `evidence/contributions/${capture.repository}/${capture.stage}/${capture.scenario}.ndjson`)
    assert.equal(capture.revision, lock.repositories[capture.repository][capture.stage === 'before' ? 'upstreamRevision' : 'revision'])
    await readCapture(capture)
  }
  return manifest
}

export async function readCapture(capture, path = resolve(root, capture.path)) {
  assert.equal(await fileDigest(path), capture.sha256, `${capture.path}: captured trace bytes changed`)
  const rows = (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(rows.length, capture.events)
  assert.equal(rows[0].observation.point, 'trace-init')
  rows.forEach((row, index) => {
    assert.equal(row.schema, 'cordis.paper-trace/v1')
    assert.equal(row.tag, 'trace')
    assert.equal(row.sequence, index + 1)
    assert.equal(row.implementation.revision, capture.revision)
    assert.equal(row.scenario, capture.scenario)
  })
  return rows
}

/** Locate the concrete ordering witness separately from the old broad checker. */
export function unsafeRecovery(rows) {
  for (let index = 1; index < rows.length; index++) {
    const event = rows[index].observation
    if (event.point !== 'inverse-started') continue
    const consumers = rows[index - 1].state.fibers.filter(f => f.lifecycle !== 'Inactive' && f.committed.some(b => b.provider === event.fiber))
    if (consumers.length) return { sequence: rows[index].sequence, provider: event.fiber, consumers: consumers.map(f => ({ id: f.id, lifecycle: f.lifecycle, retired: f.retired })) }
  }
  return null
}

/** Move an actual provider recovery event before an observed consumer quiesces. */
export function earlyRecoveryControl(rows) {
  const recovery = rows.find(row => row.observation.point === 'inverse-started' && row.observation.fiber === 'provider#1')
  assert.ok(recovery)
  const initial = rows.find(row => row.state.fibers.some(f => f.lifecycle === 'Unloading' && f.committed.some(b => b.provider === recovery.observation.fiber))
    && row.state.resources.some(r => r.id === recovery.observation.resource && r.status === 'installed'))
  assert.ok(initial, 'fixed trace must contain the waiting state used by the negative control')
  const first = structuredClone(initial)
  first.sequence = 1
  first.observation = { point: 'trace-init' }
  const second = structuredClone(first)
  second.sequence = 2
  second.observation = structuredClone(recovery.observation)
  second.state.resources.find(r => r.id === recovery.observation.resource).status = 'restoring'
  return [first, second]
}

export function classifyTlc(result, expected, property) {
  assert.equal(result.timedOut, false, 'TLC timed out')
  const output = `${result.stdout}\n${result.stderr}`
  if (expected === 'accepted') {
    assert.equal(result.code, 0, output.slice(-3000))
    assert.match(output, /Model checking completed\. No error has been found\./)
  } else {
    assert.notEqual(result.code, 0, 'the counterexample was incorrectly accepted')
    const pattern = property === 'DependencySafeRecovery'
      ? /Invariant DependencySafeRecovery is violated/
      : /Temporal propert(?:y TraceMatched (?:was|is)|ies were) violated/
    assert.match(output, pattern, 'tool, parser, or checksum errors are not counterexamples')
  }
  return expected
}

export async function validateContributionReport(report, manifest) {
  manifest ??= await loadContributions()
  assert.equal(report.schema, 'cordis.contribution-verification/v1')
  assert.equal(report.status, 'pass')
  assert.equal(report.evidenceKind, 'tlc-replay-of-observed-implementation-traces')
  assert.equal(report.paperTheorems, 'not-proved-by-trace-replay')
  assert.ok(['recorded-captures', 'fixed-captures-matched-fresh-alignment'].includes(report.sourceExecution))
  assert.equal(report.lockSha256, await fileDigest(resolve(root, 'contributions.lock.json')))
  assert.deepEqual(report.toolchain, manifest.toolchain)
  assert.deepEqual(report.contributions, manifest.contributions)
  const checkerFiles = ['scripts/check-contributions.mjs', 'scripts/lib/contributions.mjs', 'scripts/lib/toolchain.mjs']
  assert.deepEqual(Object.keys(report.checkerSha256), checkerFiles)
  for (const path of checkerFiles) assert.equal(report.checkerSha256[path], await fileDigest(resolve(root, path)))
  assert.equal(report.results.length, manifest.captures.length)
  for (const [index, result] of report.results.entries()) {
    const { checks, witness, ...capture } = result
    assert.deepEqual(capture, manifest.captures[index])
    assert.deepEqual(witness, unsafeRecovery(await readCapture(capture)))
    assert.deepEqual(checks.map(c => [c.model, c.property, c.result]), [
      ['TeardownOrder', 'DependencySafeRecovery', capture.stage === 'before' ? 'rejected' : 'accepted'],
      ['CordisTrace', 'TraceMatched', capture.stage === 'before' ? 'rejected' : 'accepted'],
    ])
  }
  assert.deepEqual(report.controls.map(c => [c.repository, c.kind, c.check.model, c.check.property, c.check.result]),
    repositoryKeys.map(key => [key, 'synthetic-early-recovery', 'TeardownOrder', 'DependencySafeRecovery', 'rejected']))
}
