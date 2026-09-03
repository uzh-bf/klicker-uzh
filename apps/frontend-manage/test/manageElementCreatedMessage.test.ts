import assert from 'node:assert/strict'
import {
  isManageElementCreatedMessage,
  sanitizeManageElementCreatedPayload,
} from '../src/components/assistant/manageElementCreatedMessage.ts'

assert.equal(
  isManageElementCreatedMessage({
    type: 'klicker:manage-element-created',
    payload: { id: 1, name: 'Draft question' },
  }),
  true
)
assert.equal(isManageElementCreatedMessage({ type: 'klicker:other' }), false)
assert.equal(isManageElementCreatedMessage(null), false)
assert.equal(
  isManageElementCreatedMessage('klicker:manage-element-created'),
  false
)

assert.deepEqual(
  sanitizeManageElementCreatedPayload({ id: 42, name: 'Draft question' }),
  { id: 42, name: 'Draft question' }
)

// Rejects malformed or out-of-bounds payloads instead of trusting the
// postMessage sender.
assert.equal(
  sanitizeManageElementCreatedPayload({ id: '42', name: 'Draft question' }),
  null
)
assert.equal(sanitizeManageElementCreatedPayload({ id: 42, name: 123 }), null)
assert.equal(sanitizeManageElementCreatedPayload({ id: 42, name: '' }), null)
assert.equal(
  sanitizeManageElementCreatedPayload({ id: 42, name: 'x'.repeat(201) }),
  null
)
assert.equal(
  sanitizeManageElementCreatedPayload({
    id: Number.POSITIVE_INFINITY,
    name: 'Draft question',
  }),
  null
)
assert.equal(sanitizeManageElementCreatedPayload({ id: 42 }), null)
assert.equal(sanitizeManageElementCreatedPayload(null), null)
