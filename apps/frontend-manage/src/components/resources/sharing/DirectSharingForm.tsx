import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AccessLevel, CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import useAccessLevelSelection from '../../../lib/hooks/useAccessLevelSelection'

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
    accessLevel,
  }: {
    usernameOrEmail?: string
    userGroupId?: number
    accessLevel: AccessLevel
  }) => Promise<boolean>
}) {
  const t = useTranslations()
  const accessLevelSelectItems = useAccessLevelSelection({ type })

  return (
    <Formik
      isInitialValid={false}
      initialValues={{
        usernameOrEmail: '',
        userGroupId: undefined,
        accessLevel: AccessLevel.Read,
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
            accessLevel: values.accessLevel,
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
          accessLevel: Yup.string().required(),
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
              name="accessLevel"
              id="accessLevel"
              items={accessLevelSelectItems}
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
                  'mt-1 text-green-700 hover:text-green-800',
                  !isValid || isSubmitting
                    ? 'text-gray-500 hover:cursor-not-allowed hover:text-gray-500'
                    : '',
                  isSubmitting && 'hover:cursor-progress'
                ),
              }}
              data={{ cy: 'new-permission-submit' }}
            >
              <FontAwesomeIcon
                icon={faSave}
                className="mt-1 h-[1.1rem] w-[1.1rem]"
              />
            </Button>
          </td>
        </tr>
      )}
    </Formik>
  )
}

export default DirectSharingForm
