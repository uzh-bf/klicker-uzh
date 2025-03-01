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

function AnswerCollectionMetaForm({
  collection,
  setSuccessToast,
}: {
  collection: AnswerCollection
  setSuccessToast: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [modifyAnswerCollection] = useMutation(ModifyAnswerCollectionDocument)

  return (
    <Formik
      initialValues={{
        name: collection.name,
        description: collection.description,
      }}
      onSubmit={async (values) => {
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
          setSuccessToast(true)
        }
      }}
      validationSchema={Yup.object({
        name: Yup.string().required(t('manage.resources.nameRequired')),
        description: Yup.string().required(
          t('manage.resources.descriptionRequired')
        ),
      })}
    >
      {({ isValid, isSubmitting }) => (
        <Form className="flex flex-col">
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
            <Button.Icon icon={faSave} />
            <Button.Label>{t('manage.resources.saveChanges')}</Button.Label>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AnswerCollectionMetaForm
