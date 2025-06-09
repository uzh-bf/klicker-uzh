import { faPencil, faUserTie } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Badge } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function UserGroupBadge({
  isMember,
  isAdmin,
  isOwner,
}: {
  isMember: boolean
  isAdmin: boolean
  isOwner: boolean
}) {
  const t = useTranslations()

  if (isOwner) {
    return (
      <Badge className="flex flex-row items-center gap-1.5 border-2 border-green-600 bg-green-50 text-black hover:bg-green-100">
        <FontAwesomeIcon icon={faUserTie} />
        <div>{t('shared.generic.owner')}</div>
      </Badge>
    )
  }

  if (isAdmin) {
    return (
      <Badge className="flex flex-row items-center gap-1.5 border-2 border-orange-600 bg-orange-50 text-black hover:bg-orange-100">
        <FontAwesomeIcon icon={faPencil} />
        <div>{t('manage.userGroups.admin')}</div>
      </Badge>
    )
  }

  if (isMember) {
    return (
      <Badge className="border-2 border-gray-600 bg-gray-50 text-black hover:bg-gray-100">
        <div>{t('manage.userGroups.member')}</div>
      </Badge>
    )
  }

  return null
}

export default UserGroupBadge
