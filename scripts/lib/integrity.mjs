import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  assertHash,
  assertGitlink,
  validateEvidenceOutput,
  validateSubmoduleState,
} from './evidence.mjs'
import { validateSchema } from './schema.mjs'
import {
  exists,
  filesUnder,
  git,
  portableReference,
  readJson,
  sha256File,
  studyRoot,
} from './system.mjs'

const documentationPairs = [
  ['README.md', 'README.zh-CN.md'],
  ['docs/architecture.md', 'docs/architecture.zh-CN.md'],
  ['docs/method.md', 'docs/method.zh-CN.md'],
  ['docs/reproduce.md', 'docs/reproduce.zh-CN.md'],
  ['docs/results.md', 'docs/results.zh-CN.md'],
]

function repositoryEntries(lock) {
  return Object.entries(lock.repositories)
}

function exactNames(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} set differs from study.lock.json`)
}

function scenarioNames(source, start, end) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from)
  assert.ok(from >= 0 && to > from, `could not locate ${start} scenario inventory`)
  return [...source.slice(from, to).matchAll(/^  \{\n    name: '([^']+)'/gm)].map(match => match[1])
}

async function markdownFiles() {
  const files = documentationPairs.flat()
  files.push('LICENSES/README.md')
  return [...new Set(files)]
}

function markdownTargets(content) {
  return [...content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1])
}

function localTarget(raw) {
  let target = raw.trim()
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1)
  if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined
  target = target.split('#', 1)[0].split('?', 1)[0]
  assert.ok(target && !target.startsWith('/'), `local documentation link must be relative: ${raw}`)
  return decodeURIComponent(target)
}

export async function loadStudyLock() {
  const [lock, schema] = await Promise.all([
    readJson(resolve(studyRoot, 'study.lock.json')),
    readJson(resolve(studyRoot, 'schemas/study-lock.schema.json')),
  ])
  validateSchema(lock, schema)
  assert.equal(lock.evidence.coreScenarioCount, lock.evidence.coreScenarios.length)
  assert.equal(lock.evidence.mutationCount, lock.evidence.mutations.length)
  assert.equal(
    lock.evidence.fullScenarioCount,
    lock.evidence.coreScenarios.length + lock.evidence.deepseekScenarios.length,
  )
  for (const [, repository] of repositoryEntries(lock)) {
    assert.equal(repository.branch.startsWith('codex/'), false, `${repository.path} uses a forbidden codex/* branch`)
  }
  for (const key of ['cordis', 'deepseekHarness']) {
    const repository = lock.repositories[key]
    const variants = lock.branchMatrix[key]
    assert.deepEqual(
      {
        branch: repository.branch,
        revision: repository.revision,
      },
      {
        branch: variants.conformance.branch,
        revision: variants.conformance.revision,
      },
      `${key} primary source must be the conformance variant`,
    )
    assert.deepEqual(
      [variants.traceBaseline.traceInstrumentation, variants.traceBaseline.logicFixes, variants.traceBaseline.evidence],
      [true, false, 'expected-trace-mismatches'],
      `${key} trace baseline has the wrong role`,
    )
    assert.deepEqual(
      [variants.conformance.traceInstrumentation, variants.conformance.logicFixes, variants.conformance.evidence],
      [true, true, 'formal-and-ordinary-tests-pass'],
      `${key} conformance variant has the wrong role`,
    )
    assert.deepEqual(
      [variants.upstreamFix.traceInstrumentation, variants.upstreamFix.logicFixes, variants.upstreamFix.evidence],
      [false, true, 'ordinary-tests-pass'],
      `${key} upstream-fix variant has the wrong role`,
    )
    for (const variant of Object.values(variants)) {
      assert.equal(variant.branch.startsWith('codex/'), false, `${key} variant uses a forbidden codex/* branch`)
    }
  }
  return lock
}

export async function readGitlink(path) {
  const output = await git(['ls-files', '--stage', '--', path])
  const match = output.match(/^160000 ([0-9a-f]{40}) 0\t/)
  assert.ok(match, `${path} is not recorded as a git submodule`)
  return match[1]
}

export async function inspectSubmodule(repository, options = {}) {
  const root = resolve(studyRoot, repository.path)
  const gitlink = await readGitlink(repository.path)
  assertGitlink(repository.revision, gitlink, repository.path)
  const initialized = await exists(resolve(root, '.git'))
  if (!initialized) {
    assert.equal(options.required ?? false, false, `${repository.path} is not initialized`)
    return { initialized: false, dirty: false, head: undefined, gitlink }
  }
  const [head, status] = await Promise.all([
    git(['rev-parse', 'HEAD'], root),
    git(['status', '--porcelain=v1', '--untracked-files=all'], root),
  ])
  const state = { initialized: true, dirty: Boolean(status), head, gitlink }
  validateSubmoduleState(state, repository.revision, repository.path)
  return state
}

async function validateGitmodules(lock) {
  const content = await readFile(resolve(studyRoot, '.gitmodules'), 'utf8')
  for (const [, repository] of repositoryEntries(lock)) {
    assert.ok(content.includes(`path = ${repository.path}`), `.gitmodules does not declare ${repository.path}`)
    assert.ok(content.includes(`url = ${repository.source}`), `.gitmodules does not use the locked source for ${repository.path}`)
  }
}

async function validateOwnedCommitIdentity(lock, key) {
  const repository = lock.repositories[key]
  const root = resolve(studyRoot, repository.path)
  for (const revision of repository.ownedCommits) {
    const identity = (await git([
      'show', '-s', '--format=%an%x00%ae%x00%cn%x00%ce', revision,
    ], root)).split('\0')
    assert.deepEqual(identity, [
      lock.commitIdentity.name,
      lock.commitIdentity.email,
      lock.commitIdentity.name,
      lock.commitIdentity.email,
    ], `${repository.path} commit ${revision} has the wrong author or committer`)
  }
  for (const rewrite of repository.rewrittenCommits) {
    assert.ok(repository.ownedCommits.includes(rewrite.studyRevision), `${rewrite.studyRevision} is not an owned commit`)
  }
}

async function validateCoreSource(lock) {
  const root = resolve(studyRoot, lock.repositories.cordis.path)
  const [provenance, observations, scenarios, generator, theorems, runner] = await Promise.all([
    readJson(resolve(root, 'formal/provenance.json')),
    readJson(resolve(root, 'formal/observation-points.json')),
    readFile(resolve(root, 'formal/harness/scenarios.ts'), 'utf8'),
    readFile(resolve(root, 'formal/harness/generate.ts'), 'utf8'),
    readFile(resolve(root, 'formal/THEOREMS.md'), 'utf8'),
    readFile(resolve(root, 'formal/tools/run.mjs'), 'utf8'),
  ])
  assert.equal(provenance.paper.commit, lock.repositories.paper.revision)
  assert.equal(provenance.paper.sha256, lock.paper.sha256)
  assert.equal(provenance.cordis.baseline, lock.repositories.cordis.baseline)
  assert.equal(provenance.cordis.formalBranch, lock.repositories.cordis.branch)
  assert.equal(provenance.deepseekHarness.baseline, lock.repositories.deepseekHarness.baseline)
  assert.equal(provenance.specula.commit, lock.references.specula.commit)
  assert.equal(provenance.specula.version, lock.references.specula.version)
  assert.deepEqual(provenance.toolchain, {
    tlaTools: lock.toolchain.tlaTools,
    communityModules: lock.toolchain.communityModules,
  })
  for (const tool of [lock.toolchain.tlaTools, lock.toolchain.communityModules]) {
    assert.ok(runner.includes(tool.version), `Cordis runner does not pin tool version ${tool.version}`)
    assert.ok(runner.includes(tool.sha256), `Cordis runner does not pin tool hash ${tool.sha256}`)
  }
  assert.ok(Array.isArray(observations.entries))
  assert.equal(observations.entries.length, lock.evidence.observationPointCount)
  for (const entry of observations.entries) {
    assert.ok(Number.isInteger(entry.occurrences) && entry.occurrences > 0, 'observation occurrence must be positive')
  }

  const coreNames = scenarioNames(scenarios, 'export const scenarios', 'export const preconditionScenarios')
  const expectedCore = lock.evidence.coreScenarios.filter(name => !name.startsWith('confluence-'))
  exactNames(coreNames, expectedCore, 'core scenario')
  assert.ok(generator.includes("captureConfluence(api, implementation, 'left')"))
  assert.ok(generator.includes("captureConfluence(api, implementation, 'right')"))
  const premiseNames = scenarioNames(scenarios, 'export const preconditionScenarios', 'export function canonicalState')
  exactNames(premiseNames, lock.evidence.prerequisiteAudits.map(item => item.name), 'prerequisite scenario')
  for (const property of lock.evidence.requiredProperties) {
    assert.ok(
      [runner, scenarios, generator].some(source => source.includes(property)),
      `Cordis conformance kit does not check ${property}`,
    )
    if (property !== 'RuntimeRefinesPaper') {
      assert.ok(theorems.includes(property), `THEOREMS.md does not mention ${property}`)
    }
  }
  await validateOwnedCommitIdentity(lock, 'cordis')
}

async function validateBootstrapAssets(lock) {
  const cordis = lock.bootstrap.cordis
  portableReference(cordis.lockPath)
  assertHash(
    await sha256File(resolve(studyRoot, cordis.lockPath)),
    cordis.sha256,
    'Cordis bootstrap lock',
  )
  const packageJson = await readJson(resolve(studyRoot, lock.repositories.cordis.path, 'package.json'))
  assert.equal(packageJson.packageManager, cordis.packageManager, 'Cordis package manager differs from the bootstrap lock')
}

async function validateDeepSeekSource(lock) {
  const root = resolve(studyRoot, lock.repositories.deepseekHarness.path)
  const [scenarios, workflow, note, noteZh, runner, packageJson] = await Promise.all([
    readFile(resolve(root, 'scripts/cordis-paper-scenarios.ts'), 'utf8'),
    readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8'),
    readFile(resolve(root, '.agents/notes/implemented/testing/2026-08-15-cordis-paper-trace-conformance.md'), 'utf8'),
    readFile(resolve(root, '.agents/notes/implemented/testing/2026-08-15-cordis-paper-trace-conformance.zh.md'), 'utf8'),
    readFile(resolve(root, 'scripts/run-cordis-paper-conformance.ts'), 'utf8'),
    readJson(resolve(root, 'package.json')),
  ])
  exactNames(
    scenarioNames(scenarios, 'export const scenarios', '] satisfies readonly ScenarioDefinition[]'),
    lock.evidence.deepseekScenarios,
    'DeepSeek Harness scenario',
  )
  const cordisRevision = lock.repositories.cordis.revision
  assert.ok(workflow.includes(`ref: ${cordisRevision}`), 'DeepSeek Harness CI does not pin the locked Cordis revision')
  assert.ok(note.includes(`/tree/${cordisRevision}/formal`), 'English Agent Note has the wrong Cordis pin')
  assert.ok(noteZh.includes(`/tree/${cordisRevision}/formal`), 'Chinese Agent Note has the wrong Cordis pin')
  assert.ok(runner.includes('CORDIS_FORMAL_ROOT'), 'DeepSeek Harness runner does not accept CORDIS_FORMAL_ROOT')
  assert.equal(packageJson.scripts['test:cordis-paper'], 'tsx scripts/run-cordis-paper-conformance.ts')
  await validateOwnedCommitIdentity(lock, 'deepseekHarness')
}

async function validatePaper(lock) {
  assertHash(
    await sha256File(resolve(studyRoot, lock.paper.path)),
    lock.paper.sha256,
    'paper.pdf',
  )
}

async function validateDocumentation() {
  for (const pair of documentationPairs) {
    for (const path of pair) assert.equal(await exists(resolve(studyRoot, path)), true, `${path} is missing`)
  }
  for (const path of await markdownFiles()) {
    const absolute = resolve(studyRoot, path)
    const content = await readFile(absolute, 'utf8')
    assert.ok(content.endsWith('\n'), `${path} has no final newline`)
    assert.equal(/[ \t]+$/m.test(content), false, `${path} contains trailing whitespace`)
    for (const raw of markdownTargets(content)) {
      const target = localTarget(raw)
      if (!target) continue
      const destination = resolve(dirname(absolute), target)
      assert.equal(await exists(destination), true, `${path} links to missing ${raw}`)
    }
  }
}

async function validatePortalFiles() {
  for (const path of [
    '.github/workflows/integrity.yml',
    '.github/workflows/conformance.yml',
    '.github/workflows/nightly.yml',
    '.github/workflows/release.yml',
    'scripts/study.mjs',
    'test/study.test.mjs',
  ]) {
    assert.equal(await exists(resolve(studyRoot, path)), true, `${path} is missing`)
  }
  for (const path of ['.github/workflows/conformance.yml', '.github/workflows/nightly.yml']) {
    const workflow = await readFile(resolve(studyRoot, path), 'utf8')
    assert.ok(workflow.includes('uses: actions/upload-artifact@v7'), `${path} must use upload-artifact v7`)
    assert.ok(workflow.includes('include-hidden-files: true'), `${path} must upload the hidden evidence root`)
  }
  const release = await readFile(resolve(studyRoot, '.github/workflows/release.yml'), 'utf8')
  assert.ok(release.includes('uses: actions/upload-artifact@v7'), 'release workflow must use upload-artifact v7')
}

async function validateLicenses(lock, states) {
  for (const path of ['LICENSE', 'NOTICE', 'LICENSES/CC-BY-4.0.txt', 'LICENSES/README.md']) {
    assert.equal(await exists(resolve(studyRoot, path)), true, `${path} is missing`)
  }
  for (const [key, repository] of repositoryEntries(lock)) {
    if (repository.license !== 'MIT' || !states[key].initialized) continue
    assert.equal(await exists(resolve(studyRoot, repository.path, 'LICENSE')), true, `${repository.path}/LICENSE is missing`)
  }
  assert.equal(lock.repositories.paper.license, 'NOASSERTION')
}

async function validateExistingEvidence(lock) {
  const outputs = [
    ['.artifacts/cordis-pr', { role: 'upstream', revision: lock.repositories.cordis.revision, modelProfile: 'pr' }],
    ['.artifacts/cordis-nightly', { role: 'upstream', revision: lock.repositories.cordis.revision, modelProfile: 'nightly' }],
    ['.artifacts/deepseek-harness', { role: 'vendored', revision: lock.repositories.deepseekHarness.revision }],
  ]
  for (const [relative, options] of outputs) {
    const root = resolve(studyRoot, relative)
    if ((await filesUnder(root)).length === 0) continue
    await validateEvidenceOutput(root, lock, options)
  }
}

/** Validate the portal lock, initialized sources, documentation, and generated evidence. */
export async function verifyPortal(options = {}) {
  const lock = await loadStudyLock()
  await validateGitmodules(lock)
  const states = {}
  for (const [key, repository] of repositoryEntries(lock)) {
    const required = key !== 'deepseekHarness' || options.full === true
    states[key] = await inspectSubmodule(repository, { required })
  }
  assert.equal(states.cordis.initialized, true)
  assert.equal(states.paper.initialized, true)
  await Promise.all([
    validateCoreSource(lock),
    validateBootstrapAssets(lock),
    validatePaper(lock),
    validateDocumentation(),
    validatePortalFiles(),
    validateLicenses(lock, states),
  ])
  if (states.deepseekHarness.initialized) await validateDeepSeekSource(lock)
  if (options.evidence !== false) await validateExistingEvidence(lock)
  return {
    full: states.deepseekHarness.initialized,
    repositories: Object.fromEntries(repositoryEntries(lock).map(([key, repository]) => [key, repository.revision])),
  }
}
