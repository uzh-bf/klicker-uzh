import assert from 'node:assert/strict'
import { UserLoginScope } from '@klicker-uzh/graphql/dist/ops.js'
import { canUseChatbotOwnerPreview } from '../src/components/resources/chatbots/chatbotOwnerPreviewAccess.ts'

assert.equal(canUseChatbotOwnerPreview(UserLoginScope.AccountOwner), true)
assert.equal(canUseChatbotOwnerPreview(UserLoginScope.FullAccess), true)
assert.equal(canUseChatbotOwnerPreview(UserLoginScope.SessionExec), false)
assert.equal(canUseChatbotOwnerPreview(UserLoginScope.ReadOnly), false)
assert.equal(canUseChatbotOwnerPreview(undefined), false)
