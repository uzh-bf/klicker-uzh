import * as DB from '@klicker-uzh/prisma/client'

export type AdaptivePracticeQuizNodeOverrideInput = {
  nodeId: number
  enabled: boolean
  weight?: number | null
  questionCap?: number | null
}

export type AdaptivePracticeQuizElementOverrideInput = {
  assignmentId: number
  enabled: boolean
  discrimination?: number | null
}

export type AdaptivePracticeQuizResearchSettingsInput = {
  levelMappingRule?: DB.AdaptiveLevelMappingRule | null
  attemptSelectionPolicy?: DB.AdaptiveAttemptSelectionPolicy | null
  topInformationRatio?: number | null
  defaultDiscrimination?: number | null
}

export type AdaptivePracticeQuizConfigInput = {
  competenceTreeId: string
  scaleVersionId?: string | null
  preset: DB.AdaptivePracticeQuizPreset
  totalQuestionCap?: number | null
  perLeafQuestionCap?: number | null
  minQuestionsPerLeaf?: number | null
  classificationZ?: number | null
  showTimer?: boolean | null
  nodeOverrides?: AdaptivePracticeQuizNodeOverrideInput[] | null
  elementOverrides?: AdaptivePracticeQuizElementOverrideInput[] | null
  researchSettings?: AdaptivePracticeQuizResearchSettingsInput | null
}

export type AdaptivePracticeQuizConfigView = Pick<
  DB.PracticeQuizAdaptiveConfig,
  | 'competenceTreeId'
  | 'scaleVersionId'
  | 'measurementVersion'
  | 'calibrationPolicyVersion'
  | 'preset'
  | 'attemptSelectionPolicy'
  | 'totalQuestionCap'
  | 'perLeafQuestionCap'
  | 'minQuestionsPerLeaf'
  | 'classificationZ'
  | 'topInformationRatio'
  | 'defaultDiscrimination'
  | 'levelMappingRule'
  | 'showTimer'
>
