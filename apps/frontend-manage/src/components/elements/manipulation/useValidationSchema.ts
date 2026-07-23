import {
  CodeLanguage,
  CodeTestVisibility,
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'
import { ElementFormTypesCaseStudy } from './types'

const PYTHON_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
])

function isValidJson(value?: string) {
  if (typeof value !== 'string') return false

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function isJsonArray(value?: string) {
  if (!isValidJson(value)) return false
  return Array.isArray(JSON.parse(value!))
}

function useSharedValidationSchema() {
  const t = useTranslations()

  return {
    status: yup.string().oneOf(Object.values(ElementStatus)),
    name: yup.string().required(t('manage.formErrors.questionName')),
    tags: yup.array().of(yup.string()),
    type: yup.string().oneOf(Object.values(ElementType)).required(),

    content: yup
      .string()
      .required(t('manage.formErrors.questionContent'))
      .test({
        message: t('manage.formErrors.questionContent'),
        test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
      }),

    explanation: yup.string().when(['type'], ([type], schema) => {
      if (type === ElementType.Flashcard)
        return schema.required(t('manage.formErrors.explanationRequired'))
      return schema.nullable()
    }),
  }
}

function useChoicesSchema() {
  const t = useTranslations()

  return yup.array().of(
    yup.object().shape({
      ix: yup.number(),
      value: yup
        .string()
        .required(t('manage.formErrors.answerContent'))
        .test({
          message: t('manage.formErrors.answerContent'),
          test: (content) =>
            !content?.match(/^(<br>(\n)*)$/g) && content !== '',
        }),
      correct: yup.boolean().nullable(),
      feedback: yup.string().nullable(),
    })
  )
}

function useOptionsSchemaSC() {
  const t = useTranslations()
  const baseChoicesSchema = useChoicesSchema()

  return {
    displayMode: yup.string().oneOf(Object.values(ElementDisplayMode)),
    hasAnswerFeedbacks: yup.boolean(),
    hasSampleSolution: yup.boolean(),
    choices: baseChoicesSchema
      .min(1, t('manage.formErrors.NumberQuestionsRequired'))
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema.test({
            message: t('manage.formErrors.SCAnswersCorrect'),
            test: (choices) =>
              choices?.filter((choice) => choice.correct).length === 1,
          }),
      })
      .when('hasAnswerFeedbacks', {
        is: true,
        then: (schema) =>
          schema.test({
            message: t('manage.formErrors.feedbackContent'),
            test: (choices) =>
              choices?.every(
                (choice) =>
                  typeof choice.feedback !== 'undefined' &&
                  choice.feedback !== null &&
                  !choice.feedback?.match(/^(<br>(\n)*)$/g) &&
                  choice.feedback !== ''
              ),
          }),
      }),
  }
}

function useOptionsSchemaMC() {
  const t = useTranslations()
  const baseChoicesSchema = useChoicesSchema()

  return {
    displayMode: yup.string().oneOf(Object.values(ElementDisplayMode)),
    hasAnswerFeedbacks: yup.boolean(),
    hasSampleSolution: yup.boolean(),
    choices: baseChoicesSchema
      .min(1, t('manage.formErrors.NumberQuestionsRequired'))
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema.test({
            message: t('manage.formErrors.MCAnswersCorrect'),
            test: (choices) => {
              return (
                (choices?.filter((choice) => choice.correct).length ?? 0) >= 1
              )
            },
          }),
      })
      .when('hasAnswerFeedbacks', {
        is: true,
        then: (schema) =>
          schema.test({
            message: t('manage.formErrors.feedbackContent'),
            test: (choices) =>
              choices?.every(
                (choice) =>
                  typeof choice.feedback !== 'undefined' &&
                  choice.feedback !== null &&
                  !choice.feedback?.match(/^(<br>(\n)*)$/g) &&
                  choice.feedback !== ''
              ),
          }),
      }),
  }
}

function useOptionsSchemaKPRIM() {
  const t = useTranslations()
  const baseChoicesSchema = useChoicesSchema()

  return {
    hasAnswerFeedbacks: yup.boolean(),
    hasSampleSolution: yup.boolean(),
    choices: baseChoicesSchema
      .length(4, t('manage.formErrors.NumberQuestionsRequiredKPRIM'))
      .when('hasAnswerFeedbacks', {
        is: true,
        then: (schema) =>
          schema.test({
            message: t('manage.formErrors.feedbackContent'),
            test: (choices) =>
              choices?.every(
                (choice) =>
                  typeof choice.feedback !== 'undefined' &&
                  choice.feedback !== null &&
                  !choice.feedback?.match(/^(<br>(\n)*)$/g) &&
                  choice.feedback !== ''
              ),
          }),
      }),
  }
}

