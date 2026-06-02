import type * as DB from '@klicker-uzh/prisma/client'

type UserProfileSource = Pick<
  DB.User,
  | 'catalystIndividual'
  | 'catalystInstitutional'
  | 'catalystTier'
  | 'email'
  | 'firstLogin'
  | 'id'
  | 'locale'
  | 'privatePreview'
  | 'publicPreview'
  | 'role'
  | 'sendProjectUpdates'
  | 'shortname'
>

export function toUserProfile(
  user: UserProfileSource | null,
  { numChatbots }: { numChatbots: number }
) {
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    sendProjectUpdates: user.sendProjectUpdates,
    shortname: user.shortname,
    role: user.role,
    locale: user.locale,
    firstLogin: user.firstLogin,
    catalyst: user.catalystInstitutional || user.catalystIndividual,
    catalystTier: user.catalystTier,
    publicPreview: user.publicPreview,
    privatePreview: user.privatePreview,
    numChatbots,
  }
}
