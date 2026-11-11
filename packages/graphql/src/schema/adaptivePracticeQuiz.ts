import { createAdaptivePracticeQuizSchema } from '@klicker-uzh/adaptive-server/schema/adaptivePracticeQuiz'
import builder from '../builder.js'
import { AdaptiveLevelMappingRule, AdaptiveNodeKind } from './competenceTree.js'
import { ElementType } from './elementData.js'
import { PracticeQuizMode } from './practiceQuiz.js'

export const {
  AdaptivePracticeQuizPreset,
  AdaptiveAttemptSelectionPolicy,
  AdaptivePracticeQuizNodeOverrideInputRef,
  AdaptivePracticeQuizNodeOverrideInput,
  AdaptivePracticeQuizElementOverrideInputRef,
  AdaptivePracticeQuizElementOverrideInput,
  AdaptivePracticeQuizResearchSettingsInputRef,
  AdaptivePracticeQuizResearchSettingsInput,
  AdaptivePracticeQuizConfigInputRef,
  AdaptivePracticeQuizConfigInput,
  AdaptivePracticeQuizConfig,
  AdaptivePracticeQuizLevel,
  AdaptivePracticeQuizTree,
  AdaptivePracticeQuizNode,
  AdaptivePracticeQuizAssignment,
  AdaptiveReadinessIssueParametersType,
  AdaptiveReadinessIssueType,
  AdaptiveCoverageReadinessType,
  AdaptiveRootReachabilityType,
  AdaptiveQuizReadinessRef,
  AdaptiveQuizReadinessType,
  AdaptivePracticeQuizPreviewRef,
  AdaptivePracticeQuizPreviewType,
  AdaptivePracticeQuizSetupPreviewRef,
  AdaptivePracticeQuizSetupPreviewType,
  PracticeQuizPublicationPreviewRef,
  PracticeQuizPublicationPreviewType,
} = createAdaptivePracticeQuizSchema(builder, {
  AdaptiveLevelMappingRule,
  AdaptiveNodeKind,
  ElementType,
  PracticeQuizMode,
})
