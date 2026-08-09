import { useMutation } from '@apollo/client'
import {
  faBan,
  faCheck,
  faPlusCircle,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import {
  CreateUserGroupDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSwitchField,
  FormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { FieldArray, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'

type UserGroupCreationFormValues = {
  name?: string
  members: { shortnameOrEmail: string; isAdmin: boolean }[]
}

function UserGroupCreationForm({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void
  onSuccess: () => void
  onError: () => void
}) {
  const t = useTranslations()
  const [createUserGroup] = useMutation(CreateUserGroupDocument)

  const validationSchema = Yup.object({
    name: Yup.string().required(t('manage.userGroups.nameRequired')),
    members: Yup.array()
      .of(
        Yup.object().shape({
          shortnameOrEmail: Yup.string().required(
            t('manage.userGroups.emailShortnameRequired')
          ),
        })
      )
      .min(1, t('manage.userGroups.minOneMemberRequired'))
      .test(
        'unique',
        t('manage.userGroups.uniqueUsersRequired'),
        function (arr) {
          if (!arr) return true
          const values = arr.map((item) => item.shortnameOrEmail)
          const uniqueValues = new Set(values)
          return values.length === uniqueValues.size
        }
      ),
  })

  return (
    <div className="mb-6">
      <div className="mb-3">{t('manage.userGroups.creationExplanation')}</div>
      <Formik
        initialValues={{
          name: undefined,
          members: [{ shortnameOrEmail: '', isAdmin: false }],
        }}
        onSubmit={async (values: UserGroupCreationFormValues) => {
          try {
            const { data } = await createUserGroup({
              variables: {
                name: values.name!,
                members: values.members!,
              },
              update: (cache, { data }) => {
                // check if the creation was successful
                if (!data?.createUserGroup) return

                // update the list of user groups
                cache.updateQuery(
                  { query: GetUserGroupsUserDocument },
                  (qData) => {
                    if (!qData?.getUserGroupsUser) return qData
                    return {
                      getUserGroupsUser: [
                        ...qData.getUserGroupsUser,
                        data.createUserGroup!,
                      ],
                    }
                  }
                )
              },
            })

            if (data?.createUserGroup?.id) {
              onClose()
              onSuccess()
            } else {
              onError()
            }
          } catch (error) {
            console.error('Error creating user group:', error)
            onError()
          }
        }}
        validationSchema={validationSchema}
        validateOnMount
      >
        {({ values, errors, isValid, isSubmitting }) => (
          <Form>
            <FormikTextField
              required
              name="name"
              label={t('shared.generic.name')}
              tooltip={t('manage.userGroups.nameTooltip')}
              data={{ cy: 'user-group-name' }}
            />
            <FieldArray
              name="members"
              render={({ push, remove }) => (
                <div className="space-y-2">
                  {values.members.map((_, index) => (
                    <div
                      // Formik member entries have no persisted identity; the field index is their controlled identity.
                      // biome-ignore lint/suspicious/noArrayIndexKey: index is the only stable identity available for this controlled Formik array
                      key={index}
                      className="flex space-x-2"
                    >
                      <div className="grow">
                        <FormikTextField
                          required={index === 0}
                          name={`members.${index}.shortnameOrEmail`}
                          placeholder={t('manage.userGroups.emailOrShortname')}
                          label={`${t('manage.userGroups.member')} ${index + 1}`}
                          data={{ cy: `member-shortname-email-${index}` }}
                        />
                      </div>
                      <div className="mb-1.5 flex items-end">
                        <FormikSwitchField
                          name={`members.${index}.isAdmin`}
                          label={t('manage.userGroups.admin')}
                          data={{ cy: `member-admin-${index}` }}
                          className={{ root: 'ml-2' }}
                        />
                      </div>
                      <Button
                        onClick={() => remove(index)}
                        data={{ cy: `remove-member-${index}` }}
                        className={{
                          root: 'h-9 w-9 self-end border-red-600 text-red-600 hover:text-red-600',
                        }}
                      >
                        <Button.Icon withoutLabel icon={faTrashCan} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() =>
                      push({ shortnameOrEmail: '', isAdmin: false })
                    }
                    className={{ root: 'w-full' }}
                    data={{ cy: 'add-member' }}
                  >
                    <Button.Icon icon={faPlusCircle} />
                    <Button.Label>
                      {t('manage.userGroups.addMember')}
                    </Button.Label>
                  </Button>
                </div>
              )}
            />
            {errors && typeof errors.members === 'string' ? (
              <UserNotification
                type="error"
                message={errors.members}
                className={{ root: 'mt-2 text-base' }}
              />
            ) : null}
            <div className="mt-3 flex w-full flex-row justify-between">
              <Button
                className={{ root: 'h-8 border-red-400' }}
                onClick={onClose}
                data={{ cy: 'cancel-create-user-group' }}
              >
                <Button.Icon icon={faBan} />
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                type="submit"
                disabled={!isValid}
                loading={isSubmitting}
                className={{ root: 'h-8 border-green-700' }}
                data={{ cy: 'submit-create-user-group' }}
              >
                <Button.Icon icon={faCheck} loading={isSubmitting} />
                <Button.Label>{t('shared.generic.create')}</Button.Label>
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  )
}

export default UserGroupCreationForm
