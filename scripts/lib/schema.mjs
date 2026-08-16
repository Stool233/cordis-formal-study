import assert from 'node:assert/strict'

/** Error raised when a value does not satisfy the checked JSON Schema subset. */
export class SchemaValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`)
    this.name = 'SchemaValidationError'
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function valueType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (Number.isInteger(value)) return 'integer'
  return typeof value
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith('#/')) {
    throw new SchemaValidationError('$schema', `unsupported reference ${reference}`)
  }
  let current = rootSchema
  for (const raw of reference.slice(2).split('/')) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~')
    assert.ok(current && typeof current === 'object' && key in current, `missing schema reference ${reference}`)
    current = current[key]
  }
  return current
}

function checkType(value, expected) {
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (expected === 'array') return Array.isArray(value)
  if (expected === 'integer') return Number.isInteger(value)
  return typeof value === expected
}

function validateNode(value, schema, rootSchema, path) {
  if (schema.$ref) validateNode(value, resolveReference(rootSchema, schema.$ref), rootSchema, path)

  if (schema.type && !checkType(value, schema.type)) {
    throw new SchemaValidationError(path, `expected ${schema.type}, received ${valueType(value)}`)
  }
  if ('const' in schema && !sameValue(value, schema.const)) {
    throw new SchemaValidationError(path, `expected constant ${JSON.stringify(schema.const)}`)
  }
  if (schema.enum && !schema.enum.some(candidate => sameValue(candidate, value))) {
    throw new SchemaValidationError(path, `expected one of ${schema.enum.map(String).join(', ')}`)
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new SchemaValidationError(path, `expected at least ${schema.minLength} characters`)
    }
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      throw new SchemaValidationError(path, `does not match ${schema.pattern}`)
    }
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    throw new SchemaValidationError(path, `expected a value of at least ${schema.minimum}`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new SchemaValidationError(path, `expected at least ${schema.minItems} items`)
    }
    if (schema.uniqueItems) {
      const serialized = value.map(item => JSON.stringify(item))
      if (new Set(serialized).size !== serialized.length) throw new SchemaValidationError(path, 'expected unique items')
    }
    if (schema.items) value.forEach((item, index) => validateNode(item, schema.items, rootSchema, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties ?? {}
    for (const key of schema.required ?? []) {
      if (!(key in value)) throw new SchemaValidationError(path, `missing required property ${key}`)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) throw new SchemaValidationError(`${path}.${key}`, 'unexpected property')
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) validateNode(value[key], childSchema, rootSchema, `${path}.${key}`)
    }
  }
}

/** Validate a JavaScript value against the JSON Schema features used by the study lock. */
export function validateSchema(value, schema) {
  validateNode(value, schema, schema, '$')
  return value
}
