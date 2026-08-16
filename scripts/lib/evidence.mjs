import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { absolutePathAt, exists, filesUnder, portableReference, readJson } from './system.mjs'

function record(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
  return value
}

function exactNames(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} set differs from study.lock.json`)
}

function validatePrerequisites(actual, prerequisiteAudits) {
  assert.ok(Array.isArray(actual), 'conformance report has no prerequisite audits')
  const expected = Object.fromEntries(prerequisiteAudits.map(item => [item.name, { [item.property]: item.status }]))
  const observed = Object.fromEntries(actual.map(item => [item.name, item.properties]))
  assert.deepEqual(observed, expected, 'prerequisite audit results differ from the required not-applicable results')
}

function allPass(properties, label) {
  record(properties, `${label}.properties`)
  assert.ok(Object.keys(properties).length > 0, `${label} has no observed properties`)
  for (const [property, status] of Object.entries(properties)) {
    assert.equal(status, 'pass', `${label}.${property} must be pass, received ${String(status)}`)
  }
}

export function assertGitlink(lockRevision, gitlink, label = 'submodule') {
  assert.match(gitlink, /^[0-9a-f]{40}$/, `${label} has no committed gitlink`)
  assert.equal(gitlink, lockRevision, `${label} gitlink does not match study.lock.json`)
}

export function validateSubmoduleState(state, expectedRevision, label = 'submodule') {
  assert.equal(state.initialized, true, `${label} is not initialized`)
  assert.equal(state.dirty, false, `${label} is dirty`)
  assert.equal(state.head, expectedRevision, `${label} HEAD does not match study.lock.json`)
  assertGitlink(expectedRevision, state.gitlink, label)
}

export function assertHash(actual, expected, label) {
  assert.equal(actual, expected, `${label} SHA-256 does not match study.lock.json`)
}

export function validateModelReport(report, requiredProperties, expectedProfile) {
  record(report, 'model report')
  assert.equal(report.schema, 'cordis.paper-model-report/v1')
  assert.equal(report.profile, expectedProfile)
  assert.ok(Array.isArray(report.results) && report.results.length > 0, 'model report has no results')
  const observed = new Set()
  for (const result of report.results) {
    record(result, 'model result')
    assert.equal(result.status, 'pass', `${result.name} model status is not pass`)
    allPass(result.properties, `model ${result.name}`)
    Object.keys(result.properties).forEach(property => observed.add(property))
  }
  const modelProperties = requiredProperties.filter(property => property !== 'ProgressBound')
  for (const property of modelProperties) assert.ok(observed.has(property), `required model property ${property} is unobserved`)
}

export function validateConformanceReport(report, expectedScenarioNames, prerequisiteAudits) {
  record(report, 'conformance report')
  assert.equal(report.schema, 'cordis.paper-conformance-report/v1')
  record(report.generatedFrom, 'conformance report generatedFrom')
  for (const field of ['name', 'version', 'revision', 'role']) {
    assert.ok(typeof report.generatedFrom[field] === 'string' && report.generatedFrom[field], `generatedFrom.${field} is missing`)
  }
  assert.equal(report.traceMatched, 'pass', 'aggregate TraceMatched is not pass')
  assert.ok(Array.isArray(report.scenarios), 'conformance report has no scenarios')
  exactNames(report.scenarios.map(scenario => scenario.name), expectedScenarioNames, 'scenario')
  for (const scenario of report.scenarios) {
    record(scenario, 'scenario')
    assert.ok(Number.isInteger(scenario.events) && scenario.events > 0, `${scenario.name} produced an empty trace`)
    assert.equal(scenario.traceMatched, 'pass', `${scenario.name} did not fully satisfy TraceMatched`)
    portableReference(scenario.trace)
    allPass(scenario.properties, `scenario ${scenario.name}`)
  }
  validatePrerequisites(report.prerequisites, prerequisiteAudits)
}

export function validateBaselineConformanceReport(report, options) {
  record(report, 'baseline conformance report')
  assert.equal(report.schema, 'cordis.paper-conformance-report/v1')
  record(report.generatedFrom, 'baseline conformance generatedFrom')
  assert.equal(report.generatedFrom.revision, options.revision, 'baseline report has the wrong implementation revision')
  assert.equal(report.generatedFrom.role, options.role, 'baseline report has the wrong implementation role')
  assert.equal(report.traceMatched, 'expected-fail', 'baseline aggregate must remain expected-fail')
  assert.ok(Array.isArray(report.scenarios), 'baseline report has no scenarios')
  exactNames(report.scenarios.map(scenario => scenario.name), options.scenarios, 'baseline scenario')
  const mismatches = []
  for (const scenario of report.scenarios) {
    record(scenario, 'baseline scenario')
    assert.ok(Number.isInteger(scenario.events) && scenario.events > 0, `${scenario.name} produced an empty trace`)
    portableReference(scenario.trace)
    if (scenario.traceMatched === 'expected-fail') {
      mismatches.push(scenario.name)
      record(scenario.properties, `${scenario.name}.properties`)
      assert.ok(Object.keys(scenario.properties).length > 0, `${scenario.name} has no observed properties`)
      for (const [property, status] of Object.entries(scenario.properties)) {
        assert.equal(status, 'expected-fail', `${scenario.name}.${property} must remain expected-fail`)
      }
    } else {
      assert.equal(scenario.traceMatched, 'pass', `${scenario.name} has an unexpected trace status`)
      allPass(scenario.properties, `baseline scenario ${scenario.name}`)
    }
  }
  exactNames(mismatches, options.traceMismatches, 'baseline trace mismatch')
  validatePrerequisites(report.prerequisites, options.prerequisites)
}

export function validateBaselineBehaviorReport(report, options) {
  record(report, 'baseline behavior report')
  assert.equal(report.schema, 'cordis.paper-baseline-behavior/v1')
  record(report.implementation, 'baseline behavior implementation')
  assert.equal(report.implementation.revision, options.revision, 'baseline behavior report has the wrong implementation revision')
  exactNames(report.expectedFailures, options.behaviorFailures, 'baseline expected behavior failure')
  assert.ok(Array.isArray(report.results) && report.results.length > 0, 'baseline behavior report has no results')
  const failures = []
  for (const result of report.results) {
    record(result, 'baseline behavior result')
    if (result.status === 'expected-fail') failures.push(result.name)
    else assert.equal(result.status, 'pass', `${result.name} has an unexpected behavior status`)
  }
  exactNames(failures, options.behaviorFailures, 'baseline behavior failure')
}

export function validateMutationReport(report, mutations) {
  record(report, 'mutation report')
  assert.equal(report.schema, 'cordis.paper-mutation-report/v1')
  assert.ok(Array.isArray(report.results), 'mutation report has no results')
  exactNames(report.results.map(result => result.name), mutations, 'mutation')
  for (const result of report.results) {
    assert.equal(result.status, 'rejected', `${result.name} mutant was not rejected`)
    portableReference(result.trace)
    assert.ok(typeof result.theorem === 'string' && result.theorem, `${result.name} has no failing theorem`)
  }
}

export async function parseSerialized(path) {
  const content = await readFile(path, 'utf8')
  if (path.endsWith('.ndjson')) {
    const lines = content.trim().split('\n').filter(Boolean)
    assert.ok(lines.length > 0, `${path} is empty`)
    return lines.map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${path}:${index + 1} is not valid JSON: ${error.message}`)
      }
    })
  }
  return JSON.parse(content)
}

