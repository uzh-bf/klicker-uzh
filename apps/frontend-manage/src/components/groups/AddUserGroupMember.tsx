import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { Button, FormikTextField, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../lib/trpc'

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
  const utils = trpc.useUtils()
  const addUserToUserGroup = trpc.sharing.addUserToUserGroup.useMutation()
  const refreshUserGroups = async () => {
    try {
      await utils.sharing.userGroups.invalidate()
    } catch (error) {
      console.error(error)
    }
  }

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
          const addedUser = await addUserToUserGroup.mutateAsync({
            groupId,
            shortnameOrEmail: values.shortnameOrEmail,
            asAdmin: adminMode,
          })

          if (addedUser.user) {
            await refreshUserGroups()
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
          onErrorToast()
        } finally {
          setSubmitting(false)
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
            disabled={loading || isSubmitting}
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
