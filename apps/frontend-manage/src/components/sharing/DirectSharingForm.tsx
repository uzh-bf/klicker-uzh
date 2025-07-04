import { useQuery } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  GetUserGroupsUserDocument,
  ObjectType,
  PermissionLevel,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikSwitchField,
  SelectField,
  TextField,
  toast,
} from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { prop, sortBy } from 'remeda'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import usePermissionLevelSelection from '../../lib/hooks/usePermissionLevelSelection'

function DirectSharingForm({
  type,
  showPropagationSetting,
  shareObjectCallback,
}: {
  type: ObjectType
  showPropagationSetting: boolean
  shareObjectCallback: ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
    propagation,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
    propagation: boolean
  }) => Promise<boolean>
}) {
  const t = useTranslations()
  const permissionLevelSelectItems = usePermissionLevelSelection({ type })
  const { data, loading } = useQuery(GetUserGroupsUserDocument, {
    fetchPolicy: 'cache-and-network',
  })

  // fetch own user to disable sharing with self
  const { data: user } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const onFailure = () =>
    toast({
      type: 'error',
      message: t('manage.sharing.sharingFailed'),
      options: { duration: 3000 },
    })

  return (
    <Formik
      validateOnChange={false}
      isInitialValid={false}
      initialValues={{
        shortnameOrEmail: '',
        userGroupId: undefined,
        permissionLevel: PermissionLevel.Read,
        propagation: false,
      }}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true)

        if (
          typeof values.userGroupId !== 'undefined' ||
          (typeof values.shortnameOrEmail !== 'undefined' &&
            values.shortnameOrEmail !== '')
        ) {
          const success = await shareObjectCallback({
            shortnameOrEmail:
              typeof values.shortnameOrEmail !== 'undefined' &&
              values.shortnameOrEmail !== ''
                ? values.shortnameOrEmail
                : undefined,
            userGroupId:
              typeof values.userGroupId !== 'undefined'
                ? parseInt(values.userGroupId)
                : undefined,
            permissionLevel: values.permissionLevel,
            propagation: values.propagation,
          })

          if (success) {
            resetForm()
            setSubmitting(false)
          }
        } else {
          onFailure()
          setSubmitting(false)
        }
      }}
      validationSchema={Yup.object().shape({
        shortnameOrEmail: Yup.string()
          .test(
            'either-shortname-or-group',
            t('manage.sharing.shortnameEmailOrGroupRequired'),
            function (value) {
              // if userGroupId exists in the parent, this field can be empty
              return this.parent.userGroupId || (!!value && value !== '')
            }
          )
          .test(
            'not-self',
            t('manage.sharing.noSelfSharing'),
            function (value) {
              // check if the user is trying to share with themselves
              if (value && user?.userProfile) {
                return (
                  value.toLowerCase() !==
                  user.userProfile.shortname.toLowerCase()
                )
              }
              return true
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
        propagation: Yup.boolean(),
      })}
    >
      {({
        values,
        errors,
        touched,
        isSubmitting,
        isValid,
        setFieldValue,
        setFieldTouched,
        submitForm,
        validateForm,
      }) => (
        <tr className="border-t border-gray-200 hover:bg-gray-50">
          <td className="px-4 py-3 text-sm text-gray-900">
            <TextField
              value={values.shortnameOrEmail || ''}
              error={errors.shortnameOrEmail}
              isTouched={touched.shortnameOrEmail}
              onChange={(newValue) => {
                setFieldValue('shortnameOrEmail', newValue)
                setFieldValue('userGroupId', undefined)
                setFieldTouched('shortnameOrEmail', true)

                // manually trigger form re-validation (otherwise lacks one step behind)
                setTimeout(() => {
                  validateForm()
                }, 0)
              }}
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
            <SelectField
              key={`userGroupId-${values.userGroupId}`}
              disabled={isSubmitting || data?.getUserGroupsUser?.length === 0}
              placeholder={
                data?.getUserGroupsUser?.length === 0
                  ? t('manage.sharing.noUserGroupsAvailable')
                  : t('manage.sharing.noUserGroupSelected')
              }
              value={values.userGroupId}
              onChange={(newValue) => {
                setFieldValue('userGroupId', newValue)
                setFieldValue('shortnameOrEmail', '')

                // manually trigger form re-validation (otherwise lacks one step behind)
                setTimeout(() => {
                  validateForm()
                }, 0)
              }}
              items={
                loading || !data?.getUserGroupsUser
                  ? []
                  : sortBy(
                      data.getUserGroupsUser.map((group) => ({
                        value: String(group.id),
                        labelString: group.name,
                        label: (
                          <div className="flex flex-row items-center gap-2 text-sm">
                            <span>{group.name}</span>
                            <span className="mr-5 text-gray-600">{`(${group.numOfMembers} ${t('manage.userGroups.members')})`}</span>
                          </div>
                        ),
                        data: { cy: `user-group-${group.name}` },
                      })),
                      prop('labelString')
                    )
              }
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
                  item: 'text-sm',
                },
              }}
              data={{ cy: 'new-permission-access-level' }}
            />
          </td>
          {showPropagationSetting ? (
            <td className="w-24 text-center">
              <FormikSwitchField
                name="propagation"
                size="sm"
                disabled={isSubmitting}
                data={{ cy: 'new-permission-propagation' }}
                className={{ root: 'justify-center' }}
              />
            </td>
          ) : null}
          <td className="w-10 text-center">
            <Button
              basic
              type="button"
              onClick={() => submitForm()}
              primary={isValid}
              disabled={!isValid}
              className={{
                root: twMerge(
                  'px-2 py-2 hover:text-white',
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
