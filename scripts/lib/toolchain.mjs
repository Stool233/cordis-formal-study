import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { readJson, sha256, studyRoot } from './system.mjs'

const definitions = [
  ['tlaTools', 'CORDIS_TLA_TOOLS_JAR'],
  ['communityModules', 'CORDIS_TLA_COMMUNITY_JAR'],
]

export async function loadToolArtifacts(root = studyRoot) {
  const manifest = await readJson(resolve(root, 'tools/artifacts.json'))
  assert.equal(manifest.schema, 'cordis.formal-study-tool-artifacts/v1')
  assert.ok(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0)
  const digests = new Set()
  for (const artifact of manifest.artifacts) {
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/)
    assert.equal(digests.has(artifact.sha256), false, 'duplicate tool artifact digest')
    digests.add(artifact.sha256)
    assert.equal(artifact.path, `tools/artifacts/${artifact.sha256}.jar`)
    assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0)
    assert.ok(definitions.some(([key]) => key === artifact.tool), 'unknown tool artifact')
    assert.ok(typeof artifact.version === 'string' && artifact.version.length > 0)
  }
  return manifest
}

async function verifyArtifact(path, artifact) {
  let contents
  try {
    contents = await readFile(path)
  } catch (error) {
    throw new Error(`Cannot read pinned ${artifact.tool} artifact ${path}; restore the file from this checkout. No rolling-release download is attempted.`, { cause: error })
  }
  assert.equal(sha256(contents), artifact.sha256, `${artifact.tool} SHA-256 mismatch: ${path}`)
  assert.equal(contents.length, artifact.bytes, `${artifact.tool} size mismatch: ${path}`)
}

/** Validate every bundled file, including artifacts not selected by this run. */
export async function verifyToolArtifacts(root = studyRoot) {
  const manifest = await loadToolArtifacts(root)
  await Promise.all(manifest.artifacts.map(artifact => verifyArtifact(resolve(root, artifact.path), artifact)))
  return manifest
}

/** Supply exact local artifacts to the unchanged kit's own checksum verifier. */
export async function formalToolEnvironment(toolchain, { root = studyRoot, environment = process.env } = {}) {
  const manifest = await loadToolArtifacts(root)
  const result = {}
  for (const [key, variable] of definitions) {
    const expected = toolchain[key]
    assert.ok(expected, `${key} is missing from the selected toolchain`)
    const artifact = manifest.artifacts.find(item => item.tool === key && item.sha256 === expected.sha256)
    assert.ok(artifact, `No bundled ${key} matches the selected lock's SHA-256 ${expected.sha256}; add and review the exact artifact before running.`)
    assert.equal(artifact.version, expected.version, `${key} version differs from artifact manifest`)
    const override = environment[variable]
    assert.ok(override === undefined || (typeof override === 'string' && override.trim().length > 0), `${variable} must name a file`)
    const path = override === undefined ? resolve(root, artifact.path) : resolve(override)
    await verifyArtifact(path, artifact)
    result[variable] = path
  }
  return result
}
