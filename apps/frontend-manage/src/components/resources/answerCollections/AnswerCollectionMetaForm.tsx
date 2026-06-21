import { faSave } from '@fortawesome/free-regular-svg-icons'
import { Button, FormikTextField, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import * as Yup from 'yup'
import { trpc, type RouterOutputs } from '../../../lib/trpc'
import EditorField from '../../activities/creation/EditorField'
import TouchMonitor from './TouchMonitor'

type AnswerCollection = NonNullable<
  RouterOutputs['resources']['singleAnswerCollection']['answerCollection']
>

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
  const utils = trpc.useUtils()
  const modifyAnswerCollection =
    trpc.resources.modifyAnswerCollection.useMutation()
  const refreshInlineAnswerCollections = () => {
    if (inlineEditing && refetchAnswerCollections) {
      void refetchAnswerCollections().catch(console.error)
    }
  }
  const invalidateAnswerCollection = () => {
    void utils.resources.answerCollectionsInfo.invalidate().catch(console.error)
    void utils.resources.singleAnswerCollection
      .invalidate({ id: collection.id })
      .catch(console.error)
  }
  const showErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })

  return (
    <Formik
      enableReinitialize
      initialValues={{
        name: collection.name,
        description: collection.description,
      }}
      onSubmit={async (values, { resetForm }) => {
        try {
          const res = await modifyAnswerCollection.mutateAsync({
            id: collection.id,
            name: values.name !== collection.name ? values.name : undefined,
            description:
              values.description !== collection.description
                ? values.description
                : undefined,
          })

          if (!res.answerCollection?.id) {
            showErrorToast()
            return
          }

          refreshInlineAnswerCollections()
          invalidateAnswerCollection()
          onSuccess()
          resetForm()
        } catch (error) {
          console.error('Error updating answer collection metadata:', error)
          showErrorToast()
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
            disabled={!isValid || isSubmitting}
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
