import * as DB from '@klicker-uzh/prisma/client'
import type {
  FlashcardGenerationConfiguration,
  GeneratedFlashcard,
  GeneratedFlashcardEditable,
  GeneratedQuestionCitation,
  GeneratedQuestionEditable,
  GeneratedQuestionOriginal,
  QuestionGenerationConfiguration,
  QuestionGenerationDesignSummary,
  QuestionGenerationPlanSummary,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import type {
  GeneratedElementEditableInput as GeneratedElementEditableInputValue,
  StartElementGenerationInput,
} from '../services/elementGeneration.js'

export type GeneratableElementType = 'SC' | 'MC' | 'KPRIM' | 'FLASHCARD'
type ElementGenerationLanguageValue = 'de' | 'en'
type ElementGenerationBloomLevelValue =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
type ElementGenerationDifficultyPresetValue =
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'EASY'
  | 'MIXED'
  | 'HARD'
type GeneratedElementCardTypeValue = 'definition' | 'formula' | 'calculation'

export const GeneratableElementType = builder.enumType(
  'GeneratableElementType',
  { values: ['SC', 'MC', 'KPRIM', 'FLASHCARD'] as const }
)
export const ElementGenerationLanguage = builder.enumType(
  'ElementGenerationLanguage',
  { values: ['de', 'en'] as const }
)
export const ElementGenerationBloomLevel = builder.enumType(
  'ElementGenerationBloomLevel',
  {
    values: ['remember', 'understand', 'apply', 'analyze', 'evaluate'] as const,
  }
)
export const ElementGenerationDifficultyPreset = builder.enumType(
  'ElementGenerationDifficultyPreset',
  {
    values: ['D1', 'D2', 'D3', 'D4', 'D5', 'EASY', 'MIXED', 'HARD'] as const,
  }
)
export const GeneratedElementCardType = builder.enumType(
  'GeneratedElementCardType',
  { values: ['definition', 'formula', 'calculation'] as const }
)
export const ElementGenerationBuildStatus = builder.enumType(
  'ElementGenerationBuildStatus',
  { values: Object.values(DB.ElementGenerationBuildStatus) }
)
export const ElementGenerationReviewGate = builder.enumType(
  'ElementGenerationReviewGate',
  { values: Object.values(DB.ElementGenerationReviewGate) }
)
export const ElementGenerationReviewDecision = builder.enumType(
  'ElementGenerationReviewDecision',
  { values: Object.values(DB.ElementGenerationReviewDecision) }
)
export const GeneratedElementDecision = builder.enumType(
  'GeneratedElementDecision',
  { values: Object.values(DB.GeneratedElementDecision) }
)

type ElementGenerationTypeCapability = {
  elementType: GeneratableElementType
  reviewGates: DB.ElementGenerationReviewGate[]
  supportsSourceScopes: boolean
  supportsDifficulty: boolean
  supportsBloomLevels: boolean
  supportsRetry: boolean
  supportsIncompletePublication: boolean
}
const ElementGenerationTypeCapabilityRef =
  builder.objectRef<ElementGenerationTypeCapability>(
    'ElementGenerationTypeCapability'
  )
ElementGenerationTypeCapabilityRef.implement({
  fields: (t) => ({
    elementType: t.field({
      type: GeneratableElementType,
      resolve: (capability) => capability.elementType,
    }),
    reviewGates: t.expose('reviewGates', {
      type: [ElementGenerationReviewGate],
    }),
    supportsSourceScopes: t.exposeBoolean('supportsSourceScopes'),
    supportsDifficulty: t.exposeBoolean('supportsDifficulty'),
    supportsBloomLevels: t.exposeBoolean('supportsBloomLevels'),
    supportsRetry: t.exposeBoolean('supportsRetry'),
    supportsIncompletePublication: t.exposeBoolean(
      'supportsIncompletePublication'
    ),
  }),
})

export type ElementGenerationCapabilitiesView = {
  elementTypes: GeneratableElementType[]
  languages: ElementGenerationLanguageValue[]
  bloomLevels: ElementGenerationBloomLevelValue[]
  difficultyLevels: number[]
  typeCapabilities: ElementGenerationTypeCapability[]
  supportsIndividualRegeneration: boolean
  configured: boolean
}
export const ElementGenerationCapabilitiesRef =
  builder.objectRef<ElementGenerationCapabilitiesView>(
    'ElementGenerationCapabilities'
  )
ElementGenerationCapabilitiesRef.implement({
  fields: (t) => ({
    elementTypes: t.expose('elementTypes', { type: [GeneratableElementType] }),
    languages: t.expose('languages', { type: [ElementGenerationLanguage] }),
    bloomLevels: t.expose('bloomLevels', {
      type: [ElementGenerationBloomLevel],
    }),
    difficultyLevels: t.exposeIntList('difficultyLevels'),
    typeCapabilities: t.expose('typeCapabilities', {
      type: [ElementGenerationTypeCapabilityRef],
    }),
    supportsIndividualRegeneration: t.exposeBoolean(
      'supportsIndividualRegeneration'
    ),
    configured: t.exposeBoolean('configured'),
  }),
})

type ElementGenerationSourceScopeView = {
  resourceId: string
  title: string
  sourceFile: string
  pageCount: number | null
}
const ElementGenerationSourceScopeRef =
  builder.objectRef<ElementGenerationSourceScopeView>(
    'ElementGenerationSourceScope'
  )
ElementGenerationSourceScopeRef.implement({
  fields: (t) => ({
    resourceId: t.exposeID('resourceId'),
    title: t.exposeString('title'),
    sourceFile: t.exposeString('sourceFile'),
    pageCount: t.exposeInt('pageCount', { nullable: true }),
  }),
})

export type ElementGenerationSourceView = {
  graphBuildId: string
  kbId: string
  kbName: string
  indexedAt: Date
  isStale: boolean
  sourceCount: number
  sources: ElementGenerationSourceScopeView[]
}
export const ElementGenerationSourceRef =
  builder.objectRef<ElementGenerationSourceView>('ElementGenerationSource')
ElementGenerationSourceRef.implement({
  fields: (t) => ({
    graphBuildId: t.exposeID('graphBuildId'),
    kbId: t.exposeID('kbId'),
    kbName: t.exposeString('kbName'),
    indexedAt: t.expose('indexedAt', { type: 'Date' }),
    isStale: t.exposeBoolean('isStale'),
    sourceCount: t.exposeInt('sourceCount'),
    sources: t.expose('sources', { type: [ElementGenerationSourceScopeRef] }),
  }),
})

type ElementGenerationConfigurationSourceScopeView = {
  resourceId: string
  pageFrom: number | null
  pageTo: number | null
}
const ElementGenerationConfigurationSourceScopeRef =
  builder.objectRef<ElementGenerationConfigurationSourceScopeView>(
    'ElementGenerationConfigurationSourceScope'
  )
ElementGenerationConfigurationSourceScopeRef.implement({
  fields: (t) => ({
    resourceId: t.exposeID('resourceId'),
    pageFrom: t.exposeInt('pageFrom', { nullable: true }),
    pageTo: t.exposeInt('pageTo', { nullable: true }),
  }),
})

type ElementGenerationObjectiveView = {
  id: string
  text: string
  bloomLevel: ElementGenerationBloomLevelValue | null
}
const ElementGenerationObjectiveRef =
  builder.objectRef<ElementGenerationObjectiveView>(
    'ElementGenerationObjective'
  )
ElementGenerationObjectiveRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    text: t.exposeString('text'),
    bloomLevel: t.expose('bloomLevel', {
      type: ElementGenerationBloomLevel,
      nullable: true,
    }),
  }),
})