function useOptionsSchemaNumerical() {
  const t = useTranslations()

  return {
    hasSampleSolution: yup.boolean(),

    accuracy: yup
      .number()
      .nullable()
      .min(0, t('manage.formErrors.NRPrecision')),
    unit: yup.string().nullable(),

    restrictions: yup.object().shape({
      min: yup
        .number()
        .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
        .max(1e30, t('manage.formErrors.NumericalOverflow'))
        .nullable()
        .when('max', {
          is: (max?: number) => typeof max !== 'undefined' && max !== null,
          then: (schema) =>
            schema.lessThan(
              yup.ref('max'),
              t('manage.formErrors.NRMinLessThanMax')
            ),
        }),
      max: yup
        .number()
        .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
        .max(1e30, t('manage.formErrors.NumericalOverflow'))
        .nullable(),
    }),

    solutionType: yup
      .string()
      .oneOf(['range', 'exact'])
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema.required(t('manage.formErrors.chooseSolutionType')),
      }),

    solutionRanges: yup
      .array()
      .of(
        yup.object().shape({
          min: yup.number().nullable(),
          max: yup.number().nullable(),
        })
      )
      .nullable()
      .when(['hasSampleSolution', 'solutionType'], {
        is: (hasSampleSolution: boolean, solutionType: string) =>
          hasSampleSolution && solutionType === 'range',
        then: (schema) =>
          schema
            .required(t('manage.formErrors.solutionRequired'))
            .min(1, t('manage.formErrors.solutionRangeRequired'))
            // verify that either a min or max value are specified
            .test({
              message: t('manage.formErrors.NROneValueRequired'),
              test: (value) => {
                if (!value) return true
                return !value.some(
                  (range) =>
                    (range.min === null || typeof range.min === 'undefined') &&
                    (range.max === null || typeof range.max === 'undefined')
                )
              },
            })
            // check that the min value is less than the max value
            .test({
              message: t('manage.formErrors.NRMinLessThanMaxSol'),
              test: (value) => {
                if (!value) return true
                return !value.some(
                  (range) =>
                    range.min !== null &&
                    range.max !== null &&
                    typeof range.min !== 'undefined' &&
                    typeof range.max !== 'undefined' &&
                    range.min >= range.max
                )
              },
            })
            // check that the min and max values are within the system restrictions
            .test({
              message: t('manage.formErrors.NumericalUnderflow'),
              test: (value) => {
                if (!value) return true
                return !value.some(
                  (range) =>
                    (range.min !== null &&
                      typeof range.min !== 'undefined' &&
                      range.min < -1e30) ||
                    (range.max !== null &&
                      typeof range.max !== 'undefined' &&
                      range.max < -1e30)
                )
              },
            })
            .test({
              message: t('manage.formErrors.NumericalOverflow'),
              test: (value) => {
                if (!value) return true
                return !value.some(
                  (range) =>
                    (range.min !== null &&
                      typeof range.min !== 'undefined' &&
                      range.min > 1e30) ||
                    (range.max !== null &&
                      typeof range.max !== 'undefined' &&
                      range.max > 1e30)
                )
              },
            })
            // check that the solution ranges are within the optionally defined restrictions
            .test({
              message: t(
                'manage.formErrors.NRSolutionRangesWithinRestrictions'
              ),
              test: (ranges, context) => {
                if (!ranges) return true

                const restrictions = context.parent.restrictions

                return !ranges.some((range) => {
                  if (
                    restrictions.min !== null &&
                    typeof restrictions.min !== 'undefined'
                  ) {
                    if (
                      (range.min !== null &&
                        typeof range.min !== 'undefined' &&
                        range.min < restrictions.min) ||
                      (range.max !== null &&
                        typeof range.max !== 'undefined' &&
                        range.max < restrictions.min)
                    ) {
                      return true
                    }
                  }

                  if (
                    restrictions.max !== null &&
                    typeof restrictions.max !== 'undefined'
                  ) {
                    if (
                      (range.min !== null &&
                        typeof range.min !== 'undefined' &&
                        range.min > restrictions.max) ||
                      (range.max !== null &&
                        typeof range.max !== 'undefined' &&
                        range.max > restrictions.max)
                    ) {
                      return true
                    }
                  }

                  return false
                })
              },
            }),
      }),

    exactSolutions: yup
      .array()
      .of(
        yup
          .number()
          .required(t('manage.formErrors.enterSolution'))
          .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
          .max(1e30, t('manage.formErrors.NumericalOverflow'))
      )
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema.when('solutionType', {
            is: 'exact',
            then: (schema) =>
              schema
                .required(t('manage.formErrors.solutionRequired'))
                .min(1, t('manage.formErrors.exactSolutionRequired'))
                .test({
                  message: t(
                    'manage.formErrors.NRExactSolutionsWithinRestrictions'
                  ),
                  test: (solution, context) => {
                    const restrictions = context.parent.restrictions
                    return !solution.some((sol) => {
                      if (!sol) return false

                      if (
                        restrictions.min !== null &&
                        typeof restrictions.min !== 'undefined' &&
                        sol < restrictions.min
                      ) {
                        return true
                      }

                      if (
                        restrictions.max !== null &&
                        typeof restrictions.max !== 'undefined' &&
                        sol > restrictions.max
                      ) {
                        return true
                      }

                      return false
                    })
                  },
                }),
          }),
      }),
  }
}

