import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import UserGroupCreationErrorToast from './UserGroupCreationErrorToast'
import UserGroupCreationForm from './UserGroupCreationForm'
import UserGroupCreationSuccessToast from './UserGroupCreationSuccessToast'

function UserGroupCreation() {
  const t = useTranslations()
  const [formOpen, setFormOpen] = useState(false)
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  return (
    <>
      <H3>{t('manage.userGroups.userGroupCreation')}</H3>
      {!formOpen ? (
        <div className="mb-4">
          <Button
            fluid
            onClick={() => setFormOpen(true)}
            data={{ cy: 'create-user-group' }}
          >
            <Button.Icon icon={faPlusCircle} />
            <Button.Label>{t('manage.userGroups.newUserGroup')}</Button.Label>
          </Button>
        </div>
      ) : null}
      {formOpen ? (
        <UserGroupCreationForm
          onClose={() => setFormOpen(false)}
          onSuccess={() => setSuccessToast(true)}
          onError={() => setErrorToast(true)}
        />
      ) : null}
      <UserGroupCreationSuccessToast
        open={successToast}
        setOpen={setSuccessToast}
      />
      <UserGroupCreationErrorToast open={errorToast} setOpen={setErrorToast} />
    </>
  )
}

export default UserGroupCreation