export async function validateBaselineOutput(outputRoot, lock, options) {
  for (const name of ['generation-report.json', 'conformance-report.json', 'baseline-behavior-report.json']) {
    assert.equal(await exists(resolve(outputRoot, name)), true, `${outputRoot}/${name} is missing`)
  }
  const expectedScenarios = options.key === 'deepseekHarness'
    ? [...lock.evidence.coreScenarios, ...lock.evidence.deepseekScenarios]
    : lock.evidence.coreScenarios
  const stage = lock.researchStages.find(candidate => candidate.id === 'baseline')
  assert.ok(stage, 'baseline research stage is missing')
  const expected = stage.repositories[options.key]
  const conformance = await readJson(resolve(outputRoot, 'conformance-report.json'))
  validateBaselineConformanceReport(conformance, {
    revision: expected.revision,
    role: options.role,
    scenarios: expectedScenarios,
    traceMismatches: expected.traceMismatches,
    prerequisites: lock.evidence.prerequisiteAudits,
  })
  validateBaselineBehaviorReport(await readJson(resolve(outputRoot, 'baseline-behavior-report.json')), {
    revision: expected.revision,
    behaviorFailures: expected.behaviorFailures,
  })
  for (const scenario of conformance.scenarios) {
    const reference = portableReference(scenario.trace)
    const trace = resolve(outputRoot, reference)
    assert.equal(await exists(trace), true, `${reference} is missing`)
    const lines = await parseSerialized(trace)
    assert.ok(lines.every(line => line.tag === 'trace'), `${reference} contains a non-trace record`)
  }
  for (const name of expected.traceMismatches) {
    assert.equal(await exists(resolve(outputRoot, `failures/trace-${name}.json`)), true, `failure metadata for ${name} is missing`)
    assert.equal(await exists(resolve(outputRoot, `counterexamples/trace-${name}.json`)), true, `counterexample for ${name} is missing`)
  }
  await assertPortableEvidence(outputRoot)
  return {
    scenarios: conformance.scenarios.length,
    traceMismatches: expected.traceMismatches.length,
    behaviorFailures: expected.behaviorFailures.length,
  }
}

