import { useMutation, useQuery } from '@apollo/client'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  QuestionDisplayMode,
  QuestionType,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentQuestion from '@klicker-uzh/shared-components/src/StudentQuestion'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  H3,
  Label,
  Modal,
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

  // TODO: ensure that every validation schema change is also reflected in an adaption of the error messages
  const questionManipulationSchema = Yup.object().shape({
    name: Yup.string().required(t('manage.formErrors.questionName')),
    tags: Yup.array().of(Yup.string()),
    type: Yup.string().oneOf(Object.values(QuestionType)).required(),
    displayMode: Yup.string().oneOf(Object.values(QuestionDisplayMode)),
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
        switch (type) {
          case 'SC':
          case 'MC':
          case 'KPRIM': {
            const baseChoicesSchema = Yup.array()
              .of(
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
              .min(1)

            if (type === 'KPRIM')
              return schema.shape({
                choices: baseChoicesSchema,
              })

            if (type === 'SC')
              return schema.shape({
                choices: baseChoicesSchema.test({
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
              choices: baseChoicesSchema.test({
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

          case 'NUMERICAL': {
            const baseSolutionRanges = Yup.array().of(
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

  const dropdownOptions = Object.values(QuestionType).map((type) => ({
    value: type,
    label: t(`shared.${type}.typeLabel`),
  }))

  const [newQuestionType, setNewQuestionType] = useState(QuestionType.Sc)

  const questionType = useMemo(() => {
    return mode === QuestionEditMode.CREATE
      ? newQuestionType
      : dataQuestion?.question?.type
  }, [mode, dataQuestion?.question?.type, newQuestionType])

  const question = useMemo(() => {
    if (mode === QuestionEditMode.CREATE) {
      const common = {
        type: questionType,
        displayMode: QuestionDisplayMode.List,
        name: '',
        content: '',
        explanation: '',
        tags: [],
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        pointsMultiplier: '1',
      }

      switch (questionType) {
        case QuestionType.Sc:
        case QuestionType.Mc:
        case QuestionType.Kprim:
          return {
            ...common,
            options: {
              choices: [{ ix: 0, value: '', correct: false, feedback: '' }],
            },
          }

        case QuestionType.Numerical:
          return {
            ...common,
            options: {
              accuracy: 0,
              unit: '',
              restrictions: { min: undefined, max: undefined },
              solutionRanges: [{ min: undefined, max: undefined }],
            },
          }

        case QuestionType.FreeText:
          return {
            ...common,
            options: {
              placeholder: '',
              restrictions: { maxLength: undefined },
              solutions: [],
            },
          }

        default: {
          console.error('question type not implemented', questionType)
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
            dataQuestion.question.displayMode ?? QuestionDisplayMode.List,
          tags: dataQuestion.question.tags?.map((tag) => tag.name) ?? [],
          options: dataQuestion.question.questionData.options,
        }
      : {}
  }, [dataQuestion?.question, mode, questionType])

  // TODO: styling of tooltips - some are too wide
  // TODO: show errors of form validation below fields as for the login form

  if (!question || questionType !== question?.type) {
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
          content: values.content,
          explanation:
            !values.explanation?.match(/^(<br>(\n)*)$/g) &&
            values.explanation !== ''
              ? values.explanation
              : null,
          hasSampleSolution: values.hasSampleSolution,
          hasAnswerFeedbacks: values.hasAnswerFeedbacks,
          tags: values.tags,
          displayMode: values.displayMode,
          pointsMultiplier: parseInt(values.pointsMultiplier),
        }
        switch (questionType) {
          case QuestionType.Sc:
          case QuestionType.Mc:
          case QuestionType.Kprim:
            await manipulateChoicesQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                type: questionType,
                options: {
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
            break

          case QuestionType.Numerical:
            await manipulateNUMERICALQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                options: {
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
            break

          case QuestionType.FreeText:
            await manipulateFreeTextQuestion({
              variables: {
                ...common,
                id: isDuplication ? undefined : questionId,
                options: {
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
            break

          default:
            break
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
              >
                <Button.Label>{t('shared.generic.close')}</Button.Label>
              </Button>
            }
          >
            <div className="flex flex-row gap-12">
              <div className="flex-1 max-w-5xl">
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
                    required
                  />
                  {mode === QuestionEditMode.CREATE ? (
                    <Select
                      placeholder={t('manage.questionForms.selectQuestionType')}
                      items={dropdownOptions}
                      onChange={(newValue: string) => {
                        resetForm()
                        setNewQuestionType(newValue)
                      }}
                      value={newQuestionType}
                      data={{ cy: 'select-question-type' }}
                    />
                  ) : (
                    <div className="my-auto">
                      {(question?.type as QuestionType)
                        ? t(`shared.${question?.type}.typeLabel`)
                        : ''}
                    </div>
                  )}
                </div>

                <Form className="w-full" id="question-manipulation-form">
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
                    <FastField
                      name="name"
                      type="text"
                      className="w-full bg-opacity-50 border rounded bg-uzh-grey-20 border-uzh-grey-60 h-9 focus:border-primary-40"
                      data-cy="insert-question-title"
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
                              { label: 'x1', value: '1' },
                              { label: 'x2', value: '2' },
                              { label: 'x3', value: '3' },
                              { label: 'x4', value: '4' },
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
                        questionType={questionType}
                        shouldUpdate={(next, prev) =>
                          next?.formik.values.content !==
                            prev?.formik.values.content ||
                          next?.questionType !== prev?.questionType
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
                            key={`${questionType}-content`}
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
                        questionType={questionType}
                        shouldUpdate={(next, prev) =>
                          next?.formik.values.explanation !==
                            prev?.formik.values.explanation ||
                          next?.questionType !== prev?.questionType
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
                            key={`${questionType}-explanation`}
                            data_cy="insert-question-explanation"
                          />
                        )}
                      </FastField>
                    )}
                  </div>

                  <div className="flex flex-row gap-4 mt-4">
                    {QUESTION_GROUPS.CHOICES.includes(questionType) && (
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
                    {QUESTION_GROUPS.FREE.includes(questionType) && (
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
                    {QUESTION_GROUPS.CHOICES.includes(questionType) && (
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
                    {[QuestionType.Sc, QuestionType.Mc].includes(
                      questionType
                    ) && (
                      <FormikSelectField
                        name="displayMode"
                        items={Object.values(QuestionDisplayMode).map(
                          (mode) => ({
                            value: mode,
                            label: t(`manage.questionForms.${mode}Display`),
                          })
                        )}
                      />
                    )}
                  </div>

                  {QUESTION_GROUPS.CHOICES.includes(questionType) && (
                    <FieldArray name="options.choices">
                      {({ push, remove }: FieldArrayRenderProps) => (
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
                                key={choice.ix}
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
                                    questionType={questionType}
                                    shouldUpdate={(next, prev) =>
                                      next?.formik.values[
                                        `options.choices.${index}.value`
                                      ] !==
                                        prev?.formik.values[
                                          `options.choices.${index}.value`
                                        ] ||
                                      next?.questionType !== prev?.questionType
                                    }
                                  >
                                    {({ field, meta }: FastFieldProps) => (
                                      <ContentInput
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
                                        key={`${questionType}-choice-${index}`}
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
                                            className={{ root: 'gap-0 mr-0.5' }}
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
                                    onClick={() => remove(index)}
                                    className={{
                                      root: 'items-center justify-center w-10 h-10 ml-2 text-white bg-red-600 rounded-md',
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
                                        questionType={questionType}
                                        shouldUpdate={(next, prev) =>
                                          next?.formik.values[
                                            `options.choices.${index}.feedback`
                                          ] !==
                                            prev?.formik.values[
                                              `options.choices.${index}.feedback`
                                            ] ||
                                          next?.questionType !==
                                            prev?.questionType
                                        }
                                      >
                                        {({ field, meta }: FastFieldProps) => (
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
                                            key={`${questionType}-feedback-${index}`}
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
                              root: 'font-bold border border-solid border-uzh-grey-100',
                            }}
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
                      )}
                    </FieldArray>
                  )}

                  {questionType === QuestionType.Numerical && (
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
                              input: 'bg-white text-gray-500',
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
                              input: 'bg-white text-gray-500',
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
                              input: 'bg-white text-gray-500',
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
                                      key={index}
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
                                      />
                                      <Button
                                        onClick={() => remove(index)}
                                        className={{
                                          root: 'ml-2 text-white bg-red-500 sm:hover:bg-red-600',
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

                  {questionType === QuestionType.FreeText && (
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
                                    key={index}
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
                        accuracy: values.options?.accuracy,
                        unit: values.options?.unit,
                        restrictions: {
                          min: values.options?.restrictions?.min,
                          max: values.options?.restrictions?.max,
                          maxLength: values.options?.restrictions?.maxLength,
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
                {QUESTION_GROUPS.CHOICES.includes(questionType) && (
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
          </Modal>
        )
      }}
    </Formik>
  )
}

QuestionEditModal.Mode = QuestionEditMode

export default QuestionEditModal
