import type { ElementType } from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  GroupActivityDecision,
  GroupActivityResults,
} from '@klicker-uzh/types'
import type { GroupActivityGradingSource } from '../../services/manageGroupActivityGrading.js'
import { toPreviewElementData } from './elementPreview.js'

type ElementInstanceOptionsDto = {
  __typename: 'ElementInstanceOptions'
  pointsMultiplier: number | null
}

function getElementInstanceOptionsDto(
  options: unknown
): ElementInstanceOptionsDto | null {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return null
  }

  const pointsMultiplier = (options as { pointsMultiplier?: unknown })
    .pointsMultiplier

  return {
    __typename: 'ElementInstanceOptions' as const,
    pointsMultiplier:
      typeof pointsMultiplier === 'number' ? pointsMultiplier : null,
  }
}

function toGroupActivityDecisionDto(decision: GroupActivityDecision) {
  return {
    __typename: 'GroupActivityDecision' as const,
    instanceId: decision.instanceId,
    type: decision.type as ElementType,
    freeTextResponse: decision.freeTextResponse ?? null,
    choicesResponse:
      decision.choicesResponse?.map((choice) => ({
        __typename: 'ChoicesResponseObject' as const,
        ix: choice.ix,
        selected: choice.selected,
      })) ?? null,
    numericalResponse: decision.numericalResponse ?? null,
    contentResponse: decision.contentResponse ?? null,
    selectionResponse: decision.selectionResponse ?? null,
    caseStudyResponse:
      decision.caseStudyResponse?.map((caseItem) => ({
        __typename: 'SingleQuestionResponseCaseStudyCase' as const,
        caseId: caseItem.caseId,
        itemResponses: caseItem.itemResponses.map((item) => ({
          __typename: 'SingleQuestionResponseCaseStudyItem' as const,
          itemId: item.itemId,
          criterionResponses: item.criterionResponses.map((criterion) => ({
            __typename: 'SingleQuestionResponseCaseStudyCriterion' as const,
            criterionId: criterion.criterionId,
            response: criterion.response,
          })),
        })),
      })) ?? null,
  }
}

function toGroupActivityResultsDto(results: GroupActivityResults | null) {
  if (!results) return null

  return {
    __typename: 'GroupActivityResults' as const,
    passed: results.passed,
    points: results.points,
    comment: results.comment ?? null,
    grading: results.grading.map((grading) => ({
      __typename: 'GroupActivityGrading' as const,
      instanceId: grading.instanceId,
      score: grading.score,
      maxPoints: grading.maxPoints,
      feedback: grading.feedback ?? null,
    })),
  }
}

export function toGroupActivityGradingDto(
  groupActivity: GroupActivityGradingSource | null
) {
  if (!groupActivity) return null

  return {
    __typename: 'GroupActivity' as const,
    id: groupActivity.id,
    name: groupActivity.name,
    displayName: groupActivity.displayName,
    description: groupActivity.description ?? null,
    status: groupActivity.status,
    pointsMultiplier: groupActivity.pointsMultiplier,
    scheduledStartAt: groupActivity.scheduledStartAt,
    scheduledEndAt: groupActivity.scheduledEndAt,
    clues:
      groupActivity.clues?.map((clue) => ({
        __typename: 'GroupActivityClue' as const,
        id: clue.id,
        type: clue.type,
        name: clue.name,
        displayName: clue.displayName,
        value: clue.value,
        unit: clue.unit ?? null,
      })) ?? null,
    stacks:
      groupActivity.stacks?.map((stack) => ({
        __typename: 'ElementStack' as const,
        id: stack.id,
        displayName: stack.displayName ?? null,
        description: stack.description ?? null,
        elements:
          stack.elements?.map((element) => ({
            __typename: 'ElementInstance' as const,
            id: element.id,
            type: element.type,
            elementType: element.elementType,
            options: getElementInstanceOptionsDto(element.options),
            elementData: toPreviewElementData(
              element.elementData as unknown as ElementData
            ),
          })) ?? null,
      })) ?? null,
    activityInstances:
      groupActivity.activityInstances?.map((instance) => ({
        __typename: 'GroupActivityInstance' as const,
        id: instance.id,
        groupActivityId: instance.groupActivityId,
        decisionsSubmittedAt: instance.decisionsSubmittedAt ?? null,
        decisions:
          (instance.decisions as GroupActivityDecision[] | null)?.map(
            toGroupActivityDecisionDto
          ) ?? null,
        resultsComputedAt: instance.resultsComputedAt ?? null,
        results: toGroupActivityResultsDto(
          instance.results as GroupActivityResults | null
        ),
        groupName: instance.groupName,
      })) ?? null,
  }
}
