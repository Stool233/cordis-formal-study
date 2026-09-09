import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const studyRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

export async function sha256File(path) {
  return sha256(await readFile(path))
}

export function posixPath(path) {
  return path.split(sep).join('/')
}

export function relativePosix(root, path) {
  const value = posixPath(relative(root, path))
  if (!value || value === '..' || value.startsWith('../') || isAbsolute(value)) {
    throw new Error(`${path} is not a descendant of ${root}`)
  }
  return value
}

export async function filesUnder(root, directory = root) {
  const result = []
  if (!(await exists(directory))) return result
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filesUnder(root, path))
    else if (entry.isFile()) result.push({ path, relative: relativePosix(root, path) })
  }
  return result.sort((left, right) => left.relative.localeCompare(right.relative))
}

export function formatCommand(command, args) {
  return [command, ...args].map(value => /[\s"']/.test(value) ? JSON.stringify(value) : value).join(' ')
}

/** Spawn a command without a shell and reject on a non-zero exit status. */
export function run(command, args, options = {}) {
  const cwd = options.cwd ?? studyRoot
  if (!options.quiet) {
    const shownCwd = cwd === studyRoot ? '.' : relativePosix(studyRoot, cwd)
    process.stdout.write(`+ (${shownCwd}) ${formatCommand(command, args)}\n`)
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    if (options.capture) {
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
    }
    child.on('error', rejectPromise)
    child.on('close', code => {
      const result = { code: code ?? 1, stdout, stderr }
      if ((code ?? 1) === 0 || options.allowFailure) resolvePromise(result)
      else {
        const detail = options.capture ? `\n${stdout}${stderr}` : ''
        rejectPromise(new Error(`${formatCommand(command, args)} exited with ${code}${detail}`))
      }
    })
  })
}

export async function capture(command, args, options = {}) {
  const result = await run(command, args, { ...options, capture: true, quiet: true })
  return result.stdout.trim()
}

export async function git(args, cwd = studyRoot) {
  return capture('git', args, { cwd })
}

const windowsAbsolute = /^(?:[A-Za-z]:[\\/]|\\\\)/
const embeddedUnixAbsolute = /(?:^|[:=;\s])\/(?!\/)/
const embeddedWindowsAbsolute = /(?:^|[=;\s])(?:[A-Za-z]:[\\/]|\\\\)/

/** Return the JSON location of the first machine-local absolute path. */
export function absolutePathAt(value, location = '$') {
  if (typeof value === 'string') {
    return isAbsolute(value) || windowsAbsolute.test(value) || embeddedUnixAbsolute.test(value) || embeddedWindowsAbsolute.test(value)
      ? location
      : undefined
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = absolutePathAt(value[index], `${location}[${index}]`)
      if (found) return found
    }
    return undefined
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const found = absolutePathAt(item, `${location}.${key}`)
      if (found) return found
    }
  }
  return undefined
}

export function portableReference(reference) {
  if (typeof reference !== 'string' || reference.length === 0) throw new Error('evidence reference must be a non-empty string')
  if (reference.includes('\\') || reference.startsWith('/') || /^[A-Za-z]:\//.test(reference)) {
    throw new Error(`evidence reference must be relative POSIX: ${reference}`)
  }
  const segments = reference.split('/')
  if (segments.includes('..') || segments.includes('') || segments.includes('.')) {
    throw new Error(`evidence reference escapes or is not normalized: ${reference}`)
  }
  return reference
}
