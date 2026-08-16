import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'
import {
  assertGitlink,
  assertHash,
  validateConformanceReport,
  validateModelReport,
  validateMutationReport,
  validateReleaseManifest,
  validateSubmoduleState,
} from '../scripts/lib/evidence.mjs'
import { SchemaValidationError, validateSchema } from '../scripts/lib/schema.mjs'
import { absolutePathAt, portableReference, studyRoot } from '../scripts/lib/system.mjs'

const execute = promisify(execFile)
const revision = 'a'.repeat(40)

function conformanceReport() {
  return {
    schema: 'cordis.paper-conformance-report/v1',
    generatedFrom: { name: 'cordis', version: '1.0.0', revision, role: 'upstream' },
    traceMatched: 'pass',
    scenarios: [{
      name: 'core',
      events: 2,
      traceMatched: 'pass',
      trace: 'traces/core.ndjson',
      properties: { Preservation: 'pass' },
    }],
    prerequisites: [{ name: 'cycle', properties: { Progress: 'not-applicable' } }],
  }
}

test('schema validator rejects missing and extra fields', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: { name: { type: 'string', minLength: 1 } },
  }
  assert.throws(() => validateSchema({}, schema), SchemaValidationError)
  assert.throws(() => validateSchema({ name: 'study', extra: true }, schema), SchemaValidationError)
  assert.deepEqual(validateSchema({ name: 'study' }, schema), { name: 'study' })
})

test('gitlink and initialized submodule state must match the lock', () => {
  assert.doesNotThrow(() => assertGitlink(revision, revision))
  assert.throws(() => assertGitlink(revision, 'b'.repeat(40)), /does not match/)
  assert.doesNotThrow(() => validateSubmoduleState({ initialized: true, dirty: false, head: revision, gitlink: revision }, revision))
  assert.throws(() => validateSubmoduleState({ initialized: false, dirty: false, head: revision, gitlink: revision }, revision), /not initialized/)
  assert.throws(() => validateSubmoduleState({ initialized: true, dirty: true, head: revision, gitlink: revision }, revision), /dirty/)
  assert.throws(() => validateSubmoduleState({ initialized: true, dirty: false, head: 'b'.repeat(40), gitlink: revision }, revision), /HEAD/)
})

test('locked hashes reject different content', () => {
  assert.doesNotThrow(() => assertHash('abc', 'abc', 'paper'))
  assert.throws(() => assertHash('abc', 'def', 'paper'), /SHA-256/)
})

test('portable evidence rejects absolute and escaping paths', () => {
  assert.equal(absolutePathAt({ trace: '/tmp/trace.ndjson' }), '$.trace')
  assert.equal(absolutePathAt({ command: 'read C:\\temp\\trace.ndjson' }), '$.command')
  assert.equal(absolutePathAt({ trace: 'traces/core.ndjson' }), undefined)
  assert.equal(portableReference('traces/core.ndjson'), 'traces/core.ndjson')
  assert.throws(() => portableReference('../trace.ndjson'), /escapes/)
  assert.throws(() => portableReference('C:/trace.ndjson'), /relative POSIX/)
})

test('conformance requires non-empty, completely matched, passing scenarios', () => {
  const prerequisites = [{ name: 'cycle', property: 'Progress', status: 'not-applicable' }]
  const valid = conformanceReport()
  assert.doesNotThrow(() => validateConformanceReport(valid, ['core'], prerequisites))

  const empty = structuredClone(valid)
  empty.scenarios[0].events = 0
  assert.throws(() => validateConformanceReport(empty, ['core'], prerequisites), /empty trace/)

  const unmatched = structuredClone(valid)
  unmatched.scenarios[0].traceMatched = 'fail'
  assert.throws(() => validateConformanceReport(unmatched, ['core'], prerequisites), /TraceMatched/)

  for (const status of ['not-applicable', 'unobserved']) {
    const incomplete = structuredClone(valid)
    incomplete.scenarios[0].properties.Preservation = status
    assert.throws(() => validateConformanceReport(incomplete, ['core'], prerequisites), /must be pass/)
  }

  const imprecisePremise = structuredClone(valid)
  imprecisePremise.prerequisites[0].properties.Progress = 'pass'
  assert.throws(() => validateConformanceReport(imprecisePremise, ['core'], prerequisites), /prerequisite/)
})

test('model reports must observe every required model property', () => {
  const report = {
    schema: 'cordis.paper-model-report/v1',
    profile: 'pr',
    results: [{ name: 'kernel', status: 'pass', properties: { Preservation: 'pass' } }],
  }
  assert.doesNotThrow(() => validateModelReport(report, ['Preservation', 'ProgressBound'], 'pr'))
  assert.throws(() => validateModelReport(report, ['Preservation', 'Ordering'], 'pr'), /unobserved/)
})

test('every semantic mutant must be rejected', () => {
  const report = {
    schema: 'cordis.paper-mutation-report/v1',
    results: [{ name: 'fifo', status: 'rejected', trace: 'mutations/fifo.ndjson', theorem: 'LifoRecovery' }],
  }
  assert.doesNotThrow(() => validateMutationReport(report, ['fifo']))
  report.results[0].status = 'accepted'
  assert.throws(() => validateMutationReport(report, ['fifo']), /was not rejected/)
})

test('release manifest covers every payload exactly once', () => {
  const manifest = {
    schema: 'cordis.formal-study-evidence-manifest/v1',
    files: [{ path: 'evidence/report.json', sha256: 'a'.repeat(64), bytes: 10 }],
  }
  assert.doesNotThrow(() => validateReleaseManifest(manifest, ['evidence/report.json']))
  assert.throws(() => validateReleaseManifest(manifest, ['evidence/report.json', 'study.lock.json']), /cover every payload/)
})

test('CLI exposes the documented command surface', async () => {
  const { stdout } = await execute(process.execPath, ['scripts/study.mjs', 'help'], { cwd: studyRoot })
  for (const command of ['verify', 'bootstrap', 'reproduce', 'package']) assert.match(stdout, new RegExp(command))
})
