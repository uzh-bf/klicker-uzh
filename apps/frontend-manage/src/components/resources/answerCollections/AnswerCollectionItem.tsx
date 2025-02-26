import {
  faDownload,
  faEllipsisVertical,
  faLink,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AnswerCollection, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import useAnswerCollectionActionsDropdown from '~/lib/hooks/useAnswerCollectionActionsDropdown'
import ObjectAccessLabel from '../../catalog/ObjectAccessLabel'
import AnswerCollectionEditModal from './AnswerCollectionEditModal'
import AnswerCollectionViewingModal from './AnswerCollectionViewingModal'
import CollectionDeletionModal from './CollectionDeletionModal'
import CollectionRemovalModal from './CollectionRemovalModal'
import CollectionSharingModal from './CollectionSharingModal'
import TransferCollectionOwnershipModal from './TransferCollectionOwnershipModal'

function AnswerCollectionItem({
  collection,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  collection: AnswerCollection
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
  const [sharingModal, setSharingModal] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)

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

  const dropdownItems = useAnswerCollectionActionsDropdown({
    isOwner: collection.isOwner ?? false,
    isShareable: collection.isShareable ?? false,
    isEditable: collection.isEditable ?? false,
    isRemovable: collection.isRemovable ?? false,
    isDeletionAllowed: collection.isDeletionAllowed ?? false,
    setSharingModal,
    setEditModal,
    setViewingModal,
    setRemovalModal,
    setDeletionModal,
  })

  return (
    <>
      <div
        className="flex items-center justify-between px-1 py-2 hover:bg-gray-50"
        data-cy={`answer-collection-${collection.name}`}
      >
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            {!(collection.isOwner && !collection.isImported) && (
              <FontAwesomeIcon
                icon={collection.isImported ? faDownload : faLink}
                className="text-gray-500"
                fixedWidth
              />
            )}
            <span className="font-medium">{collection.name}</span>
            {collection.isEditable && collectionAccessMap[collection.access]}
          </div>

          <div className="text-sm text-gray-500">
            {!collection.isOwner && (
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
          {collection.isShareable && (collection.numSharedUsers ?? 0) > 0 && (
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

      {/* editing and viewing modal components */}
      {collection.isEditable && (
        <AnswerCollectionEditModal
          collectionId={collection.id}
          open={editModal}
          onClose={() => setEditModal(false)}
          onDelete={() => setDeletionModal(true)}
        />
      )}
      {!collection.isEditable && (
        <AnswerCollectionViewingModal
          collectionId={collection.id}
          open={viewingModal}
          onClose={() => setViewingModal(false)}
          onRemove={() => setRemovalModal(true)}
        />
      )}

      {/* sharing functionalities modals to add / revoke / ... access */}
      {collection.isShareable && (
        <>
          <CollectionSharingModal
            collection={collection}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
            onOwnershipTransfer={() => setTransferModalOpen(true)}
          />
          <TransferCollectionOwnershipModal
            open={transferModalOpen}
            onClose={() => setTransferModalOpen(false)}
            collectionId={collection.id}
            collectionName={collection.name}
          />
        </>
      )}

      {/* answer collection deletion functionality for owner and admins */}
      {collection.isDeletionAllowed && (
        <CollectionDeletionModal
          collection={collection}
          deletionModal={deletionModal}
          setDeletionModal={setDeletionModal}
          setDeletionSuccess={setDeletionSuccess}
          setDeletionFailure={setDeletionFailure}
        />
      )}
      {!collection.isOwner && (
        <CollectionRemovalModal
          collection={collection}
          removalModal={removalModal}
          setRemovalModal={setRemovalModal}
          setRemovalSuccess={setRemovalSuccess}
          setRemovalFailure={setRemovalFailure}
        />
      )}
    </>
  )
}

export default AnswerCollectionItem
