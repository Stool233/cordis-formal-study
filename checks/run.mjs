import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { checks } from './lifecycle.mjs'

const [implementation, output] = process.argv.slice(2)
const { Context } = await import(pathToFileURL(implementation).href)
const results = []
for (const check of checks) {
  let timeout
  try {
    await Promise.race([
      check.run(Context),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${check.id} exceeded 5 seconds`)), 5_000)
      }),
    ])
    results.push({ id: check.id, status: 'pass' })
  } catch (error) {
    results.push({ id: check.id, status: 'fail', message: error.message })
    await writeFile(output, `${JSON.stringify(results, null, 2)}\n`)
    console.error(`${check.id}: ${error.message}`)
    process.exit(1)
  } finally {
    clearTimeout(timeout)
  }
}
await writeFile(output, `${JSON.stringify(results, null, 2)}\n`)
console.log(`${results.length} lifecycle checks passed`)
