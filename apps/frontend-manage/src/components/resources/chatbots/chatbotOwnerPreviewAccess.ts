import { UserLoginScope } from '@klicker-uzh/graphql/dist/ops'

export function canUseChatbotOwnerPreview(
  scope: UserLoginScope | null | undefined
): boolean {
  return (
    scope === UserLoginScope.AccountOwner || scope === UserLoginScope.FullAccess
  )
}
