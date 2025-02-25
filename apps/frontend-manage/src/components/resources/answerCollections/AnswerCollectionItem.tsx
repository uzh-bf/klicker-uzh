import { faEye, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faDownload,
  faEllipsisVertical,
  faInfoCircle,
  faLink,
  faPencil,
  faUserGroup,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AnswerCollection, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ObjectAccessLabel from '../../catalog/ObjectAccessLabel'
import AnswerCollectionEditModal from './AnswerCollectionEditModal'
import AnswerCollectionViewingModal from './AnswerCollectionViewingModal'
import CollectionDeletionModal from './CollectionDeletionModal'
import CollectionRemovalModal from './CollectionRemovalModal'

function AnswerCollectionItem({
  collection,
  isOwner = false,
  isEditable = false,
  isImported = false,
  accessGranted = false,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  collection: AnswerCollection
  isOwner?: boolean
  isEditable?: boolean
  isImported?: boolean
  accessGranted?: boolean
  setDeletionSuccess: Dispatch<SetStateAction<boolean>>
  setDeletionFailure: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  // modal states
  const [editModal, setEditModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [viewingModal, setViewingModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)

  const collectionAccessMap: Record<ObjectAccess, React.ReactNode> = {
    [ObjectAccess.Private]: (
      <ObjectAccessLabel
        accessType={ObjectAccess.Private}
        className="ml-2 text-sm"
      />
    ),
    [ObjectAccess.Public]: (
      <ObjectAccessLabel
        accessType={ObjectAccess.Public}
        className="ml-2 text-sm"
      />
    ),
    [ObjectAccess.Restricted]: (
      <ObjectAccessLabel
        accessType={ObjectAccess.Restricted}
        className="ml-2 text-sm"
      />
    ),
  }

  const DeletionTooltip = () => (
    <Tooltip
      tooltip={t('manage.resources.deletionDisabledInUse')}
      className={{
        tooltip: 'max-w-[30rem] text-sm',
        trigger: 'ml-2',
      }}
    >
      <FontAwesomeIcon icon={faInfoCircle} className="text-primary-100" />
    </Tooltip>
  )

  const dropdownItems = isEditable
    ? [
        {
          id: 'edit',
          label: (
            <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
              <FontAwesomeIcon icon={faPencil} className="mr-2.5 h-4 w-4" />
              {t('manage.resources.editCollection')}
            </div>
          ),
          onClick: () => setEditModal(true),
          data: { cy: 'edit-answer-collection' },
        },
        {
          id: 'delete',
          label: (
            <div
              className={twMerge(
                'flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100',
                !collection.isRemovable &&
                  'text-opactiy-50 hover:cursor-not-allowed'
              )}
            >
              <FontAwesomeIcon icon={faTrashCan} className="mr-2.5 h-4 w-4" />
              {t('manage.resources.deleteCollection')}
              {!collection.isRemovable && <DeletionTooltip />}
            </div>
          ),
          onClick: () => setDeletionModal(true),
          disabled: !collection.isRemovable,
          data: { cy: 'delete-answer-collection' },
        },
      ]
    : accessGranted
      ? [
          {
            id: 'view',
            label: (
              <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
                <FontAwesomeIcon icon={faEye} className="mr-2.5 h-4 w-4" />
                {t('manage.resources.viewCollection')}
              </div>
            ),
            onClick: () => setViewingModal(true),
            data: { cy: 'view-answer-collection' },
          },
          {
            id: 'remove',
            label: (
              <div
                className={twMerge(
                  'flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100',
                  !collection.isRemovable &&
                    'text-opactiy-50 hover:cursor-not-allowed'
                )}
              >
                <FontAwesomeIcon icon={faX} className="mr-2.5 h-4 w-4" />
                {t('manage.resources.removeCollection')}
                {!collection.isRemovable && <DeletionTooltip />}
              </div>
            ),
            onClick: () => setRemovalModal(true),
            disabled: !collection.isRemovable,
            data: { cy: 'remove-answer-collection' },
          },
        ]
      : []

  return (
    <>
      <div
        className="flex items-center justify-between px-1 py-2 hover:bg-gray-50"
        data-cy={`answer-collection-${collection.name}`}
      >
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            {!(isOwner && !isImported) && (
              <FontAwesomeIcon
                icon={isImported ? faDownload : faLink}
                className="text-gray-500"
                fixedWidth
              />
            )}
            <span className="font-medium">{collection.name}</span>
            {isEditable && collectionAccessMap[collection.access]}
          </div>

          <div className="text-sm text-gray-500">
            {!isEditable && (
              <span className="mr-3">
                {t('manage.resources.byOwner', {
                  owner:
                    collection.ownerShortname ?? t('shared.generic.unknown'),
                })}
              </span>
            )}
            {typeof collection.numOfEntries !== 'undefined' &&
              collection.numOfEntries !== null && (
                <span>
                  {t('manage.resources.numOfAnswers', {
                    number: collection.numOfEntries ?? 0,
                  })}
                </span>
              )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isEditable && (collection.numSharedUsers ?? 0) > 0 && (
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-1">{collection.numSharedUsers}</span>
              <FontAwesomeIcon icon={faUserGroup} />
            </div>
          )}

          {dropdownItems.length > 0 && (
            <Dropdown
              items={dropdownItems}
              trigger={
                <Button
                  basic
                  className={{
                    root: 'rounded-full p-1.5 text-gray-500 hover:bg-gray-100',
                  }}
                >
                  <FontAwesomeIcon icon={faEllipsisVertical} />
                </Button>
              }
              data={{ cy: `answer-collection-actions-${collection.name}` }}
            />
          )}
        </div>
      </div>

      {isEditable && (
        <>
          <AnswerCollectionEditModal
            collectionId={collection.id}
            open={editModal}
            onClose={() => setEditModal(false)}
            onDelete={() => setDeletionModal(true)}
          />
          <CollectionDeletionModal
            collection={collection}
            deletionModal={deletionModal}
            setDeletionModal={setDeletionModal}
            setDeletionSuccess={setDeletionSuccess}
            setDeletionFailure={setDeletionFailure}
          />
        </>
      )}

      {accessGranted && (
        <>
          <AnswerCollectionViewingModal
            collectionId={collection.id}
            open={viewingModal}
            onClose={() => setViewingModal(false)}
            onRemove={() => setRemovalModal(true)}
          />
          <CollectionRemovalModal
            collection={collection}
            removalModal={removalModal}
            setRemovalModal={setRemovalModal}
            setRemovalSuccess={setRemovalSuccess}
            setRemovalFailure={setRemovalFailure}
          />
        </>
      )}
    </>
  )
}

export default AnswerCollectionItem
