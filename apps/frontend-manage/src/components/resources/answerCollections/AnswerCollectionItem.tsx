import {
  faDownload,
  faEllipsisVertical,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AnswerCollection, ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Dropdown, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useAnswerCollectionActionsDropdown from '../../../lib/hooks/useAnswerCollectionActionsDropdown'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import AnswerCollectionRemovalModal from '../../sharing/AnswerCollectionRemovalModal'
import ObjectPermissionLevel from '../../sharing/ObjectPermissionLevel'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import SharingTypeBadge from '../../sharing/SharingTypeBadge'
import AnswerCollectionDuplicationModal from './AnswerCollectionDuplicationModal'
import AnswerCollectionEditModal from './AnswerCollectionEditModal'
import AnswerCollectionViewingModal from './AnswerCollectionViewingModal'
import CollectionDeletionModal from './CollectionDeletionModal'

function AnswerCollectionItem({
  collection,
  highlighted = false,
}: {
  collection: AnswerCollection
  highlighted?: boolean
}) {
  const t = useTranslations()

  // modal states
  const [editModal, setEditModal] = useState(false)
  const [duplicationModal, setDuplicationModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [viewingModal, setViewingModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [activityLogOpen, setActivityLogOpen] = useState(false)

  const dropdownItems = useAnswerCollectionActionsDropdown({
    collectionName: collection.name,
    isOwner: collection.isOwner ?? false,
    isManager: collection.isManager ?? false,
    isEditor: collection.isEditor ?? false,
    isRemovable: collection.isRemovable ?? false,
    isDeletable: collection.isDeletable ?? false,
    setSharingModal,
    setEditModal,
    setDuplicationModal,
    setViewingModal,
    setRemovalModal,
    setDeletionModal,
    setActivityLogOpen,
  })

  return (
    <>
      <div
        className={twMerge(
          'my-[0.2rem] flex items-center justify-between rounded-md border border-solid px-4 py-3 shadow-sm transition-all hover:shadow-md',
          highlighted && 'border-primary-100 bg-orange-50'
        )}
        data-cy={`answer-collection-${collection.name}`}
      >
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className="font-medium">{collection.name}</span>
            {collection.permissionLevel && (
              <ObjectPermissionLevel
                objectName={collection.name}
                permissionLevel={collection.permissionLevel}
              />
            )}
          </div>

          <div className="flex flex-row gap-4 text-sm text-gray-500">
            {!collection.isOwner && (
              <div>
                {t('manage.resources.byOwner', {
                  owner:
                    collection.ownerShortname ?? t('shared.generic.unknown'),
                })}
              </div>
            )}
            {typeof collection.numOfEntries !== 'undefined' &&
              collection.numOfEntries !== null && (
                <div>
                  {t('manage.resources.numOfAnswers', {
                    number: collection.numOfEntries ?? 0,
                  })}
                </div>
              )}
            {collection.isImported ? (
              <div className="flex h-5 flex-row items-center gap-2 py-1">
                <FontAwesomeIcon icon={faDownload} className="h-4 w-4" />
                <div>{t('shared.generic.imported')}</div>
              </div>
            ) : (
              <SharingTypeBadge
                sharingType={collection.sharingType}
                className={{ root: 'h-5' }}
              />
            )}
          </div>
          <div className="flex flex-row gap-4 text-sm text-gray-500">
            <div>
              {t('shared.generic.createdAt', {
                date: dayjs(collection.createdAt).format('DD.MM.YYYY HH:mm'),
              })}
            </div>
            <div>
              {t('shared.generic.updatedAt', {
                date: dayjs(collection.updatedAt).format('DD.MM.YYYY HH:mm'),
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {collection.isManager && (collection.numSharedUsers ?? 0) > 0 && (
            <button
              type="button"
              aria-label={`${t(`manage.sharing.share${ObjectType.AnswerCollection}`)} (${collection.numSharedUsers} ${t('shared.generic.users')})`}
              className="hover:text-primary-100 flex cursor-pointer items-center border-0 bg-transparent p-0 text-sm text-gray-600"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSharingModal(true)
              }}
              data-cy="open-sharing-modal"
            >
              <span className="mr-1">{collection.numSharedUsers}</span>
              <FontAwesomeIcon icon={faUserGroup} />
            </button>
          )}

          {dropdownItems.length > 0 && (
            <Dropdown
              items={dropdownItems}
              trigger={<FontAwesomeIcon icon={faEllipsisVertical} />}
              className={{
                item: 'py-0.5 text-sm',
                trigger:
                  'h-7 w-7 rounded-full border-none bg-transparent text-gray-500 hover:bg-gray-100',
              }}
              data={{ cy: `answer-collection-actions-${collection.name}` }}
            />
          )}
        </div>
      </div>

      {/* editing and viewing modal components */}
      {collection.isEditor && editModal && (
        <AnswerCollectionEditModal
          collectionId={collection.id}
          onClose={() => setEditModal(false)}
        />
      )}
      {duplicationModal && (
        <AnswerCollectionDuplicationModal
          collectionId={collection.id}
          onClose={() => setDuplicationModal(false)}
          onSuccess={() =>
            toast({
              type: 'success',
              message: t('manage.resources.duplicationSuccess'),
              options: { duration: 3000 },
            })
          }
        />
      )}

      {!collection.isEditor && viewingModal && (
        <AnswerCollectionViewingModal
          collectionId={collection.id}
          onClose={() => setViewingModal(false)}
        />
      )}

      {/* sharing functionalities modals to add / revoke / ... access */}
      {collection.isManager && (
        <>
          {sharingModal && (
            <ObjectSharingModalWrapper
              objectId={collection.id}
              objectName={collection.name}
              objectType={ObjectType.AnswerCollection}
              onClose={() => setSharingModal(false)}
            />
          )}
          {deletionModal && (
            <CollectionDeletionModal
              collection={collection}
              setDeletionModal={setDeletionModal}
            />
          )}
        </>
      )}

      {/* removal modal for non-owners */}
      {!collection.isOwner && removalModal ? (
        <AnswerCollectionRemovalModal
          id={collection.id}
          name={collection.name}
          onClose={() => setRemovalModal(false)}
        />
      ) : null}

      {activityLogOpen && (
        <ActivityLogDialog
          objectId={collection.id}
          objectType={ObjectType.AnswerCollection}
          open={activityLogOpen}
          onClose={() => setActivityLogOpen(false)}
        />
      )}
    </>
  )
}

export default AnswerCollectionItem
