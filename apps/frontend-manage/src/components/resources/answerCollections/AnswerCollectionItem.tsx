import {
  faDownload,
  faEllipsisVertical,
  faLink,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useAnswerCollectionActionsDropdown from '../../../lib/hooks/useAnswerCollectionActionsDropdown'
import AnswerCollectionRemovalModal from '../../sharing/AnswerCollectionRemovalModal'
import ObjectPermissionLevel from '../../sharing/ObjectPermissionLevel'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import AnswerCollectionEditModal from './AnswerCollectionEditModal'
import AnswerCollectionViewingModal from './AnswerCollectionViewingModal'
import CollectionDeletionModal from './CollectionDeletionModal'

function AnswerCollectionItem({
  collection,
  highlighted = false,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  collection: AnswerCollection
  highlighted?: boolean
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

  const dropdownItems = useAnswerCollectionActionsDropdown({
    isOwner: collection.isOwner ?? false,
    isManager: collection.isManager ?? false,
    isEditor: collection.isEditor ?? false,
    isRemovable: collection.isRemovable ?? false,
    isDeletable: collection.isDeletable ?? false,
    setSharingModal,
    setEditModal,
    setViewingModal,
    setRemovalModal,
    setDeletionModal,
  })

  return (
    <>
      <div
        className={twMerge(
          'flex items-center justify-between px-1 py-2 hover:bg-gray-50',
          highlighted && 'bg-orange-100 hover:bg-orange-200'
        )}
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
            {collection.permissionLevel && (
              <ObjectPermissionLevel
                objectName={collection.name}
                permissionLevel={collection.permissionLevel}
              />
            )}
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
          {collection.isManager && (collection.numSharedUsers ?? 0) > 0 && (
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
                  <Button.Icon withoutLabel icon={faEllipsisVertical} />
                </Button>
              }
              data={{ cy: `answer-collection-actions-${collection.name}` }}
            />
          )}
        </div>
      </div>

      {/* editing and viewing modal components */}
      {collection.isEditor && (
        <AnswerCollectionEditModal
          collectionId={collection.id}
          open={editModal}
          onClose={() => setEditModal(false)}
        />
      )}
      {!collection.isEditor && (
        <AnswerCollectionViewingModal
          collectionId={collection.id}
          open={viewingModal}
          onClose={() => setViewingModal(false)}
        />
      )}

      {/* sharing functionalities modals to add / revoke / ... access */}
      {collection.isManager && (
        <>
          <ObjectSharingModalWrapper
            objectId={collection.id}
            objectName={collection.name}
            objectType={SharingObjectType.AnswerCollection}
            isOwner={collection.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
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

      {/* removal modal for non-owners */}
      {!collection.isOwner && (
        <AnswerCollectionRemovalModal
          id={collection.id}
          name={collection.name}
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