function useOptionsSchemaFreeText() {
  const t = useTranslations()

  return {
    hasSampleSolution: yup.boolean(),
    restrictions: yup.object().shape({
      maxLength: yup
        .number()
        .min(1, t('manage.formErrors.FTMaxLength'))
        .nullable(),
    }),
    solutions: yup
      .array()
      .of(
        yup
          .string()
          .required(t('manage.formErrors.enterSolution'))
          .min(1, t('manage.formErrors.enterSolution'))
      )
      .nullable()
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema
            .required(t('manage.formErrors.solutionRequired'))
            .min(1, t('manage.formErrors.solutionRequired')),
      }),
  }
}

function useOptionsSchemaCode() {
  const t = useTranslations()

  return {
    language: yup
      .string()
      .oneOf([CodeLanguage.Python])
      .required(t('manage.formErrors.COLanguageRequired')),
    starterCode: yup.string(),
    entrypoint: yup
      .string()
      .trim()
      .required(t('manage.formErrors.COEntrypointRequired'))
      .matches(PYTHON_IDENTIFIER, t('manage.formErrors.COEntrypointInvalid'))
      .test({
        message: t('manage.formErrors.COEntrypointKeyword'),
        test: (value) => !value || !PYTHON_KEYWORDS.has(value),
      }),
    hasSampleSolution: yup.boolean(),
    sampleSolution: yup.string().when('hasSampleSolution', {
      is: true,
      then: (schema) =>
        schema.required(t('manage.formErrors.COSampleSolutionRequired')),
    }),
    executionLimits: yup.object().shape({
      perTestTimeoutSeconds: yup.string().oneOf(['5']).required(),
    }),
    testCases: yup
      .array()
      .of(
        yup.object().shape({
          id: yup.string().required(),
          name: yup
            .string()
            .trim()
            .required(t('manage.formErrors.COTestNameRequired')),
          args: yup
            .string()
            .required(t('manage.formErrors.COTestArgsInvalid'))
            .test({
              message: t('manage.formErrors.COTestArgsInvalid'),
              test: isJsonArray,
            }),
          expectedOutput: yup
            .string()
            .required(t('manage.formErrors.COTestExpectedOutputInvalid'))
            .test({
              message: t('manage.formErrors.COTestExpectedOutputInvalid'),
              test: isValidJson,
            }),
          visibility: yup
            .string()
            .oneOf(Object.values(CodeTestVisibility))
            .required(),
          weight: yup
            .number()
            .required(t('manage.formErrors.COTestWeightPositive'))
            .moreThan(0, t('manage.formErrors.COTestWeightPositive')),
        })
      )
      .required(t('manage.formErrors.COTestsRequired'))
      .min(1, t('manage.formErrors.COTestsRequired'))
      .max(20, t('manage.formErrors.COTestsMax'))
      .test({
        message: t('manage.formErrors.COTestIdsUnique'),
        test: (testCases) =>
          !testCases ||
          new Set(testCases.map((testCase) => testCase.id)).size ===
            testCases.length,
      }),
  }
}

