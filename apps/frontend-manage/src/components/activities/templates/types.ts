import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { ElementFormTypes } from '../../elements/manipulation/types'

export type ActivityTemplateElementFormValues = {
  processed: boolean // boolean to signal that this instance has been processed / adapted if desired
  useTemplateInstance: boolean // boolean to signal that this instance should be directly copied from the template
  useExistingElement: boolean // boolean to signal that an existing element should be loaded into the template
  useNewElement: boolean // boolean to signal that a new element was entered by the user
  instance: ElementInstance // original instance information from the template
  formValues: ElementFormTypes | null // form values for the element, if the user has chosen to insert their own content
  elementId: number | null // id of the existing element that should be loaded into the template
  elementName: string | null // (only UI / form) name of the existing element that should be loaded into the template
}

export type LiveQuizTemplateFormValues = {
  // common form values relevant for live quiz
  name: string
  displayName: string
  description?: string
  courseId?: string
  multiplier: string // ! fixed (but shown)
  settingsProcessed: boolean // boolean to signal that the settings have been processed / adapted if desired

  // live quiz settings (same as in wizard)
  isGamificationEnabled: boolean // ! customizable / fixed depending on course settings (shown)
  isAssessmentEnabled: boolean // ! fixed (but shown)
  isConfusionFeedbackEnabled: boolean // ! irrelevant = hidden
  isLiveQAEnabled: boolean // ! irrelevant = hidden
  isModerationEnabled: boolean // ! irrelevant = hidden
  defaultPoints: number // ! fixed (but illustrated)
  defaultCorrectPoints: number // ! fixed (but illustrated)
  maxBonusPoints: number // ! fixed (but illustrated)
  timeToZeroBonus: number // ! fixed (but illustrated)

  // blocks with optionally identical or modified elements
  blocks: {
    timeLimit?: string // optional time limit to be set through custom dialog
    isEscapeRoom?: boolean
    escapeRoomTimeLimit?: number
    escapeRoomHintPenalty?: number
    escapeRoomLockoutSeconds?: number
    escapeRoomIntroText?: string | null
    elements: ActivityTemplateElementFormValues[]
  }[]
}