type ElementGenerationDifficultyCountsView = {
  d1: number
  d2: number
  d3: number
  d4: number
  d5: number
}
const ElementGenerationDifficultyCountsRef =
  builder.objectRef<ElementGenerationDifficultyCountsView>(
    'ElementGenerationDifficultyCounts'
  )
ElementGenerationDifficultyCountsRef.implement({
  fields: (t) => ({
    d1: t.exposeInt('d1'),
    d2: t.exposeInt('d2'),
    d3: t.exposeInt('d3'),
    d4: t.exposeInt('d4'),
    d5: t.exposeInt('d5'),
  }),
})

type ElementGenerationConfigurationView = {
  elementType: GeneratableElementType
  language: ElementGenerationLanguageValue
  elementCount: number
  difficultyPreset: ElementGenerationDifficultyPresetValue | null
  difficultyCounts: ElementGenerationDifficultyCountsView | null
  sourceScopes: ElementGenerationConfigurationSourceScopeView[]
  objectives: ElementGenerationObjectiveView[]
  bloomLevels: ElementGenerationBloomLevelValue[]
}
const ElementGenerationConfigurationRef =
  builder.objectRef<ElementGenerationConfigurationView>(
    'ElementGenerationConfiguration'
  )
ElementGenerationConfigurationRef.implement({
  fields: (t) => ({
    elementType: t.expose('elementType', { type: GeneratableElementType }),
    language: t.expose('language', { type: ElementGenerationLanguage }),
    elementCount: t.exposeInt('elementCount'),
    difficultyPreset: t.expose('difficultyPreset', {
      type: ElementGenerationDifficultyPreset,
      nullable: true,
    }),
    difficultyCounts: t.expose('difficultyCounts', {
      type: ElementGenerationDifficultyCountsRef,
      nullable: true,
    }),
    sourceScopes: t.expose('sourceScopes', {
      type: [ElementGenerationConfigurationSourceScopeRef],
    }),
    objectives: t.expose('objectives', {
      type: [ElementGenerationObjectiveRef],
    }),
    bloomLevels: t.expose('bloomLevels', {
      type: [ElementGenerationBloomLevel],
    }),
  }),
})

