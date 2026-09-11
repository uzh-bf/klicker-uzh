import type { AssessmentBaselineContent } from '@klicker-uzh/audit'
import { hashCanonicalValue } from '@klicker-uzh/audit'
import type {
  ElementData,
  ElementInstanceOptions,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
} from '@klicker-uzh/types'

type BaselineBlockStatus = 'SCHEDULED' | 'ACTIVE' | 'EXECUTED'

export type AssessmentBaselineSnapshot = {
  id: string
  name: string
  displayName: string
  description: string | null
  accessMode: 'PUBLIC' | 'RESTRICTED'
  status: string
  reviewStatus: string
  availableFrom: Date | null
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isModerationEnabled: boolean
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  isDeleted?: boolean
  areInstancesOutdated: boolean
  pointsMultiplier: number
  defaultPoints: number
  defaultCorrectPoints: number
  maxBonusPoints: number
  timeToZeroBonus: number
  activeBlockId: number | null
  courseId: string | null
  pinCode?: string | null
  blocks: Array<{
    id: number
    order: number
    timeLimit: number | null
    expiresAt: Date | null
    randomSelection: number | null
    execution: number
    status: BaselineBlockStatus
    startedAt: Date | null
    closedAt: Date | null
    elements: Array<{
      id: number
      order: number
      elementId: number
      isVersionOutdated: boolean
      options: ElementInstanceOptions
      elementData: ElementData
    }>
  }>
  participations: Array<{ participantId: string; isActive: boolean }>
  permissions: Array<{
    userId: string
    permissionLevel: string
    effective: boolean
  }>
}

function collectStringLeaves(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    output.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const nested of value) collectStringLeaves(nested, output)
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) {
      collectStringLeaves(nested, output)
    }
  }
}

export function assessmentBaselineMarkdown(
  snapshot: AssessmentBaselineSnapshot
): string[] {
  const markdown: string[] = []
  if (snapshot.description !== null) markdown.push(snapshot.description)
  for (const block of snapshot.blocks) {
    for (const element of block.elements) {
      collectStringLeaves(element.elementData, markdown)
    }
  }
  return markdown
}

type CapturedMediaState = Extract<
  AssessmentBaselineContent,
  { kind: 'MEDIA_REFERENCE' }
>['media']

type BaselineLimitation = Extract<
  AssessmentBaselineContent,
  { kind: 'LIMITATION' }
>

export function sourceElementVersion(elementData: ElementData): number {
  const match = elementData.id.match(/-v([1-9]\d*)$/u)
  if (
    match?.[1] === undefined ||
    elementData.elementId <= 0 ||
    !Number.isSafeInteger(elementData.elementId)
  ) {
    throw new Error(
      `Element instance has invalid source version identity ${elementData.id}`
    )
  }
  return Number(match[1])
}

export function mapContentOptions(elementData: ElementData) {
  switch (elementData.type) {
    case 'SC':
    case 'MC':
    case 'KPRIM': {
      const options = elementData.options as ElementOptionsChoices
      return {
        kind: elementData.type,
        displayMode: options.displayMode,
        options: options.choices.map((choice) => ({
          optionId: choice.ix,
          value: choice.value,
          feedback: choice.feedback ?? null,
        })),
      } as const
    }
    case 'FREE_TEXT': {
      const options = elementData.options as ElementOptionsFreeText
      return {
        kind: 'FREE_TEXT',
        placeholder: null,
        maximumLength: options.restrictions?.maxLength ?? null,
      } as const
    }
    case 'NUMERICAL': {
      const options = elementData.options as ElementOptionsNumerical
      return {
        kind: 'NUMERICAL',
        unit: options.unit ?? null,
        accuracy: options.accuracy ?? null,
        placeholder: options.placeholder ?? null,
        restrictions:
          options.restrictions === undefined || options.restrictions === null
            ? null
            : {
                minimum: options.restrictions.min ?? null,
                maximum: options.restrictions.max ?? null,
              },
      } as const
    }
    case 'SELECTION': {
      const options = elementData.options as ElementOptionsSelection
      if (options.answerCollection === undefined) {
        throw new Error('Selection baseline is missing its answer collection')
      }
      return {
        kind: 'SELECTION',
        numberOfInputs: options.numberOfInputs,
        answerCollectionId: options.answerCollection.id,
        items: options.answerCollection.entries.map((entry) => ({
          itemId: entry.id,
          value: entry.value,
        })),
      } as const
    }
    case 'CASE_STUDY': {
      const options = elementData.options as ElementOptionsCaseStudy
      if (options.items === undefined) {
        throw new Error('Case-study baseline is missing its selected items')
      }
      return {
        kind: 'CASE_STUDY',
        answerCollectionId: options.answerCollectionId ?? null,
        items: options.items.map((entry) => ({
          itemId: entry.id,
          value: entry.value,
        })),
        criteria: options.criteria.map((criterion) => ({
          criterionId: criterion.id,
          name: criterion.name,
          order: criterion.order ?? null,
          minimum: criterion.min,
          maximum: criterion.max,
          step: criterion.step,
          unit: criterion.unit ?? null,
          labels:
            criterion.labels === undefined || criterion.labels === null
              ? null
              : {
                  minimum: criterion.labels.min,
                  midpoint: criterion.labels.mid ?? null,
                  maximum: criterion.labels.max,
                },
        })),
        cases: options.cases.map((caseItem) => ({
          caseId: caseItem.id,
          title: caseItem.title,
          description: caseItem.description,
          order: caseItem.order ?? null,
        })),
      } as const
    }
    case 'CONTENT':
      return { kind: 'CONTENT' } as const
    case 'FLASHCARD':
      return { kind: 'FLASHCARD' } as const
  }
}

