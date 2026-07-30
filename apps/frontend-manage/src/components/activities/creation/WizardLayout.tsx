import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizPreset,
  ElementOrderType,
  ElementType,
  ParameterType,
  PracticeQuizMode,
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

export interface ElementInstanceFormInput {
  id: number
  title: string
  type: ElementType
  hasSampleSolution: boolean
  existingInstanceId: number | null
  duplicateInstance: boolean
}

export interface ElementBlockFormValues {
  timeLimit?: number
  elements: ElementInstanceFormInput[]
}

export interface ElementStackFormValues {
  displayName?: string
  description?: string
  elements: ElementInstanceFormInput[]
}

export interface ElementBlockErrorValues {
  timeLimit?: string
  elements?:
    | string
    | {
        id: string
        title: string
        type: string
        hasSampleSolution: string
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

export interface LiveQuizFormValues extends CommonFormValues {
  blocks: ElementBlockFormValues[]
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  isPinProtected: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
  defaultPoints: number
  defaultCorrectPoints: number
  maxBonusPoints: number
  timeToZeroBonus: number
}

export interface MicroLearningFormValues extends CommonFormValues {
  stacks: ElementStackFormValues[]
  startDate: Date
  endDate: Date
}

export interface AdaptivePracticeQuizNodeOverrideFormValues {
  nodeId: number
  enabled: boolean
  weight: string
  questionCap: string
}

export interface AdaptivePracticeQuizElementOverrideFormValues {
  assignmentId: number
  enabled: boolean
  discrimination: string
}

export interface AdaptivePracticeQuizConfigFormValues {
  competenceTreeId?: string
  preset: AdaptivePracticeQuizPreset
  totalQuestionCap: string
  perLeafQuestionCap: string
  minQuestionsPerLeaf: string
  classificationZ: string
  showTimer: boolean
  attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy
  levelMappingRule: AdaptiveLevelMappingRule
  topInformationRatio: string
  defaultDiscrimination: string
  nodeOverrides: AdaptivePracticeQuizNodeOverrideFormValues[]
  elementOverrides: AdaptivePracticeQuizElementOverrideFormValues[]
}

export interface PracticeQuizFormValues extends CommonFormValues {
  mode: PracticeQuizMode
  adaptiveConfig: AdaptivePracticeQuizConfigFormValues
  stacks: ElementStackFormValues[]
  order: ElementOrderType
  resetTimeDays: string
}

export interface GroupActivityFormValues extends CommonFormValues {
  stack: ElementStackFormValues
  startDate: Date
  endDate: Date
  clues: GroupActivityClueFormValues[]
}

export type CreationFormValues =
  | LiveQuizFormValues
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
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-6 flex-row items-end gap-8">
        <H2 className={{ root: 'm-0 flex flex-none items-end' }}>
          {editMode
            ? t('manage.elements.editElement', { element: title })
            : t('manage.elements.createElement', { element: title })}
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

      <div className="flex min-h-0 w-full flex-1 flex-col justify-between gap-1 pt-4">
        {!isCompleted && steps[activeStep]}
        {isCompleted && completionStep}
      </div>
    </div>
  )
}

export default WizardLayout
