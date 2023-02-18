import { useMutation, useQuery } from '@apollo/client'
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
import {
  FastField,
  FastFieldProps,
  FieldArray,
  FieldArrayRenderProps,
  FieldProps,
  Form,
  Formik,
} from 'formik'
import React, { useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  FormikSelectField,
  H3,
  Label,
  Modal,
  Select,
  Switch,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import {
  QUESTION_GROUPS,
  QUESTION_TYPES,
  TYPES_LABELS,
} from 'shared-components/src/constants'
import ContentInput from 'shared-components/src/ContentInput'
import StudentQuestion from 'shared-components/src/StudentQuestion'

const questionManipulationSchema = Yup.object().shape({
  name: Yup.string().required('Geben Sie einen Namen für die Frage ein.'),
  tags: Yup.array().of(Yup.string()),
  type: Yup.string()
    .oneOf(['SC', 'MC', 'KPRIM', 'NUMERICAL', 'KPRIM', 'FREE_TEXT'])
    .required(),
  displayMode: Yup.string().oneOf(['LIST', 'GRID']),
  content: Yup.string()
    .required('Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu')
    .test({
      message: 'Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu',
      test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
    }),
  explanation: Yup.string(),
  hasSampleSolution: Yup.boolean(),
  hasAnswerFeedbacks: Yup.boolean(),

  // TODO: adapt validation structure for attachments once they are available
  attachments: Yup.array()
    .of(
      Yup.object().shape({
        href: Yup.string().required(
          'Bitte geben Sie eine URL für den Anhang ein'
        ),
        name: Yup.string().required(
          'Bitte geben Sie einen Namen für den Anhang ein'
        ),
        originalName: Yup.string(),
        description: Yup.string(),
      })
    )
    .nullable(),

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
                  message:
                    'Bitte fügen Sie einen Inhalt zu Ihrer Antwortoption hinzu',
                  test: (content) =>
                    !content?.match(/^(<br>(\n)*)$/g) && content !== '',
                }),
                correct: Yup.boolean().nullable(),
                feedback: hasAnswerFeedbacks
                  ? Yup.string().test({
                      message:
                        'Bitte fügen Sie einen Inhalt zu Ihrem Antwortfeedback hinzu',
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
                message: 'Bei SC-Fragen muss genau eine Antwort korrekt sein.',
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
              message:
                'Bei MC-Fragen muss mindestens eine Antwort korrekt sein.',
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
            restrictions: Yup.object().shape({
              min: Yup.number().nullable(),
              // TODO: less than if max defined
              // .lessThan(Yup.ref('max')),
              max: Yup.number().nullable(),
              // TODO: more than if min defined
              // .moreThan(Yup.ref('min')),
            }),

            solutionRanges: hasSampleSolution
              ? baseSolutionRanges.min(1)
              : baseSolutionRanges,
          })
        }

        case 'FREE_TEXT': {
          const baseSolutions = Yup.array().of(Yup.string().required().min(1))

          return schema.shape({
            restrictions: Yup.object().shape({
              // TODO: ensure that this check does not fail if the user enters a number and then deletes it
              maxLength: Yup.number().min(1).nullable(),
            }),

            solutions: hasSampleSolution ? baseSolutions.min(1) : baseSolutions,
          })
        }
      }
    }
  ),
})

interface QuestionEditModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  questionId?: number
  mode: 'EDIT' | 'CREATE'
}

