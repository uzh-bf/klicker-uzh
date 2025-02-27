import { faEye } from '@fortawesome/free-regular-svg-icons'
import {
  faPencil,
  faPersonRunning,
  faUserTie,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AccessLevel } from '@klicker-uzh/graphql/dist/ops'
import { Badge } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

const AccessLevelIcons: Record<
  AccessLevel,
  { icon: IconDefinition; color: string }
> = {
  [AccessLevel.Read]: { icon: faEye, color: 'text-blue-600' },
  [AccessLevel.Execute]: { icon: faPersonRunning, color: 'text-green-600' },
  [AccessLevel.Write]: { icon: faPencil, color: 'text-orange-600' },
  [AccessLevel.Admin]: { icon: faUserTie, color: 'text-red-600' },
}

function ObjectPermissionLevel({ accessLevel }: { accessLevel: AccessLevel }) {
  const { icon, color } = AccessLevelIcons[accessLevel]
  const t = useTranslations()

  return (
    <Badge
      variant="secondary"
      className={twMerge('ml-2 h-6 gap-2 bg-opacity-20 px-2', color)}
    >
      <FontAwesomeIcon icon={icon} size="sm" />
      <span className="text-sm">
        {t(`manage.resources.access${accessLevel}`)}
      </span>
    </Badge>
  )
}

export default ObjectPermissionLevel
