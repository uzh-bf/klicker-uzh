import { useQuery } from '@apollo/client'
import {
  GetUserGroupsUserDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  FormikSelectField,
  SelectField,
  TextField,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { prop, sortBy } from 'remeda'
import { twMerge } from 'tailwind-merge'
import usePermissionLevelSelection from '../../../../lib/hooks/usePermissionLevelSelection'
import type { ElementBatchSharingFormValues } from './types'

function ElementBatchSharingCard({ disabled }: { disabled: boolean }) {
  const t = useTranslations()
  const permissionLevelSelectItems = usePermissionLevelSelection({
    type: ObjectType.Element,
  })
  const {
    values,
    errors,
    touched,
    submitCount,
    setFieldTouched,
    setFieldValue,
  } = useFormikContext<ElementBatchSharingFormValues>()
  const { data, loading } = useQuery(GetUserGroupsUserDocument, {
    fetchPolicy: 'cache-and-network',
    skip: !values.enabled,
  })
  const showRecipientError =
    values.enabled &&
    submitCount > 0 &&
    Boolean(errors.shortnameOrEmail ?? errors.userGroupId)

  return (
    <Card
      className={twMerge(
        'gap-1 px-4 py-3',
        values.enabled && 'ring-primary-100 ring-1'
      )}
    >
      <CardHeader className="px-0">
        <CardTitle className="font-normal">
          {t('manage.questionPool.batchSharing')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-start gap-2">
          <Checkbox
            id="element-batch-sharing-enabled"
            checked={values.enabled}
            onCheck={() => {
              void setFieldValue('enabled', !values.enabled)
            }}
            disabled={disabled}
            data={{ cy: 'element-batch-sharing-checkbox' }}
          />
          <label htmlFor="element-batch-sharing-enabled" className="sr-only">
            {t('manage.questionPool.batchSharing')}
          </label>
          <div className="min-w-0 flex-1">
            <div className="mb-3 text-sm text-gray-600">
              {t('manage.questionPool.batchSharingDescription')}
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="element-batch-sharing-user"
                  className="mb-1 block text-sm font-medium"
                >
                  {t('manage.questionPool.batchSharingUserOrEmail')}
                </label>
                <TextField
                  id="element-batch-sharing-user"
                  value={values.shortnameOrEmail}
                  error={errors.shortnameOrEmail}
                  isTouched={touched.shortnameOrEmail}
                  onChange={(shortnameOrEmail) => {
                    void setFieldValue('shortnameOrEmail', shortnameOrEmail)
                    void setFieldValue('userGroupId', undefined)
                    void setFieldTouched('shortnameOrEmail', true, false)
                  }}
                  placeholder={`${t('shared.generic.shortname')} / ${t('shared.generic.email')}`}
                  disabled={disabled || !values.enabled}
                  className={{ input: 'h-8 w-full text-sm' }}
                  data={{
                    cy: 'element-batch-sharing-username-or-email',
                  }}
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="element-batch-sharing-user-group"
                  className="mb-1 block text-sm font-medium"
                >
                  {t('manage.questionPool.batchSharingGroup')}
                </label>
                <SelectField
                  id="element-batch-sharing-user-group"
                  key={`batch-sharing-group-${values.userGroupId}`}
                  disabled={
                    disabled ||
                    !values.enabled ||
                    data?.getUserGroupsUser?.length === 0
                  }
                  placeholder={
                    data?.getUserGroupsUser?.length === 0
                      ? t('manage.sharing.noUserGroupsAvailable')
                      : t('manage.sharing.noUserGroupSelected')
                  }
                  value={values.userGroupId}
                  onChange={(userGroupId) => {
                    void setFieldValue('shortnameOrEmail', '')
                    void setFieldValue('userGroupId', userGroupId)
                    void setFieldTouched('userGroupId', true, false)
                  }}
                  items={
                    loading || !data?.getUserGroupsUser
                      ? []
                      : sortBy(
                          data.getUserGroupsUser.map((group) => ({
                            value: String(group.id),
                            labelString: group.name,
                            label: (
                              <div className="flex items-center gap-2 text-sm">
                                <span>{group.name}</span>
                                <span className="text-gray-600">
                                  {`(${group.numOfMembers} ${t('manage.userGroups.members')})`}
                                </span>
                              </div>
                            ),
                            data: {
                              cy: `element-batch-sharing-group-${group.name}`,
                            },
                          })),
                          prop('labelString')
                        )
                  }
                  className={{
                    root: 'min-w-0 w-full',
                    select: {
                      root: 'min-w-0 w-full',
                      trigger: 'h-8 min-w-0 w-full text-sm',
                    },
                  }}
                  data={{ cy: 'element-batch-sharing-user-group' }}
                />
              </div>
              <div className="min-w-0 xl:col-span-2">
                <label
                  htmlFor="element-batch-sharing-permission-level"
                  className="mb-1 block text-sm font-medium"
                >
                  {t('manage.questionPool.batchSharingPermission')}
                </label>
                <FormikSelectField
                  name="permissionLevel"
                  id="element-batch-sharing-permission-level"
                  items={permissionLevelSelectItems}
                  disabled={disabled || !values.enabled}
                  className={{
                    root: 'min-w-0 w-full',
                    select: {
                      root: 'min-w-0 w-full',
                      trigger: 'h-8 min-w-0 w-full text-sm',
                      item: 'text-sm',
                    },
                  }}
                  data={{
                    cy: 'element-batch-sharing-permission-level',
                  }}
                />
              </div>
              {showRecipientError ? (
                <p role="alert" className="text-sm text-red-700 xl:col-span-2">
                  {errors.shortnameOrEmail ?? errors.userGroupId}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ElementBatchSharingCard
