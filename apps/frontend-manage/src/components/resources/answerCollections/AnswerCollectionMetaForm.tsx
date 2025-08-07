import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  AnswerCollection,
  GetSingleAnswerCollectionDocument,
  ModifyAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import * as Yup from 'yup'
import EditorField from '../../activities/creation/EditorField'
import TouchMonitor from './TouchMonitor'

function AnswerCollectionMetaForm({
  collection,
  onSuccess,
  metadataTouched,
  setMetadataTouched,
  inlineEditing,
  refetchAnswerCollections,
}: {
  collection: AnswerCollection
  onSuccess: () => void
  metadataTouched: boolean
  setMetadataTouched: Dispatch<SetStateAction<boolean>>
  inlineEditing: boolean
  refetchAnswerCollections?: () => Promise<any>
}) {
  const t = useTranslations()
  // TODO: add query update
  const [modifyAnswerCollection] = useMutation(ModifyAnswerCollectionDocument, {
    update: (cache, { data }) => {
      if (data?.modifyAnswerCollection) {
        const updatedCollection = data.modifyAnswerCollection
        cache.updateQuery(
          {
            query: GetSingleAnswerCollectionDocument,
            variables: { id: updatedCollection.id },
          },
          (existingData) => {
            if (!existingData) return null

            return {
              ...existingData,
              getSingleAnswerCollection: {
                ...existingData.getSingleAnswerCollection,
                id: collection.id,
                name: updatedCollection.name,
                description: updatedCollection.description,
              },
            }
          }
        )
      }
    },
  })

  return (
    <Formik
      enableReinitialize
      initialValues={{
        name: collection.name,
        description: collection.description,
      }}
      onSubmit={async (values, { resetForm }) => {
        const { data } = await modifyAnswerCollection({
          variables: {
            id: collection.id,
            name: values.name !== collection.name ? values.name : undefined,
            description:
              values.description !== collection.description
                ? values.description
                : undefined,
          },
        })

        if (data?.modifyAnswerCollection?.id) {
          // if the answer collection is edited inline (in a question context), refetch the selection
          if (inlineEditing) {
            await refetchAnswerCollections?.()
          }

          onSuccess()
          resetForm()
        }
      }}
      validationSchema={Yup.object({
        name: Yup.string().required(t('manage.resources.nameRequired')),
        description: Yup.string().required(
          t('manage.resources.descriptionRequired')
        ),
      })}
    >
      {({ touched, isValid, isSubmitting }) => (
        <Form className="flex flex-col">
          <TouchMonitor
            touched={Object.values(touched).some((t) => t)}
            stateValue={metadataTouched}
            setState={setMetadataTouched}
          />
          <FormikTextField
            required
            name="name"
            label={t('manage.resources.name')}
            tooltip={t('manage.resources.nameTooltip')}
            data={{ cy: 'answer-collection-name' }}
            className={{ label: 'text-base' }}
          />
          <EditorField
            required
            label={t('shared.generic.description')}
            tooltip={t('manage.resources.descriptionTooltip')}
            placeholder={t('manage.resources.descriptionPlaceholder')}
            fieldName="description"
            showToolbarOnFocus={false}
            data={{ cy: 'answer-collection-description' }}
            className={{ root: 'mb-3 mt-1.5', label: 'text-base' }}
          />
          <Button
            primary
            type="submit"
            disabled={!isValid}
            loading={isSubmitting}
            className={{
              root: 'self-end',
            }}
            data={{ cy: 'save-changes-answer-collection' }}
          >
            <Button.Icon icon={faSave} loading={isSubmitting} />
            <Button.Label>{t('manage.resources.saveMetadata')}</Button.Label>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AnswerCollectionMetaForm
