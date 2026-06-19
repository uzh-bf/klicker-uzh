import { faLockOpen, faUserLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectAccess } from '@lib/constants/catalogEnums'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function ObjectAccessLabel({
  accessType,
  iconOnly = false,
  className,
}: {
  accessType: ObjectAccess
  iconOnly?: boolean
  className?: string
}) {
  const t = useTranslations()

  if (accessType === ObjectAccess.Public) {
    return (
      <div
        className={twMerge(
          'flex flex-row items-center gap-2 text-green-700',
          className
        )}
      >
        <FontAwesomeIcon icon={faLockOpen} />
        {!iconOnly ? t(`manage.catalog.access${ObjectAccess.Public}`) : null}
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-2 text-orange-600',
        className
      )}
    >
      <FontAwesomeIcon icon={faUserLock} />
      {!iconOnly ? t(`manage.catalog.access${ObjectAccess.Restricted}`) : null}
    </div>
  )
}

export default ObjectAccessLabel
