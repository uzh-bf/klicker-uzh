import { LiveQuiz } from '@klicker-uzh/graphql/dist/ops'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import { useMemo } from 'react'
import { LiveQuizTemplateFormValues } from '../types'

function useInitialLiveQuizTemplateFormData({
  liveQuiz,
}: {
  liveQuiz?: LiveQuiz | null
}) {
  return useMemo((): LiveQuizTemplateFormValues | undefined => {
    if (!liveQuiz) {
      return undefined
    }

    return {
      name: liveQuiz.name,
      displayName: liveQuiz.displayName,
      description: liveQuiz.description ?? undefined,
      courseId: 'no-course-selected',
      multiplier: String(liveQuiz.pointsMultiplier),
      settingsProcessed: false,

      isGamificationEnabled: false, // initialized without course assignment -> default is false
      isAssessmentEnabled: false, // initialized without course assignment -> default is false
      isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
      isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
      isModerationEnabled: liveQuiz.isModerationEnabled,
      defaultPoints: liveQuiz.defaultPoints ?? LQ_DEFAULT_POINTS,
      defaultCorrectPoints:
        liveQuiz.defaultCorrectPoints ?? LQ_DEFAULT_CORRECT_POINTS,
      maxBonusPoints: liveQuiz.maxBonusPoints ?? LQ_MAX_BONUS_POINTS,
      timeToZeroBonus: liveQuiz.timeToZeroBonus ?? LQ_TIME_TO_ZERO_BONUS,

      blocks:
        liveQuiz.blocks?.map((block) => ({
          timeLimit: block.timeLimit ? String(block.timeLimit) : undefined,
          isEscapeRoom: !!block.escapeRoomConfig,
          escapeRoomTimeLimit: block.escapeRoomConfig?.timeLimit,
          escapeRoomHintPenalty: block.escapeRoomConfig?.hintPenalty,
          escapeRoomLockoutSeconds: block.escapeRoomConfig?.lockoutSeconds,
          escapeRoomIntroText: block.escapeRoomConfig?.introText,
          elements:
            block.elements?.map((element) => ({
              processed: false,
              useTemplateInstance: false,
              useExistingElement: false,
              useNewElement: false,
              instance: element,
              formValues: null,
              elementId: null,
              elementName: null,
            })) ?? [],
        })) ?? [],
    }
  }, [liveQuiz])
}

export default useInitialLiveQuizTemplateFormData
