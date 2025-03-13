import {
  faClock,
  faFileLines,
  faFolder,
} from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faEllipsisVertical,
  faList,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CatalogObject,
  CatalogObjectType,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useCatalogObjectActionsDropdown from '../../../lib/hooks/useCatalogObjectActionsDropdown'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import ObjectAccessSelection from '../administration/ObjectAccessSelection'
import ObjectAccessLabel from '../ObjectAccessLabel'
import CatalogChangeAccessModal from './CatalogChangeAccessModal'
import CatalogImportModal from './CatalogImportModal'
import CatalogObjectImportSuccessToast from './CatalogObjectImportSuccessToast'
import CatalogRequestCancellationModal from './CatalogRequestCancellationModal'
import CatalogRequestCancellationSuccessToast from './CatalogRequestCancellationSuccessToast'
import CatalogRequestModal from './CatalogRequestModal'
import CatalogRequestSuccessToast from './CatalogRequestSuccessToast'
import ObjectRemovalModal from './ObjectRemovalModal'

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
  const objectTypeIcons: Record<CatalogObjectType, IconDefinition> = {
    [CatalogObjectType.AnswerCollection]: faList,
    [CatalogObjectType.CatalogCollection]: faFolder,
    [CatalogObjectType.LiveQuizTemplate]: faFileLines,
  }
  const actionsDisabled = object.isOwner || object.isShared

  // modal states
  const [requestModal, setRequestModal] = useState(false)
  const [requestCancellationModal, setRequestCancellationModal] =
    useState(false)
  const [importModal, setImportModal] = useState(false)
  const [changeAccessModal, setChangeAccessModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [newAccess, setNewAccess] = useState<ObjectAccess>(object.access)

  // toast states
  const [showRequestSuccessToast, setShowRequestSuccessToast] = useState(false)
  const [showImportSuccessToast, setShowImportSuccessToast] = useState(false)
  const [
    showRequestCancellationSuccessToast,
    setShowRequestCancellationSuccessToast,
  ] = useState(false)

  // Use the new dropdown hook
  const dropdownItems = useCatalogObjectActionsDropdown({
    object,
    actionsDisabled,
    managedAccess,
    setImportModal,
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
          if (
            actionsDisabled ||
            (object.isRequested && object.access === ObjectAccess.Restricted)
          )
            return

          object.access === ObjectAccess.Public
            ? setImportModal(true)
            : setRequestModal(true)
        }}
        data-cy={`catalog-object-${object.name}`}
      >
        <div className="flex flex-row items-center gap-2">
          <ObjectAccessLabel
            iconOnly
            accessType={object.access}
            className="mr-2 w-3 text-sm"
          />
          <FontAwesomeIcon
            icon={objectTypeIcons[object.objectType]}
            className="h-4 w-4"
          />
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
          objectType={CatalogObjectType.AnswerCollection}
          objectId={object.id ?? object.uuid!}
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

      {/* functionality for users to import a copy of a publicly available object */}
      {!actionsDisabled && object.access === ObjectAccess.Public ? (
        <CatalogImportModal
          open={importModal}
          onSuccess={() => {
            setShowImportSuccessToast(true)
            setImportModal(false)
          }}
          onClose={() => setImportModal(false)}
          objectType={object.objectType}
          objectId={object.id ?? object.uuid!}
          objectName={object.name}
          objectOwner={object.ownerShortname}
          catalogCollectionId={catalogCollectionId}
        />
      ) : null}
      <CatalogObjectImportSuccessToast
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
          objectId={object.id ?? object.uuid!}
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
            assignmentId={object.assignmentId}
            newAccess={newAccess}
            catalogCollectionId={catalogCollectionId}
          />
          <ObjectRemovalModal
            object={object}
            open={removalModal}
            catalogCollectionId={catalogCollectionId}
            onClose={() => setRemovalModal(false)}
          />
        </>
      ) : null}
      {object.isManager ? (
        object.uuid ? (
          <ObjectSharingModalWrapper
            objectUuid={object.uuid}
            objectName={object.name}
            objectType={object.objectType}
            catalogCollectionId={catalogCollectionId}
            isOwner={object.isOwner}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        ) : (
          <ObjectSharingModalWrapper
            objectId={object.id!}
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