function useOptionsSchemaSelection({
  numberOfAnswerOptions,
}: {
  numberOfAnswerOptions?: number
}) {
  const t = useTranslations()

  return {
    hasSampleSolution: yup.boolean(),
    itemSelectionMode: yup.string().oneOf(['existing', 'new']),
    answerCollection: yup.string().when('itemSelectionMode', {
      is: (value?: 'existing' | 'new') => !value || value === 'existing',
      then: (schema) =>
        schema.required(t('manage.formErrors.SEanswerCollectionRequired')),
      otherwise: (schema) => schema,
    }),
    manuallyCreatedItems: yup
      .array()
      .of(
        yup.object().shape({
          id: yup.number().required(),
          value: yup.string().required(),
        })
      )
      .when('itemSelectionMode', {
        is: (value?: 'existing' | 'new') => value === 'new',
        then: (schema) =>
          schema
            .required(t('manage.formErrors.CSNewItemsRequired'))
            .min(1, t('manage.formErrors.CSNewItemsRequired')),
        otherwise: (schema) => schema,
      }),
    numberOfInputs: yup
      .number()
      .required(t('manage.formErrors.SEnumberOfInputsRequired'))
      .min(1, t('manage.formErrors.SEnumberOfInputsMin'))
      .max(
        numberOfAnswerOptions ? numberOfAnswerOptions - 1 : 100,
        t('manage.formErrors.SEnumberOfInputsMax')
      ),
    correctAnswers: yup
      .array()
      .of(yup.number())
      .nullable()
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema
            .required(t('manage.formErrors.SEcorrectAnswersRequired'))
            .min(1, t('manage.formErrors.SEcorrectAnswersRequired'))
            .test({
              message: t('manage.formErrors.SEcorrectAnswersMatchInputs'),
              test: (value, context) => {
                const numberOfInputs = context.parent.numberOfInputs
                return value?.length >= numberOfInputs
              },
            }),
      }),
  }
}

