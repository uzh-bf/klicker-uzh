import type { UserLoginScope } from '@klicker-uzh/graphql/dist/ops'

export function canUseChatbotOwnerPreview(
  scope: UserLoginScope | null | undefined
): boolean {
  return scope === 'ACCOUNT_OWNER' || scope === 'FULL_ACCESS'
}
