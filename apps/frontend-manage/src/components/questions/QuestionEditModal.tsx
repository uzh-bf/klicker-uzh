import { useMutation, useQuery } from '@apollo/client'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementDisplayMode,
  ElementType,
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  UpdateQuestionInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentQuestion from '@klicker-uzh/shared-components/src/StudentQuestion'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  H3,
  H4,
  Label,
  Modal,
  Prose,
  Select,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import {
  FastField,
  FastFieldProps,
  FieldArray,
  FieldArrayRenderProps,
  FieldProps,
  Form,
  Formik,
} from 'formik'
import { useTranslations } from 'next-intl'
import React, { Suspense, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import ContentInput from '../common/ContentInput'
import SuspendedTagInput from './tags/SuspendedTagInput'

enum QuestionEditMode {
  DUPLICATE = 'DUPLICATE',
  EDIT = 'EDIT',
  CREATE = 'CREATE',
}

interface QuestionEditModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  questionId?: number
  mode: QuestionEditMode
}

function QuestionEditModal({
  isOpen,
  handleSetIsOpen,
  questionId,
  mode,
}: QuestionEditModalProps): React.ReactElement {
  const isDuplication = mode === QuestionEditMode.DUPLICATE
  const t = useTranslations()
  const [updateInstances, setUpdateInstances] = useState(false)

  // TODO: ensure that every validation schema change is also reflected in an adaption of the error messages
  const questionManipulationSchema = Yup.object().shape({
    name: Yup.string().required(t('manage.formErrors.questionName')),
    tags: Yup.array().of(Yup.string()),
    type: Yup.string().oneOf(Object.values(ElementType)).required(),
    displayMode: Yup.string().oneOf(Object.values(ElementDisplayMode)),
    content: Yup.string()
      .required(t('manage.formErrors.questionContent'))
      .test({
        message: t('manage.formErrors.questionContent'),
        test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
      }),
    explanation: Yup.string().nullable(),
    hasSampleSolution: Yup.boolean(),
    hasAnswerFeedbacks: Yup.boolean(),

    options: Yup.object().when(
      ['type', 'hasSampleSolution', 'hasAnswerFeedbacks'],
      ([type, hasSampleSolution, hasAnswerFeedbacks], schema) => {
        const baseChoicesSchema = Yup.array().of(
          Yup.object().shape({
            ix: Yup.number(),
            value: Yup.string().test({
              message: t('manage.formErrors.answerContent'),
              test: (content) =>
                !content?.match(/^(<br>(\n)*)$/g) && content !== '',
            }),
            correct: Yup.boolean().nullable(),
            feedback: hasAnswerFeedbacks
              ? Yup.string().test({
                  message: t('manage.formErrors.feedbackContent'),
                  test: (content) =>
                    !content?.match(/^(<br>(\n)*)$/g) && content !== '',
                })
              : Yup.string().nullable(),
          })
        )

        switch (type) {
          case 'SC':
          case 'MC': {
            let choicesSchema = baseChoicesSchema.min(
              1,
              t('manage.formErrors.NumberQuestionsRequired')
            )

            if (type === 'SC')
              return schema.shape({
                choices: choicesSchema.test({
                  message: t('manage.formErrors.SCAnswersCorrect'),
                  test: (choices) => {
                    return (
                      !hasSampleSolution ||
                      choices.filter((choice) => choice.correct).length === 1
                    )
                  },
                }),
              })

            return schema.shape({
              choices: choicesSchema.test({
                message: t('manage.formErrors.MCAnswersCorrect'),
                test: (choices) => {
                  return (
                    !hasSampleSolution ||
                    choices.filter((choice) => choice.correct).length >= 1
                  )
                },
              }),
            })
          }

          case 'KPRIM': {
            const choicesSchema = baseChoicesSchema.length(
              4,
              t('manage.formErrors.NumberQuestionsRequiredKPRIM')
            )

            return schema.shape({
              choices: choicesSchema,
            })
          }

          case 'NUMERICAL': {
            const baseSolutionRanges = Yup.array()
              .of(
                Yup.object().shape({
                  min: Yup.number().nullable(),
                  // TODO: min less than max if defined
                  // .when('max', {
                  //   is: (max) => typeof max !== 'undefined',
                  //   then: (schema) => schema.lessThan(Yup.ref('max')),
                  // }),
                  max: Yup.number().nullable(),
                  // TODO: max more than min if defined
                  // .when('min', {
                  //   is: (min) => typeof min !== 'undefined',
                  //   then: (schema) => schema.moreThan(Yup.ref('min')),
                  // }),
                })
              )
              .nullable()

            return schema.shape({
              accuracy: Yup.number()
                .nullable()
                .min(0, t('manage.formErrors.NRPrecision')),
              unit: Yup.string().nullable(),

              restrictions: Yup.object().shape({
                min: Yup.number().nullable(),
                // TODO: less than if max defined
                // .lessThan(Yup.ref('max')),
                max: Yup.number().nullable(),
                // TODO: more than if min defined
                // .moreThan(Yup.ref('min')),
              }),

              solutionRanges: hasSampleSolution
                ? baseSolutionRanges.min(
                    1,
                    t('manage.formErrors.solutionRangeRequired')
                  )
                : baseSolutionRanges,
            })
          }

          case 'FREE_TEXT': {
            const baseSolutions = Yup.array().of(
              Yup.string()
                .required(t('manage.formErrors.enterSolution'))
                .min(1, t('manage.formErrors.enterSolution'))
            )

            return schema.shape({
              restrictions: Yup.object().shape({
                // TODO: ensure that this check does not fail if the user enters a number and then deletes it
                maxLength: Yup.number()
                  .min(1, t('manage.formErrors.FTMaxLength'))
                  .nullable(),
              }),

              // TODO: ensure that this check does not fail if the user enters a feedback and then deactivates the sample solution option again
              solutions:
                hasSampleSolution &&
                baseSolutions.min(1, t('manage.formErrors.solutionRequired')),
            })
          }
        }
      }
    ),
  })

  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputValue: '',
    inputValid: false,
    inputEmpty: true,
  })

  const {
    loading: loadingQuestion,
    error: errorQuestion,
    data: dataQuestion,
  } = useQuery(GetSingleQuestionDocument, {
    variables: { id: questionId! },
    skip: typeof questionId === 'undefined',
  })

  const [manipulateChoicesQuestion] = useMutation(
    ManipulateChoicesQuestionDocument
  )
  const [manipulateNUMERICALQuestion] = useMutation(
    ManipulateNumericalQuestionDocument
  )
  const [manipulateFreeTextQuestion] = useMutation(
    ManipulateFreeTextQuestionDocument
  )
  const [updateQuestionInstances] = useMutation(UpdateQuestionInstancesDocument)

  const DROPDOWN_OPTIONS = [
    {
      value: ElementType.Sc,
      label: t(`shared.${ElementType.Sc}.typeLabel`),
      data: {
        cy: `select-question-type-${t(`shared.${ElementType.Sc}.typeLabel`)}`,
      },
    },
    {
      value: ElementType.Mc,
      label: t(`shared.${ElementType.Mc}.typeLabel`),
      data: {
        cy: `select-question-type-${t(`shared.${ElementType.Mc}.typeLabel`)}`,
      },
    },
    {
      value: ElementType.Kprim,
      label: t(`shared.${ElementType.Kprim}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Kprim}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Numerical,
      label: t(`shared.${ElementType.Numerical}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Numerical}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.FreeText,
      label: t(`shared.${ElementType.FreeText}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.FreeText}.typeLabel`
        )}`,
      },
    },
  ]

  const question = useMemo(() => {
    if (mode === QuestionEditMode.CREATE) {
      const common = {
        type: ElementType.Sc,
        name: '',
        content: '',
        explanation: '',
        tags: [],

        pointsMultiplier: '1',
      }

      const commonOptions = {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
      }

      switch (common.type) {
        case ElementType.Sc:
        case ElementType.Mc:
        case ElementType.Kprim:
          return {
            ...common,
            options: {
              ...commonOptions,
              displayMode: ElementDisplayMode.List,
              choices: [{ ix: 0, value: '', correct: false, feedback: '' }],
            },
          }

        case ElementType.Numerical:
          return {
            ...common,
            options: {
              ...commonOptions,
              accuracy: undefined,
              unit: '',
              restrictions: { min: undefined, max: undefined },
              solutionRanges: [{ min: undefined, max: undefined }],
            },
          }

        case ElementType.FreeText:
          return {
            ...common,
            options: {
              ...commonOptions,
              placeholder: '',
              restrictions: { maxLength: undefined },
              solutions: [],
            },
          }

        default: {
          console.error('question type not implemented', common.type)
          return {}
        }
      }
    }

    return dataQuestion?.question?.questionData
      ? {
          ...dataQuestion.question,
          name: isDuplication
            ? `${dataQuestion.question.name} (Copy)`
            : dataQuestion.question.name,
          pointsMultiplier: String(dataQuestion.question.pointsMultiplier),
          explanation: dataQuestion.question.explanation ?? '',
          displayMode:
            dataQuestion.question.questionData.options.displayMode ??
            ElementDisplayMode.List,
          hasSampleSolution:
            dataQuestion.question.questionData.options.hasSampleSolution ??
            false,
          hasAnswerFeedbacks:
            dataQuestion.question.questionData.options.hasAnswerFeedbacks ??
            false,
          tags: dataQuestion.question.tags?.map((tag) => tag.name) ?? [],
          options: dataQuestion.question.questionData.options,
        }
      : {}
  }, [dataQuestion?.question, mode])

  // TODO: styling of tooltips - some are too wide
  // TODO: show errors of form validation below fields as for the login form

  if (!question) {
    return <div></div>
  }

  return (
    <Formik
      isInitialValid={[
        QuestionEditMode.EDIT,
        QuestionEditMode.DUPLICATE,
      ].includes(mode)}
      enableReinitialize={true}
      initialValues={question}
      validationSchema={questionManipulationSchema}
      onSubmit={async (values) => {
        const common = {
          id: questionId,
          type: values.type,
          name: values.name,
          content: values.content,
          explanation:
            !values.explanation?.match(/^(<br>(\n)*)$/g) &&
            values.explanation !== ''
              ? values.explanation
              : null,
          tags: values.tags,
          pointsMultiplier: parseInt(values.pointsMultiplier),
          options: {
            hasSampleSolution: values.hasSampleSolution,
            hasAnswerFeedbacks: values.hasAnswerFeedbacks,
          },
        }

        switch (common.type) {
          case ElementType.Sc:
          case ElementType.Mc:
          case ElementType.Kprim: {
            const result = await manipulateChoicesQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                options: {
                  ...common.options,
                  displayMode: values.displayMode || ElementDisplayMode.List,
                  choices: values.options?.choices.map((choice: any) => {
                    return {
                      ix: choice.ix,
                      value: choice.value,
                      correct: choice.correct,
                      feedback: choice.feedback,
                    }
                  }),
                },
              },
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })
            if (!result.data?.manipulateChoicesQuestion?.id) return
            break
          }
          case ElementType.Numerical: {
            const result = await manipulateNUMERICALQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                options: {
                  ...common.options,
                  unit: values.options?.unit,
                  accuracy: parseInt(values.options?.accuracy),
                  restrictions: {
                    min:
                      !values.options?.restrictions ||
                      values.options?.restrictions?.min === ''
                        ? undefined
                        : parseFloat(values.options.restrictions?.min),
                    max:
                      !values.options?.restrictions ||
                      values.options?.restrictions?.max === ''
                        ? undefined
                        : parseFloat(values.options.restrictions?.max),
                  },
                  solutionRanges: values.options?.solutionRanges?.map(
                    (range: any) => {
                      return {
                        min:
                          range.min === '' ? undefined : parseFloat(range.min),
                        max:
                          range.max === '' ? undefined : parseFloat(range.max),
                      }
                    }
                  ),
                },
              },
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })
            if (!result.data?.manipulateNumericalQuestion?.id) return
            break
          }
          case ElementType.FreeText: {
            const result = await manipulateFreeTextQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                options: {
                  ...common.options,
                  placeholder: values.options?.placeholder,
                  restrictions: {
                    maxLength: parseInt(
                      values.options?.restrictions?.maxLength
                    ),
                  },
                  solutions: values.options?.solutions,
                },
              },
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })
            if (!result.data?.manipulateFreeTextQuestion?.id) return
            break
          }

          default:
            break
        }

        if (mode === QuestionEditMode.EDIT && updateInstances) {
          if (questionId !== null && typeof questionId !== 'undefined') {
            const { data: instanceResult } = await updateQuestionInstances({
              variables: { questionId: questionId },
            })
          }
        }

        handleSetIsOpen(false)
      }}
    >
      {({
        errors,
        touched,
        isSubmitting,
        values,
        isValid,
        resetForm,
        setFieldValue,
        setFieldTouched,
        validateForm,
      }) => {
        if (loadingQuestion) {
          return null
        }

        return (
          <Modal
            asPortal
            fullScreen
            title={t(`manage.questionForms.${mode}Title`)}
            className={{
              content: 'max-w-[1400px] md:text-base text-sm',
              title: 'text-xl',
            }}
            open={isOpen}
            onClose={() => handleSetIsOpen(false)}
            escapeDisabled={true}
            onPrimaryAction={
              <Button
                disabled={isSubmitting || !isValid}
                className={{
                  root: twMerge(
                    'mt-2 font-bold text-white border-uzh-grey-80 bg-primary-80',
                    (isSubmitting || !isValid) &&
                      'opacity-50 cursor-not-allowed'
                  ),
                }}
                type="submit"
                form="question-manipulation-form"
                data={{ cy: 'save-new-question' }}
              >
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            }
            onSecondaryAction={
              <Button
                className={{ root: 'mt-2 border-uzh-grey-80' }}
                onClick={() => handleSetIsOpen(false)}
                data={{ cy: 'close-question-modal' }}
              >
                <Button.Label>{t('shared.generic.close')}</Button.Label>
              </Button>
            }
          >
            <div className="flex flex-row gap-12">
              <div className="flex-1 max-w-5xl">
                <Form className="w-full" id="question-manipulation-form">
                  <div className="z-0 flex flex-row">
                    <Label
                      label={t('manage.questionForms.questionType')}
                      className={{
                        root: 'mr-2 text-lg font-bold w-max',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      // tooltip="// TODO: tooltip content"
                      // showTooltipSymbol={mode === 'CREATE'}
                      required={mode === 'CREATE'}
                    />
                    <FormikSelectField
                      contentPosition="popper"
                      disabled={mode === 'EDIT'}
                      name="type"
                      placeholder={t('manage.questionForms.selectQuestionType')}
                      items={DROPDOWN_OPTIONS}
                      data={{ cy: 'select-question-type' }}
                    />
                  </div>

                  <div className="flex flex-row mt-2">
                    <Label
                      label={t('manage.questionForms.questionTitle')}
                      className={{
                        root: 'mr-2 text-lg font-bold w-56',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip={t('manage.questionForms.titleTooltip')}
                      showTooltipSymbol
                      required
                    />
                    <FormikTextField
                      onBlur={() => null}
                      name="name"
                      className={{
                        root: 'w-full',
                      }}
                      data={{ cy: 'insert-question-title' }}
                    />
                  </div>

                  <div className="flex flex-row mt-2">
                    <Label
                      label={t('manage.questionPool.tags')}
                      className={{
                        root: 'my-auto mr-2 text-lg font-bold w-36',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip={t('manage.questionForms.tagsTooltip')}
                      showTooltipSymbol={true}
                    />
                    <Suspense fallback={<Loader />}>
                      <SuspendedTagInput />
                    </Suspense>
                  </div>

                  <div className="z-0 flex flex-row mt-2">
                    <Label
                      label={t('shared.generic.multiplier')}
                      className={{
                        root: 'mr-2 text-lg font-bold w-32',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip={t('manage.questionForms.multiplierTooltip')}
                      showTooltipSymbol
                      required
                    />

                    {typeof values.pointsMultiplier !== 'undefined' && (
                      <FastField
                        name="pointsMultiplier"
                        shouldUpdate={(next, prev) =>
                          next?.formik.values.pointsMultiplier !==
                            prev?.formik.values.pointsMultiplier ||
                          next?.pointsMultiplier !== prev?.pointsMultiplier
                        }
                      >
                        {({ field, meta }: FastFieldProps) => (
                          <Select
                            items={[
                              {
                                label: 'x1',
                                value: '1',
                                data: { cy: 'select-multiplier-1' },
                              },
                              {
                                label: 'x2',
                                value: '2',
                                data: { cy: 'select-multiplier-2' },
                              },
                              {
                                label: 'x3',
                                value: '3',
                                data: { cy: 'select-multiplier-3' },
                              },
                              {
                                label: 'x4',
                                value: '4',
                                data: { cy: 'select-multiplier-4' },
                              },
                            ]}
                            onChange={(newValue: string) =>
                              setFieldValue('pointsMultiplier', newValue)
                            }
                            value={field.value}
                            data={{ cy: 'select-multiplier' }}
                          />
                        )}
                      </FastField>
                    )}
                  </div>

                  <div className="mt-4">
                    <Label
                      label={t('shared.generic.question')}
                      className={{
                        root: 'my-auto mr-2 text-lg font-bold',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip={t('manage.questionForms.questionTooltip')}
                      showTooltipSymbol
                      required
                    />

                    {typeof values.content !== 'undefined' && (
                      <FastField
                        name="content"
                        questionType={values.type}
                        shouldUpdate={(next, prev) =>
                          next?.formik.values.content !==
                            prev?.formik.values.content ||
                          next?.formik.values.type !== prev?.formik.values.type
                        }
                      >
                        {({ field, meta }: FastFieldProps) => (
                          <ContentInput
                            autoFocus
                            error={meta.error}
                            touched={meta.touched}
                            content={field.value || '<br>'}
                            onChange={(newValue: string) =>
                              setFieldValue('content', newValue)
                            }
                            showToolbarOnFocus={false}
                            placeholder={t(
                              'manage.questionForms.questionPlaceholder'
                            )}
                            key={`${values.type}-content`}
                            data_cy="insert-question-text"
                            className={{ content: 'max-w-none' }}
                          />
                        )}
                      </FastField>
                    )}
                  </div>

                  <div className="mt-4">
                    <Label
                      label={t('shared.generic.explanation')}
                      className={{
                        root: 'my-auto mr-2 text-lg font-bold',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip={t('manage.questionForms.explanationTooltip')}
                      showTooltipSymbol={true}
                    />

                    {typeof values.explanation !== 'undefined' && (
                      <FastField
                        name="explanation"
                        questionType={values.type}
                        shouldUpdate={(next, prev) =>
                          next?.formik.values.explanation !==
                            prev?.formik.values.explanation ||
                          next?.formik.values.type !== prev?.formik.values.type
                        }
                      >
                        {({ field, meta }: FastFieldProps) => (
                          <ContentInput
                            error={meta.error}
                            touched={meta.touched}
                            content={field.value || '<br>'}
                            onChange={(newValue: string) =>
                              setFieldValue('explanation', newValue)
                            }
                            placeholder={t(
                              'manage.questionForms.explanationPlaceholder'
                            )}
                            key={`${values.type}-explanation`}
                            data_cy="insert-question-explanation"
                          />
                        )}
                      </FastField>
                    )}
                  </div>

                  <div className="flex flex-row gap-4 mt-4">
                    {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                      <div className="flex-1">
                        <Label
                          label={t('manage.questionForms.answerOptions')}
                          className={{
                            root: 'my-auto mr-2 text-lg font-bold',
                            tooltip: 'text-base font-normal',
                          }}
                          tooltip={t(
                            'manage.questionForms.answerOptionsTooltip'
                          )}
                          showTooltipSymbol
                          required
                        />
                      </div>
                    )}
                    {QUESTION_GROUPS.FREE.includes(values.type) && (
                      <div className="flex-1">
                        <Label
                          label={t('shared.generic.options')}
                          className={{
                            root: 'my-auto mr-2 text-lg font-bold',
                            tooltip: 'text-base font-normal',
                          }}
                          tooltip={t('manage.questionForms.FTOptionsTooltip')}
                          showTooltipSymbol={true}
                        />
                      </div>
                    )}
                    <Switch
                      checked={values.hasSampleSolution || false}
                      onCheckedChange={(newValue: boolean) => {
                        setFieldValue('hasSampleSolution', newValue)
                        validateForm()
                      }}
                      label={t('shared.generic.sampleSolution')}
                      data={{ cy: 'configure-sample-solution' }}
                    />
                    {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                      <Switch
                        checked={values.hasAnswerFeedbacks || false}
                        onCheckedChange={(newValue: boolean) => {
                          setFieldValue('hasAnswerFeedbacks', newValue)
                          validateForm()
                        }}
                        label={t('manage.questionPool.answerFeedbacks')}
                        disabled={!values.hasSampleSolution}
                        className={{
                          root: twMerge(
                            !values.hasSampleSolution && 'opacity-50'
                          ),
                        }}
                      />
                    )}
                    {[ElementType.Sc, ElementType.Mc].includes(values.type) && (
                      <FormikSelectField
                        name="displayMode"
                        items={Object.values(ElementDisplayMode).map(
                          (mode) => ({
                            value: mode,
                            label: t(`manage.questionForms.${mode}Display`),
                            data: {
                              cy: `select-display-mode-${t(
                                `manage.questionForms.${mode}Display`
                              )}`,
                            },
                          })
                        )}
                        data={{ cy: 'select-display-mode' }}
                      />
                    )}
                  </div>

                  {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                    <FieldArray name="options.choices">
                      {({ push, remove }: FieldArrayRenderProps) => {
                        return (
                          <div className="flex flex-col w-full gap-2 pt-2">
                            {values.options?.choices?.map(
                              (
                                choice: {
                                  ix: number
                                  value: string
                                  correct?: boolean
                                  feedback?: string
                                },
                                index: number
                              ) => (
                                <div
                                  key={index}
                                  className={twMerge(
                                    'w-full rounded border-uzh-grey-80',
                                    values.hasSampleSolution && 'p-2',
                                    choice.correct &&
                                      values.hasSampleSolution &&
                                      ' bg-green-100 border-green-300',
                                    !choice.correct &&
                                      values.hasSampleSolution &&
                                      ' bg-red-100 border-red-300'
                                  )}
                                >
                                  <div className="flex flex-row w-full focus:border-primary-40">
                                    {/* // TODO: define maximum height of editor if possible */}
                                    <FastField
                                      name={`options.choices.${index}.value`}
                                      questionType={values.type}
                                      shouldUpdate={(next, prev) =>
                                        next?.formik.values[
                                          `options.choices.${index}.value`
                                        ] !==
                                          prev?.formik.values[
                                            `options.choices.${index}.value`
                                          ] ||
                                        next.formik.values.type !==
                                          prev.formik.values.type ||
                                        next.formik.values.options.choices
                                          .length !==
                                          prev.formik.values.options.choices
                                            .length
                                      }
                                    >
                                      {({ field, meta }: FastFieldProps) => (
                                        <ContentInput
                                          key={`${values.type}-choice-${index}-${values.options.choices.length}`}
                                          error={meta.error}
                                          touched={meta.touched}
                                          content={field.value}
                                          onChange={(newContent: string) => {
                                            setFieldValue(
                                              `options.choices.${index}.value`,
                                              newContent
                                            )
                                          }}
                                          showToolbarOnFocus={true}
                                          placeholder={t(
                                            'manage.questionForms.answerOptionPlaceholder'
                                          )}
                                          className={{
                                            root: 'bg-white',
                                          }}
                                          data_cy="insert-answer-field"
                                        />
                                      )}
                                    </FastField>
                                    {values.hasSampleSolution && (
                                      <div className="flex flex-row items-center ml-2">
                                        <div className="mr-2">
                                          {t('shared.generic.correct')}?
                                        </div>
                                        <FastField
                                          name={`options.choices.${index}.correct`}
                                        >
                                          {({ field }: FieldProps) => (
                                            <Switch
                                              checked={field.value || false}
                                              label=""
                                              className={{
                                                root: 'gap-0 mr-0.5',
                                              }}
                                              onCheckedChange={(
                                                newValue: boolean
                                              ) => {
                                                setFieldValue(
                                                  `options.choices.${index}.correct`,
                                                  newValue
                                                )
                                              }}
                                              data={{ cy: 'set-correctness' }}
                                            />
                                          )}
                                        </FastField>
                                      </div>
                                    )}
                                    <Button
                                      onClick={() => {
                                        // decrement the choice.ix value of all answers after this one
                                        values.options.choices
                                          .slice(index + 1)
                                          .forEach((choice) => {
                                            setFieldValue(
                                              `options.choices.${choice.ix}.ix`,
                                              choice.ix - 1
                                            )
                                          })
                                        remove(index)
                                      }}
                                      className={{
                                        root: 'items-center justify-center w-10 h-10 ml-2 text-white bg-red-600 rounded-md',
                                      }}
                                      data={{
                                        cy: `delete-answer-option-ix-${index}`,
                                      }}
                                    >
                                      <Button.Icon>
                                        <FontAwesomeIcon
                                          icon={faTrash}
                                          className="hover:bg-primary-20"
                                        />
                                      </Button.Icon>
                                    </Button>
                                  </div>

                                  {values.hasAnswerFeedbacks &&
                                    values.hasSampleSolution && (
                                      <div className="">
                                        <div className="mt-2 text-sm font-bold">
                                          {t('shared.generic.feedback')}
                                        </div>
                                        <FastField
                                          name={`options.choices.${index}.feedback`}
                                          questionType={values.type}
                                          shouldUpdate={(next, prev) =>
                                            next?.formik.values[
                                              `options.choices.${index}.feedback`
                                            ] !==
                                              prev?.formik.values[
                                                `options.choices.${index}.feedback`
                                              ] ||
                                            next?.formik.values.type !==
                                              prev?.formik.values.type
                                          }
                                        >
                                          {({
                                            field,
                                            meta,
                                          }: FastFieldProps) => (
                                            <ContentInput
                                              error={meta.error}
                                              touched={meta.touched}
                                              content={field.value || '<br>'}
                                              onChange={(
                                                newContent: string
                                              ): void => {
                                                setFieldValue(
                                                  `options.choices.${index}.feedback`,
                                                  newContent
                                                )
                                              }}
                                              className={{
                                                root: 'bg-white',
                                                content:
                                                  'w-full rounded border border-uzh-grey-100 focus:border-primary-40',
                                              }}
                                              showToolbarOnFocus={true}
                                              placeholder={t(
                                                'manage.questionForms.feedbackPlaceholder'
                                              )}
                                              key={`${values.type}-feedback-${index}`}
                                            />
                                          )}
                                        </FastField>
                                      </div>
                                    )}
                                </div>
                              )
                            )}

                            <Button
                              fluid
                              className={{
                                root: twMerge(
                                  'font-bold border border-solid border-uzh-grey-100',
                                  values.type === ElementType.Kprim &&
                                    values.options.choices.length >= 4 &&
                                    'opacity-50 cursor-not-allowed'
                                ),
                              }}
                              disabled={
                                values.type === ElementType.Kprim &&
                                values.options.choices.length >= 4
                              }
                              onClick={() =>
                                push({
                                  ix: values.options.choices[
                                    values.options.choices.length - 1
                                  ]
                                    ? values.options.choices[
                                        values.options.choices.length - 1
                                      ].ix + 1
                                    : 0,
                                  value: '<br>',
                                  correct: false,
                                  explanation: '<br>',
                                })
                              }
                              data={{ cy: 'add-new-answer' }}
                            >
                              {t('manage.questionForms.addAnswer')}
                            </Button>
                          </div>
                        )
                      }}
                    </FieldArray>
                  )}

                  {values.type === ElementType.Numerical && (
                    <div>
                      <div className="w-full">
                        <div className="flex flex-row items-center gap-2 mb-2">
                          <div className="font-bold">
                            {t('shared.generic.min')}:{' '}
                          </div>
                          <FormikNumberField
                            name="options.restrictions.min"
                            className={{
                              root: 'w-40 mr-2 rounded h-9 focus:border-primary-40',
                              numberField: { input: 'bg-white text-gray-500' },
                            }}
                            placeholder={t('shared.generic.minLong')}
                            data={{ cy: 'set-numerical-minimum' }}
                            hideError
                          />
                          <div className="font-bold">
                            {t('shared.generic.max')}:{' '}
                          </div>
                          <FormikNumberField
                            name="options.restrictions.max"
                            className={{
                              root: 'w-40 mr-2 rounded h-9 focus:border-primary-40',
                              numberField: { input: 'bg-white text-gray-500' },
                            }}
                            placeholder={t('shared.generic.maxLong')}
                            data={{ cy: 'set-numerical-maximum' }}
                            hideError
                          />
                        </div>
                        <div className="flex flex-row items-center gap-2">
                          <div className="font-bold">
                            {t('shared.generic.unit')}:{' '}
                          </div>
                          <FastField
                            name="options.unit"
                            type="text"
                            className="w-40 mr-2 bg-opacity-50 border rounded border-uzh-grey-100 h-9 focus:border-primary-40"
                            placeholder="CHF"
                            data-cy="set-numerical-unit"
                          />
                          <div className="font-bold">
                            {t('shared.generic.precision')}:{' '}
                          </div>
                          <FormikNumberField
                            name="options.accuracy"
                            className={{
                              root: 'w-40 mr-2 rounded h-9 focus:border-primary-40',
                              numberField: { input: 'bg-white text-gray-500' },
                            }}
                            precision={0}
                            data={{ cy: 'set-numerical-accuracy' }}
                            hideError
                          />
                        </div>
                      </div>
                      {values.hasSampleSolution && (
                        <div className="mt-3">
                          <Label
                            label={t('manage.questionForms.solutionRanges')}
                            className={{
                              root: 'my-auto mr-2 text-lg font-bold',
                              tooltip: 'text-base font-normal',
                            }}
                            tooltip={t(
                              'manage.questionForms.solutionRangesTooltip'
                            )}
                            showTooltipSymbol={true}
                          />
                          <FieldArray name="options.solutionRanges">
                            {({ push, remove }: FieldArrayRenderProps) => (
                              <div className="flex flex-col gap-1 w-max">
                                {values.options.solutionRanges?.map(
                                  (_range: any, index: number) => (
                                    <div
                                      className="flex flex-row items-center gap-2"
                                      key={`${index}-${values.options.solutionRanges.length}`}
                                    >
                                      <div className="font-bold">
                                        {t('shared.generic.min')}:{' '}
                                      </div>
                                      <FormikNumberField
                                        name={`options.solutionRanges.${index}.min`}
                                        className={{
                                          root: 'w-40 mr-2 rounded h-9 focus:border-primary-40',
                                          input: 'bg-white text-gray-500',
                                        }}
                                        placeholder={t(
                                          'shared.generic.minLong'
                                        )}
                                        data={{
                                          cy: `set-solution-range-min-${index}`,
                                        }}
                                      />
                                      <div className="font-bold">
                                        {t('shared.generic.max')}:{' '}
                                      </div>
                                      <FormikNumberField
                                        name={`options.solutionRanges.${index}.max`}
                                        className={{
                                          root: 'w-40 mr-2 rounded h-9 focus:border-primary-40',
                                          input: 'bg-white text-gray-500',
                                        }}
                                        placeholder={t(
                                          'shared.generic.maxLong'
                                        )}
                                        data={{
                                          cy: `set-solution-range-max-${index}`,
                                        }}
                                      />
                                      <Button
                                        onClick={() => remove(index)}
                                        className={{
                                          root: 'ml-2 text-white bg-red-500 sm:hover:bg-red-600',
                                        }}
                                        data={{
                                          cy: `delete-solution-range-ix-${index}`,
                                        }}
                                      >
                                        {t('shared.generic.delete')}
                                      </Button>
                                    </div>
                                  )
                                )}
                                <Button
                                  fluid
                                  className={{
                                    root: 'flex-1 font-bold border border-solid border-uzh-grey-100',
                                  }}
                                  onClick={() =>
                                    push({
                                      min: undefined,
                                      max: undefined,
                                    })
                                  }
                                  data={{ cy: 'add-solution-range' }}
                                >
                                  {t('manage.questionForms.addSolutionRange')}
                                </Button>
                              </div>
                            )}
                          </FieldArray>
                        </div>
                      )}
                    </div>
                  )}

                  {values.type === ElementType.FreeText && (
                    <div className="flex flex-col">
                      <div className="flex flex-row items-center mb-4">
                        <div className="mr-2 font-bold">
                          {t('manage.questionForms.maximumLength')}:
                        </div>
                        <FormikNumberField
                          name="options.restrictions.maxLength"
                          className={{
                            field:
                              'mr-2 bg-opacity-50 border rounded w-44  h-9 focus:border-primary-40',
                          }}
                          placeholder={t('manage.questionForms.answerLength')}
                          precision={0}
                          data={{ cy: 'set-free-text-length' }}
                          hideError
                        />
                      </div>
                      {values.hasSampleSolution && (
                        <FieldArray name="options.solutions">
                          {({ push, remove }: FieldArrayRenderProps) => (
                            <div className="flex flex-col gap-1 w-max">
                              {values.options.solutions?.map(
                                (_solution, index) => (
                                  <div
                                    className="flex flex-row items-center gap-2"
                                    key={`${index}-${values.options.solutions.length}`}
                                  >
                                    <div className="w-40 font-bold">
                                      {t(
                                        'manage.questionForms.possibleSolutionN',
                                        { number: String(index + 1) }
                                      )}
                                      :{' '}
                                    </div>
                                    <FastField
                                      name={`options.solutions.${index}`}
                                      type="text"
                                      className="w-40 mr-2 bg-opacity-50 border rounded border-uzh-grey-100 h-9 focus:border-primary-40"
                                      placeholder={t('shared.generic.solution')}
                                    />
                                    <Button
                                      onClick={() => remove(index)}
                                      className={{
                                        root: 'ml-2 text-white bg-red-500 sm:hover:bg-red-600',
                                      }}
                                      data={{
                                        cy: `delete-solution-ix-${index}`,
                                      }}
                                    >
                                      {t('shared.generic.delete')}
                                    </Button>
                                  </div>
                                )
                              )}
                              <Button
                                fluid
                                className={{
                                  root: 'flex-1 font-bold border border-solid border-uzh-grey-100',
                                }}
                                onClick={() => push('')}
                                data={{ cy: 'add-solution-value' }}
                              >
                                {t('manage.questionForms.addSolution')}
                              </Button>
                            </div>
                          )}
                        </FieldArray>
                      )}
                    </div>
                  )}
                </Form>

                {JSON.stringify(errors) !== '{}' && (
                  <UserNotification
                    className={{
                      root: 'mt-8 text-base p-4',
                      icon: 'text-red-700',
                      message: 'text-red-700',
                    }}
                    type="error"
                  >
                    <div>{t('manage.formErrors.resolveErrors')}</div>
                    <ul className="ml-4 list-disc">
                      {errors.name && (
                        <li>{`${t('manage.questionForms.questionTitle')}: ${
                          errors.name
                        }`}</li>
                      )}
                      {errors.tags && (
                        <li>{`${t('manage.questionPool.tags')}: ${
                          errors.tags
                        }`}</li>
                      )}
                      {errors.pointsMultiplier && (
                        <li>{`${t('shared.generic.multiplier')}: ${
                          errors.pointsMultiplier
                        }`}</li>
                      )}
                      {errors.content && (
                        <li>{`${t('shared.generic.question')}: ${
                          errors.content
                        }`}</li>
                      )}
                      {errors.explanation && (
                        <li>{`${t('shared.generic.explanation')}: ${
                          errors.explanation
                        }`}</li>
                      )}

                      {/* error messages specific to SC / MC / KP questions */}
                      {errors.options &&
                        errors.options.choices &&
                        typeof errors.options.choices === 'object' &&
                        errors.options.choices?.map(
                          (choiceError: any, ix: number) =>
                            choiceError && (
                              <li key={`choice-${ix}`}>{`${t(
                                'manage.questionForms.answerOption'
                              )} ${ix + 1}: ${
                                choiceError.value && choiceError.feedback
                                  ? `${choiceError.value} ${choiceError.feedback}`
                                  : choiceError.value || choiceError.feedback
                              }`}</li>
                            )
                        )}
                      {errors.options &&
                        errors.options.choices &&
                        typeof errors.options.choices === 'string' && (
                          <li>{`${t('manage.questionForms.answerOptions')}: ${
                            errors.options.choices
                          }`}</li>
                        )}

                      {/* error messages specific to NR questions */}
                      {errors.options && errors.options.accuracy && (
                        <li>{`${t('shared.generic.precision')}: ${
                          errors.options.accuracy
                        }`}</li>
                      )}
                      {errors.options &&
                        errors.options.solutionRanges &&
                        typeof errors.options.solutionRanges === 'string' && (
                          <li>{`${t('manage.questionForms.solutionRanges')}: ${
                            errors.options.solutionRanges
                          }`}</li>
                        )}

                      {/* error messages specific to FT questions */}
                      {errors.options && errors.options.restrictions && (
                        <li>{`${t('manage.questionForms.answerLength')}: ${
                          errors.options.restrictions.maxLength
                        }`}</li>
                      )}
                      {errors.options &&
                        errors.options.solutions &&
                        typeof errors.options.solutions === 'object' &&
                        errors.options.solutions?.map(
                          (solutionError: any, ix: number) =>
                            solutionError && (
                              <li key={`solution-${ix}`}>{`${t(
                                'manage.questionForms.possibleSolutionN',
                                { number: String(ix + 1) }
                              )}: ${solutionError}`}</li>
                            )
                        )}
                      {errors.options &&
                        errors.options.solutions &&
                        typeof errors.options.solutions === 'string' && (
                          <li>{`${t(
                            'manage.questionForms.possibleSolutions'
                          )}: ${errors.options.solutions}`}</li>
                        )}
                    </ul>
                  </UserNotification>
                )}
              </div>
              <div className="flex-1 max-w-sm">
                <H3>{t('shared.generic.preview')}</H3>
                <div className="p-4 border rounded">
                  <StudentQuestion
                    activeIndex={0}
                    numItems={1}
                    isSubmitDisabled
                    onSubmit={() => null}
                    onExpire={() => null}
                    currentQuestion={{
                      instanceId: 0,
                      // ...dataQuestion?.question,
                      content: values.content,
                      type: values.type,
                      displayMode: values.displayMode,
                      // options: dataQuestion?.question?.questionData.options,
                      options: {
                        choices: values.options?.choices,
                        accuracy: parseInt(values.options?.accuracy),
                        unit: values.options?.unit,
                        restrictions: {
                          min: parseFloat(values.options?.restrictions?.min),
                          max: parseFloat(values.options?.restrictions?.max),
                          maxLength: parseInt(
                            values.options?.restrictions?.maxLength
                          ),
                        },
                      },
                    }}
                    inputValue={inputValue}
                    inputValid={inputValid}
                    inputEmpty={inputEmpty}
                    setInputState={setInputState}
                  />
                </div>
                {values.explanation && (
                  <div className="mt-4">
                    <H3>{t('shared.generic.explanation')}</H3>
                    <Markdown content={values.explanation} />
                  </div>
                )}
                {QUESTION_GROUPS.CHOICES.includes(values.type) &&
                  values.hasAnswerFeedbacks && (
                    <div className="mt-4">
                      <H3>{t('shared.generic.feedbacks')}</H3>
                      {values.options?.choices?.map((choice, index) => (
                        <div
                          key={index}
                          className="pt-1 pb-1 border-b last:border-b-0"
                        >
                          {choice.feedback ? (
                            <Markdown content={choice.feedback} />
                          ) : (
                            t('manage.questionForms.noFeedbackDefined')
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {mode === QuestionEditMode.EDIT && (
              <div
                className={twMerge(
                  'p-2 mt-3 border border-solid rounded flex flex-row gap-6 items-center',
                  updateInstances && 'bg-orange-100 border-orange-200'
                )}
              >
                <Switch
                  checked={updateInstances}
                  onCheckedChange={() => setUpdateInstances(!updateInstances)}
                />
                <div>
                  <H4 className={{ root: 'm-0' }}>
                    {t('manage.questionForms.updateInstances')}
                  </H4>
                  <Prose className={{ root: 'prose-xs max-w-none' }}>
                    {t('manage.questionForms.updateInstancesExplanation')}
                  </Prose>
                </div>
              </div>
            )}
          </Modal>
        )
      }}
    </Formik>
  )
}

QuestionEditModal.Mode = QuestionEditMode

export default QuestionEditModal
