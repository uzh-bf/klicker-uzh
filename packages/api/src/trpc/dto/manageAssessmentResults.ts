import type { ElementData } from '@klicker-uzh/types'
import type {
  LiveQuizStudentAssessmentBlock,
  PointCorrectionHistoryItem,
} from '../../services/manageAssessmentResults.js'
import { toPreviewElementData } from './elementPreview.js'

export function toLiveQuizStudentAssessmentResponsesDto(
  blocks: LiveQuizStudentAssessmentBlock[] | null
) {
  if (!blocks) return null

  return blocks.map((block) => ({
    blockId: block.blockId,
    instances: block.instances.map((instanceResult) => ({
      ...instanceResult,
      instance: {
        id: instanceResult.instance.id,
        type: instanceResult.instance.type,
        elementType: instanceResult.instance.elementType,
        options: instanceResult.instance.options,
        elementData: toPreviewElementData(
          instanceResult.instance.elementData as ElementData
        ),
      },
    })),
  }))
}

export function toPreviousPointCorrectionsDto(
  corrections: PointCorrectionHistoryItem[]
) {
  return corrections.map((correction) => ({
    id: correction.id,
    type: correction.type,
    basePoints: correction.basePoints,
    correctnessPoints: correction.correctnessPoints,
    bonusPoints: correction.bonusPoints,
    reason: correction.reason,
    studentReason: correction.studentReason,
    createdAt: correction.createdAt,
    correctedBy: correction.correctedBy ?? null,
    participant: correction.participant ?? null,
    participants: correction.participants ?? null,
    liveQuiz: correction.liveQuiz ?? null,
    instance: correction.instance ?? null,
  }))
}
