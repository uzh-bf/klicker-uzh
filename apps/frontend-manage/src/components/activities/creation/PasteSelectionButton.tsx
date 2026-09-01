import { faBars } from '@fortawesome/free-solid-svg-icons'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
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
  acceptedTypes,
  stack,
  replace,
}: StackProps | BlockProps) {
  const t = useTranslations()
  const acceptedSelection = Object.values(selection).filter((question) =>
    acceptedTypes.includes(question.type)
  )

  return (
    <Button
      fluid
      className={{
        root: 'mb-2 h-7 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
      }}
      onClick={() => {
        const newElements = acceptedSelection.map((question) => ({
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
          count: acceptedSelection.length,
        })}
      </Button.Label>
    </Button>
  )
}

export default PasteSelectionButton
