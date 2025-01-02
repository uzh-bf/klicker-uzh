import {
  faLock,
  faLockOpen,
  faUserLock,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CollectionAccess } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function CollectionAccessLabel({
  accessType,
  className,
}: {
  accessType: CollectionAccess
  className?: string
}) {
  const t = useTranslations()

  if (accessType === CollectionAccess.Public) {
    return (
      <div
        className={twMerge(
          'flex flex-row items-center gap-2 text-green-700',
          className
        )}
      >
        <FontAwesomeIcon icon={faLockOpen} />
        {t(`manage.resources.access${CollectionAccess.Public}`)}
      </div>
    )
  } else if (accessType === CollectionAccess.Restricted) {
    return (
      <div
        className={twMerge(
          'flex flex-row items-center gap-2 text-orange-600',
          className
        )}
      >
        <FontAwesomeIcon icon={faUserLock} />
        {t(`manage.resources.access${CollectionAccess.Restricted}`)}
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-2 text-red-700',
        className
      )}
    >
      <FontAwesomeIcon icon={faLock} />
      {t(`manage.resources.access${CollectionAccess.Private}`)}
    </div>
  )
}

export default CollectionAccessLabel
