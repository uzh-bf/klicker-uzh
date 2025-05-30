import { useMutation } from '@apollo/client'
import {
  faBan,
  faPersonWalkingArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetUserGroupsUserDocument,
  LeaveUserGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import LeaveUserGroupErrorToast from './LeaveUserGroupErrorToast'

function LeaveUserGroupModal({
  open,
  onClose,
  onSuccess,
  groupId,
  groupName,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  groupId: number
  groupName: string
}) {
  const t = useTranslations()
  const [errorToast, setErrorToast] = useState(false)
  const [leaveUserGroup, { loading }] = useMutation(LeaveUserGroupDocument)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.userGroups.leaveGroup')}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!loading && <FontAwesomeIcon icon={faPersonWalkingArrowRight} />}
          <span>{t('shared.generic.confirm')}</span>
        </div>
      }
      primaryLoading={loading}
      onPrimaryAction={async () => {
        try {
          const { data: success } = await leaveUserGroup({
            variables: {
              groupId,
            },
            update: (cache, { data }) => {
              // check if request was successful
              const success = data?.leaveUserGroup
              if (!success) return

              // update list of user groups
              const userGroups = cache.readQuery({
                query: GetUserGroupsUserDocument,
              })

              if (userGroups?.getUserGroupsUser) {
                cache.writeQuery({
                  query: GetUserGroupsUserDocument,

                  data: {
                    getUserGroupsUser: userGroups?.getUserGroupsUser.filter(
                      (group) => group.id !== groupId
                    ),
                  },
                })
              }
            },
          })

          if (success?.leaveUserGroup) {
            onSuccess()
          } else {
            setErrorToast(true)
          }
        } catch (error) {
          console.error('Error leaving user group:', error)
          setErrorToast(true)
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-leave-group' }}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-leave-group' }}
      className={{ content: 'max-w-xl' }}
    >
      {t('manage.userGroups.confirmLeaveGroup', { groupName })}

      <LeaveUserGroupErrorToast
        open={errorToast}
        setOpen={() => setErrorToast(false)}
      />
    </Modal>
  )
}

export default LeaveUserGroupModal
