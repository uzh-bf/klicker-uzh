import { omitBy } from 'remeda'
import {
  ElementStatus,
  ElementType,
} from '../../../../lib/constants/elementTypes'
import { trpc, type RouterInputs } from '../../../../lib/trpc'
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
} from '../../../elements/manipulation/helpers'
import type { ElementFormTypes } from '../../../elements/manipulation/types'
import extractFormValuesFromElementInstance from '../extractFormValuesFromElementInstance'
import { LiveQuizTemplateFormValues } from '../types'

type TemplateElementManipulationInput = NonNullable<
  NonNullable<
    RouterInputs['activity']['createLiveQuizFromTemplate']['blocks'][number]['elements'][number]['newElement']
  >
>

function useProcessLiveQuizTemplateBlocksData() {
  const createAnswerCollectionMutation =
    trpc.resources.createAnswerCollection.useMutation()
  const utils = trpc.useUtils()
  const readyStatus = ElementStatus.Ready as ElementFormTypes['status']

  const processLiveQuizTemplateBlocksData = async ({
    data,
  }: {
    data: LiveQuizTemplateFormValues
  }) => {
    const blocksWithPromises = data.blocks.map(async (block, blockIx) => {
      // process all elements in this block and resolve their promises
      const resolvedElements = await Promise.all(
        block.elements.map(async (element, elementIx) => {
          // if none of the options is selected, throw an error
          if (
            !element.useTemplateInstance &&
            !element.useExistingElement &&
            !element.useNewElement
          ) {
            throw new Error('No option was selected for the element')
          }

          // existing element should be added to the template
          if (element.useExistingElement) {
            return {
              order: elementIx,
              useExistingElement: true,
              existingElementId: element.elementId,
              useNewElement: false,
            }
          }
          // new element should be created (either based on form inputs or instance data)
          else {
            // set the form values either to the custom entered or extract them from the instance
            let values = element.formValues
            if (element.useTemplateInstance) {
              values = extractFormValuesFromElementInstance({
                instance: element.instance,
              })
            }

            // if no form values are defined, throw an error
            if (!values) {
              console.log(
                'For element',
                element,
                'no valid form values were found:',
                values
              )
              throw new Error('No form values were defined')
            }

            // mutate the form values into the format that is expected by the GraphQL mutation
            let elementManipulationData:
              | TemplateElementManipulationInput
              | undefined = undefined

            switch (values.type) {
              case ElementType.Sc:
              case ElementType.Mc:
              case ElementType.Kprim: {
                const args = prepareChoicesArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values: { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  // options key needs to be removed to avoid GraphQL error on submission
                  ...omitBy(args, (_, key) => key === 'options'),
                  type: values.type,
                  choicesOptions: args.options,
                }

                break
              }

              case ElementType.Numerical: {
                const args = prepareNumericalArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values: { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  ...omitBy(args, (_, key) => key === 'options'),
                  type: ElementType.Numerical,
                  numericalOptions: args.options,
                }

                break
              }

              case ElementType.FreeText: {
                const args = prepareFreeTextArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values: { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  ...omitBy(args, (_, key) => key === 'options'),
                  type: ElementType.FreeText,
                  freeTextOptions: args.options,
                }

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
                        onAnswerCollectionCreated: () =>
                          utils.resources.answerCollectionsInfo.invalidate(),
                      })
                    : undefined

                // if the creation was not successful, return early
                if (
                  values.options.itemSelectionMode === 'new' &&
                  (innerValues === null || typeof innerValues === 'undefined')
                ) {
                  throw new Error(
                    'Inline answer collection creation failed for selection element'
                  )
                }

                const args = prepareSelectionArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values:
                    values.options.itemSelectionMode === 'new'
                      ? { ...innerValues!, status: readyStatus }!
                      : { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  ...omitBy(args, (_, key) => key === 'options'),
                  type: ElementType.Selection,
                  selectionOptions: args.options,
                }

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
                        onAnswerCollectionCreated: () =>
                          utils.resources.answerCollectionsInfo.invalidate(),
                      })
                    : undefined

                // if the creation was not successful, return early
                if (
                  values.options.itemSelectionMode === 'new' &&
                  (innerValues === null || typeof innerValues === 'undefined')
                ) {
                  throw new Error(
                    'Inline answer collection creation failed for case study element'
                  )
                }

                const args = prepareCaseStudyArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values:
                    values.options.itemSelectionMode === 'new'
                      ? { ...innerValues!, status: readyStatus }!
                      : { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  ...omitBy(args, (_, key) => key === 'options'),
                  type: ElementType.CaseStudy,
                  caseStudyOptions: args.options,
                }

                break
              }

              case ElementType.Flashcard: {
                const args = prepareFlashcardArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values: { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  ...args,
                  type: ElementType.Flashcard,
                }

                break
              }

              case ElementType.Content: {
                const args = prepareContentArgs({
                  elementId: undefined,
                  isDuplication: false,
                  values: { ...values, status: readyStatus },
                })

                elementManipulationData = {
                  ...args,
                  type: ElementType.Content,
                }

                break
              }
            }

            if (!elementManipulationData) {
              console.log(
                'For element',
                element,
                'no valid element manipulation data was found:',
                elementManipulationData
              )
              throw new Error('No element manipulation data was computed')
            }

            return {
              order: elementIx,
              useExistingElement: false,
              useNewElement: true,
              newElement: elementManipulationData,
            }
          }
        })
      )

      return {
        order: blockIx,
        timeLimit: block.timeLimit ? parseFloat(block.timeLimit) : null,
        elements: resolvedElements,
      }
    })

    return await Promise.all(blocksWithPromises)
  }

  return { processLiveQuizTemplateBlocksData }
}

export default useProcessLiveQuizTemplateBlocksData