export async function assertPortableEvidence(outputRoot) {
  const serialized = (await filesUnder(outputRoot)).filter(file => file.relative.endsWith('.json') || file.relative.endsWith('.ndjson'))
  assert.ok(serialized.length > 0, `${outputRoot} contains no serialized evidence`)
  for (const file of serialized) {
    const value = await parseSerialized(file.path)
    const found = absolutePathAt(value)
    assert.equal(found, undefined, `${file.relative} contains an absolute path at ${found}`)
  }
}

export async function validateEvidenceOutput(outputRoot, lock, options) {
  const expectedScenarios = options.role === 'vendored'
    ? [...lock.evidence.coreScenarios, ...lock.evidence.deepseekScenarios]
    : lock.evidence.coreScenarios
  const required = ['generation-report.json', 'conformance-report.json', 'mutation-report.json']
  if (options.modelProfile) required.push('model-report.json')
  for (const name of required) assert.equal(await exists(resolve(outputRoot, name)), true, `${outputRoot}/${name} is missing`)

  const conformance = await readJson(resolve(outputRoot, 'conformance-report.json'))
  validateConformanceReport(conformance, expectedScenarios, lock.evidence.prerequisiteAudits)
  assert.equal(conformance.generatedFrom.role, options.role)
  assert.equal(conformance.generatedFrom.revision, options.revision)
  for (const scenario of conformance.scenarios) {
    const reference = portableReference(scenario.trace)
    const trace = resolve(outputRoot, reference)
    assert.equal(await exists(trace), true, `${reference} is missing`)
    const lines = await parseSerialized(trace)
    assert.ok(lines.every(line => line.tag === 'trace'), `${reference} contains a non-trace record`)
  }

  const mutation = await readJson(resolve(outputRoot, 'mutation-report.json'))
  validateMutationReport(mutation, lock.evidence.mutations)
  for (const result of mutation.results) {
    assert.equal(await exists(resolve(outputRoot, portableReference(result.trace))), true, `${result.trace} is missing`)
    assert.equal(await exists(resolve(outputRoot, `failures/mutation-${result.name}.json`)), true, `failure metadata for ${result.name} is missing`)
  }

  if (options.modelProfile) {
    validateModelReport(await readJson(resolve(outputRoot, 'model-report.json')), lock.evidence.requiredProperties, options.modelProfile)
  }
  await assertPortableEvidence(outputRoot)
  return { scenarios: conformance.scenarios.length, mutations: mutation.results.length }
}

