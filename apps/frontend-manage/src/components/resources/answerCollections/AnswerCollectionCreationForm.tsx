import { useMutation } from '@apollo/client'
import {
  faBan,
  faCheck,
  faPlusCircle,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import {
  CreateAnswerCollectionDocument,
  GetAnswerCollectionsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  H3,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { FieldArray, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import EditorField from '../../activities/creation/EditorField'

type AnswerCollectionFormValues = {
  name?: string
  description?: string
  entries: { clientId: string; value?: string }[]
}

let nextAnswerCollectionEntryClientId = 0

function createAnswerCollectionEntryClientId(): string {
  return `entry-${nextAnswerCollectionEntryClientId++}`
}

function AnswerCollectionCreationForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations()
  const [createAnswerCollection] = useMutation(CreateAnswerCollectionDocument)

  const validationSchema = Yup.object({
    name: Yup.string().required(t('manage.resources.nameRequired')),
    description: Yup.string().required(
      t('manage.resources.descriptionRequired')
    ),
    entries: Yup.array()
      .of(
        Yup.object().shape({
          value: Yup.string().required(t('manage.resources.valueRequired')),
        })
      )
      .min(2, t('manage.resources.minTwoEntriesRequired'))
      .test(
        'unique',
        t('manage.resources.uniqueValuesRequired'),
        function (arr) {
          if (!arr) return true
          const values = arr.map((item) => item.value)
          const uniqueValues = new Set(values)
          return values.length === uniqueValues.size
        }
      ),
  })

  return (
    <div className="mb-6">
      <H3>{t('manage.resources.createAnswerCollection')}</H3>
      <Formik
        initialValues={{
          name: undefined,
          description: undefined,
          entries: [
            {
              clientId: createAnswerCollectionEntryClientId(),
              value: undefined,
            },
            {
              clientId: createAnswerCollectionEntryClientId(),
              value: undefined,
            },
          ],
        }}
        onSubmit={async (values: AnswerCollectionFormValues) => {
          const { data } = await createAnswerCollection({
            variables: {
              name: values.name!,
              description: values.description!,
              answers: values.entries.map((entry) => entry.value!),
            },
            update: (cache, { data }) => {
              // check if the creation was successful
              if (!data?.createAnswerCollection) return

              cache.updateQuery(
                { query: GetAnswerCollectionsInfoDocument },
                (qData) => {
                  if (!qData?.getAnswerCollectionsInfo) return qData

                  return {
                    getAnswerCollectionsInfo: [
                      ...qData.getAnswerCollectionsInfo,
                      data.createAnswerCollection!,
                    ],
                  }
                }
              )
            },
          })

          if (data?.createAnswerCollection?.id) {
            toast({
              type: 'success',
              message: t('manage.resources.collectionCreationSuccess'),
              options: { duration: 3000 },
            })
            onClose()
          } else {
            toast({
              type: 'error',
              message: t('manage.resources.collectionCreationError'),
              options: { duration: 10000 },
            })
          }
        }}
        validationSchema={validationSchema}
        validateOnMount
      >
        {({ values, errors, isValid, isSubmitting }) => (
          <Form>
            <FormikTextField
              required
              name="name"
              label={t('manage.resources.name')}
              tooltip={t('manage.resources.nameTooltip')}
              data={{ cy: 'answer-collection-name' }}
            />
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
                  {values.entries.map((entry, index) => (
                    <div key={entry.clientId} className="flex space-x-2">
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
                          root: 'h-9 w-9 self-end border-red-600 text-red-600 hover:text-red-600',
                        }}
                      >
                        <Button.Icon withoutLabel icon={faTrashCan} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() =>
                      push({
                        clientId: createAnswerCollectionEntryClientId(),
                        value: undefined,
                      })
                    }
                    className={{ root: 'w-full' }}
                    data={{ cy: 'add-response-entry' }}
                  >
                    <Button.Icon icon={faPlusCircle} />
                    <Button.Label>
                      {t('manage.resources.addValue')}
                    </Button.Label>
                  </Button>
                </div>
              )}
            />
            {errors && typeof errors.entries === 'string' ? (
              <UserNotification
                type="error"
                message={errors.entries}
                className={{ root: 'mt-2 text-base' }}
              />
            ) : null}
            <div className="mt-3 flex w-full flex-row justify-between">
              <Button
                className={{ root: 'h-8 border-red-400' }}
                onClick={onClose}
                data={{ cy: 'cancel-create-answer-collection' }}
              >
                <Button.Icon icon={faBan} />
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                type="submit"
                disabled={!isValid}
                loading={isSubmitting}
                className={{ root: 'h-8 border-green-700' }}
                data={{ cy: 'submit-create-answer-collection' }}
              >
                <Button.Icon icon={faCheck} loading={isSubmitting} />
                <Button.Label>{t('shared.generic.create')}</Button.Label>
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  )
}

export default AnswerCollectionCreationForm
