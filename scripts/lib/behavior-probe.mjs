import assert from 'node:assert/strict'

/** Retarget a locked probe without changing any behavioral assertion. */
export function prepareBehaviorProbe(source, originalImport, targetImport, fixed = false) {
  const importText = `from '${originalImport}'`
  assert.equal(source.split(importText).length, 2, 'probe must have exactly one implementation import')
  let result = source.replace(importText, `from ${JSON.stringify(targetImport)}`)
  if (fixed) {
    const expected = /^const expectedFailures = (?:\[\n(?:  '[^'\n]+',\n)+\]|tests\.map\(test => test\.name\))$/gm
    assert.equal([...result.matchAll(expected)].length, 1, 'probe must use one known expected failure declaration')
    result = result.replace(expected, 'const expectedFailures = []')
    const role = /role: '(upstream|vendored)-unmodified'/g
    assert.equal([...result.matchAll(role)].length, 1, 'probe must declare its implementation role')
    result = result.replace(role, "role: '$1-migrated'")
  }
  return `${result}\n`
}
