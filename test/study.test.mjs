import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'
import {
  assertGitlink,
  assertHash,
  validateBaselineBehaviorReport,
  validateBaselineConformanceReport,
  validateConformanceReport,
  validateModelReport,
  validateMutationReport,
  validateOrdinaryGatesReport,
  validateReleaseManifest,
  validateStudyReleaseFiles,
  validateStudyReport,
  validateSubmoduleState,
} from '../scripts/lib/evidence.mjs'
import { loadStudyLock } from '../scripts/lib/integrity.mjs'
import { SchemaValidationError, validateSchema } from '../scripts/lib/schema.mjs'
import {
  validateResearchStages,
  validateStageCheckoutState,
  validateUpstreamFixInventory,
} from '../scripts/lib/stages.mjs'
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

function baselineReport() {
  const scenario = (name, status) => ({
    name,
    events: 2,
    trace: `traces/${name}.ndjson`,
    traceMatched: status,
    properties: { Preservation: status },
  })
  return {
    schema: 'cordis.paper-conformance-report/v1',
    generatedFrom: { name: 'cordis', version: '1.0.0', revision, role: 'upstream' },
    traceMatched: 'expected-fail',
    scenarios: [scenario('mismatch-a', 'expected-fail'), scenario('pass-a', 'pass')],
    prerequisites: [{ name: 'cycle', properties: { Progress: 'not-applicable' } }],
  }
}

function baselineOptions() {
  return {
    revision,
    role: 'upstream',
    scenarios: ['mismatch-a', 'pass-a'],
    traceMismatches: ['mismatch-a'],
    prerequisites: [{ name: 'cycle', property: 'Progress', status: 'not-applicable' }],
  }
}

function ordinaryReport(lock) {
  const command = { name: 'test', command: 'npm test', status: 'pass' }
  return {
    schema: 'cordis.formal-study-ordinary-gates/v1',
    stage: 'upstream-fix',
    status: 'pass',
    formalStatus: 'not-run',
    formalEvidence: {
      stage: 'conformance',
      cordis: {
        revision: lock.branchMatrix.cordis.conformance.revision,
        report: 'stages/02-conformance/cordis/conformance-report.json',
      },
      deepseekHarness: {
        revision: lock.branchMatrix.deepseekHarness.conformance.revision,
        report: 'stages/02-conformance/deepseek-harness/conformance-report.json',
      },
    },
    repositories: {
      cordis: {
        revision: lock.branchMatrix.cordis.upstreamFix.revision,
        instrumentation: 'absent',
        commands: [command],
      },
      deepseekHarness: {
        revision: lock.branchMatrix.deepseekHarness.upstreamFix.revision,
        instrumentation: 'absent',
        commands: [command],
      },
    },
  }
}

