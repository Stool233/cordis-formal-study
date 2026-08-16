import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { filesUnder, portableReference, readJson, sha256, studyRoot } from './system.mjs'
import {
  validateBaselineOutput,
  validateEvidenceOutput,
  validateOrdinaryGatesReport,
  validateReleaseManifest,
  validateStudyReleaseFiles,
  validateStudyReport,
} from './evidence.mjs'

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
    baselineCordis: resolve(studyRoot, '.artifacts/stages/01-baseline/cordis'),
    baselineVendored: resolve(studyRoot, '.artifacts/stages/01-baseline/deepseek-harness'),
    conformanceCordis: resolve(studyRoot, '.artifacts/stages/02-conformance/cordis'),
    conformanceVendored: resolve(studyRoot, '.artifacts/stages/02-conformance/deepseek-harness'),
    upstreamFix: resolve(studyRoot, '.artifacts/stages/03-upstream-fix'),
    nightly: resolve(studyRoot, '.artifacts/cordis-nightly'),
  }
  await validateBaselineOutput(roots.baselineCordis, lock, { key: 'cordis', role: 'upstream' })
  await validateBaselineOutput(roots.baselineVendored, lock, { key: 'deepseekHarness', role: 'vendored-unmodified' })
  await validateEvidenceOutput(roots.conformanceCordis, lock, {
    role: 'upstream',
    revision: lock.branchMatrix.cordis.conformance.revision,
    modelProfile: 'pr',
  })
  await validateEvidenceOutput(roots.conformanceVendored, lock, {
    role: 'vendored',
    revision: lock.branchMatrix.deepseekHarness.conformance.revision,
  })
  await validateEvidenceOutput(roots.nightly, lock, { role: 'upstream', revision: lock.repositories.cordis.revision, modelProfile: 'nightly' })
  validateOrdinaryGatesReport(await readJson(resolve(roots.upstreamFix, 'ordinary-gates-report.json')), lock)
  validateStudyReport(await readJson(resolve(studyRoot, '.artifacts/study-report.json')), lock)

  const entries = [
    ...await evidenceEntries(roots.baselineCordis, 'evidence/baseline/cordis'),
    ...await evidenceEntries(roots.baselineVendored, 'evidence/baseline/deepseek-harness'),
    ...await evidenceEntries(roots.conformanceCordis, 'evidence/conformance/cordis'),
    ...await evidenceEntries(roots.conformanceVendored, 'evidence/conformance/deepseek-harness'),
    ...await evidenceEntries(roots.upstreamFix, 'evidence/upstream-fix'),
    ...await evidenceEntries(roots.nightly, 'evidence/nightly'),
    { path: 'study-report.json', data: await readFile(resolve(studyRoot, '.artifacts/study-report.json')) },
    { path: 'study-report.md', data: await readFile(resolve(studyRoot, '.artifacts/study-report.md')) },
    { path: 'study.lock.json', data: await readFile(resolve(studyRoot, 'study.lock.json')) },
    { path: 'provenance/cordis.json', data: await readFile(resolve(studyRoot, 'sources/cordis/formal/provenance.json')) },
  ]
  assert.ok(entries.length > 2, 'no evidence payload was selected')
  validateStudyReleaseFiles(entries.map(entry => entry.path))
  const payload = entries.map(entry => ({ path: entry.path, sha256: sha256(entry.data), bytes: entry.data.length }))
  const manifest = {
    schema: 'cordis.formal-study-evidence-manifest/v1',
    studyVersion: version,
    sourceRevisions: {
      cordis: Object.fromEntries(Object.entries(lock.branchMatrix.cordis).map(([key, value]) => [key, value.revision])),
      paper: lock.repositories.paper.revision,
      deepseekHarness: Object.fromEntries(Object.entries(lock.branchMatrix.deepseekHarness).map(([key, value]) => [key, value.revision])),
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
