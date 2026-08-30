import * as DB from '@klicker-uzh/prisma/client'

export const asChatbotAuthor = {
  authenticated: true,
  role: DB.UserRole.USER,
  catalyst: true,
  scope: DB.UserLoginScope.FULL_ACCESS,
}
