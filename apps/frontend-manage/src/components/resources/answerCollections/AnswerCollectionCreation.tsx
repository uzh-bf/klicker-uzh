import { useMutation } from '@apollo/client'
import {
  faBan,
  faCheck,
  faPlusCircle,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CollectionAccess,
  CreateAnswerCollectionDocument,
  GetAnswerCollectionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { FieldArray, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import EditorField from '../../activities/creation/EditorField'
import AnswerCollectionAccessSelection from './AnswerCollectionAccessSelection'
import AnswerCollectionCatalogSelection from './AnswerCollectionCatalogSelection'

type AnswerCollectionFormValues = {
  name?: string
  access: CollectionAccess
  description?: string
  entries: { value?: string }[]
}

function AnswerCollectionCreation({
  onClose,
  openSuccessToast,
  openErrorToast,
}: {
  onClose: () => void
  openSuccessToast: () => void
  openErrorToast: () => void
}) {
  const t = useTranslations()
  const [createAnswerCollection] = useMutation(CreateAnswerCollectionDocument)

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
      <Formik
        initialValues={{
          name: undefined,
          access: CollectionAccess.Private,
          catalogCollectionId: '',
          description: undefined,
          entries: [{ value: undefined }, { value: undefined }],
        }}
        onSubmit={async (values: AnswerCollectionFormValues) => {
          const { data } = await createAnswerCollection({
            variables: {
              name: values.name!,
              description: values.description!,
              access: values.access,
              answers: values.entries.map((entry) => entry.value!),
            },
            update: (cache, { data }) => {
              if (!data?.createAnswerCollection) return

              const queryData = cache.readQuery({
                query: GetAnswerCollectionsDocument,
              })
              const previousCollections = queryData?.getAnswerCollections
              if (!previousCollections) return

              cache.writeQuery({
                query: GetAnswerCollectionsDocument,
                data: {
                  getAnswerCollections: [
                    ...previousCollections,
                    data.createAnswerCollection,
                  ],
                },
              })
            },
          })

          if (data?.createAnswerCollection?.id) {
            onClose()
            openSuccessToast()
          } else {
            openErrorToast()
          }
        }}
        validationSchema={validationSchema}
        validateOnMount
      >
        {({ values, errors, isValid, isSubmitting }) => (
          <Form>
            <div className="mb-1 flex space-x-4">
              <FormikTextField
                required
                name="name"
                label={t('manage.resources.name')}
                tooltip={t('manage.resources.nameTooltip')}
                data={{ cy: 'answer-collection-name' }}
              />
              <AnswerCollectionAccessSelection />
            </div>
            {values.access !== CollectionAccess.Private ? (
              <AnswerCollectionCatalogSelection />
            ) : null}
            {typeof values.access !== 'undefined' ? (
              <UserNotification
                message={t(`manage.resources.infoAccess${values.access}`)}
                className={{ root: 'my-2' }}
              />
            ) : null}
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
              <Button
                className={{ root: 'h-8 border-red-400' }}
                onClick={onClose}
                data={{ cy: 'cancel-create-answer-collection' }}
              >
                <FontAwesomeIcon icon={faBan} />
                {t('shared.generic.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!isValid}
                loading={isSubmitting}
                className={{ root: 'h-8 border-green-700' }}
                data={{ cy: 'submit-create-answer-collection' }}
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
