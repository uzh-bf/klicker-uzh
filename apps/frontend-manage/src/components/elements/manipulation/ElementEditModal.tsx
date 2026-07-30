import { useMutation, useQuery } from '@apollo/client'
import {
  CreateAnswerCollectionDocument,
  ElementType,
  FlagOutdatedElementInstancesDocument,
  GetSingleElementDocument,
  GetUserTagsDocument,
  ManipulateCaseStudyQuestionDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateCodeQuestionDocument,
  ManipulateContentElementDocument,
  ManipulateFlashcardElementDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  ManipulateSelectionQuestionDocument,
  UpdateElementInstancesDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import React, { useMemo, useState } from 'react'
import { useElementAutoSave } from './elementAutoSave'
import ElementEditForm from './ElementEditForm'
import {
  createInlineCaseStudyCollection,
  createInlineSelectionCollection,
  prepareCaseStudyArgs,
  prepareChoicesArgs,
  prepareCodeArgs,
  prepareContentArgs,
  prepareFlashcardArgs,
  prepareFreeTextArgs,
  prepareNumericalArgs,
  prepareSelectionArgs,
} from './helpers'
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
  const { loading: loadingUser, data: dataUser } = useQuery(UserProfileDocument)
  const userId = dataUser?.userProfile?.id
  const {
    autoSavedElement,
    loaded: autoSaveLoaded,
    setAutoSavedElement,
  } = useElementAutoSave(autoSaveKey, userId)
  const recoveredElement = autoSavedElement

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
  const [manipulateCodeQuestion] = useMutation(ManipulateCodeQuestionDocument)
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

  // only update the form values on initial rendering in creation or edit mode (not in duplication mode)
  // (otherwise, saving the question will directly trigger another save)
  const formikInitialValues = useMemo(() => {
    if (!initialValues || !userId || !autoSaveLoaded) {
      return undefined
    }
    return isDuplication ? initialValues : (recoveredElement ?? initialValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDuplication, initialValues, userId, autoSaveLoaded])

  return (
    <ElementEditForm
      mode={mode}
      elementId={elementId}
      inputsDisabled={inputsDisabled}
      loading={
        loadingUser ||
        loadingQuestion ||
        !formikInitialValues ||
        Object.keys(formikInitialValues).length === 0
      }
      initialValues={formikInitialValues}
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
      onSubmitElement={async (values) => {
        try {
          switch (values.type) {
            case ElementType.Content: {
              const args = prepareContentArgs({
                elementId,
                isDuplication,
                values,
              })

              const result = await manipulateContentElement({
                variables: args,
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

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
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

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
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

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
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

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
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

              const data = result.data?.manipulateFreeTextQuestion
              if (data?.__typename !== 'FreeTextElement' || !data.id) {
                return false
              }

              break
            }

            case ElementType.Code: {
              const args = prepareCodeArgs({
                elementId,
                isDuplication,
                values,
              })

              const result = await manipulateCodeQuestion({
                variables: args,
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

              const data = result.data?.manipulateCodeQuestion
              if (data?.__typename !== 'CodeElement' || !data.id) {
                return false
              }

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
                return false
              }

              const args = prepareSelectionArgs({
                elementId,
                isDuplication,
                values:
                  values.options.itemSelectionMode === 'new'
                    ? innerValues!
                    : values,
              })

              const result = await manipulateSelectionQuestion({
                variables: args,
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

              const data = result.data?.manipulateSelectionQuestion
              if (data?.__typename !== 'SelectionElement' || !data.id) {
                return false
              }

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
                return false
              }

              const args = prepareCaseStudyArgs({
                elementId,
                isDuplication,
                values:
                  values.options.itemSelectionMode === 'new'
                    ? innerValues!
                    : values,
              })

              const result = await manipulateCaseStudyQuestion({
                variables: args,
                refetchQueries: [{ query: GetUserTagsDocument }],
              })
              await refetchElements()

              const data = result.data?.manipulateCaseStudyQuestion
              if (data?.__typename !== 'CaseStudyElement' || !data.id) {
                return false
              }

              break
            }

            default:
              break
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

          return true
        } catch (err) {
          console.error('Error submitting element:', err)
          return false
        }
      }}
      onSuccess={() => {
        // remove local storage entry
        setAutoSavedElement(undefined)

        // extract query parameters
        const {
          editElementId,
          contextActivityId,
          contextActivityType,
          ...query
        } = router.query

        if (contextActivityId && contextActivityType) {
          // if the element is edited in the context of an activity, re-open the corresponding activity details
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
          // close modal
          handleSetIsOpen(false)

          // unset the edit element id
          router.push({ pathname: '/', query }, undefined, { shallow: true })
        }

        // trigger success toast
        triggerSuccessToast()
      }}
      setAutoSavedElement={setAutoSavedElement}
    />
  )
}

export default ElementEditModal
