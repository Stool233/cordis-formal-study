import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { formalToolEnvironment, loadToolArtifacts, verifyToolArtifacts } from '../scripts/lib/toolchain.mjs'
import { readJson, sha256, studyRoot } from '../scripts/lib/system.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'cordis tools '))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'tools/artifacts'), { recursive: true })
  const artifacts = []
  const toolchain = {}
  for (const tool of ['tlaTools', 'communityModules']) {
    const data = Buffer.from(`test bytes for ${tool}`)
    const digest = sha256(data)
    const artifact = { tool, version: 'test', sha256: digest, bytes: data.length, path: `tools/artifacts/${digest}.jar` }
    await writeFile(resolve(root, artifact.path), data)
    artifacts.push(artifact)
    toolchain[tool] = { version: artifact.version, sha256: digest }
  }
  const manifest = { schema: 'cordis.formal-study-tool-artifacts/v1', artifacts }
  const save = () => writeFile(join(root, 'tools/artifacts.json'), JSON.stringify(manifest))
  await save()
  return { root, manifest, toolchain, save }
}

test('bundled tools cover both unchanged locks with distinct TLC artifacts', async () => {
  const manifest = await verifyToolArtifacts()
  const study = await readJson(resolve(studyRoot, 'study.lock.json'))
  const alignment = await readJson(resolve(studyRoot, 'alignment.lock.json'))
  const original = await formalToolEnvironment(study.toolchain, { environment: {} })
  const migrated = await formalToolEnvironment({ ...study.toolchain, tlaTools: alignment.tlaTools }, { environment: {} })
  assert.notEqual(original.CORDIS_TLA_TOOLS_JAR, migrated.CORDIS_TLA_TOOLS_JAR)
  assert.equal(original.CORDIS_TLA_COMMUNITY_JAR, migrated.CORDIS_TLA_COMMUNITY_JAR)
  assert.equal(manifest.artifacts.length, 3)
})

test('tool selection works without fetching even when the old cache contains replacement bytes', async t => {
  const { root, toolchain } = await fixture(t)
  await mkdir(join(root, '.artifacts/tool-cache'), { recursive: true })
  await writeFile(join(root, '.artifacts/tool-cache/tla2tools-1.8.0.jar'), 'new rolling release')
  const fetch = globalThis.fetch
  t.after(() => { globalThis.fetch = fetch })
  globalThis.fetch = () => { throw new Error('network must not be used') }
  const env = await formalToolEnvironment(toolchain, { root, environment: {} })
  assert.equal(sha256(await readFile(env.CORDIS_TLA_TOOLS_JAR)), toolchain.tlaTools.sha256)
})

test('missing or corrupted bundled files fail instead of accepting another release', async t => {
  const { root, manifest, toolchain } = await fixture(t)
  const path = resolve(root, manifest.artifacts[0].path)
  await writeFile(path, 'corrupted bytes')
  await assert.rejects(formalToolEnvironment(toolchain, { root, environment: {} }), /SHA-256 mismatch/)
  await rm(path)
  await assert.rejects(formalToolEnvironment(toolchain, { root, environment: {} }), /No rolling-release download/)
})

test('explicit overrides are accepted only at the selected digest', async t => {
  const { root, manifest, toolchain } = await fixture(t)
  const path = join(root, 'external copy.jar')
  await writeFile(path, await readFile(resolve(root, manifest.artifacts[0].path)))
  const environment = { CORDIS_TLA_TOOLS_JAR: path }
  assert.equal((await formalToolEnvironment(toolchain, { root, environment })).CORDIS_TLA_TOOLS_JAR, path)
  await writeFile(path, 'wrong tool')
  await assert.rejects(formalToolEnvironment(toolchain, { root, environment }), /SHA-256 mismatch/)
  await rm(path)
  await assert.rejects(formalToolEnvironment(toolchain, { root, environment }), /Cannot read pinned/)
  await assert.rejects(formalToolEnvironment(toolchain, { root, environment: { CORDIS_TLA_TOOLS_JAR: '' } }), /must name a file/)
})

test('an unknown digest or changed version cannot silently select the default tool', async t => {
  const { root, toolchain } = await fixture(t)
  const changed = structuredClone(toolchain)
  changed.tlaTools.sha256 = '0'.repeat(64)
  await assert.rejects(formalToolEnvironment(changed, { root, environment: {} }), /No bundled tlaTools matches/)
  changed.tlaTools = { ...toolchain.tlaTools, version: 'new-version' }
  await assert.rejects(formalToolEnvironment(changed, { root, environment: {} }), /version differs/)
})

test('manifest rejects path escapes and duplicate digests', async t => {
  const { root, manifest, save } = await fixture(t)
  const path = manifest.artifacts[0].path
  manifest.artifacts[0].path = '../outside.jar'
  await save()
  await assert.rejects(loadToolArtifacts(root))
  manifest.artifacts[0].path = path
  manifest.artifacts.push(manifest.artifacts[0])
  await save()
  await assert.rejects(loadToolArtifacts(root), /duplicate tool artifact digest/)
})
