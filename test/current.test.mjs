import assert from 'node:assert/strict'
import test from 'node:test'
import { checkIds } from '../checks/lifecycle.mjs'
import { checkerDigests, fileDigest, loadLock, root, validateLock, validateReport, validateResults } from '../scripts/lib/current.mjs'
import { join } from 'node:path'

test('result validation rejects missing, duplicate, unknown, and failed checks', () => {
  const results = checkIds.map(id => ({ id, status: 'pass' }))
  validateResults(results)
  for (const invalid of [results.slice(1), [...results, results[0]], [...results, { id: 'unknown', status: 'pass' }], results.map((item, index) => ({ ...item, status: index === 0 ? 'fail' : 'pass' }))]) {
    assert.throws(() => validateResults(invalid))
  }
})

test('lock validation rejects altered check inventories, source paths, revisions, and paper URLs', async () => {
  const lock = await loadLock()
  for (const alter of [
    value => { value.checks.pop() },
    value => { value.repositories.cordis.revision = 'main' },
    value => { value.repositories.cordis.sourceTrees['../../outside'] = 'a'.repeat(40) },
    value => { value.paper.url = 'https://arxiv.org/abs/2608.25512v2' },
  ]) {
    const changed = structuredClone(lock)
    alter(changed)
    assert.throws(() => validateLock(changed))
  }
})

test('report validation binds all six results to the exact paper, source, checker, and dependency lock', async () => {
  const lock = await loadLock()
  const report = {
    schema: 'cordis.current-verification/v1', status: 'pass',
    evidenceKind: 'implementation-behavior-regression', paperTheorems: 'not-proved-by-these-checks',
    runtime: { node: '24.14.0', platform: 'darwin', architecture: 'arm64' },
    lockSha256: await fileDigest(join(root, 'current.lock.json')),
    paper: lock.paper, checkerSha256: await checkerDigests(),
    repositories: Object.fromEntries(Object.entries(lock.repositories).map(([key, value]) => [key, {
      revision: value.revision, sourceTrees: value.sourceTrees,
      results: checkIds.map(id => ({ id, status: 'pass' })),
    }])),
  }
  await validateReport(report, lock)
  for (const alter of [
    value => { value.repositories.deepseekHarness.results.pop() },
    value => { value.repositories.cordis.sourceTrees['packages/core/src'] = 'f'.repeat(40) },
    value => { value.checkerSha256['checks/lifecycle.mjs'] = 'f'.repeat(64) },
    value => { value.checkerSha256['package-lock.json'] = 'f'.repeat(64) },
    value => { value.lockSha256 = 'f'.repeat(64) },
    value => { value.paperTheorems = 'proved' },
    value => { value.runtime.node = '22.22.0' },
  ]) {
    const changed = structuredClone(report)
    alter(changed)
    await assert.rejects(validateReport(changed, lock))
  }
})