function configurationView(
  build: DB.ElementGenerationBuild
): ElementGenerationConfigurationView {
  if (build.elementType === DB.ElementType.FLASHCARD) {
    const configuration =
      build.configuration as FlashcardGenerationConfiguration
    return {
      elementType: 'FLASHCARD',
      language: configuration.language,
      elementCount: configuration.flashcardCount,
      difficultyPreset: null,
      difficultyCounts: null,
      sourceScopes: [],
      objectives: configuration.objectives.map((objective) => ({
        ...objective,
        bloomLevel: null,
      })),
      bloomLevels: [],
    }
  }

  const configuration = build.configuration as QuestionGenerationConfiguration
  return {
    elementType: build.elementType as Exclude<
      GeneratableElementType,
      'FLASHCARD'
    >,
    language: configuration.language,
    elementCount: configuration.questionCount,
    difficultyPreset: configuration.difficultyPreset,
    difficultyCounts: configuration.difficultyCounts,
    sourceScopes: configuration.sourceScopes,
    objectives: configuration.objectives,
    bloomLevels: configuration.bloomLevels,
  }
}

type ElementGenerationWarningView = { code: string; message: string }
const ElementGenerationWarningRef =
  builder.objectRef<ElementGenerationWarningView>('ElementGenerationWarning')
ElementGenerationWarningRef.implement({
  fields: (t) => ({
    code: t.exposeString('code'),
    message: t.exposeString('message'),
  }),
})

type ElementGenerationReviewSourceView = {
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
}
const ElementGenerationReviewSourceRef =
  builder.objectRef<ElementGenerationReviewSourceView>(
    'ElementGenerationReviewSource'
  )
ElementGenerationReviewSourceRef.implement({
  fields: (t) => ({
    sourceFile: t.exposeString('sourceFile'),
    pageFrom: t.exposeInt('pageFrom', { nullable: true }),
    pageTo: t.exposeInt('pageTo', { nullable: true }),
  }),
})

type ElementGenerationDesignSummaryView = {
  title: string
  elementCount: number
  objectives: ElementGenerationObjectiveView[]
  modules: Array<{
    moduleId: string
    moduleName: string
    elementCount: number
  }>
  sources: ElementGenerationReviewSourceView[]
  warnings: ElementGenerationWarningView[]
}
const ElementGenerationDesignModuleRef = builder.objectRef<
  ElementGenerationDesignSummaryView['modules'][number]
>('ElementGenerationDesignModule')
ElementGenerationDesignModuleRef.implement({
  fields: (t) => ({
    moduleId: t.exposeID('moduleId'),
    moduleName: t.exposeString('moduleName'),
    elementCount: t.exposeInt('elementCount'),
  }),
})
const ElementGenerationDesignSummaryRef =
  builder.objectRef<ElementGenerationDesignSummaryView>(
    'ElementGenerationDesignSummary'
  )
