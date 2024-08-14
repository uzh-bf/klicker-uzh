import { useTranslations } from 'next-intl'
import * as yup from 'yup'

const t = useTranslations()

export const nameValidationSchema = yup.object().shape({
  name: yup.string().required(t('manage.sessionForms.sessionName')),
})

export const descriptionValidationSchema = yup.object().shape({
  displayName: yup
    .string()
    .required(t('manage.sessionForms.sessionDisplayName')),
  description: yup.string(),
})

export const stepTwoValidationSchema = yup.object().shape({
  startDate: yup.date().required(t('manage.sessionForms.startDate')),
  endDate: yup
    .date()
    .min(yup.ref('startDate'), t('manage.sessionForms.endAfterStart'))
    .required(t('manage.sessionForms.endDate')),
  multiplier: yup
    .string()
    .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
  courseId: yup.string().required(t('manage.sessionForms.microlearningCourse')),
})

export const stackValiationSchema = yup.object().shape({
  stacks: yup
    .array()
    .of(
      yup.object().shape({
        displayName: yup.string(),
        description: yup.string(),
        elementIds: yup
          .array()
          .of(yup.number())
          .min(1, t('manage.sessionForms.minOneElementPerStack')),
        titles: yup.array().of(yup.string()),
        types: yup
          .array()
          .of(
            yup
              .string()
              .oneOf(acceptedTypes, t('manage.sessionForms.microlearningTypes'))
          ),
        hasSampleSolutions: yup
          .array()
          .of(
            yup.boolean().isTrue(t('manage.sessionForms.elementSolutionReq'))
          ),
      })
    )
    .min(1),
})
