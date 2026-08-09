import {
  faClock,
  faFileLines,
  faFolder,
} from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faEllipsisVertical,
  faList,
  faQuestion,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObject,
  ObjectAccess,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Dropdown, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { type KeyboardEvent, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useCatalogObjectActionsDropdown from '../../../lib/hooks/useCatalogObjectActionsDropdown'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import ObjectAccessSelection from '../administration/ObjectAccessSelection'
import ObjectAccessLabel from '../ObjectAccessLabel'
import CatalogChangeAccessModal from './CatalogChangeAccessModal'
import CatalogCopyModal from './CatalogCopyModal'
import CatalogImportModal from './CatalogImportModal'
import CatalogObjectRemovalModal from './CatalogObjectRemovalModal'
import CatalogRequestCancellationModal from './CatalogRequestCancellationModal'
import CatalogRequestModal from './CatalogRequestModal'

function CatalogObjectItem({
  object,
  catalogCollectionId,
  managedAccess,
}: {
  object: CatalogObject
  catalogCollectionId?: string
  managedAccess: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const objectTypeIcons: Record<ObjectType, IconDefinition | undefined> = {
    [ObjectType.AnswerCollection]: faList,
    [ObjectType.CatalogCollection]: faFolder,
    [ObjectType.Course]: undefined,
    [ObjectType.LiveQuiz]: faFileLines, // icon for activities & activity templates
    [ObjectType.PracticeQuiz]: faFileLines, // icon for activities & activity templates
    [ObjectType.MicroLearning]: faFileLines, // icon for activities & activity templates
    [ObjectType.GroupActivity]: faFileLines, // icon for activities & activity templates
    [ObjectType.Element]: faQuestion,
  }
  const actionsDisabled = object.isOwner || object.isShared

  // modal states
  const [requestModal, setRequestModal] = useState(false)
  const [requestCancellationModal, setRequestCancellationModal] =
    useState(false)
  const [copyModal, setCopyModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [changeAccessModal, setChangeAccessModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [newAccess, setNewAccess] = useState<ObjectAccess>(object.access)

  const dropdownItems = useCatalogObjectActionsDropdown({
    object,
    actionsDisabled,
    managedAccess,
    setImportModal,
    setCopyModal,
    setRequestModal,
    setRequestCancellationModal,
    setSharingModal,
    setRemovalModal,
  })

  const handlePrimaryAction = () => {
    if (actionsDisabled) {
      // primary action for users with access: go to corresponding list view and highlight object
      if (object.objectType === ObjectType.LiveQuiz && !!object.templateId) {
        router.push({
          pathname: '/activities',
          query: { highlight: object.objectUuid },
        })
      } else if (object.objectType === ObjectType.AnswerCollection) {
        router.push({
          pathname: '/resources/answerCollections',
          query: { highlight: object.objectId },
        })
      }
    } else if (
      object.isRequested &&
      object.access === ObjectAccess.Restricted
    ) {
      // primary action for restricted objects with pending request: open request withdrawal modal
      setRequestCancellationModal(true)
    } else if (object.access === ObjectAccess.Public) {
      if (object.objectType === ObjectType.LiveQuiz && !!object.templateId) {
        // primary action for public templates: create activity with template
        router.push(`/templates/${object.templateId}`)
      } else {
        // primary action for public objects: import the object to the user's account
        setImportModal(true)
      }
    } else {
      // primary action for restricted objects: request access
      setRequestModal(true)
    }
  }

  const handlePrimaryActionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handlePrimaryAction()
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: The row contains nested access and menu controls, so a native button would be invalid. */}
      <div
        role="button"
        tabIndex={0}
        className="flex h-9 flex-row items-center justify-between border-b border-solid px-3 py-6 text-sm hover:cursor-pointer hover:bg-slate-100"
        onClick={handlePrimaryAction}
        onKeyDown={handlePrimaryActionKeyDown}
        data-cy={`catalog-object-${object.name}`}
      >
        <div className="flex flex-row items-center gap-2">
          <ObjectAccessLabel
            iconOnly
            accessType={object.access}
            className="mr-2 w-3 text-sm"
          />
          {typeof objectTypeIcons[object.objectType] !== 'undefined' && (
            <FontAwesomeIcon
              icon={objectTypeIcons[object.objectType]!}
              className="h-4 w-4"
            />
          )}
          <div>{object.name}</div>
          {object.ownerShortname ? (
            <div className="text-xs text-slate-500">
              {t('manage.resources.byOwner', {
                owner: object.ownerShortname,
              })}
            </div>
          ) : null}
        </div>
        <div
          className={twMerge(
            'flex flex-row items-center gap-2',
            dropdownItems.length === 0 && 'mr-9'
          )}
        >
          {object.isRequested ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faClock} />
              <div>{t('manage.catalog.accessRequested')}</div>
            </div>
          ) : null}
          {object.isShared ? (
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} />
              <div>{t('manage.catalog.accessGranted')}</div>
            </div>
          ) : null}

          {managedAccess ? (
            <div className="ml-2">
              <ObjectAccessSelection
                compact
                restrictedDisabled={
                  object.objectType === ObjectType.LiveQuiz &&
                  !!object.templateId
                }
                value={object.access}
                onChange={(access) => {
                  setNewAccess(access as ObjectAccess)
                  setChangeAccessModal(true)
                }}
                cyPrefix={object.name}
              />
            </div>
          ) : null}

          {dropdownItems.length > 0 ? (
            <Dropdown
              items={dropdownItems}
              trigger={<FontAwesomeIcon icon={faEllipsisVertical} />}
              className={{
                viewport: 'z-20',
                item: 'py-0.5 text-sm',
                trigger:
                  'h-7 w-7 rounded-full border-none bg-transparent text-gray-500 hover:bg-gray-100',
              }}
              data={{ cy: `actions-dropdown-${object.name}` }}
            />
          ) : null}
        </div>
      </div>

      {/* functionality for users without access to request it for restricted catalog collections */}
      {!actionsDisabled && !object.isRequested && requestModal ? (
        <CatalogRequestModal
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.requestCatalogObjectSuccess'),
              options: { duration: 3500 },
            })
            setRequestModal(false)
          }}
          onClose={() => setRequestModal(false)}
          objectType={object.objectType}
          objectId={object.objectId ?? object.objectUuid!}
          objectName={object.name}
          objectOwner={object.ownerShortname}
          objectAccess={object.access}
          catalogCollectionId={catalogCollectionId}
        />
      ) : null}

      {/* functionality for users to copy a publicly available object */}
      {!actionsDisabled &&
      object.access === ObjectAccess.Public &&
      copyModal ? (
        <CatalogCopyModal
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.copyCatalogObjectSuccess'),
              options: { duration: 3500 },
            })
            setCopyModal(false)
          }}
          onClose={() => setCopyModal(false)}
          objectType={object.objectType}
          objectId={object.objectId ?? object.objectUuid!}
          objectName={object.name}
          objectOwner={object.ownerShortname}
          catalogCollectionId={catalogCollectionId}
        />
      ) : null}

      {/* functionality for users to import a publicly available object */}
      {!actionsDisabled &&
      object.access === ObjectAccess.Public &&
      importModal ? (
        <CatalogImportModal
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.importCatalogObjectSuccess'),
              options: { duration: 3500 },
            })
            setImportModal(false)
          }}
          onClose={() => setImportModal(false)}
          objectType={object.objectType}
          objectId={object.objectId ?? object.objectUuid!}
          objectName={object.name}
          objectOwner={object.ownerShortname}
          catalogCollectionId={catalogCollectionId}
        />
      ) : null}

      {/* functionality to cancel request for requested catalog object */}
      {object.isRequested && requestCancellationModal ? (
        <CatalogRequestCancellationModal
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.requestCancellationSuccess'),
              options: { duration: 3500 },
            })
            setRequestCancellationModal(false)
          }}
          onClose={() => setRequestCancellationModal(false)}
          objectType={object.objectType}
          objectId={object.objectId ?? object.objectUuid!}
          objectName={object.name}
          objectOwner={object.ownerShortname}
          catalogCollectionId={catalogCollectionId}
        />
      ) : null}

      {managedAccess ? (
        <>
          {changeAccessModal && (
            <CatalogChangeAccessModal
              onClose={() => setChangeAccessModal(false)}
              objectType={object.objectType}
              objectName={object.name}
              assignmentId={object.id}
              newAccess={newAccess}
              catalogCollectionId={catalogCollectionId}
            />
          )}
          {removalModal && (
            <CatalogObjectRemovalModal
              object={object}
              catalogCollectionId={catalogCollectionId}
              onClose={() => setRemovalModal(false)}
            />
          )}
        </>
      ) : null}
      {object.isManager && sharingModal ? (
        object.objectUuid ? (
          <ObjectSharingModalWrapper
            objectUuid={object.objectUuid}
            objectName={object.name}
            objectType={object.objectType}
            catalogCollectionId={catalogCollectionId}
            onClose={() => setSharingModal(false)}
          />
        ) : (
          <ObjectSharingModalWrapper
            objectId={object.objectId!}
            objectName={object.name}
            objectType={object.objectType}
            catalogCollectionId={catalogCollectionId}
            onClose={() => setSharingModal(false)}
          />
        )
      ) : null}
    </>
  )
}

export default CatalogObjectItem
