import assert from 'node:assert/strict'
import {
  buildManageAssistantUrl,
  isManageAssistantEnabled,
} from '../src/components/assistant/manageAssistantConfig'

assert.equal(isManageAssistantEnabled(undefined), false)
assert.equal(isManageAssistantEnabled(''), false)
assert.equal(isManageAssistantEnabled('false'), false)
assert.equal(isManageAssistantEnabled('true'), true)
assert.equal(isManageAssistantEnabled('1'), true)

assert.equal(
  buildManageAssistantUrl({
    chatUrl: 'https://chat.klicker.com/',
    locale: 'de',
  }),
  'https://chat.klicker.com/manage?embed=true&locale=de'
)

// The embedder origin is forwarded so the embedded assistant can target its
// readiness ping at a concrete origin instead of a '*' wildcard.
assert.equal(
  buildManageAssistantUrl({
    chatUrl: 'https://chat.klicker.com/',
    locale: 'de',
    parentOrigin: 'https://manage.klicker.com',
  }),
  'https://chat.klicker.com/manage?embed=true&locale=de&parentOrigin=https%3A%2F%2Fmanage.klicker.com'
)

assert.equal(
  buildManageAssistantUrl({
    chatUrl: undefined,
    locale: 'en',
  }),
  null
)
