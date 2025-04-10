import { useMutation, useQuery } from '@apollo/client'
import {
  ElementType,
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
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
import { ElementFormTypes } from './types'
import useElementFormInitialValues from './useElementFormInitialValues'

export enum ElementEditMode {
  DUPLICATE = 'DUPLICATE',
  EDIT = 'EDIT',
  CREATE = 'CREATE',
}

interface ElementEditModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  triggerSuccessToast: () => void
  elementId?: number
  mode: ElementEditMode
}

function ElementEditModal({
  isOpen,
  handleSetIsOpen,
  triggerSuccessToast,
  elementId,
  mode,
}: ElementEditModalProps): React.ReactElement {
  const t = useTranslations()

  const isDuplication = mode === ElementEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(false)
  const [includeTemplateUpdates, setIncludeTemplateUpdates] = useState(false)
  const [failureToast, setFailureToast] = useState(false)

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
      loading={loadingQuestion}
      initialValues={formikInitialValues}
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
      failureToast={failureToast}
      setFailureToast={setFailureToast}
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
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateContentElement
            if (data?.__typename !== 'ContentElement' || !data.id) {
              setFailureToast(true)
              return
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
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateFlashcardElement
            if (data?.__typename !== 'FlashcardElement' || !data.id) {
              setFailureToast(true)
              return
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
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateChoicesQuestion
            if (data?.__typename !== 'ChoicesElement' || !data.id) {
              setFailureToast(true)
              return
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
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateNumericalQuestion
            if (data?.__typename !== 'NumericalElement' || !data.id) {
              setFailureToast(true)
              return
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
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateFreeTextQuestion
            if (data?.__typename !== 'FreeTextElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }

          case ElementType.Selection: {
            const args = prepareSelectionArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateSelectionQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateSelectionQuestion
            if (data?.__typename !== 'SelectionElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }

          case ElementType.CaseStudy: {
            const args = prepareCaseStudyArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateCaseStudyQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateCaseStudyQuestion
            if (data?.__typename !== 'CaseStudyElement' || !data.id) {
              setFailureToast(true)
              return
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
