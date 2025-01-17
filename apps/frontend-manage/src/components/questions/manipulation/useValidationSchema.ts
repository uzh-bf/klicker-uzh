import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'

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
        .min(-1e30, t('manage.formErrors.NRUnderflow'))
        .max(1e30, t('manage.formErrors.NROverflow'))
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
        .min(-1e30, t('manage.formErrors.NRUnderflow'))
        .max(1e30, t('manage.formErrors.NROverflow'))
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
              message: t('manage.formErrors.NRUnderflow'),
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
              message: t('manage.formErrors.NROverflow'),
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
          .min(-1e30, t('manage.formErrors.NRUnderflow'))
          .max(1e30, t('manage.formErrors.NROverflow'))
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

function useValidationSchema({
  numberOfAnswerOptions,
}: {
  numberOfAnswerOptions?: number
}) {
  const t = useTranslations()
  const optionsSchemaSC = useOptionsSchemaSC()
  const optionsSchemaMC = useOptionsSchemaMC()
  const optionsSchemaKPRIM = useOptionsSchemaKPRIM()
  const optionsSchemaNumerical = useOptionsSchemaNumerical()
  const optionsSchemaFreeText = useOptionsSchemaFreeText()
  const optionsSchemaSelection = useOptionsSchemaSelection({
    numberOfAnswerOptions,
  })

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

        default:
          return schema.shape({})
      }
    }),
  })
}

export default useValidationSchema
