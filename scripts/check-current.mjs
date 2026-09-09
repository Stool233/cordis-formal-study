#!/usr/bin/env node
import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { checkerDigests, command, fileDigest, loadLock, readJson, repositoryKeys, root, validateReport, validateResults } from './lib/current.mjs'

const args = process.argv.slice(2)
function option(flag) {
  const index = args.indexOf(flag)
  if (index < 0) return undefined
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `${flag} requires a path`)
  return resolve(args[index + 1])
}

async function repositoryPath(key, source, revision) {
  const supplied = option(key === 'cordis' ? '--cordis' : '--deepseek-harness')
  if (supplied) return supplied
  const path = join(root, '.artifacts/current/repositories', key)
  await mkdir(path, { recursive: true })
  try {
    await access(join(path, '.git'))
  } catch {
    await command('git', ['init', '--quiet', path])
  }
  try {
    await command('git', ['cat-file', '-e', `${revision}^{commit}`], path)
  } catch {
    await command('git', ['fetch', '--quiet', '--depth=1', '--no-tags', source, revision], path)
  }
  return path
}

async function main() {
  if (args.includes('--help')) {
    console.log('Usage: npm run check:current -- [--cordis <repository>] [--deepseek-harness <repository>] [--output <directory>]')
    console.log('Checks the exact commits in current.lock.json. Optional local repositories supply Git objects; their working trees are not executed or changed.')
    return
  }
  assert.equal(process.versions.node.split('.')[0], '24', 'Run the current checks with Node.js 24')
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(['--cordis', '--deepseek-harness', '--output'].includes(args[index]), `unknown option: ${args[index]}`)
    option(args[index])
  }
  await mkdir(join(root, '.artifacts/current'), { recursive: true })
  const output = option('--output') ?? await mkdtemp(join(root, '.artifacts/current/run-'))
  await mkdir(output, { recursive: true })
  await rm(join(output, 'report.json'), { force: true })
  const lock = await loadLock()
  const work = await mkdtemp(join(root, '.artifacts/current/work-'))
  const repositories = {}
  try {
    for (const key of repositoryKeys) {
      const expected = lock.repositories[key]
      const repo = await repositoryPath(key, expected.source, expected.revision)
      const sourceTrees = {}
      for (const [path, tree] of Object.entries(expected.sourceTrees)) {
        sourceTrees[path] = await command('git', ['rev-parse', `${expected.revision}:${path}`], repo)
        assert.equal(sourceTrees[path], tree, `${key}/${path} differs from the selected source tree`)
      }
      const exported = join(work, key)
      await mkdir(exported)
      const archive = join(work, `${key}.tar`)
      await command('git', ['archive', '--format=tar', `--output=${archive}`, expected.revision, ...Object.keys(sourceTrees), 'LICENSE'], repo)
      await command('tar', ['-xf', archive, '-C', exported])
      const tsconfig = join(exported, 'tsconfig.json')
      await writeFile(tsconfig, JSON.stringify({ compilerOptions: {
        target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler',
        paths: key === 'deepseekHarness' ? { '@deepseek-ai/cosmokit': [join(exported, 'vendor/cosmokit/src/index.ts')] } : {},
      } }))
      const reportPath = join(output, `${key}.json`)
      await rm(reportPath, { force: true })
      console.log(`Checking ${key}@${expected.revision.slice(0, 12)}`)
      const message = await command(process.execPath, [
        join(root, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', tsconfig,
        join(root, 'checks/run.mjs'), join(exported, expected.entry), reportPath,
      ])
      console.log(message)
      const results = await readJson(reportPath)
      validateResults(results)
      repositories[key] = { revision: expected.revision, sourceTrees, results }
    }
    const report = {
      schema: 'cordis.current-verification/v1',
      checkedAt: new Date().toISOString(),
      status: 'pass',
      evidenceKind: 'implementation-behavior-regression',
      paperTheorems: 'not-proved-by-these-checks',
      runtime: { node: process.versions.node, platform: process.platform, architecture: process.arch },
      lockSha256: await fileDigest(join(root, 'current.lock.json')),
      paper: lock.paper,
      checkerSha256: await checkerDigests(),
      repositories,
    }
    await validateReport(report, lock)
    await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`Current verification: 6 / 6 passed. Report: ${join(output, 'report.json')}`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

try { await main() } catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
