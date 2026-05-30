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
    returnTo: '/resources/catalog?tab=mine',
  }),
  'https://chat.klicker.com/manage?embed=true&surface=manage&locale=de&returnTo=%2Fresources%2Fcatalog%3Ftab%3Dmine'
)

assert.equal(
  buildManageAssistantUrl({
    chatUrl: undefined,
    locale: 'en',
    returnTo: '/resources',
  }),
  null
)