function QuestionEditModal({
  isOpen,
  handleSetIsOpen,
  questionId,
  mode,
}: QuestionEditModalProps): React.ReactElement {
  const theme = useContext(ThemeContext)

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

  const dropdownOptions = useMemo(() => {
    return Object.keys(TYPES_LABELS).map((key) => ({
      value: key,
      label: TYPES_LABELS[key],
    }))
  }, [])

  const [newQuestionType, setNewQuestionType] = useState(
    Object.keys(TYPES_LABELS)[0]
  )

  const questionType = useMemo(() => {
    return mode === 'CREATE' ? newQuestionType : dataQuestion?.question?.type
  }, [mode, dataQuestion?.question?.type, newQuestionType])

  const question = useMemo(() => {
    if (mode === 'CREATE') {
      const common = {
        type: questionType,
        displayMode: QuestionDisplayMode.List,
        name: '',
        content: '<br>',
        explanation: '<br>',
        tags: [],
        attachments: null,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
      }

      switch (questionType) {
        case QUESTION_TYPES.SC:
        case QUESTION_TYPES.MC:
        case QUESTION_TYPES.KPRIM:
          return {
            ...common,
            options: {
              choices: [
                { ix: 0, value: '<br>', correct: false, feedback: '<br>' },
              ],
            },
          }

        case QUESTION_TYPES.NUMERICAL:
          return {
            ...common,
            options: {
              restrictions: { min: undefined, max: undefined },
              solutionRanges: [{ min: undefined, max: undefined }],
            },
          }

        case QUESTION_TYPES.FREE_TEXT:
          return {
            ...common,
            options: {
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
          displayMode:
            dataQuestion.question.displayMode ?? QuestionDisplayMode.List,
          tags: dataQuestion.question.tags?.map((tag) => tag.name) ?? [],
          options: dataQuestion.question.questionData.options,
        }
      : {}
  }, [dataQuestion?.question, mode, questionType])

  // TODO: styling of tooltips - some are too wide
  // TODO: show errors of form validation below fields as for the login form

  if (!question && questionType !== question?.type) {
    return <div></div>
  }

  return (
    <Formik
      // validateOnChange={false}
      isInitialValid={mode === 'EDIT'}
      enableReinitialize={true}
      initialValues={question}
      validationSchema={questionManipulationSchema}
      onSubmit={async (values) => {
        const common = {
          id: questionId,
          name: values.name,
          content: values.content,
          explanation: values.explanation,
          hasSampleSolution: values.hasSampleSolution,
          hasAnswerFeedbacks: values.hasAnswerFeedbacks,
          attachments: undefined, // TODO: format [ { id: 'attachmendId1' }, { id: 'attachmendId2' }]
          tags: values.tags,
          displayMode: values.displayMode,
        }
        switch (questionType) {
          case QuestionType.Sc:
          case QuestionType.Mc:
          case QuestionType.Kprim:
            await manipulateChoicesQuestion({
              variables: {
                ...common,
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
                options: {
                  restrictions: {
                    min:
                      !values.options?.restrictions ||
                      values.options?.restrictions?.min === ''
                        ? undefined
                        : values.options.restrictions?.min,
                    max:
                      !values.options?.restrictions ||
                      values.options?.restrictions?.max === ''
                        ? undefined
                        : values.options.restrictions?.max,
                  },
                  solutionRanges: values.options?.solutionRanges?.map(
                    (range: any) => {
                      return {
                        min: range.min === '' ? undefined : range.min,
                        max: range.max === '' ? undefined : range.max,
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
                options: {
                  restrictions: {
                    maxLength: values.options?.restrictions?.maxLength,
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
        if (mode === 'EDIT' && loadingQuestion) {
          return <div></div>
        }

        return (
          <Modal
            asPortal
            fullScreen
            title={mode === 'CREATE' ? 'Frage erstellen' : 'Frage bearbeiten'}
            className={{
              content: 'max-w-[1400px]',
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
                    'mt-2 font-bold text-white border-uzh-grey-80 disabled:bg-uzh-grey-80',
                    theme.primaryBgDark
                  ),
                }}
                type="submit"
                form="question-manipulation-form"
                data={{ cy: 'save-new-question' }}
              >
                <Button.Label>Speichern</Button.Label>
              </Button>
            }
            onSecondaryAction={
              <Button
                className={{ root: 'mt-2 border-uzh-grey-80' }}
                onClick={() => handleSetIsOpen(false)}
              >
                <Button.Label>Schliessen</Button.Label>
              </Button>
            }
          >
            <div className="flex flex-row gap-12">
              <div className="flex-1 max-w-5xl">
                <div className="z-0 flex flex-row">
                  <Label
                    label="Fragetyp"
                    className={{
                      root: 'mr-2 text-lg font-bold w-32',
                      tooltip:
                        'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                    }}
                    // tooltip="// TODO: tooltip content"
                    // showTooltipSymbol={mode === 'CREATE'}
                    required
                  />
                  {mode === 'CREATE' ? (
                    <Select
                      placeholder="Fragetyp auswählen"
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
                      {TYPES_LABELS[question?.type || '']}{' '}
                    </div>
                  )}
                </div>

                <Form className="w-full" id="question-manipulation-form">
                  <div className="flex flex-row mt-2">
                    <Label
                      label="Fragetitel"
                      className={{
                        root: 'mr-2 text-lg font-bold w-36',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip="Geben Sie einen kurzen, zusammenfassenden Titel für die Frage ein. Dieser dient lediglich zur besseren Übersicht."
                      showTooltipSymbol
                      required
                    />
                    <FastField
                      name="name"
                      type="text"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 h-9',
                        theme.primaryBorderFocus
                      )}
                      data-cy="insert-question-title"
                    />
                  </div>

                  {/* {// TODO replace tag input by suitable component including tag suggestions} */}
                  <div className="mt-2">
                    <div className="flex flex-row">
                      <Label
                        label="Tags"
                        className={{
                          root: 'my-auto mr-2 text-lg font-bold w-36',
                          tooltip:
                            'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                        }}
                        tooltip="Fügen Sie Tags zu Ihrer Frage hinzu, um die Organisation und Wiederverwendbarkeit zu verbessern (änhlich zu bisherigen Ordnern)."
                        showTooltipSymbol={true}
                      />
                      <FastField
                        name="tags"
                        type="text"
                        className={twMerge(
                          'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 h-9',
                          theme.primaryBorderFocus
                        )}
                        value={values.tags?.join(', ')}
                        onChange={(e: any) => {
                          setFieldValue('tags', e.target.value.split(', '))
                        }}
                      />
                    </div>
                    <div className="italic text-red-600">
                      Temporarily required formatting: Enter tags separated by
                      commas e.g.: Tag1,Tag2,Tag3
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label
                      label="Frage"
                      className={{
                        root: 'my-auto mr-2 text-lg font-bold',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip="Geben Sie die Frage ein, die Sie den Teilnehmenden stellen möchten. Der Rich Text Editor erlaubt Ihnen folgende (Block-) Formatierungen zu nutzen: fetter Text, kursiver Text, Code, Zitate, nummerierte Listen, unnummerierte Listen und LaTeX Formeln. Fahren Sie mit der Maus über die einzelnen Knöpfe für mehr Informationen."
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
                            placeholder="Fragetext hier eingeben…"
                            key={`${questionType}-content`}
                            data_cy="insert-question-text"
                          />
                        )}
                      </FastField>
                    )}
                  </div>

                  <div className="mt-4">
                    <Label
                      label="Erklärung"
                      className={{
                        root: 'my-auto mr-2 text-lg font-bold',
                        tooltip:
                          'font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]',
                      }}
                      tooltip="Geben Sie hier eine generische Erklärung zu Ihrer Frage ein, welche den Studierenden unabhängig von Ihrer Antwort in Lernelementen und Micro-Sessions angezeigt wird."
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
                            placeholder="Erklärung hier eingeben…"
                            key={`${questionType}-explanation`}
                            data_cy="insert-question-explanation"
                          />
                        )}
                      </FastField>
                    )}
                  </div>

                  {/* // TODO: to be released
                <div className="mb-4">
                  <Label
                    label="Anhänge:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal"
                    tooltip="// TODO Tooltip Content"
                    showTooltipSymbol={true}
                  />
                </div> */}

                  <div className="flex flex-row gap-4 mt-4">
                    {QUESTION_GROUPS.CHOICES.includes(questionType) && (
                      <div className="flex-1">
                        <Label
                          label="Antwortmöglichkeiten"
                          className={{
                            root: 'my-auto mr-2 text-lg font-bold',
                            tooltip: 'text-base font-normal',
                          }}
                          tooltip="// TODO Tooltip Content"
                          showTooltipSymbol
                          required
                        />
                      </div>
                    )}
                    {QUESTION_GROUPS.FREE.includes(questionType) && (
                      <div className="flex-1">
                        <Label
                          label="Einschränkungen"
                          className={{
                            root: 'my-auto mr-2 text-lg font-bold',
                            tooltip: 'text-base font-normal',
                          }}
                          tooltip="// TODO Tooltip Content"
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
                      label="Musterlösung"
                    />
                    {QUESTION_GROUPS.CHOICES.includes(questionType) && (
                      <Switch
                        checked={values.hasAnswerFeedbacks || false}
                        onCheckedChange={(newValue: boolean) => {
                          setFieldValue('hasAnswerFeedbacks', newValue)
                          validateForm()
                        }}
                        label="Antwort-Feedbacks"
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
                        items={[
                          {
                            value: QuestionDisplayMode.List,
                            label: 'Anzeige als Liste',
                          },
                          {
                            value: QuestionDisplayMode.Grid,
                            label: 'Anzeige als Grid',
                          },
                        ]}
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
                                <div
                                  className={twMerge(
                                    'flex flex-row w-full',
                                    theme.primaryBorderFocus
                                  )}
                                >
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
                                        placeholder="Antwortmöglichkeit eingeben…"
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
                                      <div className="mr-2">Korrekt?</div>
                                      <FastField
                                        name={`options.choices.${index}.correct`}
                                      >
                                        {({ field, meta }: FieldProps) => (
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
                                        className={twMerge(
                                          `hover:${theme.primaryBg}`
                                        )}
                                      />
                                    </Button.Icon>
                                  </Button>
                                </div>

                                {values.hasAnswerFeedbacks &&
                                  values.hasSampleSolution && (
                                    <div className="">
                                      <div className="mt-2 text-sm font-bold">
                                        Feedback
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
                                              content: twMerge(
                                                'w-full rounded border border-uzh-grey-100',
                                                theme.primaryBorderFocus
                                              ),
                                            }}
                                            showToolbarOnFocus={true}
                                            placeholder="Feedback eingeben…"
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
                            Neue Antwort hinzufügen
                          </Button>
                        </div>
                      )}
                    </FieldArray>
                  )}

                  {questionType === QuestionType.Numerical && (
                    <div>
                      <div className="w-full">
                        <div className="flex flex-row items-center gap-2">
                          <div className="font-bold">Min: </div>
                          <FastField
                            name="options.restrictions.min"
                            type="number"
                            className={twMerge(
                              'w-40 rounded bg-opacity-50 border border-uzh-grey-100 h-9 mr-2',
                              theme.primaryBorderFocus
                            )}
                            placeholder="Minimum"
                            data-cy="set-numerical-minimum"
                          />
                          <div className="font-bold">Max: </div>
                          <FastField
                            name="options.restrictions.max"
                            type="number"
                            className={twMerge(
                              'w-40 rounded bg-opacity-50 border border-uzh-grey-100 h-9 mr-2',
                              theme.primaryBorderFocus
                            )}
                            placeholder="Maximum"
                            data-cy="set-numerical-maximum"
                          />
                        </div>
                      </div>
                      {values.hasSampleSolution && (
                        <div className="mt-3">
                          <div className="mb-1 mr-2 font-bold">
                            Lösungsbereiche:
                          </div>
                          <FieldArray name="options.solutionRanges">
                            {({ push, remove }: FieldArrayRenderProps) => (
                              <div className="flex flex-col gap-1 w-max">
                                {values.options.solutionRanges?.map(
                                  (_range: any, index: number) => (
                                    <div
                                      className="flex flex-row items-center gap-2"
                                      key={index}
                                    >
                                      <div className="font-bold">Min: </div>
                                      <FastField
                                        name={`options.solutionRanges.${index}.min`}
                                        type="number"
                                        className={twMerge(
                                          'w-40 rounded bg-opacity-50 border border-uzh-grey-100 h-9 mr-2',
                                          theme.primaryBorderFocus
                                        )}
                                        placeholder="Minimum"
                                      />
                                      <div className="font-bold">Max: </div>
                                      <FastField
                                        name={`options.solutionRanges.${index}.max`}
                                        type="number"
                                        className={twMerge(
                                          'w-40 rounded bg-opacity-50 border border-uzh-grey-100 h-9',
                                          theme.primaryBorderFocus
                                        )}
                                        placeholder="Maximum"
                                      />
                                      <Button
                                        onClick={() => remove(index)}
                                        className={{
                                          root: 'ml-2 text-white bg-red-500 hover:bg-red-600',
                                        }}
                                      >
                                        Löschen
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
                                  Neuen Lösungsbereich hinzufügen
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
                        <div className="mr-2 font-bold">Maximale Länge:</div>
                        <FastField
                          name="options.restrictions.maxLength"
                          type="number"
                          className={twMerge(
                            'w-44 rounded bg-opacity-50 border border-uzh-grey-100 h-9 mr-2',
                            theme.primaryBorderFocus
                          )}
                          placeholder="Antwort Länge"
                          min={0}
                          data-cy="set-free-text-length"
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
                                      Mögliche Lösung {String(index + 1)}:{' '}
                                    </div>
                                    <FastField
                                      name={`options.solutions.${index}`}
                                      type="text"
                                      className={twMerge(
                                        'w-40 rounded bg-opacity-50 border border-uzh-grey-100 h-9 mr-2',
                                        theme.primaryBorderFocus
                                      )}
                                      placeholder="Lösung"
                                    />
                                    <Button
                                      onClick={() => remove(index)}
                                      className={{
                                        root: 'ml-2 text-white bg-red-500 hover:bg-red-600',
                                      }}
                                    >
                                      Löschen
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
                                Neue Lösung hinzufügen
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
                    notificationType="error"
                    message={JSON.stringify(errors)}
                  />
                )}
              </div>
              <div className="flex-1 max-w-sm">
                <H3>Vorschau</H3>
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
                        restrictions: {
                          min: values.options?.restrictions?.min,
                          max: values.options?.restrictions?.max,
                          maxLength: values.options?.restrictions?.maxLength,
                        },
                      },
                    }}
                    // inputValue={inputValue}
                    // inputValid={inputValid}
                    // inputEmpty={inputEmpty}
                    setInputState={() => null}
                  />
                </div>
              </div>
            </div>
          </Modal>
        )
      }}
    </Formik>
  )
}

export default QuestionEditModal
