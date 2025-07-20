import { faEye, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faEllipsisVertical,
  faPencil,
  faPersonWalkingArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UserGroup } from '@klicker-uzh/graphql/dist/ops'
import { Dropdown, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import DeleteUserGroupModal from './DeleteUserGroupModal'
import LeaveUserGroupModal from './LeaveUserGroupModal'
import UserGroupBadge from './UserGroupBadge'
import UserGroupEditModal from './UserGroupEditModal'

function UserGroupEntry({ group }: { group: UserGroup }) {
  const t = useTranslations()

  const [leaveGroupModal, setLeaveGroupModal] = useState(false)
  const [deleteGroupModal, setDeleteGroupModal] = useState(false)
  const [editModal, setEditModal] = useState(false)

  return (
    <>
      <div
        data-cy={`user-group-${group.name}`}
        className="flex flex-row justify-between rounded-md border border-solid px-4 py-3 shadow-sm transition-all hover:shadow-md"
      >
        <div>
          <div className="flex flex-row items-center gap-4">
            <div>{group.name}</div>
          </div>
          <div className="text-sm text-gray-500">{`${group.numOfMembers} ${t('manage.userGroups.members')}`}</div>
        </div>
        <div className="flex flex-row items-center gap-2">
          <UserGroupBadge
            isMember={group.isMember ?? false}
            isAdmin={group.isAdmin ?? false}
            isOwner={group.isOwner ?? false}
          />
          <Dropdown
            items={[
              {
                label: (
                  <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5">
                    <FontAwesomeIcon
                      icon={group.isMember ? faEye : faPencil}
                      className="mr-2.5 h-4 w-4"
                    />
                    {group.isMember
                      ? t('manage.userGroups.viewGroup')
                      : t('manage.userGroups.editGroup')}
                  </div>
                ),
                onClick: () => setEditModal(true),
                data: { cy: `view-edit-group-${group.name}` },
              },
              ...(!group.isOwner
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600">
                          <FontAwesomeIcon
                            icon={faPersonWalkingArrowRight}
                            className="mr-2.5 h-4 w-4"
                          />
                          {t('manage.userGroups.leaveGroup')}
                        </div>
                      ),
                      onClick: () => setLeaveGroupModal(true),
                      data: { cy: `leave-group-${group.name}` },
                    },
                  ]
                : []),
              ...(group.isOwner
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600">
                          <FontAwesomeIcon
                            icon={faTrashCan}
                            className="mr-2.5 h-4 w-4"
                          />
                          {t('manage.userGroups.deleteGroup')}
                        </div>
                      ),
                      onClick: () => setDeleteGroupModal(true),
                      data: { cy: `delete-group-${group.name}` },
                    },
                  ]
                : []),
            ]}
            trigger={<FontAwesomeIcon icon={faEllipsisVertical} />}
            className={{
              item: 'py-0.5 text-sm',
              trigger:
                'h-7 w-7 rounded-full border-none bg-transparent text-gray-500 hover:bg-gray-100',
            }}
            data={{ cy: `user-group-actions-${group.name}` }}
          />
        </div>
      </div>

      {leaveGroupModal && (
        <LeaveUserGroupModal
          onClose={() => setLeaveGroupModal(false)}
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.userGroups.leaveGroupSuccess'),
              options: { duration: 3000 },
            })
            setLeaveGroupModal(false)
          }}
          groupId={group.id}
          groupName={group.name}
        />
      )}

      {deleteGroupModal && (
        <DeleteUserGroupModal
          onClose={() => setDeleteGroupModal(false)}
          groupId={group.id}
          groupName={group.name}
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.userGroups.deleteGroupSuccess'),
              options: { duration: 3000 },
            })
            setDeleteGroupModal(false)
          }}
        />
      )}

      {editModal && (
        <UserGroupEditModal onClose={() => setEditModal(false)} group={group} />
      )}
    </>
  )
}

export default UserGroupEntry
