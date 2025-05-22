import { useMutation, useQuery } from '@apollo/client'
import {
  CreateAnswerCollectionDocument,
  ElementStatus,
  ElementType,
  GetAnswerCollectionsInfoDocument,
  GetSingleQuestionDocument,
  GetUserElementsDocument,
  GetUserTagsDocument,
  ManipulateCaseStudyQuestionDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateContentElementDocument,
  ManipulateFlashcardElementDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  ManipulateSelectionQuestionDocument,
  UpdateElementInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useTranslations } from 'next-intl'
import React, { useMemo, useState } from 'react'
import ElementEditForm from './ElementEditForm'
import {
  prepareCaseStudyArgs,
  prepareChoicesArgs,
  prepareContentArgs,
  prepareFlashcardArgs,
  prepareFreeTextArgs,
  prepareNumericalArgs,
  prepareSelectionArgs,
} from './helpers'
import {
  ElementFormTypes,
  ElementFormTypesCaseStudy,
  ElementFormTypesCaseStudySolutions,
  ElementFormTypesSelection,
} from './types'
import useElementFormInitialValues from './useElementFormInitialValues'

export enum ElementEditMode {
  DUPLICATE = 'DUPLICATE',
  EDIT = 'EDIT',
  CREATE = 'CREATE',
}

interface ElementEditModalProps {
  inputsDisabled?: boolean
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  triggerSuccessToast: () => void
  elementId?: number
  mode: ElementEditMode
}

