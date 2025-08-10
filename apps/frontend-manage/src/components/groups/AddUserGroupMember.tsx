import { useMutation } from '@apollo/client'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import {
  AddUserToUserGroupDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'

function AddUserGroupMember({
  groupId,
  adminMode = false,
  loading,
}: {
  groupId: number
  adminMode?: boolean
  loading: boolean
}) {
  const t = useTranslations()
  // TODO: add query update
  const [addUserToUserGroup] = useMutation(AddUserToUserGroupDocument)

  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('manage.userGroups.addUserGroupError'),
      options: { duration: 7000 },
    })

  return (
    <Formik
      initialValues={{ shortnameOrEmail: '' }}
      validationSchema={Yup.object().shape({
        shortnameOrEmail: Yup.string().required(
          t('manage.userGroups.emailShortnameRequired')
        ),
      })}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true)

        try {
          const { data: addedUser } = await addUserToUserGroup({
            variables: {
              groupId: groupId,
              shortnameOrEmail: values.shortnameOrEmail,
              asAdmin: adminMode,
            },
            update: (cache, { data }) => {
              // check if request was successful
              const newUser = data?.addUserToUserGroup
              if (!newUser) return

              // add the new user as an admin or member to of the group
              const userGroups = cache.readQuery({
                query: GetUserGroupsUserDocument,
              })

              if (userGroups?.getUserGroupsUser) {
                cache.writeQuery({
                  query: GetUserGroupsUserDocument,
                  data: {
                    getUserGroupsUser: userGroups?.getUserGroupsUser.map(
                      (existingGroup) => {
                        if (groupId === existingGroup.id) {
                          return {
                            ...existingGroup,
                            members: [
                              ...(existingGroup.members ?? []),
                              ...(adminMode
                                ? []
                                : [
                                    {
                                      id: newUser.id,
                                      shortname: newUser.shortname,
                                      email: newUser.email,
                                    },
                                  ]),
                            ],
                            admins: [
                              ...(existingGroup.admins ?? []),
                              ...(adminMode
                                ? [
                                    {
                                      id: newUser.id,
                                      shortname: newUser.shortname,
                                      email: newUser.email,
                                    },
                                  ]
                                : []),
                            ],
                          }
                        }

                        return existingGroup
                      }
                    ),
                  },
                })
              }
            },
          })

          setSubmitting(false)
          if (!!addedUser?.addUserToUserGroup) {
            resetForm()
            toast({
              type: 'success',
              message: t('manage.userGroups.addUserGroupSuccess'),
              options: { duration: 3000 },
            })
          } else {
            onErrorToast()
          }
        } catch (error) {
          console.error(error)
          setSubmitting(false)
          onErrorToast()
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="mt-1 flex flex-row items-center gap-2">
          <FormikTextField
            name="shortnameOrEmail"
            placeholder={
              adminMode
                ? t('manage.userGroups.addAdminPlaceholder')
                : t('manage.userGroups.addMemberPlaceholder')
            }
            className={{ input: 'h-7 text-sm' }}
            data={{ cy: `add-${adminMode ? 'admin' : 'member'}-group-input` }}
          />
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={loading}
            className={{ root: 'h-7 whitespace-nowrap text-sm' }}
            data={{
              cy: `add-${adminMode ? 'admin' : 'member'}-group-confirm`,
            }}
          >
            <Button.Icon icon={faPlus} loading={isSubmitting} />
            <Button.Label>{t('manage.userGroups.addUser')}</Button.Label>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AddUserGroupMember
