import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyTlc, earlyRecoveryControl, loadContributions, readCapture, unsafeRecovery } from '../scripts/lib/contributions.mjs'

test('all selected upstream captures expose the concrete ordering defect; fixed captures do not', async () => {
  const manifest = await loadContributions()
  for (const capture of manifest.captures) {
    const rows = await readCapture(capture)
    assert.equal(unsafeRecovery(rows) !== null, capture.stage === 'before')
    if (capture.stage === 'fixed' && capture.scenario === 'async-consumer-teardown-guard') {
      assert.equal(unsafeRecovery(earlyRecoveryControl(rows)).sequence, 2)
    }
  }
})

test('tool failures and unrelated semantic failures cannot count as the claimed counterexample', () => {
  for (const message of ['checksum mismatch', 'Parsing or semantic analysis failed', 'Invariant OtherProperty is violated', '']) {
    assert.throws(() => classifyTlc({ code: 1, timedOut: false, stdout: message, stderr: '' }, 'rejected', 'DependencySafeRecovery'))
  }
  assert.throws(() => classifyTlc({ code: 1, timedOut: true, stdout: 'Invariant DependencySafeRecovery is violated', stderr: '' }, 'rejected', 'DependencySafeRecovery'))
  assert.throws(() => classifyTlc({ code: 0, timedOut: false, stdout: 'Model checking completed. No error has been found.', stderr: '' }, 'rejected', 'DependencySafeRecovery'))
})
