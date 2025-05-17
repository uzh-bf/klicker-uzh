import { ObjectAccess, ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { SelectField, UserNotification } from '@uzh-bf/design-system'
import { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { CatalogObjectAdditionFormValues } from './AddObjectToCatalogModal'
import ObjectAccessSelection from './ObjectAccessSelection'

function ObjectTypeSelection({
  accessValue,
  objectTypeValue,
  setFieldValue,
}: {
  accessValue: ObjectAccess
  objectTypeValue?: ObjectType
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<CatalogObjectAdditionFormValues>>
}) {
  const t = useTranslations()

  // for templates the default object access type is public
  useEffect(() => {
    if (objectTypeValue === ObjectType.LiveQuiz) {
      setFieldValue('access', ObjectAccess.Public)
    } else {
      setFieldValue('access', ObjectAccess.Restricted)
    }
  }, [objectTypeValue, setFieldValue])

  return (
    <div>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-1/2">
          <SelectField
            required
            value={objectTypeValue}
            onChange={(value) => {
              setFieldValue('objectType', value)

              // regarding activities, only activity templates are supported for sharing through the catalog
              if (
                value === ObjectType.LiveQuiz ||
                value === ObjectType.PracticeQuiz ||
                value === ObjectType.MicroLearning ||
                value === ObjectType.GroupActivity
              ) {
                setFieldValue('isTemplate', true)
              }
            }}
            label={t('manage.catalog.objectType')}
            tooltip={t('manage.catalog.objectTypeTooltip')}
            placeholder={t('manage.catalog.selectObjectType')}
            items={Object.values(ObjectType)
              .filter(
                (type) =>
                  type === ObjectType.AnswerCollection ||
                  type === ObjectType.Element ||
                  type === ObjectType.LiveQuiz
              )
              .map((objectType) => ({
                value: objectType,
                label: t(
                  objectType === ObjectType.LiveQuiz
                    ? `shared.types.${objectType}_TEMPLATE`
                    : `shared.types.${objectType}`
                ),
                data: { cy: `object-type-${objectType}` },
              }))}
            data={{ cy: 'object-type-selection' }}
            className={{ select: { trigger: 'h-9' } }}
          />
        </div>
        <div className="w-full md:w-1/2">
          <ObjectAccessSelection
            cyPrefix="modal"
            // TODO: remove this constraint, once templates also support sharing and restricted access
            restrictedDisabled={objectTypeValue === ObjectType.LiveQuiz}
            value={accessValue}
            onChange={(value) => setFieldValue('access', value)}
          />
        </div>
      </div>
      <UserNotification
        message={t(`manage.catalog.infoAccess${accessValue}`)}
        className={{ root: 'mt-3' }}
      />
    </div>
  )
}

export default ObjectTypeSelection
