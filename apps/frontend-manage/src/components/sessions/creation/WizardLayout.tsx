import {
  ElementOrderType,
  ElementType,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import { H2, Workflow } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

export type GroupActivityClueFormValues = {
  name: string
  displayName: string
  type: ParameterType.String | ParameterType.Number
  value: string
  unit?: string
}

interface CommonFormValues {
  name: string
  displayName: string
  description: string
  courseId?: string
  courseStartDate?: Date
  courseEndDate?: Date
  courseGroupDeadline?: Date
  multiplier: string
}

export interface LiveQuizBlockFormValues {
  questionIds: number[]
  titles: string[]
  types: ElementType[]
  timeLimit?: number
}

export interface LiveQuizBlockErrorValues {
  questionIds?: string[]
  titles?: string[]
  types?: string[]
  timeLimit?: string
}

export interface ElementStackFormValues {
  displayName?: string
  description?: string
  elements: {
    id: number
    title: string
    type: ElementType
    hasSampleSolution: boolean
  }[]
}

export interface ElementStackErrorValues {
  displayName?: string
  description?: string
  elements?:
    | string
    | {
        id: string
        title: string
        type: string
        hasSampleSolution: string
      }[]
}

export interface LiveSessionFormValues extends CommonFormValues {
  blocks: LiveQuizBlockFormValues[]
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
  maxBonusPoints: number
  timeToZeroBonus: number
}

export interface MicroLearningFormValues extends CommonFormValues {
  stacks: ElementStackFormValues[]
  startDate: string
  endDate: string
}

export interface PracticeQuizFormValues extends CommonFormValues {
  stacks: ElementStackFormValues[]
  order: ElementOrderType
  availableFrom?: string
  resetTimeDays: string
}

export interface GroupActivityFormValues extends CommonFormValues {
  stack: ElementStackFormValues
  startDate: string
  endDate: string
  clues: GroupActivityClueFormValues[]
}

export type CreationFormValues =
  | LiveSessionFormValues
  | MicroLearningFormValues
  | PracticeQuizFormValues
  | GroupActivityFormValues

interface WizardLayoutProps {
  title: string
  editMode: boolean
  activeStep: number
  setActiveStep: (ix: number) => void
  disabledFrom: number
  workflowItems: {
    title: string
    tooltip?: string
    tooltipDisabled?: string
  }[]
  completionStep: React.ReactElement
  steps: React.ReactElement[]
  isCompleted: boolean
  saveFormData: () => void
}

function WizardLayout({
  title,
  editMode,
  activeStep,
  setActiveStep,
  disabledFrom,
  workflowItems,
  completionStep,
  steps,
  isCompleted,
  saveFormData,
}: WizardLayoutProps) {
  const t = useTranslations()

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-6 flex-row items-end gap-8">
        <H2 className={{ root: 'm-0 flex flex-none items-end' }}>
          {editMode
            ? t('manage.questionForms.editElement', { element: title })
            : t('manage.questionForms.createElement', { element: title })}
        </H2>
        <Workflow
          minimal
          showTooltipSymbols
          items={workflowItems}
          onClick={(_, ix) => {
            saveFormData()
            setActiveStep(ix)
          }}
          activeIx={activeStep}
          disabledFrom={disabledFrom}
          className={{
            item: 'hidden first:rounded-l-md last:rounded-r-md md:flex',
          }}
        />
      </div>

      <div className="flex h-full w-full flex-1 flex-col justify-between gap-1 pt-4">
        {!isCompleted && steps[activeStep]}
        {isCompleted && completionStep}
      </div>
    </div>
  )
}

export default WizardLayout
