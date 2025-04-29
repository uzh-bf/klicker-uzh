import { faCopy, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpFromBracket,
  faFilePen,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObject,
  ObjectAccess,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'

function useCatalogObjectActionsDropdown({
  object,
  actionsDisabled,
  managedAccess,
  setImportModal,
  setRequestModal,
  setRequestCancellationModal,
  setSharingModal,
  setRemovalModal,
}: {
  object: CatalogObject
  actionsDisabled: boolean
  managedAccess: boolean
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

    // import functionality for public objects that aren't owned or shared
    // TODO: enable importing live quiz templates once the corresponding functionality is available
    if (
      !actionsDisabled &&
      object.access === ObjectAccess.Public &&
      object.objectType !== SharingObjectType.LiveQuizTemplate
    ) {
      items.push({
        id: 'import',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon icon={faCopy} className="mr-2.5 h-4 w-4" />
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

    // request access functionality for objects that aren't requested, owned or shared
    // TODO: enable requesting access to live quiz templates once the corresponding functionality is available
    if (
      !actionsDisabled &&
      !object.isRequested &&
      object.objectType !== SharingObjectType.LiveQuizTemplate
    ) {
      items.push({
        id: 'requestAccess',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
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
    if (object.objectType === SharingObjectType.LiveQuizTemplate) {
      items.push({
        id: 'useTemplate',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
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
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
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
    // TODO: remove the case for live quiz templates once the corresponding sharing functionality is available
    if (
      object.isManager &&
      object.objectType !== SharingObjectType.LiveQuizTemplate
    ) {
      items.push({
        id: 'share',
        label: (
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
            <FontAwesomeIcon
              icon={faArrowUpFromBracket}
              className="mr-2.5 h-4 w-4"
            />
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
          <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100">
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
    setImportModal,
    setRequestModal,
    setRequestCancellationModal,
    setSharingModal,
    setRemovalModal,
  ])
}

export default useCatalogObjectActionsDropdown
