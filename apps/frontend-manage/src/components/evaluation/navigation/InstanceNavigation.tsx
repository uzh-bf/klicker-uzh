import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface InstanceNavigationProps {
  stack: StackEvaluation
  activeInstance: number
  setActiveInstance: (instance: number) => void
  numOfInstances: number
  instanceSelection: { label: string; value: number }[]
}

function InstanceNavigation({
  stack,
  activeInstance,
  setActiveInstance,
  numOfInstances,
  instanceSelection,
}: InstanceNavigationProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row items-center gap-2">
      <Button
        basic
        onClick={() => {
          setActiveInstance(activeInstance - 1)
        }}
        disabled={activeInstance === 0}
        className={{
          root: twMerge(
            activeInstance === 0 && 'text-uzh-grey-80 cursor-not-allowed'
          ),
        }}
        data={{ cy: 'evaluate-previous-question' }}
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </Button>
      <Button
        basic
        onClick={() => {
          setActiveInstance(activeInstance + 1)
        }}
        disabled={activeInstance === numOfInstances - 1}
        className={{
          root: twMerge(
            activeInstance === numOfInstances - 1 &&
              'text-uzh-grey-80 cursor-not-allowed'
          ),
        }}
        data={{ cy: 'evaluate-next-question' }}
      >
        <FontAwesomeIcon icon={faArrowRight} />
      </Button>

      <div className="ml-2 font-bold">{t('shared.generic.element')}:</div>

      <Select
        items={instanceSelection.map((instance) => ({
          label: instance.label,
          value: String(instance.value),
          data: { cy: `evaluation-select-instance-${instance.label}` },
        }))}
        onChange={(newValue) => {
          setActiveInstance(Number(newValue))
        }}
        className={{
          root: 'z-20 h-[2.65rem]',
          trigger: 'm-0 h-full rounded-none border-none shadow-none',
        }}
        value={String(activeInstance)}
        data={{ cy: 'evaluate-question-select' }}
      />
    </div>
  )
}

export default InstanceNavigation
