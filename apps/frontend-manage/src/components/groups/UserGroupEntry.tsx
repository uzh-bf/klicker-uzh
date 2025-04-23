import { faEye, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faEllipsisVertical,
  faPencil,
  faPersonWalkingArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UserGroup } from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import DeleteUserGroupModal from './DeleteUserGroupModal'
import DeleteUserGroupSuccessToast from './DeleteUserGroupSuccessToast'
import LeaveUserGroupModal from './LeaveUserGroupModal'
import LeaveUserGroupSuccessToast from './LeaveUserGroupSuccessToast'
import UserGroupBadge from './UserGroupBadge'
import UserGroupEditModal from './UserGroupEditModal'

function UserGroupEntry({ group }: { group: UserGroup }) {
  const t = useTranslations()

  const [leaveGroupModal, setLeaveGroupModal] = useState(false)
  const [deleteGroupModal, setDeleteGroupModal] = useState(false)
  const [editModal, setEditModal] = useState(false)

  const [leaveSuccess, setLeaveSuccess] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState(false)

  // required functionalities (ideally incl. audit log entries):
  // TODO: - add member to the group
  // TODO: - transfer ownership

  return (
    <>
      <div
        data-cy={`user-group-${group.name}`}
        className="flex flex-row justify-between border-b-2 border-gray-300 px-1.5 py-1.5 last:border-b-0"
      >
        <div>
          <div className="flex flex-row items-center gap-4">
            <div>{group.name}</div>
          </div>
          <div className="text-sm text-gray-500">{`${group.numOfMembers} ${t('manage.userGroups.members')}`}</div>
        </div>
        <div className="flex flex-row items-center gap-3">
          <UserGroupBadge
            isMember={group.isMember ?? false}
            isAdmin={group.isAdmin ?? false}
            isOwner={group.isOwner ?? false}
          />
          <Dropdown
            items={[
              {
                label: (
                  <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
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
                data: { cy: `leave-group-${group.name}` },
                className: { item: 'text-red-500' },
              },
              ...(!group.isOwner
                ? [
                    {
                      label: (
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100">
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
                        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 text-red-600 hover:bg-gray-100">
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
            data={{ cy: `user-group-actions-${group.name}` }}
          />
        </div>
      </div>

      <LeaveUserGroupModal
        open={leaveGroupModal}
        onClose={() => setLeaveGroupModal(false)}
        onSuccess={() => {
          setLeaveGroupModal(false)
          setLeaveSuccess(true)
        }}
        groupId={group.id}
        groupName={group.name}
      />
      <LeaveUserGroupSuccessToast
        open={leaveSuccess}
        setOpen={() => setLeaveSuccess(false)}
      />

      <DeleteUserGroupModal
        open={deleteGroupModal}
        onClose={() => setDeleteGroupModal(false)}
        groupId={group.id}
        groupName={group.name}
        onSuccess={() => {
          setDeleteGroupModal(false)
          setDeleteSuccess(true)
        }}
      />
      <DeleteUserGroupSuccessToast
        open={deleteSuccess}
        setOpen={() => setDeleteSuccess(false)}
      />

      <UserGroupEditModal
        open={editModal}
        onClose={() => setEditModal(false)}
        group={group}
      />
    </>
  )
}

export default UserGroupEntry
