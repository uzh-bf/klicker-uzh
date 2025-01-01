import {
  faBan,
  faCheck,
  faPlusCircle,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CollectionAccess } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { FieldArray, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import EditorField from '../../activities/creation/EditorField'

function AnswerCollectionCreation({ onClose }: { onClose: () => void }) {
  const t = useTranslations()

  const validationSchema = Yup.object({
    name: Yup.string().required(t('manage.resources.nameRequired')),
    access: Yup.string().required(),
    description: Yup.string().required(
      t('manage.resources.descriptionRequired')
    ),
    entries: Yup.array()
      .of(
        Yup.object().shape({
          value: Yup.string().required(t('manage.resources.valueRequired')),
        })
      )
      .min(2, t('manage.resources.minTwoEntriesRequired')),
  })

  return (
    <div className="mb-6">
      <Formik
        initialValues={{
          name: undefined,
          access: CollectionAccess.Private,
          description: undefined,
          entries: [{ value: undefined }, { value: undefined }],
        }}
        onSubmit={(values) => {
          // TODO: implement submission logic
          console.log(values)
        }}
        validationSchema={validationSchema}
        validateOnMount
      >
        {({ values, errors, isValid, isSubmitting }) => (
          <Form>
            <div className="flex space-x-4">
              <FormikTextField
                required
                name="name"
                label={t('manage.resources.name')}
                tooltip={t('manage.resources.nameTooltip')}
                data={{ cy: 'answer-collection-name' }}
              />
              <FormikSelectField
                required
                name="access"
                label={t('manage.resources.access')}
                tooltip={t('manage.resources.accessTooltip')}
                items={Object.values(CollectionAccess).map((value) => ({
                  value,
                  label: t(`manage.resources.access${value}`),
                }))}
                data={{ cy: 'answer-collection-access' }}
                className={{ select: { trigger: 'h-9 w-40' } }}
              />
            </div>
            <EditorField
              required
              label={t('shared.generic.description')}
              tooltip={t('manage.resources.descriptionTooltip')}
              placeholder={t('manage.resources.descriptionPlaceholder')}
              fieldName="description"
              showToolbarOnFocus={false}
              data={{ cy: 'answer-collection-description' }}
              className={{ root: 'mb-4' }}
            />
            <FieldArray
              name="entries"
              render={({ push, remove }) => (
                <div className="space-y-2">
                  {values.entries.map((_, index) => (
                    <div key={index} className="flex space-x-2">
                      <FormikTextField
                        name={`entries.${index}.value`}
                        label={t('manage.resources.answerEntry', {
                          index: index + 1,
                        })}
                        data={{ cy: `response-entry-${index}` }}
                      />
                      <Button
                        onClick={() => remove(index)}
                        data={{ cy: `remove-response-entry-${index}` }}
                        className={{
                          root: 'flex h-9 w-9 items-center justify-center self-end border-red-600',
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faTrashCan}
                          className="text-red-600"
                        />
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() => push({ value: undefined })}
                    className={{ root: 'w-full' }}
                    data={{ cy: 'add-response-entry' }}
                  >
                    <FontAwesomeIcon icon={faPlusCircle} />
                    {t('manage.resources.addValue')}
                  </Button>
                </div>
              )}
            />
            {errors && typeof errors.entries === 'string' ? (
              <UserNotification
                type="error"
                message={t('manage.resources.minTwoEntriesRequired')}
                className={{ root: 'mt-2 text-base' }}
              />
            ) : null}
            <div className="mt-3 flex w-full flex-row justify-between">
              <Button className={{ root: 'border-red-400' }} onClick={onClose}>
                <FontAwesomeIcon icon={faBan} />
                {t('shared.generic.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!isValid}
                loading={isSubmitting}
                className={{ root: 'border-green-700' }}
              >
                <FontAwesomeIcon icon={faCheck} />
                {t('shared.generic.create')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  )
}

export default AnswerCollectionCreation
