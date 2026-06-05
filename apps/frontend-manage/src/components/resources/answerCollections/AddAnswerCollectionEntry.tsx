import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faPlusCircle, faX } from '@fortawesome/free-solid-svg-icons'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import * as Yup from 'yup'
import { trpc, type RouterOutputs } from '../../../lib/trpc'

type AnswerCollectionEntry = NonNullable<
  RouterOutputs['resources']['singleAnswerCollection']['answerCollection']
>['entries'][number]

function AddAnswerCollectionEntry({
  collectionId,
  entries,
  setOptionsEditingDisabled,
  onTouched,
  onUntouched,
  onSuccess,
  inlineEditing,
  refetchAnswerCollections,
}: {
  collectionId: number
  entries: AnswerCollectionEntry[]
  setOptionsEditingDisabled: Dispatch<SetStateAction<boolean>>
  onTouched: () => void
  onUntouched: () => void
  onSuccess: () => void
  inlineEditing: boolean
  refetchAnswerCollections?: () => Promise<any>
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const [fieldOpen, setFieldOpen] = useState(false)
  const addAnswerCollectionOption =
    trpc.resources.addAnswerCollectionOption.useMutation()

  const entryValues = useMemo(
    () => entries.map((entry) => entry.value),
    [entries]
  )

  if (!fieldOpen) {
    return (
      <Button
        fluid
        onClick={() => {
          setFieldOpen(true)
          setOptionsEditingDisabled(true)
          onTouched()
        }}
        className={{ root: 'h-9 py-0' }}
        data={{ cy: 'add-answer-option' }}
      >
        <Button.Icon icon={faPlusCircle} />
        <Button.Label>{t('manage.resources.addAnswerOption')}</Button.Label>
      </Button>
    )
  }

  return (
    <Formik
      validateOnMount
      initialValues={{
        newValue: undefined,
      }}
      initialTouched={{ newValue: true }}
      validationSchema={Yup.object({
        newValue: Yup.string()
          .required(t('manage.resources.valueRequired'))
          .notOneOf(entryValues, t('manage.resources.uniqueValuesRequired')),
      })}
      onSubmit={async (values) => {
        await addAnswerCollectionOption.mutateAsync({
          collectionId,
          value: values.newValue!,
        })

        // if the answer collection is edited inline (in a question context), refetch the selection
        if (inlineEditing) {
          await refetchAnswerCollections?.()
        }

        void utils.resources.answerCollectionsInfo.invalidate()
        void utils.resources.singleAnswerCollection.invalidate({
          id: collectionId,
        })
        setFieldOpen(false)
        setOptionsEditingDisabled(false)
        onSuccess()
      }}
    >
      {({ isValid, isSubmitting }) => (
        <Form className="flex flex-row gap-1">
          <FormikTextField
            name="newValue"
            className={{ input: 'h-9' }}
            data={{ cy: 'input-new-answer-option' }}
          />

          <Button
            primary
            type="submit"
            className={{ root: 'h-9 py-0' }}
            disabled={!isValid}
            loading={isSubmitting}
            data={{ cy: 'save-new-answer-option' }}
          >
            <Button.Icon icon={faSave} loading={isSubmitting} />
            <Button.Label>{t('shared.generic.save')}</Button.Label>
          </Button>
          <Button
            type="button"
            className={{ root: 'h-9 w-9' }}
            data={{ cy: 'abort-adding-answer-option' }}
            onClick={() => {
              setFieldOpen(false)
              setOptionsEditingDisabled(false)
              onUntouched()
            }}
          >
            <Button.Icon withoutLabel icon={faX} />
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AddAnswerCollectionEntry
