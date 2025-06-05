import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { Button, H3, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import UserGroupCreationForm from './UserGroupCreationForm'

function UserGroupCreation() {
  const t = useTranslations()
  const [formOpen, setFormOpen] = useState(false)

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
          onSuccess={() =>
            toast({
              type: 'success',
              message: t('manage.userGroups.creationSuccessMessage'),
              options: { duration: 3000 },
            })
          }
          onError={() =>
            toast({
              type: 'error',
              message: t('manage.userGroups.creationErrorMessage'),
              options: { duration: 10000 },
            })
          }
        />
      ) : null}
    </>
  )
}

export default UserGroupCreation
