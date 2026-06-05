import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPencil, faSave, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import { trpc, type RouterOutputs } from '../../../lib/trpc'

type AnswerCollectionEntry = NonNullable<
  RouterOutputs['resources']['singleAnswerCollection']['answerCollection']
>['entries'][number]

function AnswerCollectionOption({
  entry,
  otherEntries,
  last,
  collectionId,
  deletionDisabled,
  editDisabled,
  setEditDisabled,
  onTouched,
  onSuccess,
  inlineEditing,
  refetchAnswerCollections,
}: {
  entry: AnswerCollectionEntry
  otherEntries: string[]
  last: boolean
  collectionId: number
  deletionDisabled?: boolean
  editDisabled: boolean
  setEditDisabled: Dispatch<SetStateAction<boolean>>
  onTouched: () => void
  onSuccess: () => void
  inlineEditing: boolean
  refetchAnswerCollections?: () => Promise<any>
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const [editMode, setEditMode] = useState(false)
  const editAnswerCollectionEntry =
    trpc.resources.editAnswerCollectionEntry.useMutation()
  const deleteAnswerCollectionEntry =
    trpc.resources.deleteAnswerCollectionEntry.useMutation()
  const deletionNotAllowed =
    deletionDisabled || (entry.numSolutionUsages ?? 0) > 0

  return (
    <div
      className={twMerge(
        'flex w-full flex-row items-center gap-1 border-b pb-1',
        last && 'border-b-0!'
      )}
    >
      <Button
        className={{
          root: twMerge(
            'h-8 w-8 items-center justify-center border border-red-600'
          ),
        }}
        disabled={deletionNotAllowed}
        data={{ cy: `delete-answer-option-${entry.value}` }}
        onClick={async () => {
          await deleteAnswerCollectionEntry.mutateAsync({
            id: entry.id,
            collectionId,
          })

          // if the answer collection is edited inline (in a question context), refetch the selection
          if (inlineEditing) {
            await refetchAnswerCollections?.()
          }

          void utils.resources.answerCollectionsInfo.invalidate()
          void utils.resources.singleAnswerCollection.invalidate({
            id: collectionId,
          })
          onSuccess()
        }}
      >
        <Button.Icon withoutLabel icon={faTrashCan} />
      </Button>
      {!editMode ? (
        <Button
          className={{
            root: 'border-primary-80 hover:border-primary-80 h-8 w-8',
          }}
          onClick={() => {
            setEditMode(true)
            setEditDisabled(true)
            onTouched()
          }}
          disabled={editDisabled}
          data={{ cy: `edit-answer-option-${entry.value}` }}
        >
          <Button.Icon withoutLabel icon={faPencil} />
        </Button>
      ) : null}
      <div
        className={twMerge('w-full', !editMode && 'ml-2')}
        data-cy={`answer-option-${entry.value}`}
      >
        {editMode ? (
          <Formik
            isInitialValid
            initialValues={{ value: entry.value }}
            validationSchema={Yup.object({
              value: Yup.string()
                .required(t('manage.resources.valueRequired'))
                .notOneOf(
                  otherEntries,
                  t('manage.resources.uniqueValuesRequired')
                ),
            })}
            initialTouched={{ value: true }}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)

              if (entry.value !== values.value) {
                await editAnswerCollectionEntry.mutateAsync({
                  id: entry.id,
                  value: values.value,
                  collectionId,
                })
              }

              void utils.resources.singleAnswerCollection.invalidate({
                id: collectionId,
              })
              setSubmitting(false)
              setEditMode(false)
              setEditDisabled(false)
              onSuccess()
            }}
          >
            {({ isSubmitting, isValid }) => (
              <Form className="gap-0.75 flex flex-row">
                <Button
                  primary
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={{ root: 'h-8 w-8' }}
                  data={{ cy: 'save-edit-answer-option' }}
                >
                  <Button.Icon withoutLabel icon={faSave} />
                </Button>
                <FormikTextField
                  name="value"
                  data={{ cy: 'edit-answer-option-input' }}
                  className={{ input: 'h-8' }}
                />
              </Form>
            )}
          </Formik>
        ) : (
          entry.value
        )}
      </div>
      {(entry.numSolutionUsages ?? 0) > 0 ? (
        <FontAwesomeIcon icon={faWarning} className="text-orange-500" />
      ) : null}
    </div>
  )
}

export default AnswerCollectionOption
