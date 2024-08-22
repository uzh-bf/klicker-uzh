import { useMutation, useQuery } from '@apollo/client'
import MultiplierSelector from '@components/sessions/creation/MultiplierSelector'
import {
  faArrowDown,
  faArrowUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementDisplayMode,
  ElementInstance,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateContentElementDocument,
  ManipulateFlashcardElementDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  UpdateQuestionInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  FormLabel,
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
  H3,
  H4,
  Modal,
  Prose,
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

function createValidationSchema(t) {
  return Yup.object().shape({
    status: Yup.string().oneOf(Object.values(ElementStatus)),
    name: Yup.string().required(t('manage.formErrors.questionName')),
    tags: Yup.array().of(Yup.string()),
    type: Yup.string().oneOf(Object.values(ElementType)).required(),

    content: Yup.string()
      .required(t('manage.formErrors.questionContent'))
      .test({
        message: t('manage.formErrors.questionContent'),
        test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
      }),

    explanation: Yup.string().when(['type'], ([type], schema) => {
      if (type === ElementType.Flashcard)
        return schema.required(t('manage.formErrors.explanationRequired'))
      return schema.nullable()
    }),

    options: Yup.object().when(['type'], ([type], schema) => {
      const baseChoicesSchema = Yup.array().of(
        Yup.object().shape({
          ix: Yup.number(),
          value: Yup.string().test({
            message: t('manage.formErrors.answerContent'),
            test: (content) =>
              !content?.match(/^(<br>(\n)*)$/g) && content !== '',
          }),
          correct: Yup.boolean().nullable(),
          feedback: Yup.string().when('hasAnswerFeedbacks', {
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

      switch (type) {
        case ElementType.Sc:
        case ElementType.Mc: {
          let choicesSchema = baseChoicesSchema.min(
            1,
            t('manage.formErrors.NumberQuestionsRequired')
          )

          if (type === 'SC')
            return schema.shape({
              displayMode: Yup.string().oneOf(
                Object.values(ElementDisplayMode)
              ),
              hasAnswerFeedbacks: Yup.boolean(),
              hasSampleSolution: Yup.boolean(),
              choices: choicesSchema.when('hasSampleSolution', {
                is: true,
                then: (schema) =>
                  schema.test({
                    message: t('manage.formErrors.SCAnswersCorrect'),
                    test: (choices) => {
                      return (
                        choices.filter((choice) => choice.correct).length === 1
                      )
                    },
                  }),
              }),
            })

          return schema.shape({
            displayMode: Yup.string().oneOf(Object.values(ElementDisplayMode)),
            hasAnswerFeedbacks: Yup.boolean(),
            hasSampleSolution: Yup.boolean(),
            choices: choicesSchema.when('hasSampleSolution', {
              is: true,
              then: (schema) =>
                schema.test({
                  message: t('manage.formErrors.MCAnswersCorrect'),
                  test: (choices) => {
                    return (
                      choices.filter((choice) => choice.correct).length >= 1
                    )
                  },
                }),
            }),
          })
        }

        case ElementType.Kprim: {
          const choicesSchema = baseChoicesSchema.length(
            4,
            t('manage.formErrors.NumberQuestionsRequiredKPRIM')
          )

          return schema.shape({
            hasAnswerFeedbacks: Yup.boolean(),
            hasSampleSolution: Yup.boolean(),
            choices: choicesSchema,
          })
        }

        case ElementType.Numerical: {
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
            hasSampleSolution: Yup.boolean(),

            accuracy: Yup.number()
              .nullable()
              .min(0, t('manage.formErrors.NRPrecision')),
            unit: Yup.string().nullable(),

            restrictions: Yup.object().shape({
              min: Yup.number()
                .min(-1e30, t('manage.formErrors.NRUnderflow'))
                .max(1e30, t('manage.formErrors.NROverflow'))
                .nullable(),
              // TODO: less than if max defined
              // .lessThan(Yup.ref('max')),
              max: Yup.number()
                .min(-1e30, t('manage.formErrors.NRUnderflow'))
                .max(1e30, t('manage.formErrors.NROverflow'))
                .nullable(),
              // TODO: more than if min defined
              // .moreThan(Yup.ref('min')),
            }),

            solutionRanges: baseSolutionRanges.when('hasSampleSolution', {
              is: true,
              then: (schema) =>
                schema.min(1, t('manage.formErrors.solutionRangeRequired')),
            }),
          })
        }

        case ElementType.FreeText: {
          const baseSolutions = Yup.array().of(
            Yup.string()
              .required(t('manage.formErrors.enterSolution'))
              .min(1, t('manage.formErrors.enterSolution'))
          )

          return schema.shape({
            hasSampleSolution: Yup.boolean(),

            restrictions: Yup.object().shape({
              // TODO: ensure that this check does not fail if the user enters a number and then deletes it
              maxLength: Yup.number()
                .min(1, t('manage.formErrors.FTMaxLength'))
                .nullable(),
            }),

            // TODO: ensure that this check does not fail if the user enters a feedback and then deactivates the sample solution option again
            solutions: baseSolutions.when('hasSampleSolution', {
              is: true,
              then: (schema) =>
                schema.min(1, t('manage.formErrors.solutionRequired')),
            }),
          })
        }
      }
    }),
  })
}

function QuestionEditModal({
  isOpen,
  handleSetIsOpen,
  questionId,
  mode,
}: QuestionEditModalProps): React.ReactElement {
  const t = useTranslations()

  const isDuplication = mode === QuestionEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(false)
  const [studentResponse, setStudentResponse] = useState<StudentResponseType>(
    {}
  )

  const questionManipulationSchema = useMemo(
    () => createValidationSchema(t),
    [t]
  )

  const { loading: loadingQuestion, data: dataQuestion } = useQuery(
    GetSingleQuestionDocument,
    {
      variables: { id: questionId! },
      skip: typeof questionId === 'undefined',
    }
  )

  const [manipulateContentElement] = useMutation(
    ManipulateContentElementDocument
  )
  const [manipulateFlashcardElement] = useMutation(
    ManipulateFlashcardElementDocument
  )
  const [manipulateChoicesQuestion] = useMutation(
    ManipulateChoicesQuestionDocument
  )
  const [manipulateNumericalQuestion] = useMutation(
    ManipulateNumericalQuestionDocument
  )
  const [manipulateFreeTextQuestion] = useMutation(
    ManipulateFreeTextQuestionDocument
  )
  const [updateQuestionInstances] = useMutation(UpdateQuestionInstancesDocument)

  const STATUS_OPTIONS = [
    {
      value: ElementStatus.Draft,
      label: t(`shared.${ElementStatus.Draft}.statusLabel`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Draft}.statusLabel`
        )}`,
      },
    },
    {
      value: ElementStatus.Review,
      label: t(`shared.${ElementStatus.Review}.statusLabel`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Review}.statusLabel`
        )}`,
      },
    },
    {
      value: ElementStatus.Ready,
      label: t(`shared.${ElementStatus.Ready}.statusLabel`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Ready}.statusLabel`
        )}`,
      },
    },
  ]

  const QUESTION_TYPE_OPTIONS = [
    {
      value: ElementType.Content,
      label: t(`shared.${ElementType.Content}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Content}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Flashcard,
      label: t(`shared.${ElementType.Flashcard}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Flashcard}.typeLabel`
        )}`,
      },
    },
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
      return {
        status: ElementStatus.Ready,
        type: ElementType.Sc,
        name: '',
        content: '',
        explanation: '',
        tags: [],
        pointsMultiplier: '1',
        options: {
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          displayMode: ElementDisplayMode.List,
          choices: [{ ix: 0, value: '', correct: false, feedback: '' }],
        },
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
          tags: dataQuestion.question.tags?.map((tag) => tag.name) ?? [],
          options: dataQuestion.question.questionData.options,
        }
      : {}
  }, [dataQuestion?.question, mode])

  // TODO: styling of tooltips - some are too wide
  // TODO: show errors of form validation below fields as for the login form

  if (!question || Object.keys(question).length === 0) {
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
          name: values.name,
          status: values.status,
          content: values.content,
          explanation:
            !values.explanation?.match(/^(<br>(\n)*)$/g) &&
            values.explanation !== ''
              ? values.explanation
              : null,
          tags: values.tags,
          pointsMultiplier: parseInt(values.pointsMultiplier ?? '1'),
        }

        switch (values.type) {
          case ElementType.Content: {
            const result = await manipulateContentElement({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
              },
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })
            if (!result.data?.manipulateContentElement?.id) return
            break
          }

          case ElementType.Flashcard: {
            const result = await manipulateFlashcardElement({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
              },
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })
            if (!result.data?.manipulateFlashcardElement?.id) return
            break
          }

          case ElementType.Sc:
          case ElementType.Mc:
          case ElementType.Kprim: {
            const result = await manipulateChoicesQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                type: values.type,
                options: {
                  hasSampleSolution: values.options?.hasSampleSolution,
                  hasAnswerFeedbacks: values.options?.hasAnswerFeedbacks,
                  displayMode:
                    values.options?.displayMode || ElementDisplayMode.List,
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
            const result = await manipulateNumericalQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                options: {
                  hasSampleSolution: values.options?.hasSampleSolution,
                  accuracy: parseInt(values.options?.accuracy),
                  unit: values.options?.unit,
                  restrictions: {
                    min:
                      !values.options?.restrictions ||
                      values.options?.restrictions?.min === ''
                        ? undefined
                        : parseFloat(values.options?.restrictions?.min),
                    max:
                      !values.options?.restrictions ||
                      values.options?.restrictions?.max === ''
                        ? undefined
                        : parseFloat(values.options?.restrictions?.max),
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
                  hasSampleSolution: values.options?.hasSampleSolution,
                  placeholder: values.options?.placeholder,
                  restrictions: {
                    maxLength:
                      !values.options?.restrictions?.maxLength ||
                      values.options?.restrictions?.maxLength === ''
                        ? undefined
                        : parseInt(values.options?.restrictions?.maxLength),
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
      {({ errors, isSubmitting, values, isValid, setFieldValue }) => {
        if (loadingQuestion) {
          return null
        }

        return (
          <Modal
            asPortal
            fullScreen
            title={t(`manage.questionForms.${mode}Title`)}
            className={{
              content:
                'max-w-[1400px] md:text-base text-sm h-max max-h-[calc(100vh-2rem)]',
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
                  <div className="z-0 flex flex-row justify-between">
                    <FormikSelectField
                      name="type"
                      required={mode === 'CREATE'}
                      contentPosition="popper"
                      disabled={mode === 'EDIT'}
                      label={t('manage.questionForms.questionType')}
                      placeholder={t('manage.questionForms.selectQuestionType')}
                      items={QUESTION_TYPE_OPTIONS}
                      data={{ cy: 'select-question-type' }}
                    />

                    <FormikSelectField
                      name="status"
                      contentPosition="popper"
                      label={t('manage.questionForms.questionStatus')}
                      placeholder={t(
                        'manage.questionForms.selectQuestionStatus'
                      )}
                      items={STATUS_OPTIONS}
                      data={{ cy: 'select-question-status' }}
                    />
                  </div>

                  <div className="flex flex-row mt-2">
                    <FormikTextField
                      name="name"
                      required
                      label={t('manage.questionForms.questionTitle')}
                      tooltip={t('manage.questionForms.titleTooltip')}
                      className={{
                        root: 'w-full',
                      }}
                      data={{ cy: 'insert-question-title' }}
                    />
                  </div>

                  <div className="flex flex-row gap-2 mt-2">
                    {values.type !== ElementType.Content &&
                      values.type !== ElementType.Flashcard && (
                        <div>
                          <MultiplierSelector
                            name="pointsMultiplier"
                            disabled={isSubmitting}
                          />
                        </div>
                      )}
                    <div className="flex flex-col w-full">
                      <FormLabel
                        required={false}
                        label={t('manage.questionPool.tags')}
                        labelType="small"
                        tooltip={t('manage.questionForms.tagsTooltip')}
                      />
                      <Suspense fallback={<Loader />}>
                        <SuspendedTagInput />
                      </Suspense>
                    </div>
                  </div>

                  <div className="mt-4">
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
                          <>
                            <FormLabel
                              required
                              label={t('shared.generic.question')}
                              labelType="small"
                              tooltip={t(
                                'manage.questionForms.questionTooltip'
                              )}
                            />
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
                              data={{ cy: 'insert-question-text' }}
                              className={{ content: 'max-w-none' }}
                            />
                          </>
                        )}
                      </FastField>
                    )}
                  </div>

                  {values.type !== ElementType.Content && (
                    <div className="mt-4">
                      {typeof values.explanation !== 'undefined' && (
                        <FastField
                          name="explanation"
                          questionType={values.type}
                          shouldUpdate={(next, prev) =>
                            next?.formik.values.explanation !==
                              prev?.formik.values.explanation ||
                            next?.formik.values.type !==
                              prev?.formik.values.type
                          }
                        >
                          {({ field, meta }: FastFieldProps) => (
                            <>
                              <FormLabel
                                required={values.type === ElementType.Flashcard}
                                label={t('shared.generic.explanation')}
                                labelType="small"
                                tooltip={t(
                                  'manage.questionForms.explanationTooltip'
                                )}
                              />
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
                                data={{ cy: 'insert-question-explanation' }}
                              />
                            </>
                          )}
                        </FastField>
                      )}
                    </div>
                  )}

                  <div className="flex flex-row gap-4 mt-4">
                    {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                      <div className="flex-1">
                        <FormLabel
                          required
                          label={t('manage.questionForms.answerOptions')}
                          labelType="small"
                          tooltip={t(
                            'manage.questionForms.answerOptionsTooltip'
                          )}
                          className={{ label: 'text-black' }}
                        />
                      </div>
                    )}
                    {QUESTION_GROUPS.FREE.includes(values.type) && (
                      <div className="flex-1">
                        <FormLabel
                          required
                          label={t('shared.generic.options')}
                          labelType="small"
                          tooltip={
                            values.type === ElementType.Numerical
                              ? t(
                                  'manage.questionForms.NUMERICALOptionsTooltip'
                                )
                              : t('manage.questionForms.FTOptionsTooltip')
                          }
                          className={{ label: 'mb-1 text-black' }}
                        />
                      </div>
                    )}
                    {QUESTION_GROUPS.ALL.includes(values.type) && (
                      <FormikSwitchField
                        name="options.hasSampleSolution"
                        label={t('shared.generic.sampleSolution')}
                        data={{ cy: 'configure-sample-solution' }}
                        className={{ label: 'text-gray-600' }}
                      />
                    )}
                    {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                      <FormikSwitchField
                        name="options.hasAnswerFeedbacks"
                        label={t('manage.questionPool.answerFeedbacks')}
                        disabled={!values.options?.hasSampleSolution}
                        className={{
                          root: twMerge(
                            !values.options?.hasSampleSolution && 'opacity-50'
                          ),
                          label: 'text-gray-600',
                        }}
                      />
                    )}
                    {[ElementType.Sc, ElementType.Mc].includes(values.type) && (
                      <FormikSelectField
                        name="options.displayMode"
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
                      {({ push, remove, move }: FieldArrayRenderProps) => {
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
                                    values.options?.hasSampleSolution && 'p-2',
                                    choice.correct &&
                                      values.options?.hasSampleSolution &&
                                      ' bg-green-100 border-green-300',
                                    !choice.correct &&
                                      values.options?.hasSampleSolution &&
                                      ' bg-red-100 border-red-300'
                                  )}
                                >
                                  <div className="flex flex-row w-full items-center focus:border-primary-40">
                                    {/* // TODO: define maximum height of editor if possible */}
                                    <FastField
                                      name={`options.choices.${index}.value`}
                                      questionType={values.type}
                                      shouldUpdate={(next, prev) =>
                                        next?.formik.values.options.choices[
                                          index
                                        ].value !==
                                          prev?.formik.values.options.choices[
                                            index
                                          ].value ||
                                        next.formik.values.type !==
                                          prev.formik.values.type
                                      }
                                    >
                                      {({ field, meta }: FastFieldProps) => (
                                        <ContentInput
                                          key={`${values.type}-choice-${index}-${values.options?.choices.length}-${values.options.choices[index].ix}`}
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
                                          data={{
                                            cy: `insert-answer-field-${index}`,
                                          }}
                                        />
                                      )}
                                    </FastField>
                                    {values.options?.hasSampleSolution && (
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
                                    <div className="ml-2 flex flex-col">
                                      <Button
                                        className={{ root: 'px-auto py-0.5' }}
                                        disabled={index === 0}
                                        onClick={() => move(index, index - 1)}
                                        data={{
                                          cy: `move-answer-option-ix-${index}-up`,
                                        }}
                                      >
                                        <FontAwesomeIcon
                                          icon={faArrowUp}
                                          className="h-3.5"
                                        />
                                      </Button>
                                      <Button
                                        className={{ root: 'px-auto py-0.5' }}
                                        disabled={
                                          index ===
                                          values.options?.choices.length - 1
                                        }
                                        onClick={() => move(index, index + 1)}
                                        data={{
                                          cy: `move-answer-option-ix-${index}-down`,
                                        }}
                                      >
                                        <FontAwesomeIcon
                                          icon={faArrowDown}
                                          className="h-3.5"
                                        />
                                      </Button>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        // decrement the choice.ix value of all answers after this one
                                        values.options?.choices
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
                                        root: 'items-center justify-center w-10 h-10 text-white bg-red-600 rounded-md',
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

                                  {values.options?.hasAnswerFeedbacks &&
                                    values.options?.hasSampleSolution && (
                                      <div className="">
                                        <div className="mt-2 text-sm font-bold">
                                          {t('shared.generic.feedback')}
                                        </div>
                                        <FastField
                                          name={`options.choices.${index}.feedback`}
                                          questionType={values.type}
                                          shouldUpdate={(next, prev) =>
                                            next?.formik.values.options.choices[
                                              index
                                            ].feedback !==
                                              prev?.formik.values.options
                                                .choices[index].feedback ||
                                            next?.formik.values.type !==
                                              prev?.formik.values.type
                                          }
                                        >
                                          {({
                                            field,
                                            meta,
                                          }: FastFieldProps) => (
                                            <ContentInput
                                              key={`${values.type}-feedback-${index}-${values.options.choices[index].ix}`}
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
                                    values.options?.choices.length >= 4 &&
                                    'opacity-50 cursor-not-allowed'
                                ),
                              }}
                              disabled={
                                values.type === ElementType.Kprim &&
                                values.options?.choices.length >= 4
                              }
                              onClick={() =>
                                push({
                                  ix: values.options?.choices[
                                    values.options?.choices.length - 1
                                  ]
                                    ? values.options?.choices[
                                        values.options?.choices.length - 1
                                      ].ix + 1
                                    : 0,
                                  value: '<br>',
                                  correct: false,
                                  feedback: '',
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
                          <FormikNumberField
                            name="options.restrictions.min"
                            label={t('shared.generic.min')}
                            placeholder={t('shared.generic.minLong')}
                            data={{ cy: 'set-numerical-minimum' }}
                            hideError
                          />
                          <FormikNumberField
                            name="options.restrictions.max"
                            label={t('shared.generic.max')}
                            placeholder={t('shared.generic.maxLong')}
                            data={{ cy: 'set-numerical-maximum' }}
                            hideError
                          />
                          <FormikTextField
                            name="options.unit"
                            label={t('shared.generic.unit')}
                            placeholder="CHF"
                            data={{ cy: 'set-numerical-unit' }}
                          />
                          <FormikNumberField
                            name="options.accuracy"
                            label={t('shared.generic.precision')}
                            precision={0}
                            data={{ cy: 'set-numerical-accuracy' }}
                            hideError
                          />
                        </div>
                      </div>
                      {values.options?.hasSampleSolution && (
                        <div className="mt-3">
                          <FormLabel
                            required
                            label={t('manage.questionForms.solutionRanges')}
                            labelType="small"
                            tooltip={t(
                              'manage.questionForms.solutionRangesTooltip'
                            )}
                          />
                          <FieldArray name="options.solutionRanges">
                            {({ push, remove }: FieldArrayRenderProps) => (
                              <div className="flex flex-col gap-1 w-max">
                                {values.options?.solutionRanges?.map(
                                  (_range: any, index: number) => (
                                    <div
                                      className="flex flex-row gap-2 items-end"
                                      key={`${index}-${values.options?.solutionRanges.length}`}
                                    >
                                      <FormikNumberField
                                        required={index === 0}
                                        name={`options.solutionRanges.${index}.min`}
                                        label={t('shared.generic.min')}
                                        placeholder={t(
                                          'shared.generic.minLong'
                                        )}
                                        data={{
                                          cy: `set-solution-range-min-${index}`,
                                        }}
                                      />
                                      <FormikNumberField
                                        required={index === 0}
                                        name={`options.solutionRanges.${index}.max`}
                                        label={t('shared.generic.max')}
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
                                          root: 'ml-2 text-white bg-red-500 hover:bg-red-600 h-9',
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
                        <FormikNumberField
                          name="options.restrictions.maxLength"
                          label={t('manage.questionForms.maximumLength')}
                          className={{
                            field: 'w-44',
                          }}
                          placeholder={t('manage.questionForms.answerLength')}
                          precision={0}
                          data={{ cy: 'set-free-text-length' }}
                          hideError
                        />
                      </div>
                      {values.options?.hasSampleSolution && (
                        <FieldArray name="options.solutions">
                          {({ push, remove }: FieldArrayRenderProps) => (
                            <div className="flex flex-col gap-1 w-max">
                              {values.options?.solutions?.map(
                                (_solution, index) => (
                                  <div
                                    className="flex flex-row items-end gap-2"
                                    key={`${index}-${values.options?.solutions.length}`}
                                  >
                                    <FormikTextField
                                      required
                                      name={`options.solutions.${index}`}
                                      label={t(
                                        'manage.questionForms.possibleSolutionN',
                                        { number: String(index + 1) }
                                      )}
                                      type="text"
                                      placeholder={t('shared.generic.solution')}
                                    />
                                    <Button
                                      onClick={() => remove(index)}
                                      className={{
                                        root: 'ml-2 text-white bg-red-500 hover:bg-red-600 h-9',
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
                      {errors.options && errors.options.unit && (
                        <li>{`${t('shared.generic.unit')}: ${
                          errors.options.unit
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
                      {errors.options &&
                        errors.options.restrictions?.maxLength && (
                          <li>{`${t('manage.questionForms.answerLength')}: ${
                            errors.options.restrictions.maxLength
                          }`}</li>
                        )}

                      {/* error messages specific to NR questions */}
                      {errors.options && errors.options.restrictions?.min && (
                        <li>{`${t('manage.questionForms.solutionRanges')}: ${
                          errors.options.restrictions.min
                        }`}</li>
                      )}
                      {errors.options && errors.options.restrictions?.max && (
                        <li>{`${t('manage.questionForms.solutionRanges')}: ${
                          errors.options.restrictions.max
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
                  <StudentElement
                    element={
                      {
                        id: 0,
                        type: ElementInstanceType.LiveQuiz,
                        elementType: values.type,
                        elementData: {
                          id: '0',
                          questionId: 0,
                          content: values.content,
                          explanation: values.explanation,
                          name: values.name,
                          pointsMultiplier: parseInt(
                            values.pointsMultiplier || '1'
                          ),
                          type: values.type,
                          options: {
                            displayMode: values.options?.displayMode,
                            choices: values.options?.choices,
                            accuracy: parseInt(values.options?.accuracy),
                            unit: values.options?.unit,
                            restrictions: {
                              min: parseFloat(
                                values.options?.restrictions?.min
                              ),
                              max: parseFloat(
                                values.options?.restrictions?.max
                              ),
                              maxLength: parseInt(
                                values.options?.restrictions?.maxLength
                              ),
                            },
                          },
                        },
                      } as ElementInstance
                    }
                    elementIx={0}
                    studentResponse={studentResponse}
                    setStudentResponse={setStudentResponse}
                  />
                </div>
                {values.explanation && (
                  <div className="mt-4">
                    <H3>{t('shared.generic.explanation')}</H3>
                    <Markdown
                      className={{
                        root: 'prose prose-p:!m-0 prose-img:!m-0 leading-6',
                      }}
                      content={values.explanation}
                    />
                  </div>
                )}
                {QUESTION_GROUPS.CHOICES.includes(values.type) &&
                  values.options?.hasAnswerFeedbacks && (
                    <div className="mt-4">
                      <H3>{t('shared.generic.feedbacks')}</H3>
                      {values.options?.choices?.map((choice, index) => (
                        <div
                          key={index}
                          className="pt-1 pb-1 border-b last:border-b-0"
                        >
                          {choice.feedback ? (
                            <Markdown
                              className={{
                                root: 'prose prose-p:!m-0 prose-img:!m-0 leading-6',
                              }}
                              content={choice.feedback}
                            />
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
