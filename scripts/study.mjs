#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { packageEvidence } from './lib/archive.mjs'
import {
  validateBaselineOutput,
  validateEvidenceOutput,
  validateOrdinaryGatesReport,
  validateStudyReport,
} from './lib/evidence.mjs'
import { inspectSubmodule, loadStudyLock, readGitlink, verifyPortal } from './lib/integrity.mjs'
import { validateSchema } from './lib/schema.mjs'
import {
  bootstrapStageCheckouts,
  requireStageCheckout,
  researchStage,
  runOrdinaryGates,
  validateUpstreamFixTree,
  withCordisDependencyLock,
} from './lib/stages.mjs'
import { readJson, run, studyRoot } from './lib/system.mjs'
import { formalToolEnvironment } from './lib/toolchain.mjs'

const artifactsRoot = resolve(studyRoot, '.artifacts')

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
  verify [--full]                         validate the portal and initialized sources
  bootstrap <core|full|study>             initialize locked sources or all stage checkouts
  reproduce <core|full|nightly>           run low-level conformance profiles
  reproduce <baseline|conformance>        reproduce discovery or corrected formal evidence
  reproduce <upstream-fix|study>          check the proposal patch or all three stages
  package --version <version>             create a deterministic evidence archive
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

async function withPrimaryCordisDependencyLock(lock, execute) {
  const root = resolve(studyRoot, lock.repositories.cordis.path)
  return withCordisDependencyLock(lock, root, execute)
}

async function bootstrap(scope) {
  assert.ok(['core', 'full', 'study'].includes(scope), 'bootstrap scope must be core, full, or study')
  const lock = await loadStudyLock()
  const keys = scope === 'core' ? ['cordis', 'paper'] : ['cordis', 'paper', 'deepseekHarness']
  await initializeSubmodules(await preflightSubmodules(lock, keys))
  if (scope === 'study') {
    await verifyPortal({ full: true, evidence: false })
    await bootstrapStageCheckouts(lock)
  } else {
    await withPrimaryCordisDependencyLock(lock, root => (
      run('corepack', ['yarn', 'install', '--immutable'], { cwd: root })
    ))
    if (scope === 'full') {
      await run('corepack', ['pnpm', 'install', '--frozen-lockfile'], {
        cwd: resolve(studyRoot, lock.repositories.deepseekHarness.path),
        env: { CI: 'true' },
      })
    }
  }
  await verifyPortal({ full: scope !== 'core', evidence: false })
  process.stdout.write(`bootstrap ${scope}: pass\n`)
}

async function reproducePrimaryCordis(lock, profile) {
  const toolEnv = await formalToolEnvironment(lock.toolchain)
  const output = resolve(artifactsRoot, profile === 'nightly' ? 'cordis-nightly' : 'cordis-pr')
  const cache = resolve(artifactsRoot, 'tool-cache')
  await rm(output, { recursive: true, force: true })
  await withPrimaryCordisDependencyLock(lock, root => run(process.execPath, [
    resolve(root, 'formal/tools/run.mjs'),
    profile === 'nightly' ? 'nightly' : 'check',
    '--quiet',
    '--output', output,
    '--cache', cache,
  ], { cwd: root, env: toolEnv }))
  await validateEvidenceOutput(output, lock, {
    role: 'upstream',
    revision: lock.repositories.cordis.revision,
    modelProfile: profile,
  })
}

async function reproduceStageNightly(lock) {
  const toolEnv = await formalToolEnvironment(lock.toolchain)
  const stage = researchStage(lock, 'conformance')
  const root = await requireStageCheckout(lock, stage.id, 'cordis')
  const output = resolve(artifactsRoot, 'cordis-nightly')
  const cache = resolve(artifactsRoot, 'tool-cache')
  await rm(output, { recursive: true, force: true })
  await withCordisDependencyLock(lock, root, cwd => run(process.execPath, [
    resolve(cwd, 'formal/tools/run.mjs'),
    'nightly',
    '--quiet',
    '--output', output,
    '--cache', cache,
  ], { cwd, env: toolEnv }))
  await validateEvidenceOutput(output, lock, {
    role: 'upstream',
    revision: stage.repositories.cordis.revision,
    modelProfile: 'nightly',
  })
}

