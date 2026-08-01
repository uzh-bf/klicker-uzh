import { useMutation, useQuery } from '@apollo/client'
import {
  CreateAnswerCollectionDocument,
  ElementType,
  FlagOutdatedElementInstancesDocument,
  GetSingleElementDocument,
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
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ElementEditForm from './ElementEditForm'
import {
  createElementAutosavePayload,
  isElementAutosavePayload,
  restoreElementAutosave,
  updateElementAutosaveFormValues,
} from './adaptive/elementAutosave'
import { refreshElementListBestEffort } from './adaptive/elementSubmission'
import {
  createInlineCaseStudyCollection,
  createInlineSelectionCollection,
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
  inputsDisabled?: boolean
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  triggerSuccessToast: () => void
  elementId?: number
  mode: ElementEditMode
  refetchElements: () => Promise<void>
}

function ElementEditModal({
  inputsDisabled = false,
  isOpen,
  handleSetIsOpen,
  triggerSuccessToast,
  elementId,
  mode,
  refetchElements,
}: ElementEditModalProps): React.ReactElement {
  const router = useRouter()
  const isDuplication = mode === ElementEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(true)
  const [includeTemplateUpdates, setIncludeTemplateUpdates] = useState(false)
  const autoSaveKey =
    typeof elementId === 'undefined' || isDuplication
      ? 'autosave-element-creation'
      : `autosave-element-${elementId}`
  const [storedAutoSave, setStoredAutoSave] = useLocalStorage<unknown>(
    autoSaveKey,
    undefined
  )
  const autoSavePayload = useMemo(
    () => restoreElementAutosave(storedAutoSave),
    [storedAutoSave]
  )

  useEffect(() => {
    if (
      autoSavePayload &&
      storedAutoSave !== undefined &&
      !isElementAutosavePayload(storedAutoSave)
    ) {
      setStoredAutoSave(autoSavePayload)
    }
  }, [autoSavePayload, setStoredAutoSave, storedAutoSave])

  const { loading: loadingQuestion, data: dataQuestion } = useQuery(
    GetSingleElementDocument,
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
  const [flagOutdatedElementInstances] = useMutation(
    FlagOutdatedElementInstancesDocument
  )

  const initialValues = useElementFormInitialValues({
    mode,
    question: dataQuestion?.element,
    isDuplication,
  })

  const shouldRestoreAutoSave =
    !isDuplication ||
    (autoSavePayload !== null && autoSavePayload.pendingMapping !== null)

  const formikInitialValues = useMemo(() => {
    if (!initialValues) {
      return undefined
    }
    return shouldRestoreAutoSave
      ? (autoSavePayload?.formValues ?? initialValues)
      : initialValues
  }, [autoSavePayload, initialValues, shouldRestoreAutoSave])

  const formAutoSavePayload = useMemo(() => {
    if (!formikInitialValues) {
      return undefined
    }

    return shouldRestoreAutoSave && autoSavePayload
      ? autoSavePayload
      : createElementAutosavePayload(formikInitialValues)
  }, [autoSavePayload, formikInitialValues, shouldRestoreAutoSave])

  const setAutoSavedElement = useCallback<
    React.Dispatch<React.SetStateAction<ElementFormTypes>>
  >(
    (nextFormValues) => {
      setStoredAutoSave((currentStoredValue: unknown) => {
        const currentPayload =
          restoreElementAutosave(currentStoredValue) ?? formAutoSavePayload
        if (!currentPayload) {
          return currentStoredValue
        }

        const formValues =
          typeof nextFormValues === 'function'
            ? nextFormValues(currentPayload.formValues)
            : nextFormValues
        return updateElementAutosaveFormValues(currentPayload, formValues)
      })
    },
    [formAutoSavePayload, setStoredAutoSave]
  )

  const handleSuccess = () => {
    const { editElementId, contextActivityId, contextActivityType, ...query } =
      router.query

    if (contextActivityId && contextActivityType) {
      router.push(
        {
          pathname: '/activities',
          query: {
            ...query,
            openActivityDetailsId: contextActivityId,
            openActivityDetailsType: contextActivityType,
          },
        },
        undefined,
        { shallow: true }
      )
    } else {
      handleSetIsOpen(false)
      router.push({ pathname: '/', query }, undefined, { shallow: true })
    }

    triggerSuccessToast()
  }

  return (
    <ElementEditForm
      mode={mode}
      elementId={elementId}
      inputsDisabled={inputsDisabled}
      loading={
        loadingQuestion ||
        !formikInitialValues ||
        Object.keys(formikInitialValues).length === 0
      }
      initialValues={formikInitialValues}
      autoSavePayload={formAutoSavePayload}
      onAutoSavePayloadChange={setStoredAutoSave}
      onClose={async () => {
        // close the modal
        handleSetIsOpen(false)

        // refetch elements here, since element status might have changed and refetch cannot be used there to avoid closing modal
        await refetchElements?.()

        // remove potential query parameters that open element edit modal on reload
        const {
          editElementId,
          contextActivityId,
          contextActivityType,
          ...query
        } = router.query
        router.push({ pathname: '/', query }, undefined, { shallow: true })
      }}
      updateInstances={updateInstances}
      setUpdateInstances={setUpdateInstances}
      includeTemplateUpdates={includeTemplateUpdates}
      setIncludeTemplateUpdates={setIncludeTemplateUpdates}
      onSubmitElement={async (values, pendingMapping, creationRequestId) => {
        const submissionElementId = elementId
        const submissionIsDuplication = isDuplication
        const initialCompetenceTreeAssignment = pendingMapping
          ? {
              treeId: pendingMapping.treeId,
              ...pendingMapping.assignment,
            }
          : undefined
        const adaptiveCreationRequestId = initialCompetenceTreeAssignment
          ? creationRequestId
          : undefined
        let savedElementId: number | null = null

        switch (values.type) {
          case ElementType.Content: {
            const args = prepareContentArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values,
            })

            const result = await manipulateContentElement({
              variables: args,
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateContentElement
            if (data?.__typename !== 'ContentElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          case ElementType.Flashcard: {
            const args = prepareFlashcardArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values,
            })

            const result = await manipulateFlashcardElement({
              variables: args,
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateFlashcardElement
            if (data?.__typename !== 'FlashcardElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          case ElementType.Sc:
          case ElementType.Mc:
          case ElementType.Kprim: {
            const args = prepareChoicesArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values,
            })

            const result = await manipulateChoicesQuestion({
              variables: {
                ...args,
                initialCompetenceTreeAssignment,
                creationRequestId: adaptiveCreationRequestId,
              },
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateChoicesQuestion
            if (data?.__typename !== 'ChoicesElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          case ElementType.Numerical: {
            const args = prepareNumericalArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values,
            })

            const result = await manipulateNumericalQuestion({
              variables: {
                ...args,
                initialCompetenceTreeAssignment,
                creationRequestId: adaptiveCreationRequestId,
              },
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateNumericalQuestion
            if (data?.__typename !== 'NumericalElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          case ElementType.FreeText: {
            const args = prepareFreeTextArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values,
            })

            const result = await manipulateFreeTextQuestion({
              variables: {
                ...args,
                initialCompetenceTreeAssignment,
                creationRequestId: adaptiveCreationRequestId,
              },
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateFreeTextQuestion
            if (data?.__typename !== 'FreeTextElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          case ElementType.Selection: {
            // if the items for the selection question were defined inline, create a new answer collection from them
            const innerValues =
              values.options.itemSelectionMode === 'new'
                ? await createInlineSelectionCollection({
                    values,
                    createAnswerCollection,
                  })
                : undefined

            // if the creation was not successful, return early
            if (
              values.options.itemSelectionMode === 'new' &&
              (innerValues === null || typeof innerValues === 'undefined')
            ) {
              return null
            }

            const args = prepareSelectionArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values:
                values.options.itemSelectionMode === 'new'
                  ? innerValues!
                  : values,
            })

            const result = await manipulateSelectionQuestion({
              variables: args,
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateSelectionQuestion
            if (data?.__typename !== 'SelectionElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          case ElementType.CaseStudy: {
            // if the items for the case study question were defined inline, create a new answer collection from them
            const innerValues =
              values.options.itemSelectionMode === 'new'
                ? await createInlineCaseStudyCollection({
                    values,
                    createAnswerCollection,
                  })
                : undefined

            // if the creation was not successful, return early
            if (
              values.options.itemSelectionMode === 'new' &&
              (innerValues === null || typeof innerValues === 'undefined')
            ) {
              return null
            }

            const args = prepareCaseStudyArgs({
              elementId: submissionElementId,
              isDuplication: submissionIsDuplication,
              values:
                values.options.itemSelectionMode === 'new'
                  ? innerValues!
                  : values,
            })

            const result = await manipulateCaseStudyQuestion({
              variables: args,
              refetchQueries: [{ query: GetUserTagsDocument }],
            })
            const data = result.data?.manipulateCaseStudyQuestion
            if (data?.__typename !== 'CaseStudyElement' || !data.id) {
              return null
            }

            savedElementId = data.id
            break
          }

          default:
            return null
        }

        if (
          mode === ElementEditMode.EDIT &&
          updateInstances &&
          elementId !== null &&
          typeof elementId !== 'undefined'
        ) {
          await updateElementInstances({
            variables: {
              elementId: elementId,
              includeTemplates: includeTemplateUpdates,
            },
          })
        } else if (
          mode === ElementEditMode.EDIT &&
          !updateInstances &&
          elementId !== null &&
          typeof elementId !== 'undefined'
        ) {
          await flagOutdatedElementInstances({ variables: { elementId } })
        }

        refreshElementListBestEffort(refetchElements)
        return savedElementId
      }}
      onSuccess={() => {
        setStoredAutoSave(null)
        handleSuccess()
      }}
      setAutoSavedElement={setAutoSavedElement}
    />
  )
}

export default ElementEditModal
