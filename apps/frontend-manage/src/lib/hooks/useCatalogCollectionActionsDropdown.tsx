import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpFromBracket,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

function useCatalogCollectionActionsDropdown({
  catalogCollectionId,
  isShareable,
  isDeletable,
  isRequestable,
  isViewable,
  setSharingModal,
  setDeletionModal,
  setRequestModal,
}: {
  catalogCollectionId: string
  isShareable: boolean
  isDeletable: boolean
  isRequestable: boolean
  isViewable: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setRequestModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const router = useRouter()

  return useMemo(() => {
    const items = []

    // sharing functionality for admin and owner
    if (isShareable) {
      items.push({
        id: 'share',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon
              icon={faArrowUpFromBracket}
              className="mr-2.5 h-4 w-4"
            />
            {t('manage.catalog.shareCatalogCollection')}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setSharingModal(true)
        },
        data: { cy: 'share-catalog-collection' },
      })
    }

    // deletion functionality for admin and owner
    if (isDeletable) {
      items.push({
        id: 'delete',
        label: (
          <div
            className={twMerge(
              'flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100'
            )}
          >
            <FontAwesomeIcon icon={faTrashCan} className="mr-2.5 h-4 w-4" />
            {t('manage.catalog.deleteCatalogCollection')}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setDeletionModal(true)
        },
        data: { cy: 'delete-catalog-collection' },
      })
    }

    // request functionality for restricted access & not requested & not shared
    if (isRequestable) {
      items.push({
        id: 'request',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon icon={faPencil} className="mr-2.5 h-4 w-4" />
            {t('manage.catalog.requestAccess')}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setRequestModal(true)
        },
        data: { cy: 'request-catalog-collection' },
      })
    }

    // ! before re-introducing this dropdown item, fix issue that router.push does not seem to work properly here
    // viewing functionality for shared access
    // if (isViewable) {
    //   items.push({
    //     id: 'view',
    //     label: (
    //       <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
    //         <FontAwesomeIcon icon={faEye} className="mr-2.5 h-4 w-4" />
    //         {t('manage.catalog.openCatalogCollection')}
    //       </div>
    //     ),
    //     onClick: (e: React.MouseEvent<HTMLDivElement>) => {
    //       e?.stopPropagation()
    //       router.push(`/resources/catalog`, { query: { catalogCollectionId } })
    //     },
    //     data: { cy: 'view-catalog-collection' },
    //   })
    // }

    return items
  }, [
    t,
    isShareable,
    isDeletable,
    isRequestable,
    setSharingModal,
    setDeletionModal,
    setRequestModal,
  ])
}

export default useCatalogCollectionActionsDropdown
