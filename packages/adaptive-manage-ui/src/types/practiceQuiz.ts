import type {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizPreset,
  ElementOrderType,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { FormikProps } from 'formik'
import type * as yup from 'yup'
import type {
  QAdaptivePracticeQuizPreviewWithRuntimeLimitsQuery,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

export type AdaptivePracticeQuizConfigFormValues = {
  competenceTreeId?: string
  scaleVersionId?: string
  preset: AdaptivePracticeQuizPreset
  timeLimitMinutes?: string
  totalQuestionCap: string
  perLeafQuestionCap: string
  minQuestionsPerLeaf: string
  minItemsPerCoverageCell: string
  classificationZ: string
  showTimer: boolean
  attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy
  levelMappingRule: AdaptiveLevelMappingRule
  topInformationRatio: string
  defaultDiscrimination: string
  nodeOverrides: {
    nodeId: number
    enabled: boolean
    weight: string
    questionCap: string
  }[]
  elementOverrides: {
    assignmentId: number
    enabled: boolean
    discrimination: string
  }[]
}

export type PracticeQuizFormValues = {
  name: string
  displayName: string
  description: string
  courseId?: string
  courseStartDate?: Date
  courseEndDate?: Date
  courseGroupDeadline?: Date
  multiplier: string
  mode: PracticeQuizMode
  adaptiveConfig: AdaptivePracticeQuizConfigFormValues
  stacks: {
    displayName?: string
    description?: string
    elements: {
      id: number
      title: string
      type: ElementType
      hasSampleSolution: boolean
      existingInstanceId: number | null
      duplicateInstance: boolean
    }[]
  }[]
  order: ElementOrderType
  resetTimeDays: string
}

export type PracticeQuizWizardStepProps = {
  editMode: boolean
  formRef: RefObject<FormikProps<PracticeQuizFormValues> | null>
  formData: PracticeQuizFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: yup.AnyObjectSchema
  adaptiveInitialPreview?: NonNullable<
    QAdaptivePracticeQuizPreviewWithRuntimeLimitsQuery['adaptivePracticeQuizPreview']
  >
  onSubmit?: (values: PracticeQuizFormValues) => Promise<void>
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (values: PracticeQuizFormValues) => void
  closeWizard: () => void
}
