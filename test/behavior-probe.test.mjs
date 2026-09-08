import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { prepareBehaviorProbe } from '../scripts/lib/behavior-probe.mjs'

const fixture = "import { Context } from './runtime.ts'\nconst expectedFailures = [\n  'resource-order',\n]\nassert.equal(resource.available, true)\nassert.deepEqual(failures, expectedFailures)\nconst metadata = { role: 'upstream-unmodified' }"

test('fixed probes preserve behavioral assertions and reject an actual regression', () => {
  const prepared = prepareBehaviorProbe(fixture, './runtime.ts', 'file:///candidate/runtime.ts', true)
  assert.ok(prepared.includes('assert.equal(resource.available, true)'))
  assert.ok(prepared.includes('assert.deepEqual(failures, expectedFailures)'))
  assert.ok(prepared.includes("role: 'upstream-migrated'"))
  const executable = prepared.replace(/^import .*\n/, '')
  const run = available => execFileSync(process.execPath, ['--input-type=module', '-e', `import assert from 'node:assert/strict'; const resource = { available: ${available} }; const failures = []; ${executable}`], { stdio: 'pipe' })
  assert.doesNotThrow(() => run(true))
  assert.throws(() => run(false), /Command failed/)
})

test('baseline mode preserves its expected failures and role', () => {
  const prepared = prepareBehaviorProbe(fixture, './runtime.ts', 'file:///candidate/runtime.ts')
  assert.equal(prepared, fixture.replace("from './runtime.ts'", 'from "file:///candidate/runtime.ts"') + '\n')
})

test('the Cordis all-tests expectation becomes an empty failure set', () => {
  const source = fixture.replace("[\n  'resource-order',\n]", 'tests.map(test => test.name)')
  assert.ok(prepareBehaviorProbe(source, './runtime.ts', 'file:///candidate.ts', true).includes('const expectedFailures = []\n'))
})

test('unexpected probe edits fail closed', () => {
  assert.throws(() => prepareBehaviorProbe(fixture, './missing.ts', 'file:///candidate.ts', true), /implementation import/)
  assert.throws(() => prepareBehaviorProbe(fixture.replace("  'resource-order',", '  computedFailure,'), './runtime.ts', 'file:///candidate.ts', true), /known expected failure declaration/)
  assert.throws(() => prepareBehaviorProbe(fixture.replace('upstream-unmodified', 'unknown'), './runtime.ts', 'file:///candidate.ts', true), /implementation role/)
})
