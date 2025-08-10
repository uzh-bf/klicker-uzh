import { faEye } from '@fortawesome/free-regular-svg-icons'
import {
  faPersonRunning,
  faUserPen,
  faUserTie,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

const PermissionLevelIcons: Record<
  PermissionLevel,
  { icon: IconDefinition; color: string } | undefined
> = {
  [PermissionLevel.Read]: { icon: faEye, color: 'text-blue-600' },
  [PermissionLevel.Execute]: { icon: faPersonRunning, color: 'text-green-600' },
  [PermissionLevel.Write]: { icon: faUserPen, color: 'text-orange-600' },
  [PermissionLevel.Admin]: { icon: faUserTie, color: 'text-red-600' },
  [PermissionLevel.Owner]: undefined,
}

function ObjectPermissionLevel({
  objectName,
  permissionLevel,
  iconOnly = false,
  className,
}: {
  objectName: string
  permissionLevel: PermissionLevel
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
