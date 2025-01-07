import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPencil, faSave, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollectionEntry,
  DeleteAnswerCollectionEntryDocument,
  EditAnswerCollectionEntryDocument,
  GetAnswerCollectionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function AnswerCollectionOption({
  entry,
  index,
  last,
  collectionId,
  deletionDisabled,
  editDisabled,
  setEditDisabled,
}: {
  entry: AnswerCollectionEntry
  index: number
  last: boolean
  collectionId: number
  deletionDisabled?: boolean
  editDisabled: boolean
  setEditDisabled: Dispatch<SetStateAction<boolean>>
}) {
  const [editMode, setEditMode] = useState(false)
  const [editAnswerCollectionEntry] = useMutation(
    EditAnswerCollectionEntryDocument
  )
  const [deleteAnswerCollectionEntry] = useMutation(
    DeleteAnswerCollectionEntryDocument
  )
  const deletionNotAllowed =
    deletionDisabled || (entry.numSolutionUsages ?? 0) > 0

  return (
    <div
      className={twMerge(
        'flex w-full flex-row items-center gap-1 border-b pb-1',
        last && '!border-b-0'
      )}
    >
      <Button
        className={{
          root: twMerge(
            'h-8 w-8 items-center justify-center border border-red-600',
            !deletionNotAllowed && 'hover:border-red-600 hover:text-red-600'
          ),
        }}
        disabled={deletionNotAllowed}
        data={{ cy: `delete-answer-option-${index}` }}
        onClick={async () => {
          await deleteAnswerCollectionEntry({
            variables: { id: entry.id },
            update: (cache, { data }) => {
              if (!data?.deleteAnswerCollectionEntry) return

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
                      queryData.getAnswerCollections?.requestedCollections ??
                      [],
                    sharedCollections:
                      queryData.getAnswerCollections?.sharedCollections ?? [],
                    answerCollections: previousCollections.map((collection) => {
                      if (collection.id === collectionId) {
                        return {
                          ...collection,
                          entries: collection.entries?.filter(
                            (e) => e.id !== entry.id
                          ),
                        }
                      }

                      return collection
                    }),
                  },
                },
              })
            },
          })
        }}
      >
        <FontAwesomeIcon icon={faTrashCan} />
      </Button>
      {!editMode ? (
        <Button
          className={{
            root: 'border-primary-80 hover:border-primary-80 h-8 w-8 items-center justify-center border',
          }}
          onClick={() => {
            setEditMode(true)
            setEditDisabled(true)
          }}
          disabled={editDisabled}
          data={{ cy: `edit-answer-option-${index}` }}
        >
          <FontAwesomeIcon icon={faPencil} />
        </Button>
      ) : null}
      <div
        className={twMerge('w-full', !editMode && 'ml-2')}
        data-cy={`answer-option-${index}`}
      >
        {editMode ? (
          <Formik
            initialValues={{ value: entry.value }}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)

              if (entry.value !== values.value) {
                await editAnswerCollectionEntry({
                  variables: { id: entry.id, value: values.value },
                  update: (cache, { data }) => {
                    if (!data?.editAnswerCollectionEntry) return

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
                            queryData.getAnswerCollections
                              ?.requestedCollections ?? [],
                          sharedCollections:
                            queryData.getAnswerCollections?.sharedCollections ??
                            [],
                          answerCollections: previousCollections.map(
                            (collection) => {
                              if (collection.id === collectionId) {
                                return {
                                  ...collection,
                                  entries: collection.entries?.map((e) => {
                                    if (e.id === entry.id) {
                                      return { ...e, value: values.value }
                                    }

                                    return e
                                  }),
                                }
                              }

                              return collection
                            }
                          ),
                        },
                      },
                    })
                  },
                })
              }

              setSubmitting(false)
              setEditMode(false)
              setEditDisabled(false)
            }}
          >
            {({ isSubmitting }) => (
              <Form className="flex flex-row gap-[0.1875rem]">
                <Button
                  type="submit"
                  className={{
                    root: twMerge(
                      'border-primary-80 hover:border-primary-80 bg-primary-100 h-8 w-8 items-center justify-center border text-white',
                      isSubmitting && 'bg-primary-60 cursor-not-allowed'
                    ),
                  }}
                  disabled={isSubmitting}
                  data={{ cy: 'save-edit-answer-option' }}
                >
                  <FontAwesomeIcon icon={faSave} />
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
