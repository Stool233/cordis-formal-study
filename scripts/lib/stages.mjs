import assert from 'node:assert/strict'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  capture,
  exists,
  formatCommand,
  git,
  run,
  sha256File,
  studyRoot,
} from './system.mjs'

export const stageOrder = ['baseline', 'conformance', 'upstream-fix']
export const stageRepositoryKeys = ['cordis', 'deepseekHarness']

const stageRoles = [
  {
    id: 'baseline',
    order: 1,
    branchRole: 'traceBaseline',
    traceInstrumentation: true,
    logicFixes: false,
    expectedOutcome: 'expected-mismatch-reproduced',
  },
  {
    id: 'conformance',
    order: 2,
    branchRole: 'conformance',
    traceInstrumentation: true,
    logicFixes: true,
    expectedOutcome: 'formal-and-tests-pass',
  },
  {
    id: 'upstream-fix',
    order: 3,
    branchRole: 'upstreamFix',
    traceInstrumentation: false,
    logicFixes: true,
    expectedOutcome: 'ordinary-tests-pass',
  },
]

export const ordinaryGateCommands = {
  cordis: [
    {
      name: 'fiber-hmr-loader-regressions',
      command: 'corepack',
      args: [
        'yarn',
        'test',
        'core/fiber',
        'hmr/index',
        'loader/group',
        'loader/index',
        'loader/isolate',
      ],
    },
    { name: 'build-core', command: 'corepack', args: ['yarn', 'build', 'core'] },
    { name: 'build', command: 'corepack', args: ['yarn', 'build'] },
    { name: 'lint', command: 'corepack', args: ['yarn', 'lint'] },
  ],
  deepseekHarness: [
    {
      name: 'lifecycle-and-session-persistence-regressions',
      command: 'corepack',
      args: [
        'pnpm',
        'exec',
        'vitest',
        'run',
        'packages/extensions/tool-cordis/tests/cordis-lifecycle.spec.ts',
        'packages/session/session-persistence/tests/persistence.spec.ts',
        'packages/session/session-persistence/tests/preparations.spec.ts',
        'packages/session/session-persistence/tests/write-behind.spec.ts',
      ],
    },
    { name: 'build', command: 'corepack', args: ['pnpm', 'run', 'build'] },
    { name: 'lint', command: 'corepack', args: ['pnpm', 'run', 'lint'] },
    { name: 'documentation', command: 'corepack', args: ['pnpm', 'run', 'doc-sync'] },
  ],
}

export function validateResearchStages(lock) {
  assert.ok(Array.isArray(lock.researchStages), 'researchStages must be an array')
  assert.deepEqual(lock.researchStages.map(stage => stage.id), stageOrder, 'research stages must remain in discovery, validation, proposal order')
  for (let index = 0; index < stageRoles.length; index++) {
    const expected = stageRoles[index]
    const actual = lock.researchStages[index]
    for (const field of ['id', 'order', 'branchRole', 'traceInstrumentation', 'logicFixes', 'expectedOutcome']) {
      assert.equal(actual[field], expected[field], `${actual.id}.${field} has the wrong stage role`)
    }
    for (const key of stageRepositoryKeys) {
      const repository = actual.repositories[key]
      const variant = lock.branchMatrix[key][actual.branchRole]
      assert.equal(repository.revision, variant.revision, `${actual.id}.${key} revision does not match branchMatrix.${actual.branchRole}`)
      assert.ok(Array.isArray(repository.traceMismatches), `${actual.id}.${key}.traceMismatches must be an array`)
      assert.ok(Array.isArray(repository.behaviorFailures), `${actual.id}.${key}.behaviorFailures must be an array`)
      if (actual.id !== 'baseline') {
        assert.deepEqual(repository.traceMismatches, [], `${actual.id}.${key} must not lock baseline trace mismatches`)
        assert.deepEqual(repository.behaviorFailures, [], `${actual.id}.${key} must not lock baseline behavior failures`)
      }
    }
  }
  const baseline = lock.researchStages[0].repositories
  assert.equal(baseline.cordis.traceMismatches.length, 9, 'Cordis baseline must lock nine trace mismatches')
  assert.equal(baseline.deepseekHarness.traceMismatches.length, 10, 'vendored baseline must lock ten trace mismatches')
  assert.equal(baseline.cordis.behaviorFailures.length, 4, 'Cordis baseline must lock four behavior failures')
  assert.equal(baseline.deepseekHarness.behaviorFailures.length, 3, 'vendored baseline must lock three behavior failures')
  return lock.researchStages
}

export function researchStage(lock, id) {
  const stage = lock.researchStages.find(candidate => candidate.id === id)
  assert.ok(stage, `unknown research stage: ${id}`)
  return stage
}

export function checkoutRoot(lock, stageId, key) {
  const stage = researchStage(lock, stageId)
  return resolve(studyRoot, '.artifacts/checkouts', key, stage.repositories[key].revision)
}

export async function requireStageCheckout(lock, stageId, key) {
  const stage = researchStage(lock, stageId)
  const root = checkoutRoot(lock, stageId, key)
  assert.equal(await exists(root), true, `${root} is missing; run npm run bootstrap:study first`)
  await inspectCheckout(root, stage.repositories[key].revision)
  return root
}

export function validateStageCheckoutState(state, expectedRevision, label = 'stage checkout') {
  assert.equal(state.head, expectedRevision, `${label} HEAD is ${state.head}; expected ${expectedRevision}; refusing to reset it`)
  assert.equal(state.status, '', `${label} is dirty; refusing to reset or overwrite it`)
}

