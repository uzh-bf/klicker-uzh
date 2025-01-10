import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AddAnswerCollectionOptionDocument,
  AnswerCollectionEntry,
  GetAnswerCollectionsDocument,
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
        className={{ root: 'w-full' }}
        onClick={() => {
          setFieldOpen(true)
          setOptionsEditingDisabled(true)
        }}
        data={{ cy: 'add-answer-option' }}
      >
        <FontAwesomeIcon icon={faPlusCircle} className="mr-1" />
        {t('manage.resources.addAnswerOption')}
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

            const queryData = cache.readQuery({
              query: GetAnswerCollectionsDocument,
            })
            const previousCollections =
              queryData?.getAnswerCollections?.answerCollections
            if (!previousCollections) return

            cache.writeQuery({
              query: GetAnswerCollectionsDocument,
              data: {
                getAnswerCollections: {
                  requestedCollections:
                    queryData.getAnswerCollections?.requestedCollections ?? [],
                  sharedCollections:
                    queryData.getAnswerCollections?.sharedCollections ?? [],
                  answerCollections: previousCollections.map((collection) => {
                    if (collection.id === collectionId) {
                      return {
                        ...collection,
                        entries: [
                          ...(collection.entries ?? []),
                          data.addAnswerCollectionOption!,
                        ],
                      }
                    }

                    return collection
                  }),
                },
              },
            })
          },
        })
        setFieldOpen(false)
        setOptionsEditingDisabled(false)
      }}
    >
      {({ isValid, isSubmitting }) => (
        <Form className="flex flex-row gap-1">
          <FormikTextField
            name="newValue"
            className={{ input: 'h-8' }}
            data={{ cy: 'input-new-answer-option' }}
          />
          <Button
            type="submit"
            className={{ root: 'border-primary-80 h-8' }}
            disabled={!isValid}
            loading={isSubmitting}
            data={{ cy: 'save-new-answer-option' }}
          >
            <FontAwesomeIcon icon={faSave} className="mr-0.5" />
            <div className="w-max">{t('shared.generic.save')}</div>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default AddAnswerCollectionEntry
