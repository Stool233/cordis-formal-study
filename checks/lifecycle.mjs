import assert from 'node:assert/strict'

export const checkIds = [
  'dependent-cleanup-before-provider-release',
  'retiring-dependent-remains-discoverable',
  'replacement-provider-has-distinct-identity',
]

async function cleanupOrder(Context) {
  const root = new Context()
  const resource = { available: true }
  const events = []
  const observed = []
  try {
    const provider = await root.plugin(ctx => {
      ctx.provide('resource', resource)
      ctx.effect(() => () => {
        resource.available = false
        events.push('provider-release')
      }, 'provider resource')
    })
    await root.plugin({
      inject: ['resource'],
      apply(ctx) {
        void ctx.resource
        return async () => {
          await Promise.resolve()
          observed.push(resource.available)
          events.push('consumer-cleanup')
        }
      },
    })
    await provider.dispose()
    assert.deepEqual(observed, [true])
    assert.deepEqual(events, ['consumer-cleanup', 'provider-release'])
    assert.equal(resource.available, false)
  } finally {
    await root.fiber.dispose()
  }
  assert.equal(root.registry.size, 0)
}

async function retirementVisibility(Context) {
  const root = new Context()
  const resource = { available: true }
  const started = Promise.withResolvers()
  const barrier = Promise.withResolvers()
  let disposing
  const Consumer = {
    inject: ['resource'],
    apply(ctx) {
      void ctx.resource
      return async () => {
        started.resolve()
        await barrier.promise
      }
    },
  }
  try {
    await root.plugin(ctx => {
      ctx.provide('resource', resource)
      ctx.effect(() => () => { resource.available = false }, 'provider resource')
    })
    const consumer = await root.plugin(Consumer)
    disposing = root.fiber.dispose()
    await started.promise
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(consumer.uid, null, 'consumer disposal has started')
    const runtime = root.registry.get(Consumer)
    assert.ok(runtime, 'retiring consumer runtime must remain registered during cleanup')
    assert.ok([...runtime.fibers].includes(consumer), 'retiring consumer fiber must remain discoverable during cleanup')
    assert.equal(resource.available, true)
    barrier.resolve()
    await disposing
    assert.equal(root.registry.has(Consumer), false)
    assert.equal(resource.available, false)
  } finally {
    barrier.resolve()
    await (disposing ?? root.fiber.dispose())
  }
  assert.equal(root.registry.size, 0)
}

async function providerIdentity(Context) {
  const root = new Context()
  const shared = { value: 1 }
  const seen = []
  let cleanups = 0
  const Provider = ctx => ctx.provide('service', shared)
  try {
    const first = await root.plugin(Provider)
    const firstId = first.uid
    const consumer = await root.plugin({
      inject: ['service'],
      apply(ctx) {
        seen.push({ value: ctx.service, provider: ctx.reflect._getImpl('service').fiber })
        return () => { cleanups++ }
      },
    })
    await first.dispose()
    assert.equal(cleanups, 1)
    const second = await root.plugin(Provider)
    await consumer
    assert.notEqual(second.uid, firstId)
    assert.equal(seen.length, 2)
    assert.equal(seen[0].value, seen[1].value)
    assert.equal(seen[0].provider, first)
    assert.equal(seen[1].provider, second)
    assert.notEqual(seen[0].provider, seen[1].provider)
    await second.dispose()
    assert.equal(cleanups, 2)
  } finally {
    await root.fiber.dispose()
  }
  assert.equal(root.registry.size, 0)
}

export const checks = [cleanupOrder, retirementVisibility, providerIdentity].map((run, index) => ({ id: checkIds[index], run }))
