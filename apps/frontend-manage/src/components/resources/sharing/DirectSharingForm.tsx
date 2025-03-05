import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  CatalogObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import usePermissionLevelSelection from '../../../lib/hooks/usePermissionLevelSelection'

function DirectSharingForm({
  type,
  onSuccess,
  onFailure,
  shareObjectCallback,
}: {
  type: CatalogObjectType
  onSuccess: () => void
  onFailure: () => void
  shareObjectCallback: ({
    usernameOrEmail,
    userGroupId,
    permissionLevel,
  }: {
    usernameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
  }) => Promise<boolean>
}) {
  const t = useTranslations()
  const permissionLevelSelectItems = usePermissionLevelSelection({ type })

  return (
    <Formik
      isInitialValid={false}
      initialValues={{
        usernameOrEmail: '',
        userGroupId: undefined,
        permissionLevel: PermissionLevel.Read,
      }}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true)

        if (
          typeof values.userGroupId !== 'undefined' ||
          (typeof values.usernameOrEmail !== 'undefined' &&
            values.usernameOrEmail !== '')
        ) {
          const success = await shareObjectCallback({
            usernameOrEmail: values.usernameOrEmail,
            userGroupId: values.userGroupId,
            permissionLevel: values.permissionLevel,
          })

          if (success) {
            resetForm()
            onSuccess()
            setSubmitting(false)
          } else {
            onFailure()
            setSubmitting(false)
          }
        } else {
          onFailure()
          setSubmitting(false)
        }
      }}
      validationSchema={Yup.object()
        .shape({
          usernameOrEmail: Yup.string(),
          userGroupId: Yup.number(),
          permissionLevel: Yup.string().required(),
        })
        .test(
          'either-user-or-group',
          t('manage.resources.usernameEmailOrGroupRequired'),
          function (values) {
            const { usernameOrEmail, userGroupId } = values
            return (
              (!!usernameOrEmail && usernameOrEmail !== '') || !!userGroupId
            )
          }
        )}
    >
      {({ values, isSubmitting, isValid, submitForm }) => (
        <tr className="border-t border-gray-200 hover:bg-gray-50">
          <td className="px-4 py-3 text-sm text-gray-900">
            <FormikTextField
              name="usernameOrEmail"
              placeholder={
                t('shared.generic.username') + ' / ' + t('shared.generic.email')
              }
              disabled={isSubmitting}
              className={{
                input: 'h-7 w-full text-sm text-gray-900',
              }}
              data={{ cy: 'new-permission-username-or-email' }}
            />
          </td>
          <td className="px-4 py-3 text-sm text-gray-900">
            <FormikSelectField
              name="userGroupId"
              id="userGroupId"
              placeholder={t('manage.resources.noUserGroupSelected')}
              items={[]} // TODO: query and add available user groups
              disabled={isSubmitting}
              className={{
                select: {
                  trigger: 'h-7 text-sm text-gray-900',
                },
              }}
              data={{ cy: 'new-permission-user-group' }}
            />
          </td>
          <td className="px-4 py-1.5 text-sm text-gray-900">
            <FormikSelectField
              name="permissionLevel"
              id="permissionLevel"
              items={permissionLevelSelectItems}
              disabled={isSubmitting}
              className={{
                select: {
                  trigger: 'h-7 text-sm text-gray-900',
                },
              }}
              data={{ cy: 'new-permission-access-level' }}
            />
          </td>
          <td className="w-10 text-center">
            <Button
              basic
              type="button"
              onClick={() => submitForm()}
              disabled={!isValid || isSubmitting}
              className={{
                root: twMerge(
                  'px-2 py-2 text-green-700 hover:text-green-800',
                  isSubmitting && 'hover:cursor-progress'
                ),
              }}
              data={{ cy: 'new-permission-submit' }}
            >
              <Button.Icon withoutLabel icon={faSave} />
            </Button>
          </td>
        </tr>
      )}
    </Formik>
  )
}

export default DirectSharingForm
