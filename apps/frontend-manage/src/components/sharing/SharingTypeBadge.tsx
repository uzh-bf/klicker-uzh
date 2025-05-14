import { faFolderTree, faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SharingType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function SharingTypeBadge({
  sharingType,
  className,
}: {
  sharingType?: SharingType | null
  className?: { root?: string; icon?: string }
}) {
  const t = useTranslations()

  if (sharingType === SharingType.Shared) {
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
  } else if (sharingType === SharingType.Dependency) {
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