function useOptionsSchemaCaseStudy() {
  const t = useTranslations()

  return {
    hasSampleSolution: yup.boolean(),
    itemSelectionMode: yup.string().oneOf(['existing', 'new']),
    answerCollection: yup.string().when('itemSelectionMode', {
      is: (value?: 'existing' | 'new') => !value || value === 'existing',
      then: (schema) =>
        schema.required(t('manage.formErrors.CSAnswerCollectionRequired')),
      otherwise: (schema) => schema,
    }),
    selectedItems: yup
      .array()
      .of(yup.number())
      .when('itemSelectionMode', {
        is: (value?: 'existing' | 'new') => !value || value === 'existing',
        then: (schema) =>
          schema
            .required(t('manage.formErrors.CSItemsRequired'))
            .min(1, t('manage.formErrors.CSItemsRequired')),
        otherwise: (schema) => schema,
      }),
    manuallyCreatedItems: yup
      .array()
      .of(
        yup.object().shape({
          id: yup.number().required(),
          value: yup.string().required(),
        })
      )
      .when('itemSelectionMode', {
        is: (value?: 'existing' | 'new') => value === 'new',
        then: (schema) =>
          schema
            .required(t('manage.formErrors.CSNewItemsRequired'))
            .min(1, t('manage.formErrors.CSNewItemsRequired')),
        otherwise: (schema) => schema,
      }),
    criteria: yup
      .array()
      .of(
        yup
          .object()
          .shape({
            id: yup.string().required(),
            name: yup
              .string()
              .required(t('manage.formErrors.CSCriteriaNameRequired')),
            mode: yup.string().oneOf(['range', 'steps']).required(),
            min: yup.number().when('mode', {
              is: 'range',
              then: (schema) =>
                schema
                  .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
                  .max(1e30, t('manage.formErrors.NumericalOverflow'))
                  .required(t('manage.formErrors.CSCriteriaMinRequired'))
                  .when('max', {
                    is: (max?: number) =>
                      typeof max !== 'undefined' && max !== null,
                    then: (schema) =>
                      schema.lessThan(
                        yup.ref('max'),
                        t('manage.formErrors.CSCriteriaMinLessThanMax')
                      ),
                  }),
              otherwise: undefined, // value cannot be set by user
            }),
            max: yup.number().when('mode', {
              is: 'range',
              then: (schema) =>
                schema
                  .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
                  .max(1e30, t('manage.formErrors.NumericalOverflow'))
                  .required(t('manage.formErrors.CSCriteriaMaxRequired')),
              otherwise: undefined, // value cannot be set by user
            }),
            step: yup.number().when('mode', {
              is: 'range',
              then: (schema) =>
                schema
                  .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
                  .max(1e30, t('manage.formErrors.NumericalOverflow'))
                  .required(t('manage.formErrors.CSCriteriaStepRequired'))
                  .test({
                    message: t('manage.formErrors.CSStepSizeTooLarge'),
                    test: function (step) {
                      const max = this.parent.max
                      const min = this.parent.min
                      return step <= (max - min) / 2
                    },
                  }),
              otherwise: undefined, // value cannot be set by user
            }),
            unit: yup.string().nullable(),
            labels: yup.object().when('mode', {
              is: 'steps',
              then: (schema) =>
                schema.test({
                  message: t('manage.formErrors.CSLabelsRequired'),
                  test: function (labels: {
                    min?: string
                    mid?: string
                    max?: string
                  }) {
                    if (!labels) return false

                    const minLabel = labels.min
                    const maxLabel = labels.max

                    return (
                      typeof minLabel === 'string' &&
                      minLabel.trim().length > 0 &&
                      typeof maxLabel === 'string' &&
                      maxLabel.trim().length > 0
                    )
                  },
                }),
              otherwise: (schema) => schema.nullable(),
            }),
          })
          .test({
            message: t('manage.formErrors.CSStepsDefinitionRequired'),
            test: function (criterion) {
              if (criterion.mode !== 'steps') return true

              const max = criterion.max
              const min = criterion.min

              if (typeof max === 'undefined' || max === null) return false
              if (typeof min === 'undefined' || min === null) return false

              // check if the number of steps is chosen sufficiently large
              return max + 1 - min >= 2
            },
          })
      )
      .required(t('manage.formErrors.CSCriteriaRequired'))
      .min(1, t('manage.formErrors.CSCriteriaRequired')),
    cases: yup
      .array()
      .of(
        yup.object().shape({
          title: yup
            .string()
            .required(t('manage.formErrors.CSCaseTitleRequired')),
          description: yup
            .string()
            .required(t('manage.formErrors.CSCaseDescriptionRequired'))
            .test({
              message: t('manage.formErrors.CSCaseDescriptionRequired'),
              test: (description) =>
                !description?.match(/^(<br>(\n)*)$/g) && description !== '',
            }),
          solutions: yup.object().test({
            test: function (
              solutions: ElementFormTypesCaseStudy['options']['cases'][0]['solutions']
            ) {
              const grandparent = this.from?.[2].value

              if (!grandparent.hasSampleSolution) {
                return true
              }

              if (!solutions) {
                return this.createError({
                  message: t('manage.formErrors.CSSolutionsRequired'),
                })
              }

              const itemMode: ElementFormTypesCaseStudy['options']['itemSelectionMode'] =
                grandparent.itemSelectionMode
              const selectedItems: ElementFormTypesCaseStudy['options']['selectedItems'] =
                grandparent.selectedItems
              const createdItems: ElementFormTypesCaseStudy['options']['manuallyCreatedItems'] =
                grandparent.manuallyCreatedItems
              const criteria: ElementFormTypesCaseStudy['options']['criteria'] =
                grandparent.criteria

              // set the answer collection items according to the mode setting
              const items =
                typeof itemMode === 'undefined' || itemMode === 'existing'
                  ? (selectedItems ?? [])
                  : (createdItems?.map((item) => item.id) ?? [])

              const solutionKeys = Object.keys(solutions)
              if (solutionKeys.length !== items.length) {
                return this.createError({
                  message: t(
                    'manage.formErrors.CSSolutionsMissingCertainItems'
                  ),
                })
              }

              for (let itemIx = 0; itemIx < items.length; itemIx++) {
                const itemId = items[itemIx]
                const criterionSolutions = solutions[`itemId-${itemId}`]

                if (
                  !criterionSolutions ||
                  Object.keys(criterionSolutions).length !== criteria.length
                ) {
                  return this.createError({
                    message: t(
                      'manage.formErrors.CSSolutionsMissingCriteriaItem',
                      {
                        itemNumber: itemIx + 1,
                      }
                    ),
                  })
                }

                for (const criterion of criteria) {
                  const solution = criterionSolutions[criterion.id]
                  const minValue = parseFloat(solution?.min)
                  const maxValue = parseFloat(solution?.max)

                  if (
                    !solution ||
                    typeof solution.min !== 'string' ||
                    typeof solution.max !== 'string' ||
                    Number.isNaN(minValue) ||
                    Number.isNaN(maxValue)
                  ) {
                    return this.createError({
                      message: t(
                        'manage.formErrors.CSSolutionsMinMaxRequired',
                        {
                          itemNumber: itemIx + 1,
                          criterionName: criterion.name,
                        }
                      ),
                    })
                  }

                  if (minValue > maxValue) {
                    return this.createError({
                      message: t('manage.formErrors.CSSolutionsMinMaxOrder', {
                        itemNumber: itemIx + 1,
                        criterionName: criterion.name,
                      }),
                    })
                  }

                  const criterionMin = parseFloat(String(criterion.min))
                  const criterionMax = parseFloat(String(criterion.max))
                  const stepValue = parseFloat(criterion.step)

                  if (
                    !Number.isNaN(criterionMin) &&
                    !Number.isNaN(criterionMax) &&
                    !Number.isNaN(stepValue)
                  ) {
                    if (minValue < criterionMin || maxValue > criterionMax) {
                      return this.createError({
                        message: t(
                          'manage.formErrors.CSSolutionsMinMaxBounds',
                          {
                            itemNumber: itemIx + 1,
                            criterionName: criterion.name,
                          }
                        ),
                      })
                    }

                    // for numerical range criteria, enforce that min and max are at least one step width apart
                    if (
                      criterion.mode === 'range' &&
                      minValue + stepValue > maxValue
                    ) {
                      return this.createError({
                        message: t('manage.formErrors.CSSolutionsMinMaxStep', {
                          itemNumber: itemIx + 1,
                          criterionName: criterion.name,
                        }),
                      })
                    }

                    // for step / likert criteria, enforce that min and max are integers
                    if (criterion.mode === 'steps') {
                      const minInt = Math.floor(minValue)
                      const maxInt = Math.floor(maxValue)

                      if (minInt !== minValue || maxInt !== maxValue) {
                        return this.createError({
                          message: t(
                            'manage.formErrors.CSSolutionsMinMaxIntegers',
                            {
                              itemNumber: itemIx + 1,
                              criterionName: criterion.name,
                            }
                          ),
                        })
                      }
                    }
                  }
                }
              }

              return true
            },
          }),
        })
      )
      .required(t('manage.formErrors.CSCasesRequired'))
      .min(1, t('manage.formErrors.CSCasesRequired')),
  }
}