export function mapScoringRules(elementData: ElementData) {
  switch (elementData.type) {
    case 'SC':
    case 'MC':
    case 'KPRIM': {
      const options = elementData.options as ElementOptionsChoices
      return {
        kind: elementData.type,
        correctOptionIds: options.choices
          .filter((choice) => choice.correct === true)
          .map((choice) => choice.ix),
      } as const
    }
    case 'FREE_TEXT': {
      const options = elementData.options as ElementOptionsFreeText
      return {
        kind: 'FREE_TEXT',
        acceptedAnswers: options.solutions ?? [],
      } as const
    }
    case 'NUMERICAL': {
      const options = elementData.options as ElementOptionsNumerical
      return {
        kind: 'NUMERICAL',
        exactSolutions: options.exactSolutions ?? [],
        solutionRanges: (options.solutionRanges ?? []).map((range) => ({
          minimum: range.min ?? null,
          maximum: range.max ?? null,
        })),
      } as const
    }
    case 'SELECTION': {
      const options = elementData.options as ElementOptionsSelection
      return {
        kind: 'SELECTION',
        correctItemIds: options.answerCollectionSolutionIds ?? [],
      } as const
    }
    case 'CASE_STUDY': {
      const options = elementData.options as ElementOptionsCaseStudy
      return {
        kind: 'CASE_STUDY',
        cases: options.cases
          .map((caseItem) => ({
            caseId: caseItem.id,
            items: (caseItem.solutions ?? [])
              .map((solution) => ({
                itemId: solution.itemId,
                criteria: solution.criteriaSolutions
                  .map((criterion) => ({
                    criterionId: criterion.criterionId,
                    minimum: criterion.min,
                    maximum: criterion.max,
                  }))
                  .sort((left, right) =>
                    left.criterionId.localeCompare(right.criterionId)
                  ),
              }))
              .sort((left, right) => left.itemId - right.itemId),
          }))
          .sort((left, right) => left.caseId.localeCompare(right.caseId)),
      } as const
    }
    case 'CONTENT':
      return { kind: 'CONTENT' } as const
    case 'FLASHCARD':
      return { kind: 'FLASHCARD' } as const
  }
}

function mapElementParts(
  blockId: number,
  element: AssessmentBaselineSnapshot['blocks'][number]['elements'][number]
): AssessmentBaselineContent[] {
  const effectiveContent = {
    elementType: element.elementData.type,
    name: element.elementData.name,
    content: element.elementData.content,
    explanation: element.elementData.explanation ?? null,
    hasSampleSolution:
      'hasSampleSolution' in element.elementData.options
        ? (element.elementData.options.hasSampleSolution ?? false)
        : false,
    hasAnswerFeedbacks:
      'hasAnswerFeedbacks' in element.elementData.options
        ? (element.elementData.options.hasAnswerFeedbacks ?? false)
        : false,
    contentOptions: mapContentOptions(element.elementData),
  }
  const scoring = {
    elementType: element.elementData.type,
    basePointsEnabled:
      element.options.basePoints ?? element.elementData.basePoints,
    pointsMultiplier:
      element.options.pointsMultiplier ?? element.elementData.pointsMultiplier,
    scoringRules: mapScoringRules(element.elementData),
  }

  return [
    {
      kind: 'ELEMENT_INSTANCE',
      elementInstanceId: element.id,
      blockId,
      order: element.order,
      sourceElementId: element.elementId,
      sourceElementVersion: sourceElementVersion(element.elementData),
      isVersionOutdated: element.isVersionOutdated,
      effectiveContent,
      effectiveContentHash: hashCanonicalValue(effectiveContent),
    },
    {
      kind: 'SOLUTION_AND_SCORING',
      elementInstanceId: element.id,
      scoring,
      effectiveSolutionHash: hashCanonicalValue(scoring),
      algorithmVersion: 'klicker-grading-v1',
    },
  ]
}