export function validateOrdinaryGatesReport(report, lock) {
  record(report, 'ordinary gates report')
  assert.equal(report.schema, 'cordis.formal-study-ordinary-gates/v1')
  assert.equal(report.stage, 'upstream-fix')
  assert.equal(report.status, 'pass')
  assert.equal(report.formalStatus, 'not-run', 'upstream-fix must not claim direct formal validation')
  assert.equal(report.formalEvidence.stage, 'conformance')
  for (const key of ['cordis', 'deepseekHarness']) {
    const conformance = lock.branchMatrix[key].conformance
    const upstreamFix = lock.branchMatrix[key].upstreamFix
    assert.equal(report.formalEvidence[key].revision, conformance.revision)
    portableReference(report.formalEvidence[key].report)
    const repository = report.repositories[key]
    assert.equal(repository.revision, upstreamFix.revision)
    assert.equal(repository.instrumentation, 'absent')
    assert.ok(Array.isArray(repository.commands) && repository.commands.length > 0, `${key} has no ordinary gates`)
    for (const command of repository.commands) {
      assert.equal(command.status, 'pass', `${key}.${command.name} did not pass`)
      assert.ok(typeof command.command === 'string' && command.command, `${key}.${command.name} has no command`)
    }
  }
  const absolute = absolutePathAt(report)
  assert.equal(absolute, undefined, `ordinary gates report contains an absolute path at ${absolute}`)
}

export function validateStudyReport(report, lock) {
  record(report, 'study report')
  assert.equal(report.schema, 'cordis.formal-study-report/v1')
  assert.equal(report.studyVersion, lock.studyVersion)
  assert.equal(report.status, 'pass')
  assert.deepEqual(report.stages.map(stage => stage.id), ['baseline', 'conformance', 'upstream-fix'])
  const formalStatuses = ['expected-fail', 'pass', 'not-run']
  for (let index = 0; index < lock.researchStages.length; index++) {
    const expected = lock.researchStages[index]
    const actual = report.stages[index]
    assert.equal(actual.order, expected.order)
    assert.equal(actual.status, expected.expectedOutcome)
    assert.equal(actual.formalStatus, formalStatuses[index])
    for (const key of ['cordis', 'deepseekHarness']) {
      assert.equal(actual.repositories[key].revision, expected.repositories[key].revision)
      portableReference(actual.repositories[key].report)
    }
  }
  assert.equal(report.stages[0].repositories.cordis.traceMismatches, 9)
  assert.equal(report.stages[0].repositories.deepseekHarness.traceMismatches, 10)
  assert.equal(report.stages[0].repositories.cordis.behaviorFailures, 4)
  assert.equal(report.stages[0].repositories.deepseekHarness.behaviorFailures, 3)
  assert.equal(report.stages[1].repositories.cordis.scenarios, lock.evidence.coreScenarioCount)
  assert.equal(report.stages[1].repositories.deepseekHarness.scenarios, lock.evidence.fullScenarioCount)
  assert.equal(report.stages[1].repositories.cordis.mutations, lock.evidence.mutationCount)
  assert.equal(report.stages[1].repositories.deepseekHarness.mutations, lock.evidence.mutationCount)
  const absolute = absolutePathAt(report)
  assert.equal(absolute, undefined, `study report contains an absolute path at ${absolute}`)
}

export function validateReleaseManifest(manifest, files) {
  record(manifest, 'release manifest')
  assert.equal(manifest.schema, 'cordis.formal-study-evidence-manifest/v1')
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0, 'release manifest has no files')
  const actual = new Set(files)
  const declared = new Set()
  for (const entry of manifest.files) {
    record(entry, 'release manifest entry')
    portableReference(entry.path)
    assert.match(entry.sha256, /^[0-9a-f]{64}$/)
    assert.ok(Number.isInteger(entry.bytes) && entry.bytes >= 0)
    assert.equal(declared.has(entry.path), false, `duplicate release manifest entry ${entry.path}`)
    declared.add(entry.path)
  }
  assert.deepEqual([...declared].sort(), [...actual].sort(), 'release manifest does not cover every payload file')
}

export function validateStudyReleaseFiles(files) {
  const requiredPrefixes = [
    'evidence/baseline/cordis/',
    'evidence/baseline/deepseek-harness/',
    'evidence/conformance/cordis/',
    'evidence/conformance/deepseek-harness/',
    'evidence/upstream-fix/',
    'evidence/nightly/',
  ]
  for (const prefix of requiredPrefixes) {
    assert.ok(files.some(path => path.startsWith(prefix)), `release payload is missing ${prefix}`)
  }
  for (const path of ['study-report.json', 'study-report.md', 'study.lock.json', 'provenance/cordis.json']) {
    assert.ok(files.includes(path), `release payload is missing ${path}`)
  }
}
