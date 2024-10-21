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
      feedback: yup.string().when('hasAnswerFeedbacks', {
        is: true,
        then: (schema) =>
          schema.test({
            message: t('manage.formErrors.feedbackContent'),
            test: (content) =>
              !content?.match(/^(<br>(\n)*)$/g) && content !== '',
          }),
        otherwise: (schema) => schema.nullable(),
      }),
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
            test: (choices) => {
              return choices?.filter((choice) => choice.correct).length === 1
            },
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
      }),
  }
}

function useOptionsSchemaKPRIM() {
  const t = useTranslations()
  const baseChoicesSchema = useChoicesSchema()

  return {
    hasAnswerFeedbacks: yup.boolean(),
    hasSampleSolution: yup.boolean(),
    choices: baseChoicesSchema.length(
      4,
      t('manage.formErrors.NumberQuestionsRequiredKPRIM')
    ),
  }
}

function useSolutionRangeSchema() {
  const t = useTranslations()

  return yup
    .array()
    .of(
      yup.object().shape({
        min: yup
          .number()
          .nullable()
          // we can only handle one case to avoid cyclic dependencies
          .when('max', {
            is: (max?: number | null) => typeof max !== 'undefined',
            then: (schema) =>
              schema.lessThan(
                yup.ref('max'),
                t('manage.formErrors.NRMinLessThanMaxSol')
              ),
          }),
        max: yup.number().nullable(),
      })
    )
    .nullable()
}

function useOptionsSchemaNumerical() {
  const t = useTranslations()
  const baseSolutionRanges = useSolutionRangeSchema()

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
          is: (max?: number) => typeof max !== 'undefined',
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

    solutionRanges: baseSolutionRanges.when('hasSampleSolution', {
      is: true,
      then: (schema) =>
        schema
          .required(t('manage.formErrors.solutionRequired'))
          .min(1, t('manage.formErrors.solutionRangeRequired')),
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
      .when('hasSampleSolution', {
        is: true,
        then: (schema) =>
          schema
            .required(t('manage.formErrors.solutionRequired'))
            .min(1, t('manage.formErrors.solutionRequired')),
      }),
  }
}

function useValidationSchema() {
  const t = useTranslations()
  const optionsSchemaSC = useOptionsSchemaSC()
  const optionsSchemaMC = useOptionsSchemaMC()
  const optionsSchemaKPRIM = useOptionsSchemaKPRIM()
  const optionsSchemaNumerical = useOptionsSchemaNumerical()
  const optionsSchemaFreeText = useOptionsSchemaFreeText()

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

        default:
          return schema.shape({})
      }
    }),
  })
}

export default useValidationSchema
