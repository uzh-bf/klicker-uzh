import { faEye } from '@fortawesome/free-regular-svg-icons'
import {
  faPencil,
  faPersonRunning,
  faUserTie,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Badge } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

const PermissionLevelIcons: Record<
  PermissionLevel,
  { icon: IconDefinition; color: string }
> = {
  [PermissionLevel.Read]: { icon: faEye, color: 'text-blue-600' },
  [PermissionLevel.Execute]: { icon: faPersonRunning, color: 'text-green-600' },
  [PermissionLevel.Write]: { icon: faPencil, color: 'text-orange-600' },
  [PermissionLevel.Admin]: { icon: faUserTie, color: 'text-red-600' },
}

function ObjectPermissionLevel({
  permissionLevel,
}: {
  permissionLevel: PermissionLevel
}) {
  const { icon, color } = PermissionLevelIcons[permissionLevel]
  const t = useTranslations()

  return (
    <Badge
      variant="secondary"
      className={twMerge('ml-2 h-6 gap-2 bg-opacity-20 px-2', color)}
    >
      <FontAwesomeIcon icon={icon} size="sm" />
      <span className="text-sm">
        {t(`manage.resources.access${permissionLevel}`)}
      </span>
    </Badge>
  )
}

export default ObjectPermissionLevel