function studyReport(lock) {
  const repository = (stage, report, extra = {}) => ({ revision: stage.revision, report, ...extra })
  return {
    schema: 'cordis.formal-study-report/v1',
    studyVersion: lock.studyVersion,
    status: 'pass',
    stages: [
      {
        id: 'baseline', order: 1, status: 'expected-mismatch-reproduced', formalStatus: 'expected-fail',
        repositories: {
          cordis: repository(lock.researchStages[0].repositories.cordis, 'stages/01-baseline/cordis/conformance-report.json', { traceMismatches: 9, behaviorFailures: 4 }),
          deepseekHarness: repository(lock.researchStages[0].repositories.deepseekHarness, 'stages/01-baseline/deepseek-harness/conformance-report.json', { traceMismatches: 10, behaviorFailures: 3 }),
        },
      },
      {
        id: 'conformance', order: 2, status: 'formal-and-tests-pass', formalStatus: 'pass',
        repositories: {
          cordis: repository(lock.researchStages[1].repositories.cordis, 'stages/02-conformance/cordis/conformance-report.json', { scenarios: 13, mutations: 4 }),
          deepseekHarness: repository(lock.researchStages[1].repositories.deepseekHarness, 'stages/02-conformance/deepseek-harness/conformance-report.json', { scenarios: 17, mutations: 4 }),
        },
      },
      {
        id: 'upstream-fix', order: 3, status: 'ordinary-tests-pass', formalStatus: 'not-run',
        repositories: {
          cordis: repository(lock.researchStages[2].repositories.cordis, 'stages/03-upstream-fix/ordinary-gates-report.json'),
          deepseekHarness: repository(lock.researchStages[2].repositories.deepseekHarness, 'stages/03-upstream-fix/ordinary-gates-report.json'),
        },
      },
    ],
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

test('research stages preserve order, role, flags, and exact revision mapping', async () => {
  const lock = await loadStudyLock()
  assert.doesNotThrow(() => validateResearchStages(lock))
  const wrongOrder = structuredClone(lock)
  wrongOrder.researchStages.reverse()
  assert.throws(() => validateResearchStages(wrongOrder), /research stages/)
  const wrongRevision = structuredClone(lock)
  wrongRevision.researchStages[0].repositories.cordis.revision = revision
  assert.throws(() => validateResearchStages(wrongRevision), /revision does not match/)
})

test('gitlink, submodule, and stage checkout state reject drift without resetting', () => {
  assert.doesNotThrow(() => assertGitlink(revision, revision))
  assert.throws(() => assertGitlink(revision, 'b'.repeat(40)), /does not match/)
  assert.doesNotThrow(() => validateSubmoduleState({ initialized: true, dirty: false, head: revision, gitlink: revision }, revision))
  assert.throws(() => validateSubmoduleState({ initialized: true, dirty: true, head: revision, gitlink: revision }, revision), /dirty/)
  assert.doesNotThrow(() => validateStageCheckoutState({ head: revision, status: '' }, revision))
  assert.throws(() => validateStageCheckoutState({ head: revision, status: ' M file' }, revision), /dirty/)
  assert.throws(() => validateStageCheckoutState({ head: 'b'.repeat(40), status: '' }, revision), /refusing to reset/)
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

test('baseline accepts only the exact locked mismatch and behavior-failure sets', () => {
  const valid = baselineReport()
  assert.doesNotThrow(() => validateBaselineConformanceReport(valid, baselineOptions()))

  const unexpectedPass = structuredClone(valid)
  unexpectedPass.scenarios[0].traceMatched = 'pass'
  unexpectedPass.scenarios[0].properties.Preservation = 'pass'
  assert.throws(() => validateBaselineConformanceReport(unexpectedPass, baselineOptions()), /mismatch set differs/)

  const additionalMismatch = structuredClone(valid)
  additionalMismatch.scenarios[1].traceMatched = 'expected-fail'
  additionalMismatch.scenarios[1].properties.Preservation = 'expected-fail'
  assert.throws(() => validateBaselineConformanceReport(additionalMismatch, baselineOptions()), /mismatch set differs/)

  const missingMismatch = structuredClone(valid)
  missingMismatch.scenarios = missingMismatch.scenarios.slice(1)
  assert.throws(() => validateBaselineConformanceReport(missingMismatch, baselineOptions()), /scenario set differs/)

  const wrongRevision = structuredClone(valid)
  wrongRevision.generatedFrom.revision = 'b'.repeat(40)
  assert.throws(() => validateBaselineConformanceReport(wrongRevision, baselineOptions()), /wrong implementation revision/)

  const behavior = {
    schema: 'cordis.paper-baseline-behavior/v1',
    implementation: { name: 'cordis', revision, role: 'upstream-unmodified' },
    expectedFailures: ['failure-a'],
    results: [{ name: 'failure-a', status: 'expected-fail' }, { name: 'pass-a', status: 'pass' }],
  }
  assert.doesNotThrow(() => validateBaselineBehaviorReport(behavior, { revision, behaviorFailures: ['failure-a'] }))
  behavior.results[1].status = 'expected-fail'
  assert.throws(() => validateBaselineBehaviorReport(behavior, { revision, behaviorFailures: ['failure-a'] }), /failure set differs/)
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
})

test('model reports and mutants must cover every required obligation', () => {
  const model = {
    schema: 'cordis.paper-model-report/v1',
    profile: 'pr',
    results: [{ name: 'kernel', status: 'pass', properties: { Preservation: 'pass' } }],
  }
  assert.doesNotThrow(() => validateModelReport(model, ['Preservation', 'ProgressBound'], 'pr'))
  assert.throws(() => validateModelReport(model, ['Preservation', 'Ordering'], 'pr'), /unobserved/)
  const mutation = {
    schema: 'cordis.paper-mutation-report/v1',
    results: [{ name: 'fifo', status: 'rejected', trace: 'mutations/fifo.ndjson', theorem: 'LifoRecovery' }],
  }
  assert.doesNotThrow(() => validateMutationReport(mutation, ['fifo']))
  mutation.results[0].status = 'accepted'
  assert.throws(() => validateMutationReport(mutation, ['fifo']), /was not rejected/)
})

test('upstream-fix inventory rejects instrumentation and formal scripts', () => {
  assert.doesNotThrow(() => validateUpstreamFixInventory('cordis', { files: ['packages/core/src/fiber.ts'], scripts: { test: 'vitest' } }))
  assert.throws(() => validateUpstreamFixInventory('cordis', { files: ['formal/CordisKernel.tla'], scripts: {} }), /formal\/ research tooling/)
  assert.throws(() => validateUpstreamFixInventory('deepseekHarness', { files: ['vendor/cordis/src/formal-trace.ts'], scripts: {} }), /trace instrumentation/)
  assert.throws(() => validateUpstreamFixInventory('deepseekHarness', { files: [], scripts: { 'test:cordis-paper': 'tsx runner.ts' } }), /formal script/)
})

test('ordinary and aggregate reports preserve the formal not-run boundary and portability', async () => {
  const lock = await loadStudyLock()
  const ordinary = ordinaryReport(lock)
  assert.doesNotThrow(() => validateOrdinaryGatesReport(ordinary, lock))
  const falseFormalClaim = structuredClone(ordinary)
  falseFormalClaim.formalStatus = 'pass'
  assert.throws(() => validateOrdinaryGatesReport(falseFormalClaim, lock), /must not claim direct formal validation/)
  const absolute = structuredClone(ordinary)
  absolute.formalEvidence.cordis.report = '/tmp/report.json'
  assert.throws(() => validateOrdinaryGatesReport(absolute, lock), /relative POSIX/)

  const aggregate = studyReport(lock)
  assert.doesNotThrow(() => validateStudyReport(aggregate, lock))
  aggregate.stages[2].formalStatus = 'pass'
  assert.throws(() => validateStudyReport(aggregate, lock))
})

test('release manifest and payload cover every stage exactly once', () => {
  const files = [
    'evidence/baseline/cordis/report.json',
    'evidence/baseline/deepseek-harness/report.json',
    'evidence/conformance/cordis/report.json',
    'evidence/conformance/deepseek-harness/report.json',
    'evidence/upstream-fix/report.json',
    'evidence/nightly/report.json',
    'study-report.json',
    'study-report.md',
    'study.lock.json',
    'provenance/cordis.json',
  ]
  assert.doesNotThrow(() => validateStudyReleaseFiles(files))
  assert.throws(() => validateStudyReleaseFiles(files.filter(path => !path.startsWith('evidence/baseline/cordis/'))), /baseline\/cordis/)
  const manifest = {
    schema: 'cordis.formal-study-evidence-manifest/v1',
    files: files.map(path => ({ path, sha256: 'a'.repeat(64), bytes: 10 })),
  }
  assert.doesNotThrow(() => validateReleaseManifest(manifest, files))
  assert.throws(() => validateReleaseManifest(manifest, [...files, 'extra.json']), /cover every payload/)
})

test('CLI exposes the three-stage and low-level command surface', async () => {
  const { stdout } = await execute(process.execPath, ['scripts/study.mjs', 'help'], { cwd: studyRoot })
  for (const command of ['bootstrap', 'baseline', 'conformance', 'upstream-fix', 'study', 'nightly', 'package']) {
    assert.match(stdout, new RegExp(command))
  }
})
