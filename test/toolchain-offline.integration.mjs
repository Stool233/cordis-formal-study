import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'
import { formalToolEnvironment } from '../scripts/lib/toolchain.mjs'
import { readJson, studyRoot } from '../scripts/lib/system.mjs'

const execute = promisify(execFile)
const study = await readJson(resolve(studyRoot, 'study.lock.json'))
const alignment = await readJson(resolve(studyRoot, 'alignment.lock.json'))

for (const [name, tlaTools] of [['historical', study.toolchain.tlaTools], ['alignment', alignment.tlaTools]]) {
  test(`${name} kit parses all modules and runs TLC with downloads disabled and a stale cache`, { timeout: 120_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'cordis offline tools '))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const kit = join(directory, 'kit')
    const cache = join(directory, 'cache')
    await mkdir(cache)
    await cp(resolve(studyRoot, 'sources/cordis/formal'), join(kit, 'formal'), {
      recursive: true,
      filter: source => !['.cache', 'output'].includes(basename(source)),
    })
    const runner = join(kit, 'formal/tools/run.mjs')
    if (name === 'alignment') {
      const source = await readFile(runner, 'utf8')
      assert.equal(source.split(study.toolchain.tlaTools.sha256).length, 2)
      await writeFile(runner, source.replace(study.toolchain.tlaTools.sha256, tlaTools.sha256))
    }
    for (const file of ['tla2tools-1.8.0.jar', 'CommunityModules-deps-202505152026.jar']) {
      await writeFile(join(cache, file), 'stale cache or replaced release contents')
    }
    const blocker = join(directory, 'deny-downloads.mjs')
    await writeFile(blocker, 'globalThis.fetch = async () => { throw new Error("unexpected formal-tool download") }\n')
    const toolEnv = await formalToolEnvironment({ ...study.toolchain, tlaTools }, { environment: {} })
    const env = { ...process.env, ...toolEnv }
    const syntax = await execute(process.execPath, [
      '--import', pathToFileURL(blocker).href, runner, 'syntax', '--cache', cache, '--quiet',
    ], { cwd: kit, env, timeout: 60_000, maxBuffer: 2_000_000 })
    assert.doesNotMatch(syntax.stdout + syntax.stderr, /unexpected formal-tool download|checksum mismatch/)

    await writeFile(join(directory, 'ToolchainSmoke.tla'), `---- MODULE ToolchainSmoke ----
EXTENDS Naturals
VARIABLE x
Init == x = 0
Next == x' = 1 - x
Spec == Init /\\ [][Next]_x
TypeOK == x \\in {0, 1}
====
`)
    await writeFile(join(directory, 'ToolchainSmoke.cfg'), 'SPECIFICATION Spec\nINVARIANT TypeOK\n')
    const result = await execute('java', [
      '-cp', [toolEnv.CORDIS_TLA_TOOLS_JAR, toolEnv.CORDIS_TLA_COMMUNITY_JAR].join(delimiter),
      'tlc2.TLC', '-workers', '1', '-metadir', join(directory, 'states'),
      '-config', 'ToolchainSmoke.cfg', 'ToolchainSmoke.tla',
    ], { cwd: directory, env, timeout: 60_000, maxBuffer: 2_000_000 })
    assert.match(result.stdout, /Model checking completed\. No error has been found\./)
    assert.match(result.stdout, /2 distinct states found/)
  })
}
