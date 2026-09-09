#!/usr/bin/env node
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadLock, readJson, root, validateReport } from './lib/current.mjs'
import { validateContributionReport } from './lib/contributions.mjs'
import { verifyToolArtifacts } from './lib/toolchain.mjs'

const pairs = ['README', 'docs/contributions', 'docs/paper', 'docs/implementation', 'docs/verification', 'docs/reproduce', 'archive/README', 'tools/README']
try {
  const lock = await loadLock()
  for (const path of [...pairs.flatMap(stem => [`${stem}.md`, `${stem}.zh-CN.md`]), 'LICENSES/README.md']) {
    const file = resolve(root, path)
    const text = await readFile(file, 'utf8')
    assert.ok(text.endsWith('\n'), `${path} requires a final newline`)
    assert.equal(/[ \t]+$/m.test(text), false, `${path} contains trailing whitespace`)
    for (const [, raw] of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z]+:|#)/i.test(raw)) continue
      const target = decodeURIComponent(raw.split(/[?#]/, 1)[0])
      assert.equal(target.startsWith('/'), false, `${path} must use relative file links`)
      await access(resolve(dirname(file), target))
    }
  }
  const index = process.argv.indexOf('--report')
  if (index >= 0) assert.ok(process.argv[index + 1], '--report requires a path')
  const report = resolve(root, index < 0 ? 'docs/verification-report.json' : process.argv[index + 1])
  await validateReport(await readJson(report), lock)
  await validateContributionReport(await readJson(resolve(root, 'docs/contribution-report.json')))
  await verifyToolArtifacts()
  console.log('verify: current sources, documentation, TLC contribution evidence, tools, and supporting behavior evidence pass')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
