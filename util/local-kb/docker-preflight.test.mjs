import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectUnusedComposeProject } from './docker-preflight.mjs'

const compose = {
  name: 'isolated-test',
  volumes: { postgres: { name: 'isolated-test-postgres-volume' } },
}

function reader({
  endpoint = 'unix:///synthetic/docker.sock',
  containers = '',
  networks = '',
  volumes = '',
} = {}) {
  const calls = []
  return {
    calls,
    read(args) {
      calls.push(args)
      if (args[0] === 'context')
        return args[1] === 'show' ? 'desktop-linux' : endpoint
      assert.deepEqual(args.slice(0, 2), ['--context', 'desktop-linux'])
      const [kind, operation] = args.slice(2)
      assert.equal(operation, 'ls')
      return { container: containers, network: networks, volume: volumes }[kind]
    },
  }
}

test('observes unused local state without mutations or remote context inheritance', () => {
  const { read, calls } = reader()
  assert.deepEqual(inspectUnusedComposeProject(compose, read), {
    unused: true,
    context: 'desktop-linux',
    reason: 'no-existing-project-or-storage',
  })
  assert.equal(calls.length, 5)
  assert.ok(calls[2].includes('--all'))
})

test('existing stopped containers, project networks or exact volume names block setup', () => {
  for (const state of [
    { containers: 'synthetic-stopped-container' },
    { networks: 'synthetic-project-network' },
    { volumes: 'isolated-test-postgres-volume\n' },
  ]) {
    assert.equal(
      inspectUnusedComposeProject(compose, reader(state).read).unused,
      false
    )
  }
  assert.equal(
    inspectUnusedComposeProject(
      compose,
      reader({
        volumes: 'another-isolated-test-postgres-volume',
      }).read
    ).unused,
    true
  )
})

test('remote or unavailable Docker observations never qualify setup', () => {
  const remote = reader({ endpoint: 'ssh://synthetic-remote' })
  assert.equal(inspectUnusedComposeProject(compose, remote.read).unused, false)
  assert.equal(remote.calls.length, 2)
  assert.deepEqual(
    inspectUnusedComposeProject(compose, () => {
      throw new Error('synthetic-private-diagnostic')
    }),
    { unused: false, reason: 'docker-observation-unavailable' }
  )
})

test('shared and malformed volume declarations are rejected before Docker access', () => {
  for (const volume of [
    { name: 'retained-volume' },
    { name: 'isolated-test-data', external: true },
  ]) {
    assert.throws(
      () =>
        inspectUnusedComposeProject(
          { ...compose, volumes: { data: volume } },
          () => {
            assert.fail('must not query Docker')
          }
        ),
      /owned volumes/
    )
  }
})