async function reproducePrimaryVendored(lock) {
  const toolEnv = await formalToolEnvironment(lock.toolchain)
  const output = resolve(artifactsRoot, 'deepseek-harness')
  const cordisRoot = resolve(studyRoot, lock.repositories.cordis.path)
  const harnessRoot = resolve(studyRoot, lock.repositories.deepseekHarness.path)
  await rm(output, { recursive: true, force: true })
  await run('corepack', ['pnpm', 'test:cordis-paper'], {
    cwd: harnessRoot,
    env: {
      ...toolEnv,
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

async function reproduceLowLevel(scope) {
  assert.ok(['core', 'full', 'nightly'].includes(scope), 'low-level reproduce scope must be core, full, or nightly')
  const lock = await loadStudyLock()
  await verifyPortal({ full: scope === 'full', evidence: false })
  if (scope === 'nightly') await reproduceStageNightly(lock)
  else await reproducePrimaryCordis(lock, 'pr')
  if (scope === 'full') await reproducePrimaryVendored(lock)
  process.stdout.write(`reproduce ${scope}: pass\n`)
}

function stageOutput(order, id, key) {
  return resolve(artifactsRoot, 'stages', `${String(order).padStart(2, '0')}-${id}`, key)
}

async function reproduceBaseline(lock) {
  const toolEnv = await formalToolEnvironment(lock.toolchain)
  const stage = researchStage(lock, 'baseline')
  const stageRoot = resolve(artifactsRoot, 'stages/01-baseline')
  const cache = resolve(artifactsRoot, 'tool-cache')
  const cordisRoot = await requireStageCheckout(lock, stage.id, 'cordis')
  const harnessRoot = await requireStageCheckout(lock, stage.id, 'deepseekHarness')
  const cordisOutput = stageOutput(stage.order, stage.id, 'cordis')
  const harnessOutput = stageOutput(stage.order, stage.id, 'deepseek-harness')
  await rm(stageRoot, { recursive: true, force: true })
  await withCordisDependencyLock(lock, cordisRoot, root => run(process.execPath, [
    resolve(root, 'formal/tools/run.mjs'),
    'baseline',
    '--quiet',
    '--output', cordisOutput,
    '--cache', cache,
  ], { cwd: root, env: toolEnv }))
  const cordis = await validateBaselineOutput(cordisOutput, lock, { key: 'cordis', role: 'upstream' })
  await run('corepack', ['pnpm', 'test:cordis-paper'], {
    cwd: harnessRoot,
    env: {
      ...toolEnv,
      CI: 'true',
      CORDIS_FORMAL_ROOT: cordisRoot,
      CORDIS_FORMAL_OUTPUT: harnessOutput,
      CORDIS_IMPLEMENTATION_REVISION: stage.repositories.deepseekHarness.revision,
    },
  })
  const deepseekHarness = await validateBaselineOutput(harnessOutput, lock, {
    key: 'deepseekHarness',
    role: 'vendored-unmodified',
  })
  return { stage, cordis, deepseekHarness }
}

async function reproduceConformance(lock) {
  const toolEnv = await formalToolEnvironment(lock.toolchain)
  const stage = researchStage(lock, 'conformance')
  const stageRoot = resolve(artifactsRoot, 'stages/02-conformance')
  const cache = resolve(artifactsRoot, 'tool-cache')
  const cordisRoot = await requireStageCheckout(lock, stage.id, 'cordis')
  const harnessRoot = await requireStageCheckout(lock, stage.id, 'deepseekHarness')
  const cordisOutput = stageOutput(stage.order, stage.id, 'cordis')
  const harnessOutput = stageOutput(stage.order, stage.id, 'deepseek-harness')
  await rm(stageRoot, { recursive: true, force: true })
  await withCordisDependencyLock(lock, cordisRoot, async root => {
    await run(process.execPath, [
      resolve(root, 'formal/tools/run.mjs'),
      'check',
      '--quiet',
      '--output', cordisOutput,
      '--cache', cache,
    ], { cwd: root, env: toolEnv })
    await runOrdinaryGates(root, 'cordis')
  })
  const cordis = await validateEvidenceOutput(cordisOutput, lock, {
    role: 'upstream',
    revision: stage.repositories.cordis.revision,
    modelProfile: 'pr',
  })
  await run('corepack', ['pnpm', 'test:cordis-paper'], {
    cwd: harnessRoot,
    env: {
      ...toolEnv,
      CI: 'true',
      CORDIS_FORMAL_ROOT: cordisRoot,
      CORDIS_FORMAL_OUTPUT: harnessOutput,
      CORDIS_IMPLEMENTATION_REVISION: stage.repositories.deepseekHarness.revision,
    },
  })
  const deepseekHarness = await validateEvidenceOutput(harnessOutput, lock, {
    role: 'vendored',
    revision: stage.repositories.deepseekHarness.revision,
  })
  await runOrdinaryGates(harnessRoot, 'deepseekHarness')
  return { stage, cordis, deepseekHarness }
}

async function writeValidatedReport(relative, report, schemaName, validate) {
  const schema = await readJson(resolve(studyRoot, 'schemas', schemaName))
  validateSchema(report, schema)
  validate(report)
  const path = resolve(artifactsRoot, relative)
  await mkdir(resolve(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
  return path
}

async function reproduceUpstreamFix(lock) {
  const stage = researchStage(lock, 'upstream-fix')
  const stageRoot = resolve(artifactsRoot, 'stages/03-upstream-fix')
  const cordisRoot = await requireStageCheckout(lock, stage.id, 'cordis')
  const harnessRoot = await requireStageCheckout(lock, stage.id, 'deepseekHarness')
  await rm(stageRoot, { recursive: true, force: true })
  await validateUpstreamFixTree(lock, 'cordis')
  await validateUpstreamFixTree(lock, 'deepseekHarness')
  const cordisCommands = await withCordisDependencyLock(lock, cordisRoot, root => runOrdinaryGates(root, 'cordis'))
  const harnessCommands = await runOrdinaryGates(harnessRoot, 'deepseekHarness')
  const report = {
    schema: 'cordis.formal-study-ordinary-gates/v1',
    stage: 'upstream-fix',
    status: 'pass',
    formalStatus: 'not-run',
    formalEvidence: {
      stage: 'conformance',
      cordis: {
        revision: lock.branchMatrix.cordis.conformance.revision,
        report: 'stages/02-conformance/cordis/conformance-report.json',
      },
      deepseekHarness: {
        revision: lock.branchMatrix.deepseekHarness.conformance.revision,
        report: 'stages/02-conformance/deepseek-harness/conformance-report.json',
      },
    },
    repositories: {
      cordis: {
        revision: stage.repositories.cordis.revision,
        instrumentation: 'absent',
        commands: cordisCommands,
      },
      deepseekHarness: {
        revision: stage.repositories.deepseekHarness.revision,
        instrumentation: 'absent',
        commands: harnessCommands,
      },
    },
  }
  await writeValidatedReport(
    'stages/03-upstream-fix/ordinary-gates-report.json',
    report,
    'ordinary-gates-report.schema.json',
    value => validateOrdinaryGatesReport(value, lock),
  )
  return { stage, report }
}

function aggregateReport(lock, baseline, conformance, upstreamFix) {
  return {
    schema: 'cordis.formal-study-report/v1',
    studyVersion: lock.studyVersion,
    status: 'pass',
    stages: [
      {
        id: 'baseline',
        order: 1,
        status: baseline.stage.expectedOutcome,
        formalStatus: 'expected-fail',
        repositories: {
          cordis: {
            revision: baseline.stage.repositories.cordis.revision,
            report: 'stages/01-baseline/cordis/conformance-report.json',
            traceMismatches: baseline.cordis.traceMismatches,
            behaviorFailures: baseline.cordis.behaviorFailures,
          },
          deepseekHarness: {
            revision: baseline.stage.repositories.deepseekHarness.revision,
            report: 'stages/01-baseline/deepseek-harness/conformance-report.json',
            traceMismatches: baseline.deepseekHarness.traceMismatches,
            behaviorFailures: baseline.deepseekHarness.behaviorFailures,
          },
        },
      },
      {
        id: 'conformance',
        order: 2,
        status: conformance.stage.expectedOutcome,
        formalStatus: 'pass',
        repositories: {
          cordis: {
            revision: conformance.stage.repositories.cordis.revision,
            report: 'stages/02-conformance/cordis/conformance-report.json',
            scenarios: conformance.cordis.scenarios,
            mutations: conformance.cordis.mutations,
          },
          deepseekHarness: {
            revision: conformance.stage.repositories.deepseekHarness.revision,
            report: 'stages/02-conformance/deepseek-harness/conformance-report.json',
            scenarios: conformance.deepseekHarness.scenarios,
            mutations: conformance.deepseekHarness.mutations,
          },
        },
      },
      {
        id: 'upstream-fix',
        order: 3,
        status: upstreamFix.stage.expectedOutcome,
        formalStatus: 'not-run',
        repositories: {
          cordis: {
            revision: upstreamFix.stage.repositories.cordis.revision,
            report: 'stages/03-upstream-fix/ordinary-gates-report.json',
          },
          deepseekHarness: {
            revision: upstreamFix.stage.repositories.deepseekHarness.revision,
            report: 'stages/03-upstream-fix/ordinary-gates-report.json',
          },
        },
      },
    ],
  }
}

function aggregateMarkdown(report) {
  const baseline = report.stages[0].repositories
  const conformance = report.stages[1].repositories
  return `# Cordis Formal Study report / 研究报告

Overall status / 总体状态: **pass**

| Stage / 阶段 | Result / 结果 | Formal status / 形式化状态 |
| --- | --- | --- |
| 1. baseline | locked mismatches reproduced / 已复现锁定不一致 | expected-fail |
| 2. conformance | fixes satisfy bounded model, traces, mutations, and tests / 修复通过有限模型、轨迹、变异和测试 | pass |
| 3. upstream-fix | trace-free patch passes ordinary gates / 无插桩补丁通过普通门禁 | not-run |

- Baseline / 基线: Cordis ${baseline.cordis.traceMismatches} trace + ${baseline.cordis.behaviorFailures} behavior mismatches; vendored Cordis ${baseline.deepseekHarness.traceMismatches} trace + ${baseline.deepseekHarness.behaviorFailures} behavior mismatches.
- Conformance / 符合性: Cordis ${conformance.cordis.scenarios} scenarios; vendored Cordis ${conformance.deepseekHarness.scenarios} scenarios; ${conformance.cordis.mutations} rejected mutants per implementation.
- Upstream-fix / 上游补丁: formalStatus is deliberately \`not-run\`; its formal evidence is the stage-two revision carrying the same logic fixes.
`
}

async function reproduceStudy(lock) {
  const baseline = await reproduceBaseline(lock)
  const conformance = await reproduceConformance(lock)
  const upstreamFix = await reproduceUpstreamFix(lock)
  const report = aggregateReport(lock, baseline, conformance, upstreamFix)
  await writeValidatedReport(
    'study-report.json',
    report,
    'study-report.schema.json',
    value => validateStudyReport(value, lock),
  )
  await writeFile(resolve(artifactsRoot, 'study-report.md'), aggregateMarkdown(report))
  return report
}

async function reproduceStage(scope) {
  if (['core', 'full', 'nightly'].includes(scope)) return reproduceLowLevel(scope)
  const lock = await loadStudyLock()
  await verifyPortal({ full: true, evidence: false })
  if (scope === 'baseline') await reproduceBaseline(lock)
  else if (scope === 'conformance') await reproduceConformance(lock)
  else if (scope === 'upstream-fix') await reproduceUpstreamFix(lock)
  else if (scope === 'study') await reproduceStudy(lock)
  else throw new Error('reproduce scope must be baseline, conformance, upstream-fix, study, core, full, or nightly')
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
  if (command === 'reproduce') return reproduceStage(process.argv[3])
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
