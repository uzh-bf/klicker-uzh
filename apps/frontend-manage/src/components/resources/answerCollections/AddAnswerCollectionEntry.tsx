import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import {
  AddAnswerCollectionOptionDocument,
  AnswerCollectionEntry,
  GetAnswerCollectionsInfoDocument,
  GetSingleAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import * as Yup from 'yup'

function AddAnswerCollectionEntry({
  collectionId,
  entries,
  setOptionsEditingDisabled,
}: {
  collectionId: number
  entries: AnswerCollectionEntry[]
  setOptionsEditingDisabled: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [fieldOpen, setFieldOpen] = useState(false)
  const [addAnswerCollectionOption] = useMutation(
    AddAnswerCollectionOptionDocument
  )

  const entryValues = useMemo(
    () => entries.map((entry) => entry.value),
    [entries]
  )

  if (!fieldOpen) {
    return (
      <Button
        onClick={() => {
          setFieldOpen(true)
          setOptionsEditingDisabled(true)
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
        await addAnswerCollectionOption({
          variables: {
            collectionId,
            value: values.newValue!,
          },
          update: (cache, { data }) => {
            if (!data?.addAnswerCollectionOption) return

            // update the currently displayed collection
            const collectionQuery = cache.readQuery({
              query: GetSingleAnswerCollectionDocument,
              variables: {
                id: collectionId,
              },
            })
            const collection = collectionQuery?.getSingleAnswerCollection
            if (!collection) return

            cache.writeQuery({
              query: GetSingleAnswerCollectionDocument,
              variables: {
                id: collectionId,
              },
              data: {
                getSingleAnswerCollection: {
                  ...collection,
                  entries: [
                    ...(collection.entries ?? []),
                    data.addAnswerCollectionOption!,
                  ],
                },
              },
            })
          },
          refetchQueries: [GetAnswerCollectionsInfoDocument],
        })
        setFieldOpen(false)
        setOptionsEditingDisabled(false)
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
            <Button.Icon icon={faSave} />
            <Button.Label>{t('shared.generic.save')}</Button.Label>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AddAnswerCollectionEntry
