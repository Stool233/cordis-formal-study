#!/usr/bin/env node

import assert from 'node:assert/strict'
import { copyFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { packageEvidence } from './lib/archive.mjs'
import { validateEvidenceOutput } from './lib/evidence.mjs'
import { inspectSubmodule, loadStudyLock, readGitlink, verifyPortal } from './lib/integrity.mjs'
import { exists, run, sha256File, studyRoot } from './lib/system.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

function has(name) {
  return process.argv.includes(name)
}

function usage() {
  process.stdout.write(`usage: node scripts/study.mjs <command> [options]

commands:
  verify [--full]                validate the portal and initialized sources
  bootstrap <core|full>          initialize clean locked sources and install dependencies
  reproduce <core|full|nightly>  generate and validate formal evidence
  package --version <version>    create a deterministic evidence archive
`)
}

async function preflightSubmodules(lock, keys) {
  const pending = []
  for (const key of keys) {
    const repository = lock.repositories[key]
    const gitlink = await readGitlink(repository.path)
    assert.equal(gitlink, repository.revision, `${repository.path} gitlink does not match study.lock.json`)
    const state = await inspectSubmodule(repository)
    if (!state.initialized) pending.push(repository)
  }
  return pending
}

async function initializeSubmodules(repositories) {
  for (const repository of repositories) {
    await run('git', ['submodule', 'update', '--init', '--', repository.path])
    await inspectSubmodule(repository, { required: true })
  }
}

async function withCordisDependencyLock(lock, execute) {
  const root = resolve(studyRoot, lock.repositories.cordis.path)
  const source = resolve(studyRoot, lock.bootstrap.cordis.lockPath)
  const target = resolve(root, 'yarn.lock')
  assert.equal(await sha256File(source), lock.bootstrap.cordis.sha256, 'Cordis bootstrap lock SHA-256 mismatch')
  const preserve = await exists(target)
  if (preserve) {
    assert.equal(
      await sha256File(target),
      lock.bootstrap.cordis.sha256,
      `${lock.repositories.cordis.path}/yarn.lock exists with different content; refusing to overwrite it`,
    )
  } else {
    await copyFile(source, target)
  }
  try {
    return await execute(root)
  } finally {
    if (!preserve) await rm(target)
  }
}

async function installCordis(lock) {
  await withCordisDependencyLock(lock, root => (
    run('corepack', ['yarn', 'install', '--immutable'], { cwd: root })
  ))
}

async function bootstrap(scope) {
  assert.ok(scope === 'core' || scope === 'full', 'bootstrap scope must be core or full')
  const lock = await loadStudyLock()
  const keys = scope === 'full' ? ['cordis', 'paper', 'deepseekHarness'] : ['cordis', 'paper']
  await initializeSubmodules(await preflightSubmodules(lock, keys))
  await installCordis(lock)
  if (scope === 'full') {
    await run('corepack', ['pnpm', 'install', '--frozen-lockfile'], {
      cwd: resolve(studyRoot, lock.repositories.deepseekHarness.path),
      env: { CI: 'true' },
    })
  }
  await verifyPortal({ full: scope === 'full', evidence: false })
  process.stdout.write(`bootstrap ${scope}: pass\n`)
}

function cordisRunner(lock) {
  return resolve(studyRoot, lock.repositories.cordis.path, 'formal/tools/run.mjs')
}

async function reproduceCordis(lock, profile) {
  const relative = profile === 'nightly' ? '.artifacts/cordis-nightly' : '.artifacts/cordis-pr'
  const output = resolve(studyRoot, relative)
  const cache = resolve(studyRoot, '.artifacts/tool-cache')
  await rm(output, { recursive: true, force: true })
  await withCordisDependencyLock(lock, root => run(
    process.execPath,
    [
      cordisRunner(lock),
      profile === 'nightly' ? 'nightly' : 'check',
      '--quiet',
      '--output', output,
      '--cache', cache,
    ],
    { cwd: root },
  ))
  await validateEvidenceOutput(output, lock, {
    role: 'upstream',
    revision: lock.repositories.cordis.revision,
    modelProfile: profile,
  })
}

async function reproduceVendored(lock) {
  const output = resolve(studyRoot, '.artifacts/deepseek-harness')
  const cordisRoot = resolve(studyRoot, lock.repositories.cordis.path)
  const harnessRoot = resolve(studyRoot, lock.repositories.deepseekHarness.path)
  await rm(output, { recursive: true, force: true })
  await run('corepack', ['pnpm', 'test:cordis-paper'], {
    cwd: harnessRoot,
    env: {
      CI: 'true',
      CORDIS_FORMAL_ROOT: cordisRoot,
      CORDIS_FORMAL_OUTPUT: output,
      CORDIS_IMPLEMENTATION_REVISION: lock.repositories.deepseekHarness.revision,
    },
  })
  await validateEvidenceOutput(output, lock, {
    role: 'vendored',
    revision: lock.repositories.deepseekHarness.revision,
  })
}

async function reproduce(scope) {
  assert.ok(['core', 'full', 'nightly'].includes(scope), 'reproduce scope must be core, full, or nightly')
  const lock = await loadStudyLock()
  await verifyPortal({ full: scope === 'full', evidence: false })
  if (scope === 'nightly') await reproduceCordis(lock, 'nightly')
  else await reproduceCordis(lock, 'pr')
  if (scope === 'full') await reproduceVendored(lock)
  process.stdout.write(`reproduce ${scope}: pass\n`)
}

async function main() {
  const command = process.argv[2]
  if (!command || command === 'help' || has('--help')) return usage()
  if (command === 'verify') {
    const result = await verifyPortal({ full: has('--full') })
    process.stdout.write(`verify: pass (${result.full ? 'full' : 'core'} source set)\n`)
    return
  }
  if (command === 'bootstrap') return bootstrap(process.argv[3])
  if (command === 'reproduce') return reproduce(process.argv[3])
  if (command === 'package') {
    const version = option('--version')
    assert.ok(version, 'package requires --version')
    const lock = await loadStudyLock()
    await verifyPortal({ full: true })
    const result = await packageEvidence(lock, version)
    process.stdout.write(`package: pass (${result.files} files)\n`)
    return
  }
  throw new Error(`unknown command: ${command}`)
}

try {
  await main()
} catch (error) {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