ElementGenerationDesignSummaryRef.implement({
  fields: (t) => ({
    title: t.exposeString('title'),
    elementCount: t.exposeInt('elementCount'),
    objectives: t.expose('objectives', {
      type: [ElementGenerationObjectiveRef],
    }),
    modules: t.expose('modules', { type: [ElementGenerationDesignModuleRef] }),
    sources: t.expose('sources', {
      type: [ElementGenerationReviewSourceRef],
    }),
    warnings: t.expose('warnings', { type: [ElementGenerationWarningRef] }),
  }),
})

function designSummaryView(
  build: DB.ElementGenerationBuild
): ElementGenerationDesignSummaryView | null {
  if (!build.designSummary || build.elementType === DB.ElementType.FLASHCARD) {
    return null
  }
  const summary = build.designSummary as QuestionGenerationDesignSummary
  return {
    title: summary.title,
    elementCount: summary.questionCount,
    objectives: summary.objectives,
    modules: summary.modules.map(({ questionCount, ...module }) => ({
      ...module,
      elementCount: questionCount,
    })),
    sources: summary.sources,
    warnings: summary.warnings,
  }
}

type ElementGenerationPlanSummaryView = {
  elementCount: number
  elements: Array<{
    sourceElementId: string
    preview: string
    bloomLevel: ElementGenerationBloomLevelValue | null
    targetDifficulty: number | null
    sources: ElementGenerationReviewSourceView[]
  }>
  warnings: ElementGenerationWarningView[]
}
const ElementGenerationPlanElementRef = builder.objectRef<
  ElementGenerationPlanSummaryView['elements'][number]
>('ElementGenerationPlanElement')
ElementGenerationPlanElementRef.implement({
  fields: (t) => ({
    sourceElementId: t.exposeID('sourceElementId'),
    preview: t.exposeString('preview'),
    bloomLevel: t.expose('bloomLevel', {
      type: ElementGenerationBloomLevel,
      nullable: true,
    }),
    targetDifficulty: t.exposeInt('targetDifficulty', { nullable: true }),
    sources: t.expose('sources', {
      type: [ElementGenerationReviewSourceRef],
    }),
  }),
})
const ElementGenerationPlanSummaryRef =
  builder.objectRef<ElementGenerationPlanSummaryView>(
    'ElementGenerationPlanSummary'
  )
ElementGenerationPlanSummaryRef.implement({
  fields: (t) => ({
    elementCount: t.exposeInt('elementCount'),
    elements: t.expose('elements', { type: [ElementGenerationPlanElementRef] }),
    warnings: t.expose('warnings', { type: [ElementGenerationWarningRef] }),
  }),
})

function planSummaryView(
  build: DB.ElementGenerationBuild
): ElementGenerationPlanSummaryView | null {
  if (!build.planSummary || build.elementType === DB.ElementType.FLASHCARD) {
    return null
  }
  const summary = build.planSummary as QuestionGenerationPlanSummary
  return {
    elementCount: summary.questionCount,
    elements: summary.questions.map((question) => ({
      sourceElementId: question.sourceQuestionId,
      preview: question.stem,
      bloomLevel: question.bloomLevel,
      targetDifficulty: question.targetDifficulty,
      sources: question.sources,
    })),
    warnings: summary.warnings,
  }
}

type GeneratedElementChoiceView = GeneratedQuestionEditable['choices'][number]
const GeneratedElementChoiceRef = builder.objectRef<GeneratedElementChoiceView>(
  'GeneratedElementChoice'
)
GeneratedElementChoiceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    text: t.exposeString('text'),
    correct: t.exposeBoolean('correct'),
    feedback: t.exposeString('feedback', { nullable: true }),
  }),
})

type GeneratedElementEditableView = {
  name: string
  prompt: string
  context: string | null
  explanation: string | null
  choices: GeneratedElementChoiceView[]
  cardType: GeneratedElementCardTypeValue | null
  tags: string[]
}
const GeneratedElementEditableRef =
  builder.objectRef<GeneratedElementEditableView>('GeneratedElementEditable')
GeneratedElementEditableRef.implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    prompt: t.exposeString('prompt'),
    context: t.exposeString('context', { nullable: true }),
    explanation: t.exposeString('explanation', { nullable: true }),
    choices: t.expose('choices', { type: [GeneratedElementChoiceRef] }),
    cardType: t.expose('cardType', {
      type: GeneratedElementCardType,
      nullable: true,
    }),
    tags: t.exposeStringList('tags'),
  }),
})