async function inspectCheckout(root, expectedRevision) {
  assert.equal(await exists(resolve(root, '.git')), true, `${root} is not a Git checkout; refusing to overwrite it`)
  const [head, status] = await Promise.all([
    git(['rev-parse', 'HEAD'], root),
    git(['status', '--porcelain=v1', '--untracked-files=all'], root),
  ])
  validateStageCheckoutState({ head, status }, expectedRevision, root)
}

async function repositoryCache(key, source) {
  const root = resolve(studyRoot, '.artifacts/repositories', `${key}.git`)
  if (!(await exists(root))) {
    await mkdir(dirname(root), { recursive: true })
    await run('git', ['init', '--bare', root])
    await run('git', ['--git-dir', root, 'remote', 'add', 'source', source])
  } else {
    assert.equal(await capture('git', ['--git-dir', root, 'rev-parse', '--is-bare-repository']), 'true', `${root} is not a bare repository`)
    assert.equal(await capture('git', ['--git-dir', root, 'remote', 'get-url', 'source']), source, `${root} has the wrong source remote`)
  }
  return root
}

async function ensureStageCheckout(lock, stage, key) {
  const revision = stage.repositories[key].revision
  const target = checkoutRoot(lock, stage.id, key)
  if (await exists(target)) {
    await inspectCheckout(target, revision)
    return target
  }
  const repository = lock.repositories[key]
  const variant = lock.branchMatrix[key][stage.branchRole]
  const cache = await repositoryCache(key, repository.source)
  const fetchedRef = `refs/study/${key}/${stage.branchRole}`
  await run('git', [
    '--git-dir', cache,
    'fetch', '--no-tags', 'source',
    `+refs/heads/${variant.branch}:${fetchedRef}`,
  ])
  const membership = await run('git', [
    '--git-dir', cache,
    'merge-base', '--is-ancestor', revision, fetchedRef,
  ], { allowFailure: true, capture: true, quiet: true })
  assert.equal(membership.code, 0, `${revision} is not reachable from ${repository.source}#${variant.branch}`)
  await mkdir(dirname(target), { recursive: true })
  await run('git', ['--git-dir', cache, 'worktree', 'add', '--detach', target, revision])
  await inspectCheckout(target, revision)
  return target
}

export async function withCordisDependencyLock(lock, root, execute) {
  const source = resolve(studyRoot, lock.bootstrap.cordis.lockPath)
  const target = resolve(root, 'yarn.lock')
  assert.equal(await sha256File(source), lock.bootstrap.cordis.sha256, 'Cordis bootstrap lock SHA-256 mismatch')
  const preserve = await exists(target)
  if (preserve) {
    assert.equal(await sha256File(target), lock.bootstrap.cordis.sha256, `${target} exists with different content; refusing to overwrite it`)
  } else {
    await copyFile(source, target)
  }
  try {
    return await execute(root)
  } finally {
    if (!preserve) await rm(target)
  }
}

async function installCheckout(lock, key, root) {
  if (key === 'cordis') {
    await withCordisDependencyLock(lock, root, cwd => run('corepack', ['yarn', 'install', '--immutable'], { cwd }))
  } else {
    await run('corepack', ['pnpm', 'install', '--frozen-lockfile'], { cwd: root, env: { CI: 'true' } })
  }
}

/** Create and install all SHA-isolated stage checkouts without modifying an existing checkout. */
export async function bootstrapStageCheckouts(lock) {
  const roots = {}
  for (const stage of lock.researchStages) {
    roots[stage.id] = {}
    for (const key of stageRepositoryKeys) {
      roots[stage.id][key] = await ensureStageCheckout(lock, stage, key)
    }
  }
  for (const stage of lock.researchStages) {
    for (const key of stageRepositoryKeys) {
      await installCheckout(lock, key, roots[stage.id][key])
      await inspectCheckout(roots[stage.id][key], stage.repositories[key].revision)
    }
  }
  return roots
}

export function validateUpstreamFixInventory(key, inventory) {
  const files = inventory.files ?? []
  const scripts = inventory.scripts ?? {}
  if (key === 'cordis') {
    assert.equal(files.some(path => path === 'formal' || path.startsWith('formal/')), false, 'upstream-fix Cordis contains formal/ research tooling')
    assert.equal(files.some(path => path.includes('formal-trace')), false, 'upstream-fix Cordis contains a trace sink')
  } else {
    assert.equal(
      files.some(path => /formal-trace|cordis-paper-(?:conformance|scenarios|observation)/.test(path)),
      false,
      'upstream-fix DeepSeek Harness contains paper trace instrumentation or a formal runner',
    )
  }
  for (const [name, command] of Object.entries(scripts)) {
    assert.equal(/^(?:formal:)|cordis-paper/.test(name) || /cordis-paper|formal\/tools/.test(String(command)), false, `upstream-fix ${key} exposes formal script ${name}`)
  }
}

export async function validateUpstreamFixTree(lock, key) {
  const root = checkoutRoot(lock, 'upstream-fix', key)
  const files = (await git(['ls-files'], root)).split('\n').filter(Boolean)
  const packageJson = JSON.parse(await capture(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./package.json')))"], { cwd: root }))
  validateUpstreamFixInventory(key, { files, scripts: packageJson.scripts })
  return root
}

export async function runOrdinaryGates(root, key) {
  const results = []
  for (const definition of ordinaryGateCommands[key]) {
    await run(definition.command, definition.args, { cwd: root, env: { CI: 'true' } })
    results.push({
      name: definition.name,
      command: formatCommand(definition.command, definition.args),
      status: 'pass',
    })
  }
  return results
}
