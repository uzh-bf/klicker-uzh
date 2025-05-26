import { useQuery } from '@apollo/client'
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
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useCatalogObjectActionsDropdown from '../../../lib/hooks/useCatalogObjectActionsDropdown'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import ObjectAccessSelection from '../administration/ObjectAccessSelection'
import ObjectAccessLabel from '../ObjectAccessLabel'
import CatalogChangeAccessModal from './CatalogChangeAccessModal'
import CatalogCopyModal from './CatalogCopyModal'
import CatalogImportModal from './CatalogImportModal'
import CatalogObjectCopySuccessToast from './CatalogObjectCopySuccessToast'
import CatalogObjectRemovalModal from './CatalogObjectRemovalModal'
import CatalogRequestCancellationModal from './CatalogRequestCancellationModal'
import CatalogRequestCancellationSuccessToast from './CatalogRequestCancellationSuccessToast'
import CatalogRequestModal from './CatalogRequestModal'
import CatalogRequestSuccessToast from './CatalogRequestSuccessToast'

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

  // TODO: remove, once migration to single activity overwiew has been completed
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

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

  // toast states
  const [showRequestSuccessToast, setShowRequestSuccessToast] = useState(false)
  const [showCopySuccessToast, setShowCopySuccessToast] = useState(false)
  const [showImportSuccessToast, setShowImportSuccessToast] = useState(false)
  const [
    showRequestCancellationSuccessToast,
    setShowRequestCancellationSuccessToast,
  ] = useState(false)

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

  return (
    <>
      <div
        className="flex h-9 flex-row items-center justify-between border-b border-solid px-1 text-sm hover:cursor-pointer hover:bg-slate-100"
        onClick={() => {
          if (actionsDisabled) {
            // primary action for users with access: go to corresponding list view and highlight object
            if (
              object.objectType === ObjectType.LiveQuiz &&
              !!object.templateId
            ) {
              router.push({
                pathname: dataUser?.userProfile?.privatePreview
                  ? '/activities'
                  : '/quizzes',
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
            if (
              object.objectType === ObjectType.LiveQuiz &&
              !!object.templateId
            ) {
              // primary action for public templates: create activity with template
              router.push(`/templates/${object.templateId}`)
            } else {
              // primary action for public objects: copy the object to the user's account
              setCopyModal(true)
            }
          } else {
            // primary action for restricted objects: request access
            setRequestModal(true)
          }
        }}
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
              trigger={
                <ForwardRefButton
                  basic
                  className={{
                    root: 'rounded-full p-1.5 text-gray-500 hover:bg-gray-100',
                  }}
                >
                  <Button.Icon withoutLabel icon={faEllipsisVertical} />
                </ForwardRefButton>
              }
              className={{ viewport: 'z-20' }}
              data={{ cy: `actions-dropdown-${object.name}` }}
            />
          ) : null}
        </div>
      </div>

      {/* functionality for users without access to request it for restricted catalog collections */}
      {!actionsDisabled && !object.isRequested ? (
        <CatalogRequestModal
          open={requestModal}
          onSuccess={() => {
            setShowRequestSuccessToast(true)
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
      <CatalogRequestSuccessToast
        open={showRequestSuccessToast}
        onClose={() => setShowRequestSuccessToast(false)}
      />

      {/* functionality for users to copy a publicly available object */}
      {!actionsDisabled && object.access === ObjectAccess.Public ? (
        <CatalogCopyModal
          open={copyModal}
          onSuccess={() => {
            setShowCopySuccessToast(true)
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
      <CatalogObjectCopySuccessToast
        open={showCopySuccessToast}
        onClose={() => setShowCopySuccessToast(false)}
      />

      {/* functionality for users to import a publicly available object */}
      {!actionsDisabled && object.access === ObjectAccess.Public ? (
        <CatalogImportModal
          open={importModal}
          onSuccess={() => {
            setShowImportSuccessToast(true)
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
      <CatalogObjectCopySuccessToast
        open={showImportSuccessToast}
        onClose={() => setShowImportSuccessToast(false)}
      />

      {/* functionality to cancel request for requested catalog object */}
      {object.isRequested ? (
        <CatalogRequestCancellationModal
          open={requestCancellationModal}
          onSuccess={() => {
            setShowRequestCancellationSuccessToast(true)
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
      <CatalogRequestCancellationSuccessToast
        open={showRequestCancellationSuccessToast}
        onClose={() => setShowRequestCancellationSuccessToast(false)}
      />

      {managedAccess ? (
        <>
          <CatalogChangeAccessModal
            open={changeAccessModal}
            onClose={() => setChangeAccessModal(false)}
            objectType={object.objectType}
            objectName={object.name}
            assignmentId={object.id}
            newAccess={newAccess}
            catalogCollectionId={catalogCollectionId}
          />
          <CatalogObjectRemovalModal
            object={object}
            open={removalModal}
            catalogCollectionId={catalogCollectionId}
            onClose={() => setRemovalModal(false)}
          />
        </>
      ) : null}
      {object.isManager ? (
        object.objectUuid ? (
          <ObjectSharingModalWrapper
            objectUuid={object.objectUuid}
            objectName={object.name}
            objectType={object.objectType}
            catalogCollectionId={catalogCollectionId}
            isOwner={object.isOwner}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        ) : (
          <ObjectSharingModalWrapper
            objectId={object.objectId!}
            objectName={object.name}
            objectType={object.objectType}
            catalogCollectionId={catalogCollectionId}
            isOwner={object.isOwner}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )
      ) : null}
    </>
  )
}

export default CatalogObjectItem
