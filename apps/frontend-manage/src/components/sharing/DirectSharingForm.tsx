import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  PermissionLevel,
  SharingObjectType,
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
import usePermissionLevelSelection from '../../lib/hooks/usePermissionLevelSelection'

function DirectSharingForm({
  type,
  onSuccess,
  onFailure,
  shareObjectCallback,
}: {
  type: SharingObjectType
  onSuccess: () => void
  onFailure: () => void
  shareObjectCallback: ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
  }) => Promise<boolean>
}) {
  const t = useTranslations()
  const permissionLevelSelectItems = usePermissionLevelSelection({ type })

  return (
    <Formik
      validateOnChange
      isInitialValid={false}
      initialValues={{
        shortnameOrEmail: '',
        userGroupId: undefined,
        permissionLevel: PermissionLevel.Read,
      }}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true)

        if (
          typeof values.userGroupId !== 'undefined' ||
          (typeof values.shortnameOrEmail !== 'undefined' &&
            values.shortnameOrEmail !== '')
        ) {
          const success = await shareObjectCallback({
            shortnameOrEmail: values.shortnameOrEmail,
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
      validationSchema={Yup.object().shape({
        shortnameOrEmail: Yup.string().test(
          'either-shortname-or-group',
          t('manage.sharing.shortnameEmailOrGroupRequired'),
          function (value) {
            // if userGroupId exists in the parent, this field can be empty
            return this.parent.userGroupId || (!!value && value !== '')
          }
        ),
        userGroupId: Yup.number().test(
          'either-group-or-shortname',
          t('manage.sharing.shortnameEmailOrGroupRequired'),
          function (value) {
            // if shortnameOrEmail exists in the parent, this field can be empty
            return (
              (!!this.parent.shortnameOrEmail &&
                this.parent.shortnameOrEmail !== '') ||
              !!value
            )
          }
        ),
        permissionLevel: Yup.string().required(),
      })}
    >
      {({ isSubmitting, isValid, submitForm }) => (
        <tr className="border-t border-gray-200 hover:bg-gray-50">
          <td className="px-4 py-3 text-sm text-gray-900">
            <FormikTextField
              name="shortnameOrEmail"
              placeholder={
                t('shared.generic.shortname') +
                ' / ' +
                t('shared.generic.email')
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
              placeholder={t('manage.sharing.noUserGroupSelected')}
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
          <td className="w-40 px-4 py-1.5 text-sm text-gray-900">
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
