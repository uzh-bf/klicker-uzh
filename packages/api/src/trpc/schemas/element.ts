import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import { SortByType } from '@klicker-uzh/types'
import { z } from 'zod'

export const elementIdInput = z.object({
  id: z.number().int(),
})

export const artificialInstanceInput = z.object({
  elementId: z.number().int(),
})

export const singleInstanceInput = z.object({
  id: z.number().int(),
})

export const fileUploadSasInput = z.object({
  fileName: z.string(),
  contentType: z.string(),
})

export const listElementsInput = z.object({
  status: z.nativeEnum(ElementStatus).nullish(),
  type: z.nativeEnum(ElementType).nullish(),
  hasSampleSolution: z.boolean(),
  hasAnswerFeedbacks: z.boolean(),
  searchString: z.string().nullish(),
  showOwned: z.boolean().nullish(),
  showShared: z.boolean().nullish(),
  showDependencies: z.boolean().nullish(),
  tagIds: z.array(z.number().int()),
  activityId: z.string().nullish(),
  multiplier: z.number().int().nullish(),
  showUntagged: z.boolean(),
  sortByType: z.nativeEnum(SortByType),
  sortByAsc: z.boolean(),
  showArchived: z.boolean(),
  numEntries: z.number().int(),
  offset: z.number().int(),
})

const nullableString = z.string().nullish()
const nullableBoolean = z.boolean().nullish()
const nullableNumber = z.number().nullish()
const nullableInt = z.number().int().nullish()

const tagNamesInput = z.array(z.string()).nullish()

export const elementManipulationBaseInput = z.object({
  id: z.number().int().nullish(),
  status: z.nativeEnum(ElementStatus).nullish(),
  name: nullableString,
  content: nullableString,
  explanation: nullableString,
  basePoints: nullableBoolean,
  pointsMultiplier: nullableInt,
  tags: tagNamesInput,
})

const choiceInput = z.object({
  ix: z.number().int(),
  value: z.string(),
  correct: nullableBoolean,
  feedback: nullableString,
})

export const choicesOptionsInput = z.object({
  hasSampleSolution: nullableBoolean,
  hasAnswerFeedbacks: nullableBoolean,
  displayMode: z.enum(['LIST', 'GRID']).nullish(),
  choices: z.array(choiceInput).nullish(),
})

export const numericalOptionsInput = z.object({
  hasSampleSolution: nullableBoolean,
  accuracy: nullableInt,
  unit: nullableString,
  placeholder: nullableString,
  restrictions: z
    .object({
      min: nullableNumber,
      max: nullableNumber,
    })
    .nullish(),
  solutionRanges: z
    .array(
      z.object({
        min: nullableNumber,
        max: nullableNumber,
      })
    )
    .nullish(),
  exactSolutions: z.array(z.number()).nullish(),
})

export const freeTextOptionsInput = z.object({
  hasSampleSolution: nullableBoolean,
  restrictions: z
    .object({
      maxLength: nullableInt,
    })
    .nullish(),
  solutions: z.array(z.string()).nullish(),
})

export const selectionOptionsInput = z.object({
  hasSampleSolution: nullableBoolean,
  answerCollection: nullableInt,
  numberOfInputs: nullableInt,
  correctAnswers: z.array(z.number().int()).nullish(),
})

const caseStudyCriterionLabelsInput = z.object({
  min: z.string(),
  mid: nullableString,
  max: z.string(),
})

const caseStudyCriterionInput = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  unit: nullableString,
  labels: caseStudyCriterionLabelsInput.nullish(),
})

const caseStudySolutionInput = z.object({
  itemId: z.number().int(),
  criteriaSolutions: z.array(
    z.object({
      criterionId: z.string(),
      min: z.number(),
      max: z.number(),
    })
  ),
})

const caseStudyCaseInput = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number().int(),
  solutions: z.array(caseStudySolutionInput).nullish(),
})

export const caseStudyOptionsInput = z.object({
  hasSampleSolution: nullableBoolean,
  answerCollection: nullableInt,
  collectionItemIds: z.array(z.number().int()).nullish(),
  criteria: z.array(caseStudyCriterionInput).nullish(),
  cases: z.array(caseStudyCaseInput).nullish(),
})

export const manipulateContentElementInput = elementManipulationBaseInput

export const manipulateFlashcardElementInput = elementManipulationBaseInput

export const manipulateChoicesElementInput =
  elementManipulationBaseInput.extend({
    type: z.enum([ElementType.SC, ElementType.MC, ElementType.KPRIM]),
    options: choicesOptionsInput.nullish(),
  })

export const manipulateNumericalElementInput =
  elementManipulationBaseInput.extend({
    options: numericalOptionsInput.nullish(),
  })

export const manipulateFreeTextElementInput =
  elementManipulationBaseInput.extend({
    options: freeTextOptionsInput.nullish(),
  })

export const manipulateSelectionElementInput =
  elementManipulationBaseInput.extend({
    options: selectionOptionsInput.nullish(),
  })

export const manipulateCaseStudyElementInput =
  elementManipulationBaseInput.extend({
    options: caseStudyOptionsInput.nullish(),
  })

export const updateElementInstancesInput = z.object({
  elementId: z.number().int(),
  includeTemplates: z.boolean(),
})

export const instanceUpdateActivitiesInput = z.object({
  elementId: z.number().int(),
  hasSampleSolution: z.boolean().nullish(),
  includeTemplateInstances: z.boolean(),
})

export const flagOutdatedElementInstancesInput = z.object({
  elementId: z.number().int(),
})

export const changeElementStatusInput = z.object({
  elementId: z.number().int(),
  status: z.nativeEnum(ElementStatus),
})

export const applyElementBatchOperationsInput = z.object({
  elementIds: z.array(z.number().int()),
  archive: z.boolean(),
  unarchive: z.boolean(),
  status: z.nativeEnum(ElementStatus).nullish(),
  multiplier: z.number().int().nullish(),
  basePoints: z.boolean().nullish(),
  updateInstances: z.boolean(),
  updateTemplateInstances: z.boolean(),
})

export const editTagInput = z.object({
  id: z.number().int(),
  name: z.string(),
})

export const tagOrderingInput = z.object({
  originIx: z.number().int(),
  targetIx: z.number().int(),
})