function ElementEditModal({
  inputsDisabled = false,
  isOpen,
  handleSetIsOpen,
  triggerSuccessToast,
  elementId,
  mode,
}: ElementEditModalProps): React.ReactElement {
  const t = useTranslations()

  const isDuplication = mode === ElementEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(true)
  const [includeTemplateUpdates, setIncludeTemplateUpdates] = useState(false)

  const [autoSavedElement, setAutoSavedElement] =
    useLocalStorage<ElementFormTypes>(
      typeof elementId === 'undefined' || isDuplication
        ? 'autosave-element-creation'
        : `autosave-element-${elementId}`,
      undefined
    )

  const { loading: loadingQuestion, data: dataQuestion } = useQuery(
    GetSingleQuestionDocument,
    {
      variables: { id: elementId! },
      skip: typeof elementId === 'undefined' || !isOpen,
      fetchPolicy: 'cache-and-network',
    }
  )

  const [manipulateContentElement] = useMutation(
    ManipulateContentElementDocument
  )
  const [manipulateFlashcardElement] = useMutation(
    ManipulateFlashcardElementDocument
  )
  const [manipulateChoicesQuestion] = useMutation(
    ManipulateChoicesQuestionDocument
  )
  const [manipulateNumericalQuestion] = useMutation(
    ManipulateNumericalQuestionDocument
  )
  const [manipulateFreeTextQuestion] = useMutation(
    ManipulateFreeTextQuestionDocument
  )
  const [manipulateSelectionQuestion] = useMutation(
    ManipulateSelectionQuestionDocument
  )
  const [manipulateCaseStudyQuestion] = useMutation(
    ManipulateCaseStudyQuestionDocument
  )
  const [createAnswerCollection] = useMutation(CreateAnswerCollectionDocument)
  const [updateElementInstances] = useMutation(UpdateElementInstancesDocument)

  const initialValues = useElementFormInitialValues({
    mode,
    question: dataQuestion?.question,
    isDuplication,
  })

  // only update the form values on initial rendering in creation or edit mode (not in duplication mode)
  // (otherwise, saving the question will directly trigger another save)
  const formikInitialValues = useMemo(() => {
    if (!initialValues) {
      return undefined
    }
    return isDuplication ? initialValues : (autoSavedElement ?? initialValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDuplication, initialValues])

  if (!formikInitialValues || Object.keys(formikInitialValues).length === 0) {
    return <div />
  }

  return (
    <ElementEditForm
      mode={mode}
      elementId={elementId}
      inputsDisabled={inputsDisabled}
      loading={loadingQuestion}
      initialValues={formikInitialValues}
      initialStatus={dataQuestion?.question?.status ?? ElementStatus.Ready}
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
      updateInstances={updateInstances}
      setUpdateInstances={setUpdateInstances}
      includeTemplateUpdates={includeTemplateUpdates}
      setIncludeTemplateUpdates={setIncludeTemplateUpdates}
      onSubmitElement={async (values) => {
        switch (values.type) {
          case ElementType.Content: {
            const args = prepareContentArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateContentElement({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateContentElement
            if (data?.__typename !== 'ContentElement' || !data.id) {
              return false
            }

            break
          }

          case ElementType.Flashcard: {
            const args = prepareFlashcardArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateFlashcardElement({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateFlashcardElement
            if (data?.__typename !== 'FlashcardElement' || !data.id) {
              return false
            }

            break
          }

          case ElementType.Sc:
          case ElementType.Mc:
          case ElementType.Kprim: {
            const args = prepareChoicesArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateChoicesQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateChoicesQuestion
            if (data?.__typename !== 'ChoicesElement' || !data.id) {
              return false
            }

            break
          }

          case ElementType.Numerical: {
            const args = prepareNumericalArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateNumericalQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateNumericalQuestion
            if (data?.__typename !== 'NumericalElement' || !data.id) {
              return false
            }

            break
          }

          case ElementType.FreeText: {
            const args = prepareFreeTextArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateFreeTextQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateFreeTextQuestion
            if (data?.__typename !== 'FreeTextElement' || !data.id) {
              return false
            }

            break
          }

          case ElementType.Selection: {
            // make a copy of the form values (passed by reference) to optionally update them in case of an inline answer collection definition
            const innerValues: ElementFormTypesSelection & {
              status: ElementStatus
            } = JSON.parse(JSON.stringify(values))

            // if the items for the case study question were defined inline, create a new answer collection from them
            if (values.options.itemSelectionMode === 'new') {
              if (!values.options.manuallyCreatedItems) {
                return false
              }

              const { data } = await createAnswerCollection({
                variables: {
                  name: `AC Selection Question ${values.name}`,
                  description: `Answer collection containing all the items used in the context of the selection question ${values.name}`,
                  answers:
                    values.options.manuallyCreatedItems.map(
                      (item) => item.value
                    ) ?? [],
                },
                update: (cache, { data }) => {
                  if (!data?.createAnswerCollection) return

                  const queryData = cache.readQuery({
                    query: GetAnswerCollectionsInfoDocument,
                  })
                  const previousCollections =
                    queryData?.getAnswerCollectionsInfo
                  if (!previousCollections) return

                  cache.writeQuery({
                    query: GetAnswerCollectionsInfoDocument,
                    data: {
                      getAnswerCollectionsInfo: [
                        ...previousCollections,
                        data.createAnswerCollection,
                      ],
                    },
                  })
                },
              })

              if (!data?.createAnswerCollection) {
                return false
              }

              // set the answer collection id to the newly created answer collection
              innerValues.options.answerCollection = String(
                data.createAnswerCollection.id
              )

              if (values.options.hasSampleSolution) {
                // create a map between the old item index and the new correct answer collection entry ids
                const entries = data.createAnswerCollection.entries ?? []
                const itemOldIdNewIdMap = new Map<number, number>()
                values.options.manuallyCreatedItems.forEach((createdItem) => {
                  const entry = entries.find(
                    (entry) => entry.value === createdItem.value
                  )
                  if (entry) {
                    itemOldIdNewIdMap.set(createdItem.id, entry.id)
                  }
                })

                // update the ids of the correct answer options
                innerValues.options.correctAnswers =
                  values.options.correctAnswers?.flatMap((oldId) => {
                    const newItemId = itemOldIdNewIdMap.get(oldId)
                    if (typeof newItemId === 'undefined') {
                      return []
                    }
                    return [newItemId]
                  }) ?? []
              }
            }

            const args = prepareSelectionArgs({
              elementId,
              isDuplication,
              values: innerValues,
            })

            const result = await manipulateSelectionQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateSelectionQuestion
            if (data?.__typename !== 'SelectionElement' || !data.id) {
              return false
            }

            break
          }

          case ElementType.CaseStudy: {
            // make a copy of the form values (passed by reference) to optionally update them in case of an inline answer collection definition
            const innerValues: ElementFormTypesCaseStudy & {
              status: ElementStatus
            } = JSON.parse(JSON.stringify(values))

            // if the items for the case study question were defined inline, create a new answer collection from them
            if (values.options.itemSelectionMode === 'new') {
              if (!values.options.manuallyCreatedItems) {
                return false
              }

              const { data } = await createAnswerCollection({
                variables: {
                  name: `AC Case Study ${values.name}`,
                  description: `Answer collection containing all the items used in the context of the case study ${values.name}`,
                  answers:
                    values.options.manuallyCreatedItems.map(
                      (item) => item.value
                    ) ?? [],
                },
                update: (cache, { data }) => {
                  if (!data?.createAnswerCollection) return

                  const queryData = cache.readQuery({
                    query: GetAnswerCollectionsInfoDocument,
                  })
                  const previousCollections =
                    queryData?.getAnswerCollectionsInfo
                  if (!previousCollections) return

                  cache.writeQuery({
                    query: GetAnswerCollectionsInfoDocument,
                    data: {
                      getAnswerCollectionsInfo: [
                        ...previousCollections,
                        data.createAnswerCollection,
                      ],
                    },
                  })
                },
              })

              if (!data?.createAnswerCollection) {
                return false
              }

              // set the answer collection id to the newly created answer collection
              innerValues.options.answerCollection = String(
                data.createAnswerCollection.id
              )

              // set the items to the newly created answer collection items (in the same order as the values were defined)
              const entries = data.createAnswerCollection.entries ?? []
              const entryIds = values.options.manuallyCreatedItems.flatMap(
                (createdItem) => {
                  const entry = entries.find(
                    (entry) => entry.value === createdItem.value
                  )
                  return entry ? entry.id : []
                }
              )
              innerValues.options.selectedItems = entryIds

              if (values.options.hasSampleSolution) {
                // create a map between the old item id and the new correct answer collection entry ids
                const itemOldIdNewIdMap = new Map<number, number>()
                values.options.manuallyCreatedItems.forEach((createdItem) => {
                  const entry = entries.find(
                    (entry) => entry.value === createdItem.value
                  )
                  if (entry) {
                    itemOldIdNewIdMap.set(createdItem.id, entry.id)
                  }
                })

                // update the ids of the criterion solutions for all cases
                innerValues.options.cases = values.options.cases.map((c) => {
                  const mappedSolutions: ElementFormTypesCaseStudySolutions =
                    Object.fromEntries(
                      Object.entries(c.solutions ?? {}).flatMap(
                        ([key, value]) => {
                          const oldId = parseInt(key.split('-')[1])
                          const newItemId = itemOldIdNewIdMap.get(oldId)

                          if (typeof newItemId === 'undefined') {
                            return []
                          }

                          return [[`itemId-${newItemId}`, value]]
                        }
                      )
                    )

                  return { ...c, solutions: mappedSolutions }
                })
              }
            }

            const args = prepareCaseStudyArgs({
              elementId,
              isDuplication,
              values: innerValues,
            })

            const result = await manipulateCaseStudyQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserElementsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateCaseStudyQuestion
            if (data?.__typename !== 'CaseStudyElement' || !data.id) {
              return false
            }

            break
          }

          default:
            break
        }

        if (mode === ElementEditMode.EDIT && updateInstances) {
          if (elementId !== null && typeof elementId !== 'undefined') {
            await updateElementInstances({
              variables: {
                elementId: elementId,
                includeTemplates: includeTemplateUpdates,
              },
            })
          }
        }

        return true
      }}
      onSuccess={() => {
        // remove local storage entry
        if (autoSavedElement) {
          localStorage.removeItem(
            typeof elementId === 'undefined' || isDuplication
              ? 'autosave-element-creation'
              : `autosave-element-${elementId}`
          )
        }

        // close modal
        handleSetIsOpen(false)

        // trigger success toast
        triggerSuccessToast()
      }}
      setAutoSavedElement={setAutoSavedElement}
    />
  )
}

export default ElementEditModal
