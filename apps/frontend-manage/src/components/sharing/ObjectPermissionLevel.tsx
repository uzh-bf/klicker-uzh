import { faEye } from '@fortawesome/free-regular-svg-icons'
import {
  faPersonRunning,
  faUserPen,
  faUserTie,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

type PermissionLevelValue = 'READ' | 'EXECUTE' | 'WRITE' | 'ADMIN' | 'OWNER'

const PermissionLevelIcons: Record<
  PermissionLevelValue,
  { icon: IconDefinition; color: string } | undefined
> = {
  READ: { icon: faEye, color: 'text-blue-600' },
  EXECUTE: { icon: faPersonRunning, color: 'text-green-700' },
  WRITE: { icon: faUserPen, color: 'text-orange-600' },
  ADMIN: { icon: faUserTie, color: 'text-red-600' },
  OWNER: undefined,
}

function ObjectPermissionLevel({
  objectName,
  permissionLevel,
  iconOnly = false,
  className,
}: {
  objectName: string
  permissionLevel: PermissionLevelValue
  iconOnly?: boolean
  className?: string
}) {
  const badge = PermissionLevelIcons[permissionLevel]
  const t = useTranslations()

  if (typeof badge === 'undefined') {
    return null
  }

  if (iconOnly) {
    return (
      <FontAwesomeIcon
        size="sm"
        icon={badge.icon}
        className={twMerge('shrink-0', badge.color, className)}
        data-cy={`permission-level-icon-${objectName}-${permissionLevel}`}
      />
    )
  }

  return (
    <div
      className={twMerge(
        'flex h-6 items-center gap-2 overflow-hidden rounded bg-opacity-20 px-2',
        'group transition-all duration-1000 ease-in-out hover:w-auto',
        badge.color,
        className
      )}
      data-cy={`permission-level-${objectName}-${permissionLevel}`}
    >
      <FontAwesomeIcon icon={badge.icon} className="shrink-0" size="sm" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm transition-all duration-300 ease-in-out group-hover:max-w-xs">
        {t(`manage.sharing.permissions${permissionLevel}`)}
      </span>
    </div>
  )
}

export default ObjectPermissionLevel
