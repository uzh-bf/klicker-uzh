import {
  ElementType,
  TemplateElementManipulationInput,
} from '@klicker-uzh/graphql/dist/ops'
import { omitBy } from 'remeda'
import {
  prepareCaseStudyArgs,
  prepareChoicesArgs,
  prepareContentArgs,
  prepareFlashcardArgs,
  prepareFreeTextArgs,
  prepareNumericalArgs,
  prepareSelectionArgs,
} from '../../../questions/manipulation/helpers'
import extractFormValuesFromElementInstance from '../extractFormValuesFromElementInstance'
import { LiveQuizTemplateFormValues } from '../types'

function processLiveQuizTemplateBlocksData({
  data,
}: {
  data: LiveQuizTemplateFormValues
}) {
  return data.blocks.map((block, blockIx) => ({
    order: blockIx,
    timeLimit: block.timeLimit ? parseFloat(block.timeLimit) : null,
    elements: block.elements.map((element, elementIx) => {
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
              values,
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
              values,
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
              values,
            })
            elementManipulationData = {
              ...omitBy(args, (_, key) => key === 'options'),
              type: ElementType.FreeText,
              freeTextOptions: args.options,
            }
            break
          }
          case ElementType.Selection: {
            const args = prepareSelectionArgs({
              elementId: undefined,
              isDuplication: false,
              values,
            })
            elementManipulationData = {
              ...omitBy(args, (_, key) => key === 'options'),
              type: ElementType.Selection,
              selectionOptions: args.options,
            }
            break
          }
          case ElementType.CaseStudy: {
            const args = prepareCaseStudyArgs({
              elementId: undefined,
              isDuplication: false,
              values,
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
              values,
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
              values,
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
    }),
  }))
}

export default processLiveQuizTemplateBlocksData
