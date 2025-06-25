import { faCopy, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import {
  faDownload,
  faFilePen,
  faShare,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObject,
  ObjectAccess,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'

function useCatalogObjectActionsDropdown({
  object,
  actionsDisabled,
  managedAccess,
  setCopyModal,
  setImportModal,
  setRequestModal,
  setRequestCancellationModal,
  setSharingModal,
  setRemovalModal,
}: {
  object: CatalogObject
  actionsDisabled: boolean
  managedAccess: boolean
  setCopyModal: Dispatch<SetStateAction<boolean>>
  setImportModal: Dispatch<SetStateAction<boolean>>
  setRequestModal: Dispatch<SetStateAction<boolean>>
  setRequestCancellationModal: Dispatch<SetStateAction<boolean>>
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setRemovalModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const router = useRouter()

  return useMemo(() => {
    const items = []

    // import functionality for public answer collections (self-service with read permissions)
    if (
      !actionsDisabled &&
      object.access === ObjectAccess.Public &&
      object.objectType === ObjectType.AnswerCollection
    ) {
      items.push({
        id: 'import',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
            <FontAwesomeIcon icon={faDownload} className="mr-2.5 h-4 w-4" />
            {t('manage.catalog.importObjectType', {
              object: t(`shared.types.${object.objectType}`),
            })}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setImportModal(true)
        },
        data: { cy: `import-object-${object.name}` },
      })
    }

    // copy to account functionality is only available for answer collections and elements (for now) - not for activities / courses
    // when copying elements, the content of the element is copied, potentially linked answer collections are shared
    if (
      !actionsDisabled &&
      object.access === ObjectAccess.Public &&
      object.objectType !== ObjectType.CatalogCollection &&
      (object.objectType === ObjectType.AnswerCollection ||
        object.objectType === ObjectType.Element)
    ) {
      items.push({
        id: 'copyToAccount',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
            <FontAwesomeIcon icon={faCopy} className="mr-2.5 h-4 w-4" />
            {t('manage.catalog.copyObjectType', {
              object: t(`shared.types.${object.objectType}`),
            })}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setCopyModal(true)
        },
        data: { cy: `copy-object-${object.name}` },
      })
    }

    // request access functionality for objects that aren't requested, owned or shared
    if (
      !actionsDisabled &&
      !object.isRequested &&
      object.objectType !== ObjectType.LiveQuiz
    ) {
      items.push({
        id: 'requestAccess',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
            <FontAwesomeIcon icon={faHandPointer} className="mr-2.5 h-4 w-4" />
            {t('manage.catalog.requestAccess')}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setRequestModal(true)
        },
        data: { cy: `request-access-${object.name}` },
      })
    }

    // usage functionality for templates
    if (object.objectType === ObjectType.LiveQuiz && !!object.templateId) {
      items.push({
        id: 'useTemplate',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
            <FontAwesomeIcon icon={faFilePen} className="mr-2.5 h-4 w-4" />
            {t('manage.catalog.useTemplate')}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          router.push(`/templates/${object.templateId}`)
        },
        data: { cy: `use-template-${object.name}` },
      })
    }

    // cancel request functionality for requested objects
    if (object.isRequested) {
      items.push({
        id: 'cancelRequest',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
            <FontAwesomeIcon icon={faX} className="mr-2.5 h-4 w-4" />
            {t('manage.resources.cancelRequest')}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setRequestCancellationModal(true)
        },
        data: { cy: `cancel-request-${object.name}` },
      })
    }

    // sufficient permissions on the object (ADMIN / OWNER) are always deciding for whether or not to show the sharing dialog
    if (object.isManager && object.objectType !== ObjectType.LiveQuiz) {
      items.push({
        id: 'share',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
            <FontAwesomeIcon icon={faShare} className="mr-2.5 h-4 w-4" />
            {t(`manage.sharing.share${object.objectType}`)}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setSharingModal(true)
        },
        data: { cy: `share-object-${object.name}` },
      })
    }

    // remove functionality for managed access
    if (managedAccess) {
      items.push({
        id: 'remove',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600">
            <FontAwesomeIcon icon={faX} className="mr-2.5 h-4 w-4" />
            {t(`manage.catalog.remove${object.objectType}`)}
          </div>
        ),
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e?.stopPropagation()
          setRemovalModal(true)
        },
        data: { cy: `remove-object-${object.name}` },
      })
    }

    return items
  }, [
    t,
    router,
    object,
    actionsDisabled,
    managedAccess,
    setCopyModal,
    setImportModal,
    setRequestModal,
    setRequestCancellationModal,
    setSharingModal,
    setRemovalModal,
  ])
}

export default useCatalogObjectActionsDropdown
