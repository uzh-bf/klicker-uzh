import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'
import { ElementFormTypesCaseStudy } from './types'

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

function useOptionsSchemaSelection({
  numberOfAnswerOptions,
}: {
  numberOfAnswerOptions?: number
}) {
  const t = useTranslations()

  return {
    hasSampleSolution: yup.boolean(),
    numberOfInputs: yup
      .number()
      .required(t('manage.formErrors.SEnumberOfInputsRequired'))
      .min(1, t('manage.formErrors.SEnumberOfInputsMin'))
      .max(
        numberOfAnswerOptions ? numberOfAnswerOptions - 1 : 100,
        t('manage.formErrors.SEnumberOfInputsMax')
      ),
    answerCollection: yup
      .string()
      .required(t('manage.formErrors.SEanswerCollectionRequired')),
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

  // options: {
  //   hasSampleSolution: boolean
  //   answerCollection: string
  //   selectedItems: number[] // items that should be evaluated with respect to the defined criteria
  //   cases: {
  //     title: string
  //     description: string
  //     // key of top level record is `itemId-${item.id}`, key of nested record is criterion id
  //     solutions?: Record<string, Record<string, { min: number; max: number }>>
  //   }[]
  //   criteria: {
  //     id: string // short id
  //     name: string
  //     min: number
  //     max: number
  //     step: number
  //     unit?: string | null
  //   }[]
  // }

  return {
    hasSampleSolution: yup.boolean(),
    answerCollection: yup
      .string()
      .required(t('manage.formErrors.CSAnswerCollectionRequired')),
    selectedItems: yup
      .array()
      .of(yup.number())
      .required(t('manage.formErrors.CSItemsRequired'))
      .min(1, t('manage.formErrors.CSItemsRequired')),
    criteria: yup
      .array()
      .of(
        yup.object().shape({
          id: yup.string().required(),
          name: yup
            .string()
            .required(t('manage.formErrors.CSCriteriaNameRequired')),
          min: yup
            .number()
            .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
            .max(1e30, t('manage.formErrors.NumericalOverflow'))
            .required(t('manage.formErrors.CSCriteriaMinRequired'))
            .when('max', {
              is: (max?: number) => typeof max !== 'undefined' && max !== null,
              then: (schema) =>
                schema.lessThan(
                  yup.ref('max'),
                  t('manage.formErrors.CSCriteriaMinLessThanMax')
                ),
            }),
          max: yup
            .number()
            .min(-1e30, t('manage.formErrors.NumericalUnderflow'))
            .max(1e30, t('manage.formErrors.NumericalOverflow'))
            .required(t('manage.formErrors.CSCriteriaMaxRequired')),
          step: yup
            .number()
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
          unit: yup.string().nullable(),
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
            message: t('manage.formErrors.CSSolutionsRequired'),
            test: function (
              solutions: ElementFormTypesCaseStudy['options']['cases'][0]['solutions']
            ) {
              // extract parent of parent
              const grandparent = this.from?.[2].value

              // if sample solution is not set, solutions are not required
              if (!grandparent.hasSampleSolution) return true

              if (!solutions) return false

              // get selected items and criteria
              const selectedItems: ElementFormTypesCaseStudy['options']['selectedItems'] =
                grandparent.selectedItems
              const criteria: ElementFormTypesCaseStudy['options']['criteria'] =
                grandparent.criteria

              // check if we have solutions for all selected items
              const solutionKeys = Object.keys(solutions)
              if (solutionKeys.length !== selectedItems.length) return false

              // check if each selected item has solutions for all criteria
              return selectedItems.every((itemId) => {
                const criterionSolutions = solutions[`itemId-${itemId}`]
                if (!criterionSolutions) return false

                // check if number of criterion solutions matches criteria length
                if (Object.keys(criterionSolutions).length !== criteria.length)
                  return false

                // validate structure of each solution
                return criteria.every((criterion) => {
                  const solution = criterionSolutions[criterion.id]
                  const minValue = parseFloat(solution.min)
                  const maxValue = parseFloat(solution.max)

                  // solution must be defined and have a min and max value
                  if (
                    !solution ||
                    typeof solution.min !== 'string' ||
                    typeof solution.max !== 'string' ||
                    Number.isNaN(minValue) ||
                    Number.isNaN(maxValue)
                  )
                    return false

                  // min must be less or equal to max
                  if (minValue > maxValue) return false

                  // check if criterion values are defined, otherwise skip this validation part until they are defined
                  const criterionMin = parseFloat(criterion.min)
                  const criterionMax = parseFloat(criterion.max)
                  const stepValue = parseFloat(criterion.step)

                  if (
                    Number.isNaN(criterionMin) ||
                    Number.isNaN(criterionMax) ||
                    Number.isNaN(stepValue)
                  ) {
                    return true
                  } else {
                    // min and max need to lie within the bounds of the criterion and at least step size apart
                    if (
                      minValue < criterionMin ||
                      maxValue > criterionMax ||
                      minValue + stepValue > maxValue
                    )
                      return false
                  }

                  return true
                })
              })
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
