import { useLocalStorage } from '@uidotdev/usehooks'
import { useRouter } from 'next/router'
import React, { useMemo, useState } from 'react'
import {
  ElementType,
  type EditableElement,
} from '../../../lib/constants/elementTypes'
import { trpc } from '../../../lib/trpc'
import ElementEditForm from './ElementEditForm'
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
  const utils = trpc.useUtils()
  const createAnswerCollectionMutation =
    trpc.resources.createAnswerCollection.useMutation()
  const isDuplication = mode === ElementEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(true)
  const [includeTemplateUpdates, setIncludeTemplateUpdates] = useState(false)
  const refreshAfterElementManipulation = async (
    updatedElementId?: number | null
  ) => {
    try {
      await Promise.all([
        updatedElementId
          ? utils.element.single.invalidate({ id: updatedElementId })
          : Promise.resolve(),
        utils.element.tags.invalidate(),
        refetchElements(),
      ])
    } catch (error) {
      console.error('Error refreshing element after manipulation:', error)
    }
  }
  const refreshAnswerCollectionsInfo = async () => {
    await utils.resources.answerCollectionsInfo.invalidate().catch((error) => {
      console.error('Error refreshing answer collections:', error)
    })
  }

  const [autoSavedElement, setAutoSavedElement] =
    useLocalStorage<ElementFormTypes>(
      typeof elementId === 'undefined' || isDuplication
        ? 'autosave-element-creation'
        : `autosave-element-${elementId}`,
      undefined
    )

  const { isInitialLoading: loadingQuestion, data: dataQuestion } =
    trpc.element.single.useQuery(
      { id: elementId! },
      {
        enabled: typeof elementId !== 'undefined' && isOpen,
      }
    )

  const manipulateContentElement = trpc.element.manipulateContent.useMutation()
  const manipulateFlashcardElement =
    trpc.element.manipulateFlashcard.useMutation()
  const manipulateChoicesQuestion = trpc.element.manipulateChoices.useMutation()
  const manipulateNumericalQuestion =
    trpc.element.manipulateNumerical.useMutation()
  const manipulateFreeTextQuestion =
    trpc.element.manipulateFreeText.useMutation()
  const manipulateSelectionQuestion =
    trpc.element.manipulateSelection.useMutation()
  const manipulateCaseStudyQuestion =
    trpc.element.manipulateCaseStudy.useMutation()
  const updateElementInstances = trpc.element.updateInstances.useMutation()
  const flagOutdatedElementInstances =
    trpc.element.flagOutdatedInstances.useMutation()

  const initialValues = useElementFormInitialValues({
    mode,
    question: dataQuestion?.element as EditableElement | null | undefined,
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
      onClose={() => {
        // close the modal
        handleSetIsOpen(false)

        // refetch elements here, since element status might have changed and refetch cannot be used there to avoid closing modal
        void refetchElements?.().catch((error) => {
          console.error('Error refreshing elements after closing modal:', error)
        })

        // remove potential query parameters that open element edit modal on reload
        const {
          editElementId,
          contextActivityId,
          contextActivityType,
          ...query
        } = router.query
        void router.push({ pathname: '/', query }, undefined, { shallow: true })
      }}
      updateInstances={updateInstances}
      setUpdateInstances={setUpdateInstances}
      includeTemplateUpdates={includeTemplateUpdates}
      setIncludeTemplateUpdates={setIncludeTemplateUpdates}
      onSubmitElement={async (values) => {
        let updatedElementId: number | null = null

        try {
          switch (values.type) {
            case ElementType.Content: {
              const args = prepareContentArgs({
                elementId,
                isDuplication,
                values,
              })

              const result = await manipulateContentElement.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'ContentElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
              break
            }

            case ElementType.Flashcard: {
              const args = prepareFlashcardArgs({
                elementId,
                isDuplication,
                values,
              })

              const result = await manipulateFlashcardElement.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'FlashcardElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
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

              const result = await manipulateChoicesQuestion.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'ChoicesElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
              break
            }

            case ElementType.Numerical: {
              const args = prepareNumericalArgs({
                elementId,
                isDuplication,
                values,
              })

              const result = await manipulateNumericalQuestion.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'NumericalElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
              break
            }

            case ElementType.FreeText: {
              const args = prepareFreeTextArgs({
                elementId,
                isDuplication,
                values,
              })

              const result = await manipulateFreeTextQuestion.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'FreeTextElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
              break
            }

            case ElementType.Selection: {
              // if the items for the selection question were defined inline, create a new answer collection from them
              const innerValues =
                values.options.itemSelectionMode === 'new'
                  ? await createInlineSelectionCollection({
                      values,
                      createAnswerCollection: async (input) => {
                        const res =
                          await createAnswerCollectionMutation.mutateAsync(
                            input
                          )
                        return res.answerCollection
                      },
                      onAnswerCollectionCreated: refreshAnswerCollectionsInfo,
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

              const result = await manipulateSelectionQuestion.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'SelectionElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
              break
            }

            case ElementType.CaseStudy: {
              // if the items for the case study question were defined inline, create a new answer collection from them
              const innerValues =
                values.options.itemSelectionMode === 'new'
                  ? await createInlineCaseStudyCollection({
                      values,
                      createAnswerCollection: async (input) => {
                        const res =
                          await createAnswerCollectionMutation.mutateAsync(
                            input
                          )
                        return res.answerCollection
                      },
                      onAnswerCollectionCreated: refreshAnswerCollectionsInfo,
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

              const result = await manipulateCaseStudyQuestion.mutateAsync(args)

              const data = result.element
              if (data?.__typename !== 'CaseStudyElement' || !data.id) {
                return false
              }

              updatedElementId = data.id
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
            await updateElementInstances.mutateAsync({
              elementId: elementId,
              includeTemplates: includeTemplateUpdates,
            })
          } else if (
            mode === ElementEditMode.EDIT &&
            !updateInstances &&
            elementId !== null &&
            typeof elementId !== 'undefined'
          ) {
            await flagOutdatedElementInstances.mutateAsync({ elementId })
          }

          return true
        } catch (err) {
          console.error('Error submitting element:', err)
          return false
        } finally {
          if (updatedElementId !== null) {
            await refreshAfterElementManipulation(updatedElementId)
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
