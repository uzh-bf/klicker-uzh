import { useMutation } from '@apollo/client'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import {
  AddUserToUserGroupDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import AddUserGroupErrorToast from './AddUserGroupErrorToast'
import AddUserGroupSuccessToast from './AddUserGroupSuccessToast'

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
  const [addUserToUserGroup] = useMutation(AddUserToUserGroupDocument)
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  return (
    <>
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
              setSuccessToast(true)
            } else {
              setErrorToast(true)
            }
          } catch (error) {
            console.error(error)
            setSubmitting(false)
            setErrorToast(true)
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
            />
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={loading}
              className={{
                root: 'h-7 whitespace-nowrap text-sm',
              }}
            >
              <Button.Icon icon={faPlus} loading={isSubmitting} />
              <Button.Label>{t('manage.userGroups.addUser')}</Button.Label>
            </Button>
          </Form>
        )}
      </Formik>
      <AddUserGroupSuccessToast
        open={successToast}
        setOpen={() => setSuccessToast(false)}
      />
      <AddUserGroupErrorToast
        open={errorToast}
        setOpen={() => setErrorToast(false)}
      />
    </>
  )
}

export default AddUserGroupMember