export function assessmentConfigurationState(
  snapshot: AssessmentBaselineSnapshot
) {
  return {
    name: snapshot.name,
    displayName: snapshot.displayName,
    description: snapshot.description,
    accessMode: snapshot.accessMode,
    publicationStatus: snapshot.status,
    reviewStatus: snapshot.reviewStatus,
    availableFrom: snapshot.availableFrom?.toISOString() ?? null,
    isLiveQAEnabled: snapshot.isLiveQAEnabled,
    isConfusionFeedbackEnabled: snapshot.isConfusionFeedbackEnabled,
    isModerationEnabled: snapshot.isModerationEnabled,
    isGamificationEnabled: snapshot.isGamificationEnabled,
    isAssessmentEnabled: snapshot.isAssessmentEnabled,
    areInstancesOutdated: snapshot.areInstancesOutdated,
    pointsMultiplier: snapshot.pointsMultiplier,
    defaultPoints: snapshot.defaultPoints,
    defaultCorrectPoints: snapshot.defaultCorrectPoints,
    maximumBonusPoints: snapshot.maxBonusPoints,
    secondsToZeroBonus: snapshot.timeToZeroBonus,
    activeBlockId: snapshot.activeBlockId,
  }
}

export function assessmentBlockState(
  block: AssessmentBaselineSnapshot['blocks'][number]
) {
  return {
    blockId: block.id,
    order: block.order,
    timeLimitSeconds: block.timeLimit,
    expiresAt: block.expiresAt?.toISOString() ?? null,
    randomSelectionCount: block.randomSelection,
    execution: block.execution,
    status: block.status,
    startedAt: block.startedAt?.toISOString() ?? null,
    closedAt: block.closedAt?.toISOString() ?? null,
  }
}

export function assessmentElementInstanceState(
  blockId: number,
  element: AssessmentBaselineSnapshot['blocks'][number]['elements'][number]
) {
  const [contentPart, scoringPart] = mapElementParts(blockId, element)
  if (
    contentPart?.kind !== 'ELEMENT_INSTANCE' ||
    scoringPart?.kind !== 'SOLUTION_AND_SCORING'
  ) {
    throw new Error('Assessment element snapshot is incomplete')
  }
  return {
    elementInstanceId: contentPart.elementInstanceId,
    blockId: contentPart.blockId,
    order: contentPart.order,
    sourceElementId: contentPart.sourceElementId,
    sourceElementVersion: contentPart.sourceElementVersion,
    isVersionOutdated: contentPart.isVersionOutdated,
    effectiveElement: {
      content: contentPart.effectiveContent,
      scoring: scoringPart.scoring,
    },
    effectiveContentHash: contentPart.effectiveContentHash,
    effectiveSolutionHash: scoringPart.effectiveSolutionHash,
  }
}

export function assessmentSourceElementState(
  elementData: ElementData,
  effectiveContentChanged: boolean
) {
  const sourceElement = {
    content: {
      elementType: elementData.type,
      name: elementData.name,
      content: elementData.content,
      explanation: elementData.explanation ?? null,
      hasSampleSolution:
        'hasSampleSolution' in elementData.options
          ? (elementData.options.hasSampleSolution ?? false)
          : false,
      hasAnswerFeedbacks:
        'hasAnswerFeedbacks' in elementData.options
          ? (elementData.options.hasAnswerFeedbacks ?? false)
          : false,
      contentOptions: mapContentOptions(elementData),
    },
    scoring: {
      elementType: elementData.type,
      basePointsEnabled: elementData.basePoints,
      pointsMultiplier: elementData.pointsMultiplier,
      scoringRules: mapScoringRules(elementData),
    },
  }
  return {
    sourceElementId: elementData.elementId,
    sourceElementVersion: sourceElementVersion(elementData),
    sourceElement,
    sourceContentHash: hashCanonicalValue(sourceElement),
    effectiveContentChanged,
  }
}

export function buildAssessmentBaselineContents(input: {
  snapshot: AssessmentBaselineSnapshot
  capturedMedia: readonly CapturedMediaState[]
  limitations: readonly BaselineLimitation[]
}): AssessmentBaselineContent[] {
  const { snapshot } = input
  const contents: AssessmentBaselineContent[] = [
    {
      kind: 'ASSESSMENT_CONFIGURATION',
      courseId: snapshot.courseId,
      configuration: assessmentConfigurationState(snapshot),
    },
  ]

  for (const block of [...snapshot.blocks].sort(
    (left, right) => left.order - right.order || left.id - right.id
  )) {
    contents.push({
      kind: 'BLOCK',
      block: assessmentBlockState(block),
    })
    for (const element of [...block.elements].sort(
      (left, right) => left.order - right.order || left.id - right.id
    )) {
      contents.push(...mapElementParts(block.id, element))
    }
  }

  contents.push(
    ...[...snapshot.participations]
      .filter((participation) => participation.isActive)
      .sort((left, right) =>
        left.participantId.localeCompare(right.participantId)
      )
      .map(
        (participation): AssessmentBaselineContent => ({
          kind: 'PARTICIPANT_ELIGIBILITY',
          participantId: participation.participantId,
          eligible: true,
        })
      ),
    ...[...snapshot.permissions]
      .sort((left, right) => left.userId.localeCompare(right.userId))
      .map(
        (permission): AssessmentBaselineContent => ({
          kind: 'LECTURER_PERMISSION',
          userId: permission.userId,
          permission: permission.permissionLevel,
          effective: permission.effective,
        })
      ),
    ...input.capturedMedia.map(
      (media): AssessmentBaselineContent => ({
        kind: 'MEDIA_REFERENCE',
        media,
      })
    ),
    ...input.limitations
  )

  return contents
}
