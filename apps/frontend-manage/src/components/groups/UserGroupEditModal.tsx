import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  faPencil,
  faUser,
  faUserMinus,
  faUserPlus,
  faUserTie,
  faUserXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UserGroup } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H4,
  Modal,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AddUserGroupMember from './AddUserGroupMember'
import useChangeUserGroupName from './useChangeUserGroupName'
import useDemoteGroupAdminToMember from './useDemoteGroupAdminToMember'
import usePromoteGroupMemberToAdmin from './usePromoteGroupMemberToAdmin'
import useRemoveUserFromGroup from './useRemoveUserFromGroup'
import useTransferGroupOwnership from './useTransferGroupOwnership'

function UserGroupEditModal({
  onClose,
  group,
}: {
  onClose: () => void
  group: UserGroup
}) {
  const t = useTranslations()
  const isGroupEditor = group.isAdmin || group.isOwner

  const { onDemotion, demoting } = useDemoteGroupAdminToMember()
  const { onPromotion, promoting } = usePromoteGroupMemberToAdmin()
  const { onRemove, removing } = useRemoveUserFromGroup()
  const { onNameChange, nameChanging } = useChangeUserGroupName()
  const { onOwnershipTransfer, transferringOwnership } =
    useTransferGroupOwnership()
  const loading =
    demoting || promoting || removing || nameChanging || transferringOwnership // block actions as long as any modification is ongoing

  const [titleEditMode, setTitleEditMode] = useState(false)
  const [titleState, setTitleState] = useState(group.name)

  return (
    <Modal
      open
      onClose={onClose}
      title={
        titleEditMode ? (
          <div className="flex max-w-[90%] flex-row items-center md:max-w-[80%]">
            <div className="mr-2.5 whitespace-nowrap">{`${t('shared.generic.userGroup')}: `}</div>
            <TextField
              value={titleState}
              onChange={(newValue) => setTitleState(newValue)}
              className={{ input: 'h-8 font-normal' }}
              data={{ cy: 'edit-group-name-input' }}
            />
            <Button
              basic
              primary
              className={{ root: 'ml-1.5 px-2 py-2 hover:text-white' }}
              onClick={async () => {
                await onNameChange({
                  groupId: group.id,
                  newName: titleState,
                  setTitleEditMode,
                })
              }}
              data={{ cy: 'save-new-group-name' }}
            >
              <Button.Icon withoutLabel icon={faSave} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-row items-center gap-1.5">
            <div>{`${t('shared.generic.userGroup')}: ${group.name}`}</div>
            {isGroupEditor ? (
              <Button
                basic
                onClick={() => setTitleEditMode(true)}
                className={{ root: 'px-1.5 py-1.5' }}
                data={{ cy: 'edit-group-name' }}
              >
                <Button.Icon withoutLabel icon={faPencil} />
              </Button>
            ) : null}
          </div>
        )
      }
      className={{
        content: twMerge(
          'max-w-xl! flex flex-col pb-0',
          isGroupEditor && 'max-w-3xl!'
        ),
      }}
      dataCloseButton={{ cy: 'close-user-group-edit-modal' }}
    >
      <div className="mb-2.5 flex flex-row items-center gap-2">
        <FontAwesomeIcon icon={faUserTie} />
        <H4 className={{ root: 'my-0 py-0' }}>{t('shared.generic.owner')}</H4>
        <div data-cy="group-owner-shortname-email">{`${group.owner!.shortname} (${group.owner!.email})`}</div>
      </div>

      <H4>{t('manage.userGroups.admins')}</H4>
      {!group.admins || group.admins.length === 0 ? (
        <>
          {isGroupEditor ? (
            <AddUserGroupMember
              adminMode
              groupId={group.id}
              loading={loading}
            />
          ) : null}
          <UserNotification
            type="info"
            message={t('manage.userGroups.noAdmins')}
            className={{ root: 'mb-4 mt-2' }}
          />
        </>
      ) : (
        <>
          <div className="mb-2">
            {group.admins.map((admin) => (
              <div
                key={`group-admin-${admin.id}`}
                data-cy={`group-admin-${admin.shortname}`}
                className="flex flex-row justify-between border-b py-1 text-sm first:border-t"
              >
                <div className="flex flex-row items-center gap-2">
                  <FontAwesomeIcon icon={faUser} />
                  <div>
                    {isGroupEditor
                      ? `${admin.shortname} (${admin.email})`
                      : admin.shortname}
                  </div>
                </div>
                {isGroupEditor && !admin.isSelf ? (
                  <div className="flex flex-row gap-0">
                    {group.isOwner ? (
                      <Button
                        basic
                        disabled={loading}
                        className={{ root: 'px-1.5 py-[0.35rem]' }}
                        onClick={async () => {
                          await onOwnershipTransfer({
                            group,
                            newOwnerId: admin.id!,
                          })
                        }}
                        data={{
                          cy: `transfer-group-ownership-${admin.shortname}`,
                        }}
                      >
                        <Button.Icon
                          withoutLabel
                          icon={faUserTie}
                          className={{ root: 'h-3.5 w-3.5' }}
                        />
                      </Button>
                    ) : null}
                    <Button
                      basic
                      disabled={loading}
                      className={{ root: 'px-1.5 py-1' }}
                      onClick={async () => {
                        await onDemotion({
                          groupId: group.id,
                          adminId: admin.id!,
                          adminShortname: admin.shortname,
                          adminEmail: admin.email,
                        })
                      }}
                      data={{ cy: `demote-group-admin-${admin.shortname}` }}
                    >
                      <Button.Icon withoutLabel icon={faUserMinus} />
                    </Button>
                    <Button
                      basic
                      disabled={loading}
                      className={{
                        root: 'px-1.5 py-1 text-red-600 hover:text-red-600',
                      }}
                      onClick={async () => {
                        await onRemove({
                          groupId: group.id,
                          userId: admin.id!,
                        })
                      }}
                      data={{ cy: `remove-group-admin-${admin.shortname}` }}
                    >
                      <Button.Icon withoutLabel icon={faUserXmark} />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {isGroupEditor ? (
              <AddUserGroupMember
                adminMode
                groupId={group.id}
                loading={loading}
              />
            ) : null}
          </div>
          {isGroupEditor ? (
            <div className="flex flex-row justify-end gap-6 text-sm">
              {group.isOwner ? (
                <div className="flex flex-row items-center gap-2">
                  <FontAwesomeIcon icon={faUserTie} className="h-4 w-4" />
                  <div>{t('manage.userGroups.transferOwnership')}</div>
                </div>
              ) : null}
              <div className="flex flex-row items-center gap-2">
                <FontAwesomeIcon icon={faUserMinus} className="h-4 w-4" />
                <div>{t('manage.userGroups.demoteAdminToMember')}</div>
              </div>
              <div className="flex flex-row items-center gap-2 text-red-600">
                <FontAwesomeIcon icon={faUserXmark} className="h-4 w-4" />
                <div>{t('manage.userGroups.removeUserFromGroup')}</div>
              </div>
            </div>
          ) : null}
        </>
      )}

      <H4 className={{ root: 'mt-4' }}>{t('manage.userGroups.members')}</H4>
      {!group.members || group.members.length === 0 ? (
        <>
          {isGroupEditor ? (
            <AddUserGroupMember groupId={group.id} loading={loading} />
          ) : null}
          <UserNotification
            type="info"
            message={t('manage.userGroups.noMembers')}
            className={{ root: 'my-2' }}
          />
        </>
      ) : (
        <>
          <div className="mb-2">
            {group.members.map((member) => (
              <div
                key={`group-member-${member.id}`}
                data-cy={`group-member-${member.shortname}`}
                className="flex flex-row justify-between border-b py-1 text-sm first:border-t"
              >
                <div className="flex flex-row items-center gap-2">
                  <FontAwesomeIcon icon={faUser} />
                  <div>
                    {isGroupEditor
                      ? `${member.shortname} (${member.email})`
                      : member.shortname}
                  </div>
                </div>
                {isGroupEditor && !member.isSelf ? (
                  <div className="flex flex-row gap-0">
                    <Button
                      basic
                      disabled={loading}
                      className={{ root: 'px-1.5 py-1' }}
                      onClick={async () => {
                        onPromotion({
                          groupId: group.id,
                          memberId: member.id!,
                          memberShortname: member.shortname,
                          memberEmail: member.email,
                        })
                      }}
                      data={{
                        cy: `promote-group-member-${member.shortname}`,
                      }}
                    >
                      <Button.Icon withoutLabel icon={faUserPlus} />
                    </Button>
                    <Button
                      basic
                      disabled={loading}
                      className={{
                        root: 'px-1.5 py-1 text-red-600 hover:text-red-600',
                      }}
                      onClick={async () => {
                        await onRemove({
                          groupId: group.id,
                          userId: member.id!,
                        })
                      }}
                      data={{ cy: `remove-group-member-${member.shortname}` }}
                    >
                      <Button.Icon withoutLabel icon={faUserXmark} />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {isGroupEditor ? (
              <AddUserGroupMember groupId={group.id} loading={loading} />
            ) : null}
          </div>
          {isGroupEditor ? (
            <div className="flex flex-row justify-end gap-6 text-sm">
              <div className="flex flex-row items-center gap-2">
                <FontAwesomeIcon icon={faUserPlus} className="h-4 w-4" />
                <div>{t('manage.userGroups.promoteUserToAdmin')}</div>
              </div>
              <div className="flex flex-row items-center gap-2 text-red-600">
                <FontAwesomeIcon icon={faUserXmark} className="h-4 w-4" />
                <div>{t('manage.userGroups.removeUserFromGroup')}</div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  )
}

export default UserGroupEditModal
