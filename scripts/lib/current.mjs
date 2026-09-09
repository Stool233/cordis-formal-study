import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { checkIds } from '../../checks/lifecycle.mjs'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const repositoryKeys = ['cordis', 'deepseekHarness']
export const checkerFiles = ['checks/lifecycle.mjs', 'checks/run.mjs', 'scripts/check-current.mjs', 'scripts/lib/current.mjs', 'package-lock.json']
const execute = promisify(execFile)

export const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
export const digest = value => createHash('sha256').update(value).digest('hex')
export const fileDigest = async path => digest(await readFile(path))

export async function command(program, args, cwd = root) {
  const result = await execute(program, args, { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 8_000_000 })
  return result.stdout.trim()
}

export function validateLock(lock) {
  assert.equal(lock.schema, 'cordis.current-study/v1')
  assert.match(lock.paper.version, /^arXiv:\d{4}\.\d{4,5}v\d+$/)
  assert.match(lock.paper.sha256, /^[a-f0-9]{64}$/)
  assert.equal(lock.paper.url, `https://arxiv.org/abs/${lock.paper.version.slice(6)}`)
  assert.deepEqual(lock.checks, checkIds)
  assert.deepEqual(Object.keys(lock.repositories), repositoryKeys)
  for (const repository of Object.values(lock.repositories)) {
    assert.match(repository.source, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/)
    assert.match(repository.revision, /^[a-f0-9]{40}$/)
    assert.match(repository.upstreamRevision, /^[a-f0-9]{40}$/)
    assert.ok(Object.keys(repository.sourceTrees).length > 0)
    for (const [path, tree] of Object.entries(repository.sourceTrees)) {
      assert.match(path, /^(?:packages|vendor)\/[\w-]+\/src$/)
      assert.match(tree, /^[a-f0-9]{40}$/)
    }
    assert.ok(Object.keys(repository.sourceTrees).some(path => repository.entry === `${path}/index.ts`))
  }
  assert.equal(lock.archive.tag, 'archive/three-stage-study-2026-09-09')
  assert.equal(lock.archive.revision, '1d6eacf7a87edd5de0774d6fc927dd0e1901ddca')
  return lock
}

export const loadLock = async () => validateLock(await readJson(resolve(root, 'current.lock.json')))

export function validateResults(results) {
  assert.deepEqual(results.map(item => item.id), checkIds, 'the complete current check set must run exactly once')
  for (const result of results) assert.equal(result.status, 'pass', `${result.id} did not pass`)
}

export async function checkerDigests() {
  return Object.fromEntries(await Promise.all(checkerFiles.map(async path => [path, await fileDigest(resolve(root, path))])))
}

export async function validateReport(report, lock) {
  assert.equal(report.schema, 'cordis.current-verification/v1')
  assert.equal(report.status, 'pass')
  assert.equal(report.evidenceKind, 'implementation-behavior-regression')
  assert.equal(report.paperTheorems, 'not-proved-by-these-checks')
  assert.match(report.runtime.node, /^24\.\d+\.\d+$/)
  assert.ok(typeof report.runtime.platform === 'string' && report.runtime.platform.length > 0)
  assert.ok(typeof report.runtime.architecture === 'string' && report.runtime.architecture.length > 0)
  assert.equal(report.lockSha256, await fileDigest(resolve(root, 'current.lock.json')))
  assert.deepEqual(report.paper, lock.paper)
  assert.deepEqual(report.checkerSha256, await checkerDigests())
  assert.deepEqual(Object.keys(report.repositories), repositoryKeys)
  for (const key of repositoryKeys) {
    const expected = lock.repositories[key]
    const actual = report.repositories[key]
    assert.equal(actual.revision, expected.revision)
    assert.deepEqual(actual.sourceTrees, expected.sourceTrees)
    validateResults(actual.results)
  }
}
