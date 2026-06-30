import { faFolderTree, faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

type SharingTypeValue = 'OWNED' | 'SHARED' | 'DEPENDENCY'

function SharingTypeBadge({
  sharingType,
  className,
}: {
  sharingType?: SharingTypeValue | null
  className?: { root?: string; icon?: string }
}) {
  const t = useTranslations()

  if (sharingType === 'SHARED') {
    return (
      <div
        className={twMerge(
          'mr-3 flex h-max flex-row items-center gap-2 py-1',
          className?.root
        )}
      >
        <FontAwesomeIcon
          icon={faLink}
          className={twMerge('h-4 w-4', className?.icon)}
        />
        <div>{t('shared.generic.shared')}</div>
      </div>
    )
  } else if (sharingType === 'DEPENDENCY') {
    return (
      <div
        className={twMerge(
          'mr-3 flex h-max flex-row items-center gap-2 py-1',
          className?.root
        )}
      >
        <FontAwesomeIcon
          icon={faFolderTree}
          className={twMerge('h-4 w-4', className?.icon)}
        />
        <div>{t('shared.generic.dependency')}</div>
      </div>
    )
  }

  return null
}

export default SharingTypeBadge
