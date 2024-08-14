import {
  ElementOrderType,
  ElementType,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import { H2, Workflow } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

export type GroupActivityClueFormValues =
  | {
      name: string
      displayName: string
      type: ParameterType.String
      value: string
    }
  | {
      name: string
      displayName: string
      type: ParameterType.Number
      value: string
      unit: string
    }

interface CommonFormValues {
  name: string
  displayName: string
  description: string
  courseId: string
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
  elementIds: number[]
  titles: string[]
  types: ElementType[]
  hasSampleSolutions: boolean[]
}

export interface ElementStackErrorValues {
  displayName?: string
  description?: string
  elementIds: string[]
  titles: string[]
  types: string[]
  hasSampleSolutions: string[]
}

export interface LiveSessionFormValues extends CommonFormValues {
  blocks: LiveQuizBlockFormValues[]
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
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
    <div className="h-full w-full flex flex-col">
      <div className="flex flex-row items-end gap-8 h-6">
        <H2 className={{ root: 'flex flex-none m-0 items-end' }}>
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
            item: 'last:rounded-r-md first:rounded-l-md hidden md:flex',
          }}
        />
      </div>

      <div className="flex flex-1 w-full justify-between gap-1 py-4">
        {!isCompleted && (
          <div className="flex flex-col justify-between w-full h-full">
            <div>{steps[activeStep]}</div>
          </div>
        )}
        {isCompleted && completionStep}
      </div>
    </div>
  )
}

export default WizardLayout
