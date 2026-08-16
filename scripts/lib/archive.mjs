import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { filesUnder, portableReference, readJson, sha256, studyRoot } from './system.mjs'
import { validateEvidenceOutput, validateReleaseManifest } from './evidence.mjs'

function octal(value, width) {
  const encoded = value.toString(8)
  assert.ok(encoded.length <= width - 1, `tar numeric value ${value} does not fit`)
  return `${'0'.repeat(width - encoded.length - 1)}${encoded}\0`
}

function tarName(path) {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' }
  const segments = path.split('/')
  for (let index = segments.length - 1; index > 0; index--) {
    const prefix = segments.slice(0, index).join('/')
    const name = segments.slice(index).join('/')
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix }
  }
  throw new Error(`release path is too long for ustar: ${path}`)
}

function copyText(buffer, text, offset, length) {
  const value = Buffer.from(text)
  assert.ok(value.length <= length, `${text} does not fit in tar header`)
  value.copy(buffer, offset)
}

function tarHeader(path, size) {
  const header = Buffer.alloc(512)
  const split = tarName(path)
  copyText(header, split.name, 0, 100)
  copyText(header, octal(0o644, 8), 100, 8)
  copyText(header, octal(0, 8), 108, 8)
  copyText(header, octal(0, 8), 116, 8)
  copyText(header, octal(size, 12), 124, 12)
  copyText(header, octal(0, 12), 136, 12)
  header.fill(0x20, 148, 156)
  header[156] = '0'.charCodeAt(0)
  copyText(header, 'ustar\0', 257, 6)
  copyText(header, '00', 263, 2)
  copyText(header, 'root', 265, 32)
  copyText(header, 'root', 297, 32)
  copyText(header, split.prefix, 345, 155)
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  copyText(header, `${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8)
  return header
}

function makeTar(entries) {
  const chunks = []
  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    portableReference(entry.path)
    chunks.push(tarHeader(entry.path, entry.data.length), entry.data)
    const remainder = entry.data.length % 512
    if (remainder) chunks.push(Buffer.alloc(512 - remainder))
  }
  chunks.push(Buffer.alloc(1024))
  return Buffer.concat(chunks)
}

function excluded(relative) {
  const segments = relative.split('/')
  return segments.some(segment => segment === 'cache' || segment === '.cache' || segment === 'node_modules' || segment === 'tlc')
    || relative.endsWith('.jar')
    || relative.endsWith('.pdf')
}

async function evidenceEntries(sourceRoot, destinationRoot) {
  const entries = []
  for (const file of await filesUnder(sourceRoot)) {
    if (excluded(file.relative)) continue
    if (!file.relative.endsWith('.json') && !file.relative.endsWith('.ndjson')) continue
    entries.push({ path: `${destinationRoot}/${file.relative}`, data: await readFile(file.path) })
  }
  return entries
}

/** Build a deterministic, allowlisted evidence archive and SHA256SUMS. */
export async function packageEvidence(lock, version) {
  assert.equal(version, lock.studyVersion, `release version must be ${lock.studyVersion}`)
  const roots = {
    pr: resolve(studyRoot, '.artifacts/cordis-pr'),
    nightly: resolve(studyRoot, '.artifacts/cordis-nightly'),
    vendored: resolve(studyRoot, '.artifacts/deepseek-harness'),
  }
  await validateEvidenceOutput(roots.pr, lock, { role: 'upstream', revision: lock.repositories.cordis.revision, modelProfile: 'pr' })
  await validateEvidenceOutput(roots.nightly, lock, { role: 'upstream', revision: lock.repositories.cordis.revision, modelProfile: 'nightly' })
  await validateEvidenceOutput(roots.vendored, lock, { role: 'vendored', revision: lock.repositories.deepseekHarness.revision })

  const entries = [
    ...await evidenceEntries(roots.pr, 'evidence/pr'),
    ...await evidenceEntries(roots.nightly, 'evidence/nightly'),
    ...await evidenceEntries(roots.vendored, 'evidence/vendored'),
    { path: 'study.lock.json', data: await readFile(resolve(studyRoot, 'study.lock.json')) },
    { path: 'provenance/cordis.json', data: await readFile(resolve(studyRoot, 'sources/cordis/formal/provenance.json')) },
  ]
  assert.ok(entries.length > 2, 'no evidence payload was selected')
  const payload = entries.map(entry => ({ path: entry.path, sha256: sha256(entry.data), bytes: entry.data.length }))
  const manifest = {
    schema: 'cordis.formal-study-evidence-manifest/v1',
    studyVersion: version,
    sourceRevisions: {
      cordis: lock.repositories.cordis.revision,
      paper: lock.repositories.paper.revision,
      deepseekHarness: lock.repositories.deepseekHarness.revision,
    },
    files: payload,
  }
  validateReleaseManifest(manifest, entries.map(entry => entry.path))
  entries.push({ path: 'manifest.json', data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) })

  const archive = gzipSync(makeTar(entries), { level: 9, mtime: 0 })
  const dist = resolve(studyRoot, 'dist')
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  const name = `cordis-formal-study-v${version}-evidence.tar.gz`
  await writeFile(resolve(dist, name), archive)
  await writeFile(resolve(dist, 'SHA256SUMS'), `${sha256(archive)}  ${name}\n`)

  const reparsedLock = await readJson(resolve(studyRoot, 'study.lock.json'))
  assert.equal(reparsedLock.studyVersion, version)
  return { archive: resolve(dist, name), checksums: resolve(dist, 'SHA256SUMS'), files: entries.length }
}