function editableView(
  elementType: DB.ElementType,
  value:
    | GeneratedQuestionEditable
    | GeneratedQuestionOriginal
    | GeneratedFlashcardEditable
    | GeneratedFlashcard
): GeneratedElementEditableView {
  if (elementType === DB.ElementType.FLASHCARD) {
    const card = value as GeneratedFlashcardEditable
    return {
      name: card.name,
      prompt: card.front,
      context: null,
      explanation: card.back,
      choices: [],
      cardType: card.cardType,
      tags: card.tags,
    }
  }
  const question = value as GeneratedQuestionEditable
  return {
    name: question.name,
    prompt: question.stem,
    context: question.context,
    explanation: question.explanation,
    choices: question.choices,
    cardType: null,
    tags: [],
  }
}

const GeneratedElementCitationRef =
  builder.objectRef<GeneratedQuestionCitation>('GeneratedElementCitation')
GeneratedElementCitationRef.implement({
  fields: (t) => ({
    resourceId: t.exposeID('resourceId'),
    sourceFile: t.exposeString('sourceFile'),
    pageFrom: t.exposeInt('pageFrom', { nullable: true }),
    pageTo: t.exposeInt('pageTo', { nullable: true }),
    chunkIds: t.exposeStringList('chunkIds'),
  }),
})

export const ElementGenerationReviewRef =
  builder.objectRef<DB.ElementGenerationReview>('ElementGenerationReview')
ElementGenerationReviewRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    gate: t.expose('gate', { type: ElementGenerationReviewGate }),
    decision: t.expose('decision', {
      type: ElementGenerationReviewDecision,
    }),
    warningsAcknowledged: t.exposeBoolean('warningsAcknowledged'),
    reviewedAt: t.expose('reviewedAt', { type: 'Date' }),
  }),
})

export const GeneratedElementDraftRef =
  builder.objectRef<DB.GeneratedElementDraft>('GeneratedElementDraft')
GeneratedElementDraftRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    sourceElementId: t.exposeID('sourceElementId'),
    order: t.exposeInt('order'),
    duplicationIndex: t.exposeInt('duplicationIndex'),
    parentDraftId: t.exposeID('parentDraftId', { nullable: true }),
    elementType: t.field({
      type: GeneratableElementType,
      resolve: (draft) => draft.elementType as GeneratableElementType,
    }),
    original: t.field({
      type: GeneratedElementEditableRef,
      resolve: (draft) => editableView(draft.elementType, draft.original),
    }),
    current: t.field({
      type: GeneratedElementEditableRef,
      resolve: (draft) => editableView(draft.elementType, draft.current),
    }),
    revision: t.exposeInt('revision'),
    decision: t.expose('decision', { type: GeneratedElementDecision }),
    bloomLevel: t.field({
      type: ElementGenerationBloomLevel,
      nullable: true,
      resolve: (draft) =>
        draft.bloomLevel as ElementGenerationBloomLevelValue | null,
    }),
    targetDifficulty: t.exposeInt('targetDifficulty', { nullable: true }),
    predictedDifficulty: t.exposeFloat('predictedDifficulty', {
      nullable: true,
    }),
    qualityFlags: t.exposeStringList('qualityFlags'),
    citations: t.field({
      type: [GeneratedElementCitationRef],
      resolve: (draft) => draft.citations,
    }),
    provenance: t.expose('provenance', { type: 'Json', nullable: true }),
    savedElementId: t.exposeInt('savedElementId', { nullable: true }),
    savedAt: t.expose('savedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export type ElementGenerationBuildView = DB.ElementGenerationBuild & {
  reviews?: DB.ElementGenerationReview[]
  drafts: DB.GeneratedElementDraft[]
}
export const ElementGenerationBuildRef =
  builder.objectRef<ElementGenerationBuildView>('ElementGenerationBuild')
ElementGenerationBuildRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    graphBuildId: t.field({
      type: 'ID',
      resolve: (build) => build.sourceGraphBuildId,
    }),
    elementType: t.field({
      type: GeneratableElementType,
      resolve: (build) => build.elementType as GeneratableElementType,
    }),
    status: t.expose('status', { type: ElementGenerationBuildStatus }),
    stage: t.exposeString('stage'),
    configuration: t.field({
      type: ElementGenerationConfigurationRef,
      resolve: configurationView,
    }),
    requestedElementCount: t.exposeInt('requestedElementCount'),
    generatedElementCount: t.exposeInt('generatedElementCount'),
    unresolvedElementCount: t.exposeInt('unresolvedElementCount'),
    warningCount: t.exposeInt('warningCount'),
    retryCount: t.exposeInt('retryCount'),
    designSummary: t.field({
      type: ElementGenerationDesignSummaryRef,
      nullable: true,
      resolve: designSummaryView,
    }),
    planSummary: t.field({
      type: ElementGenerationPlanSummaryRef,
      nullable: true,
      resolve: planSummaryView,
    }),
    errorCode: t.exposeString('errorCode', { nullable: true }),
    errorMessage: t.exposeString('errorMessage', { nullable: true }),
    errorRetryable: t.exposeBoolean('errorRetryable', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
    incompletePublishedAt: t.expose('incompletePublishedAt', {
      type: 'Date',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
    reviews: t.field({
      type: [ElementGenerationReviewRef],
      resolve: (build) => build.reviews ?? [],
    }),
    drafts: t.expose('drafts', { type: [GeneratedElementDraftRef] }),
  }),
})

export type ElementGenerationSaveResult = {
  createdElementIds: number[]
  alreadySavedElementIds: number[]
}
export const ElementGenerationSaveResultRef =
  builder.objectRef<ElementGenerationSaveResult>('ElementGenerationSaveResult')
ElementGenerationSaveResultRef.implement({
  fields: (t) => ({
    createdElementIds: t.exposeIntList('createdElementIds'),
    alreadySavedElementIds: t.exposeIntList('alreadySavedElementIds'),
  }),
})

type SourceScopeInput = NonNullable<
  StartElementGenerationInput['sourceScopes']
>[number]
const ElementGenerationSourceScopeInputRef = builder
  .inputRef<SourceScopeInput>('ElementGenerationSourceScopeInput')
  .implement({
    fields: (t) => ({
      resourceId: t.id({ required: true, validate: { uuid: true } }),
      pageFrom: t.int({ required: false, validate: { min: 1 } }),
      pageTo: t.int({ required: false, validate: { min: 1 } }),
    }),
  })

type ObjectiveInput = NonNullable<
  StartElementGenerationInput['objectives']
>[number]
const ElementGenerationObjectiveInputRef = builder
  .inputRef<ObjectiveInput>('ElementGenerationObjectiveInput')
  .implement({
    fields: (t) => ({
      text: t.string({
        required: true,
        validate: { minLength: 1, maxLength: 500 },
      }),
      bloomLevel: t.field({
        type: ElementGenerationBloomLevel,
        required: false,
      }),
    }),
  })

export const StartElementGenerationInputRef = builder
  .inputRef<StartElementGenerationInput>('StartElementGenerationInput')
  .implement({
    fields: (t) => ({
      graphBuildId: t.id({ required: true, validate: { uuid: true } }),
      elementType: t.field({ type: GeneratableElementType, required: true }),
      language: t.field({ type: ElementGenerationLanguage, required: true }),
      elementCount: t.int({
        required: true,
        validate: { min: 1, max: 20 },
      }),
      difficultyPreset: t.field({
        type: ElementGenerationDifficultyPreset,
        required: false,
      }),
      sourceScopes: t.field({
        type: [ElementGenerationSourceScopeInputRef],
        required: false,
      }),
      objectives: t.field({
        type: [ElementGenerationObjectiveInputRef],
        required: false,
        validate: { maxLength: 20 },
      }),
      bloomLevels: t.field({
        type: [ElementGenerationBloomLevel],
        required: false,
        validate: { maxLength: 5 },
      }),
      idempotencyKey: t.string({
        required: true,
        validate: { minLength: 1, maxLength: 200 },
      }),
    }),
  })

