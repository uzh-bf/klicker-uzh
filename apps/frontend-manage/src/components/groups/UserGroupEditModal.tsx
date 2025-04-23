import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  faPencil,
  faUser,
  faUserMinus,
  faUserPlus,
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
import useChangeUserGroupName from './useChangeUserGroupName'
import useDemoteGroupAdminToMember from './useDemoteGroupAdminToMember'
import usePromoteGroupMemberToAdmin from './usePromoteGroupMemberToAdmin'
import useRemoveUserFromGroup from './useRemoveUserFromGroup'

function UserGroupEditModal({
  open,
  onClose,
  group,
}: {
  open: boolean
  onClose: () => void
  group: UserGroup
}) {
  const t = useTranslations()
  const { onDemotion, demoting } = useDemoteGroupAdminToMember()
  const { onPromotion, promoting } = usePromoteGroupMemberToAdmin()
  const { onRemove, removing } = useRemoveUserFromGroup()
  const { onNameChange, nameChanging } = useChangeUserGroupName()
  const loading = demoting || promoting || removing || nameChanging // block actions as long as any modification is ongoing

  const [titleEditMode, setTitleEditMode] = useState(false)
  const [titleState, setTitleState] = useState(group.name)

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          titleEditMode ? (
            <div className="flex flex-row items-center">
              <div className="mr-2.5 whitespace-nowrap">{`${t('shared.generic.userGroup')}: `}</div>
              <TextField
                value={titleState}
                onChange={(newValue) => setTitleState(newValue)}
                className={{ input: 'h-8 font-normal' }}
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
              >
                <Button.Icon withoutLabel icon={faSave} />
              </Button>
            </div>
          ) : (
            <div className="flex flex-row items-center gap-1.5">
              <div>{`${t('shared.generic.userGroup')}: ${group.name}`}</div>
              {group.isAdmin || group.isOwner ? (
                <Button
                  basic
                  onClick={() => setTitleEditMode(true)}
                  className={{ root: 'px-1.5 py-1.5' }}
                >
                  <Button.Icon withoutLabel icon={faPencil} />
                </Button>
              ) : null}
            </div>
          )
        }
        className={{ content: 'flex !max-w-2xl flex-col' }}
      >
        <H4>{t('manage.userGroups.admins')}</H4>
        {!group.admins || group.admins.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.userGroups.noAdmins')}
            className={{ root: 'mb-4' }}
          />
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
                    <div>{`${admin.shortname} (${admin.email})`}</div>
                  </div>
                  {group.isAdmin || group.isOwner ? (
                    <div className="flex flex-row gap-0">
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
                      >
                        <Button.Icon withoutLabel icon={faUserXmark} />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {group.isAdmin || group.isOwner ? (
              <div className="mb-4 flex flex-row justify-end gap-6 text-sm">
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

        <H4>{t('manage.userGroups.members')}</H4>
        {!group.members || group.members.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.userGroups.noMembers')}
            className={{ root: 'mb-4' }}
          />
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
                    <div>{`${member.shortname} (${member.email})`}</div>
                  </div>
                  {group.isAdmin || group.isOwner ? (
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
                      >
                        <Button.Icon withoutLabel icon={faUserXmark} />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {group.isAdmin || group.isOwner ? (
              <div className="flex flex-row justify-end gap-6 text-sm">
                <div className="flex flex-row items-center gap-2">
                  <FontAwesomeIcon icon={faUserPlus} className="h-4 w-4" />
                  <div>{t('manage.userGroups.promotUserToAdmin')}</div>
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
    </>
  )
}

export default UserGroupEditModal
