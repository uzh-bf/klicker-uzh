import { faBars } from '@fortawesome/free-solid-svg-icons'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { getCodeActivityStackViolation } from '@klicker-uzh/types'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementBlockFormValues, ElementStackFormValues } from './WizardLayout'

interface BaseProps {
  index: number
  selection: Record<number, Element>
  resetSelection: (() => void) | undefined
  acceptedTypes: ElementType[]
}

interface StackProps extends BaseProps {
  stack: ElementStackFormValues
  replace: (index: number, value: ElementStackFormValues) => void
}

interface BlockProps extends BaseProps {
  stack: ElementBlockFormValues
  replace: (index: number, value: ElementBlockFormValues) => void
}

function PasteSelectionButton({
  index,
  selection,
  resetSelection,
  stack,
  replace,
  acceptedTypes,
}: StackProps | BlockProps) {
  const t = useTranslations()
  const selectedQuestions = Object.values(selection)
  const canPasteSelection =
    selectedQuestions.every((question) =>
      acceptedTypes.includes(question.type)
    ) &&
    getCodeActivityStackViolation(
      [
        ...stack.elements.map((element) => element.type),
        ...selectedQuestions.map((question) => question.type),
      ],
      true
    ) === null

  return (
    <Button
      fluid
      disabled={!canPasteSelection}
      className={{
        root: 'mb-2 h-7 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
      }}
      onClick={() => {
        if (!canPasteSelection) return

        const newElements = selectedQuestions.map((question) => ({
          id: question.id,
          title: question.name,
          type: question.type,
          hasSampleSolution:
            'options' in question
              ? (question.options.hasSampleSolution ?? false)
              : true,
          existingInstanceId: null,
          duplicateInstance: false,
        }))
        const stackElements = stack.elements.concat(newElements)

        replace(index, {
          ...stack,
          elements: stackElements,
        })
        resetSelection?.()
      }}
      data={{ cy: 'paste-selected-questions' }}
    >
      <Button.Icon icon={faBars} />
      <Button.Label>
        {t('manage.activityWizard.pasteSelectionElements', {
          count: Object.keys(selection).length,
        })}
      </Button.Label>
    </Button>
  )
}

export default PasteSelectionButton
