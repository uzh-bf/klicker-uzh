import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  AnswerCollection,
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
}: {
  collection: AnswerCollection
  onSuccess: () => void
  metadataTouched: boolean
  setMetadataTouched: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [modifyAnswerCollection] = useMutation(ModifyAnswerCollectionDocument)

  return (
    <Formik
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
