import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPencil, faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteAnswerCollectionEntryDocument,
  EditAnswerCollectionEntryDocument,
  GetAnswerCollectionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function AnswerCollectionOption({
  id,
  value,
  collectionId,
  deletionDisabled,
  editDisabled,
  setEditDisabled,
}: {
  id: number
  value: string
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

  return (
    <div className="flex w-full flex-row items-center gap-1">
      <Button
        className={{
          root: twMerge(
            'h-8 w-8 items-center justify-center border border-red-600',
            !deletionDisabled && 'hover:border-red-600 hover:text-red-600'
          ),
        }}
        disabled={deletionDisabled}
        onClick={async () => {
          await deleteAnswerCollectionEntry({
            variables: { id },
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
                            (entry) => entry.id !== id
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
        >
          <FontAwesomeIcon icon={faPencil} />
        </Button>
      ) : null}
      <div className={twMerge('w-full', !editMode && 'ml-2')}>
        {editMode ? (
          <Formik
            initialValues={{ value }}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)

              if (value !== values.value) {
                await editAnswerCollectionEntry({
                  variables: { id, value: values.value },
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
                                  entries: collection.entries?.map((entry) => {
                                    if (entry.id === id) {
                                      return { ...entry, value: values.value }
                                    }

                                    return entry
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
                >
                  <FontAwesomeIcon icon={faSave} />
                </Button>
                <FormikTextField name="value" className={{ input: 'h-8' }} />
              </Form>
            )}
          </Formik>
        ) : (
          value
        )}
      </div>
    </div>
  )
}

export default AnswerCollectionOption