function useValidationSchema({
  numberOfAnswerOptions,
}: {
  numberOfAnswerOptions?: number
}) {
  const optionsSchemaSC = useOptionsSchemaSC()
  const optionsSchemaMC = useOptionsSchemaMC()
  const optionsSchemaKPRIM = useOptionsSchemaKPRIM()
  const optionsSchemaNumerical = useOptionsSchemaNumerical()
  const optionsSchemaFreeText = useOptionsSchemaFreeText()
  const optionsSchemaCode = useOptionsSchemaCode()
  const optionsSchemaSelection = useOptionsSchemaSelection({
    numberOfAnswerOptions,
  })
  const optionsSchemaCaseStudy = useOptionsSchemaCaseStudy()

  return yup.object().shape({
    ...useSharedValidationSchema(),

    options: yup.object().when(['type'], ([type], schema) => {
      switch (type) {
        case ElementType.Sc:
          return schema.shape(optionsSchemaSC)

        case ElementType.Mc: {
          return schema.shape(optionsSchemaMC)
        }

        case ElementType.Kprim: {
          return schema.shape(optionsSchemaKPRIM)
        }

        case ElementType.Numerical: {
          return schema.shape(optionsSchemaNumerical)
        }

        case ElementType.FreeText: {
          return schema.shape(optionsSchemaFreeText)
        }

        case ElementType.Code: {
          return schema.shape(optionsSchemaCode)
        }

        case ElementType.Selection: {
          return schema.shape(optionsSchemaSelection)
        }

        case ElementType.CaseStudy: {
          return schema.shape(optionsSchemaCaseStudy)
        }

        default:
          return schema.shape({})
      }
    }),
  })
}

export default useValidationSchema
