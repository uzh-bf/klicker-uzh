import { useMutation } from '@apollo/client'
import {
  faBan,
  faPersonWalkingArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import {
  GetUserGroupsUserDocument,
  LeaveUserGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
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
  const [leaveUserGroup] = useMutation(LeaveUserGroupDocument)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.userGroups.leaveGroup')}
      className={{ content: '!max-w-xl' }}
    >
      <div className="mb-3">
        {t('manage.userGroups.confirmLeaveGroup', { groupName })}
      </div>
      <div className="flex flex-row justify-between">
        <Button onClick={onClose}>
          <Button.Icon icon={faBan} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          destructive
          onClick={async () => {
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
        >
          <Button.Icon icon={faPersonWalkingArrowRight} />
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
      <LeaveUserGroupErrorToast
        open={errorToast}
        setOpen={() => setErrorToast(false)}
      />
    </Modal>
  )
}

export default LeaveUserGroupModal
