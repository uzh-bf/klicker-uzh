import assert from 'node:assert/strict'
import {
  STALE_QUERY_RELOAD_COOLDOWN_MS,
  shouldReloadForStalePersistedQuery,
} from '../src/lib/stalePersistedQueryReload.ts'

const now = 1_000_000_000

// Both rejections of an outdated client trigger the first reload.
for (const message of ['PersistedQueryNotFound', 'PersistedQueryOnly']) {
  assert.equal(
    shouldReloadForStalePersistedQuery({
      messages: [message],
      lastReloadAt: null,
      now,
    }),
    true
  )
}

// Ordinary GraphQL errors never reload the page.
assert.equal(
  shouldReloadForStalePersistedQuery({
    messages: ['Unauthorized'],
    lastReloadAt: null,
    now,
  }),
  false
)

// A second rejection inside the cooldown does not reload again, so a stale
// bundle that survives the reload cannot loop.
assert.equal(
  shouldReloadForStalePersistedQuery({
    messages: ['PersistedQueryNotFound'],
    lastReloadAt: String(now - STALE_QUERY_RELOAD_COOLDOWN_MS + 1),
    now,
  }),
  false
)

// After the cooldown, a later release can reload the tab again.
assert.equal(
  shouldReloadForStalePersistedQuery({
    messages: ['PersistedQueryNotFound'],
    lastReloadAt: String(now - STALE_QUERY_RELOAD_COOLDOWN_MS),
    now,
  }),
  true
)

// An unreadable stored value counts as no previous reload.
assert.equal(
  shouldReloadForStalePersistedQuery({
    messages: ['PersistedQueryOnly'],
    lastReloadAt: 'not-a-timestamp',
    now,
  }),
  true
)