export type ReviewElementGenerationInput = {
  buildId: string
  gate: DB.ElementGenerationReviewGate
  decision: DB.ElementGenerationReviewDecision
  warningsAcknowledged: boolean
}
export const ReviewElementGenerationInputRef = builder
  .inputRef<ReviewElementGenerationInput>('ReviewElementGenerationInput')
  .implement({
    fields: (t) => ({
      buildId: t.id({ required: true, validate: { uuid: true } }),
      gate: t.field({ type: ElementGenerationReviewGate, required: true }),
      decision: t.field({
        type: ElementGenerationReviewDecision,
        required: true,
      }),
      warningsAcknowledged: t.boolean({ required: true }),
    }),
  })

type GeneratedElementChoiceInputValue = NonNullable<
  GeneratedElementEditableInputValue['choices']
>[number]
const GeneratedElementChoiceInputRef = builder
  .inputRef<GeneratedElementChoiceInputValue>('GeneratedElementChoiceInput')
  .implement({
    fields: (t) => ({
      id: t.id({
        required: true,
        validate: { minLength: 1, maxLength: 100 },
      }),
      label: t.string({
        required: true,
        validate: { minLength: 1, maxLength: 20 },
      }),
      text: t.string({
        required: true,
        validate: { minLength: 1, maxLength: 10_000 },
      }),
      correct: t.boolean({ required: true }),
      feedback: t.string({
        required: false,
        validate: { maxLength: 10_000 },
      }),
    }),
  })

const GeneratedElementEditableInputRef = builder
  .inputRef<GeneratedElementEditableInputValue>('GeneratedElementEditableInput')
  .implement({
    fields: (t) => ({
      name: t.string({
        required: true,
        validate: { minLength: 1, maxLength: 500 },
      }),
      prompt: t.string({
        required: true,
        validate: { minLength: 1, maxLength: 20_000 },
      }),
      context: t.string({
        required: false,
        validate: { maxLength: 20_000 },
      }),
      explanation: t.string({
        required: false,
        validate: { maxLength: 20_000 },
      }),
      choices: t.field({
        type: [GeneratedElementChoiceInputRef],
        required: false,
        validate: { maxLength: 10 },
      }),
      cardType: t.field({ type: GeneratedElementCardType, required: false }),
      tags: t.stringList({
        required: false,
        validate: { maxLength: 20 },
      }),
    }),
  })

export type UpdateGeneratedElementDraftInput = {
  draftId: string
  expectedRevision: number
  current: GeneratedElementEditableInputValue
}
export const UpdateGeneratedElementDraftInputRef = builder
  .inputRef<UpdateGeneratedElementDraftInput>(
    'UpdateGeneratedElementDraftInput'
  )
  .implement({
    fields: (t) => ({
      draftId: t.id({ required: true, validate: { uuid: true } }),
      expectedRevision: t.int({ required: true, validate: { min: 0 } }),
      current: t.field({
        type: GeneratedElementEditableInputRef,
        required: true,
      }),
    }),
  })

export type GeneratedElementDraftInput = { draftId: string }
export const GeneratedElementDraftInputRef = builder
  .inputRef<GeneratedElementDraftInput>('GeneratedElementDraftInput')
  .implement({
    fields: (t) => ({
      draftId: t.id({ required: true, validate: { uuid: true } }),
    }),
  })

export type SetGeneratedElementDecisionInput = {
  draftId: string
  decision: DB.GeneratedElementDecision
}
export const SetGeneratedElementDecisionInputRef = builder
  .inputRef<SetGeneratedElementDecisionInput>(
    'SetGeneratedElementDecisionInput'
  )
  .implement({
    fields: (t) => ({
      draftId: t.id({ required: true, validate: { uuid: true } }),
      decision: t.field({ type: GeneratedElementDecision, required: true }),
    }),
  })

export type ElementGenerationBuildInput = { buildId: string }
export const ElementGenerationBuildInputRef = builder
  .inputRef<ElementGenerationBuildInput>('ElementGenerationBuildInput')
  .implement({
    fields: (t) => ({
      buildId: t.id({ required: true, validate: { uuid: true } }),
    }),
  })

export type PublishIncompleteElementGenerationInput = {
  buildId: string
  warningsAcknowledged: boolean
}
export const PublishIncompleteElementGenerationInputRef = builder
  .inputRef<PublishIncompleteElementGenerationInput>(
    'PublishIncompleteElementGenerationInput'
  )
  .implement({
    fields: (t) => ({
      buildId: t.id({ required: true, validate: { uuid: true } }),
      warningsAcknowledged: t.boolean({ required: true }),
    }),
  })
