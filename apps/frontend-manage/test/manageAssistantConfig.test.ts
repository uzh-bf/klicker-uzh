import assert from 'node:assert/strict'
import { buildManageAssistantUrl } from '../src/components/assistant/manageAssistantConfig.ts'

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

// The "open in new tab" link must get a clean, non-embedded URL: no
// `embed` flag and no `parentOrigin`, even if a parentOrigin is passed in,
// so a full-tab visit keeps the assistant's normal login CTA.
assert.equal(
  buildManageAssistantUrl({
    chatUrl: 'https://chat.klicker.com/',
    locale: 'de',
    parentOrigin: 'https://manage.klicker.com',
    embed: false,
  }),
  'https://chat.klicker.com/manage?locale=de'
)

assert.equal(
  buildManageAssistantUrl({
    chatUrl: 'https://chat.klicker.com/',
    embed: false,
  }),
  'https://chat.klicker.com/manage'
)
