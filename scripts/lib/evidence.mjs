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
  assert.ok(Array.isArray(report.prerequisites), 'conformance report has no prerequisite audits')
  const expected = Object.fromEntries(prerequisiteAudits.map(item => [item.name, { [item.property]: item.status }]))
  const actual = Object.fromEntries(report.prerequisites.map(item => [item.name, item.properties]))
  assert.deepEqual(actual, expected, 'prerequisite audit results differ from the required not-applicable results')
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

async function parseSerialized(path) {
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
