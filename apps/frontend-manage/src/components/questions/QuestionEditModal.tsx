import { useMutation, useQuery } from '@apollo/client'
import {
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateFreetextQuestionDocument,
  ManipulateNumericalQuestionDocument,
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
  Label,
  Modal,
  Select,
  Switch,
  ThemeContext,
} from '@uzh-bf/design-system'
import {
  QUESTION_GROUPS,
  QUESTION_TYPES,
  TYPES_LABELS,
} from 'shared-components'
import ContentInput from './ContentInput'

const questionManipulationSchema = (questionType) =>
  Yup.object().shape({
    name: Yup.string().required('Geben Sie einen Namen für die Frage ein.'),
    tags: Yup.array().of(Yup.string()),
    content: Yup.string()
      .required('Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu')
      .test({
        message: 'Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu',
        test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
      }),
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
      .nullable(true),

    options: Yup.object().shape({
      // TODO: ensure that there is at least one / exactly one correct answer for MC and SC (KPRIM can also have all wrong answers) - approach based on .when could be promising
      choices: Yup.array()
        .of(
          Yup.object().shape({
            ix: Yup.number(),
            value: Yup.string().required(
              'Bitte geben Sie einen Wert für die Antwortmöglichkeit ein'
            ),
            correct: Yup.boolean(),
            feedback: Yup.string(),
          })
        )
        .test({
          message:
            'Fragen mit Auswahlmöglichkeiten müssen mindestens eine Antwort haben. Bei SC Fragen muss genau eine Antwort korrekt sein. Bei MC Fragen muss mindestens eine Antwort korrekt sein.',
          test: (choices) => {
            if (
              questionType === 'SC' ||
              questionType === 'MC' ||
              questionType === 'KPRIM'
            ) {
              return choices ? choices.length > 0 : false
            }
            return true
          },
        }),

      // TODO: ensure that min is smaller than max
      restrictions: Yup.object().shape({
        min: Yup.number().nullable(true),
        max: Yup.number().nullable(true),
        // TODO: ensure that this check does not fail if the user enters a number and then deletes it
        maxLength: Yup.number().min(1).nullable(true),
      }),

      // TODO: fix validation of numerical questions - solution ranges should only be required to be longer than 1 if solutions are activated (same for free text)
      // TODO: ensure that max is larger than min under consideration that both can be null
      solutionRanges: Yup.array()
        .of(
          Yup.object().shape({
            min: Yup.number().nullable(true),
            max: Yup.number().nullable(true),
          })
        )
        .test({
          message:
            'Numerische Fragen mit Lösungsbereich müssen mindestens einen gültigen Lösungsbereich haben.',
          test: (solutionRanges) => {
            if (questionType === 'NUMERICAL') {
              return solutionRanges ? solutionRanges.length > 0 : false
            }
            return true
          },
        }),

      // TODO: fix validation of freetext questions - solution ranges should only be required to be longer than 1 if solutions are activated (same for numerical)
      solutions: Yup.array()
        .of(Yup.string())
        .test({
          message:
            'Freitext Fragen mit Lösungsbereich müssen mindestens einen gültigen Lösungsbereich haben.',
          test: (solutions) => {
            if (questionType === 'FREE_TEXT') {
              return solutions ? solutions.length > 0 : false
            }
            return true
          },
        }),
    }),
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
    ManipulateFreetextQuestionDocument
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
        name: '',
        content: '<br>',
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
              choices: question?.questionData?.options?.choices
                ? [...question.questionData.options.choices]
                : [{ ix: 0, value: '<br>', correct: false, feedback: '<br>' }],
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
    <Modal
      fullScreen
      title="Frage erstellen"
      classNames={{
        overlay: 'top-14',
        content: 'm-auto max-w-7xl',
      }}
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
      escapeDisabled={true}
      hideCloseButton={true}
      onPrimaryAction={
        <Button
          className="mt-2 font-bold text-white border-uzh-grey-80 bg-uzh-blue-80 disabled:bg-uzh-grey-80"
          type="submit"
          form="question-manipulation-form"
        >
          <Button.Label>Speichern</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          className="mt-2 border-uzh-grey-80"
          onClick={() => handleSetIsOpen(false)}
        >
          <Button.Label>Close</Button.Label>
        </Button>
      }
    >
      <Formik
        // validateOnChange={false}
        isInitialValid={mode === 'EDIT'}
        enableReinitialize={true}
        initialValues={question}
        validationSchema={questionManipulationSchema(questionType)}
        onSubmit={async (values) => {
          const common = {
            id: questionId,
            name: values.name,
            content: values.content,
            contentPlain: values.content, // TODO: remove this field
            hasSampleSolution: values.hasSampleSolution,
            hasAnswerFeedbacks: values.hasAnswerFeedbacks,
            attachments: undefined, // TODO: format [ { id: 'attachmendId1' }, { id: 'attachmendId2' }]
            tags: values.tags,
          }
          switch (questionType) {
            case 'SC':
            case 'MC':
            case 'KPRIM':
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
                refetchQueries: [{ query: GetUserQuestionsDocument }],
              })
              break

            case 'NUMERICAL':
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
                refetchQueries: [{ query: GetUserQuestionsDocument }],
              })
              break

            case 'FREE_TEXT':
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
                refetchQueries: [{ query: GetUserQuestionsDocument }],
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
        }) => {
          console.log(values)
          console.log(errors)

          if (mode === 'EDIT' && loadingQuestion) {
            return <div></div>
          }

          return (
            <div>
              <div className="z-0 flex flex-row">
                <Label
                  label="Fragetyp:"
                  className="my-auto mr-2 text-lg font-bold"
                  tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                  tooltip="// TODO: tooltip content"
                  showTooltipSymbol={mode === 'CREATE'}
                />
                {mode === 'CREATE' ? (
                  <Select
                    items={dropdownOptions}
                    onChange={(newValue: string) => {
                      resetForm()
                      setNewQuestionType(newValue)
                    }}
                  />
                ) : (
                  <div className="my-auto">
                    {TYPES_LABELS[question?.type || '']}
                  </div>
                )}
              </div>

              <Form className="w-full" id="question-manipulation-form">
                <div className="flex flex-row mt-2">
                  <Label
                    label="Fragetitel:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                    tooltip="Geben Sie einen kurzen, zusammenfassenden Titel für die Frage ein. Dieser dient lediglich zur besseren Übersicht."
                    showTooltipSymbol={true}
                  />
                  <FastField
                    name="name"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                    )}
                  />
                </div>

                {/* {// TODO replace tag input by suitable component including tag suggestions} */}
                <div className="mt-2">
                  <div className="flex flex-row">
                    <Label
                      label="Tags:"
                      className="my-auto mr-2 text-lg font-bold"
                      tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                      tooltip="Fügen Sie Tags zu Ihrer Frage hinzu, um die Organisation und Wiederverwendbarkeit zu verbessern (änhlich zu bisherigen Ordnern)."
                      showTooltipSymbol={true}
                    />
                    <FastField
                      name="tags"
                      type="text"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                      )}
                      value={values.tags?.join(', ')}
                      onChange={(e: any) => {
                        setFieldValue('tags', e.target.value.split(', '), false)
                      }}
                    />
                  </div>
                  <div className="italic text-red-600">
                    Temporarily required formatting: Enter tags separated by
                    commas e.g.: Tag1, Tag2, Tag3
                  </div>
                </div>

                <div className="mt-4">
                  <Label
                    label="Frage:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                    tooltip="Geben Sie die Frage ein, die Sie den Teilnehmenden stellen möchten. Der Rich Text Editor erlaubt Ihnen folgende (Block-) Formatierungen zu nutzen: fetter Text, kursiver Text, Code, Zitate, nummerierte Listen, unnummerierte Listen und LaTeX Formeln. Fahren Sie mit der Maus über die einzelnen Knöpfe für mehr Informationen."
                    showTooltipSymbol={true}
                  />

                  {typeof values.content !== 'undefined' && (
                    <FastField name="content">
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
                        />
                      )}
                    </FastField>
                  )}
                  {values.content}
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
                        label="Antwortmöglichkeiten:"
                        className="my-auto mr-2 text-lg font-bold"
                        tooltipStyle="text-base font-normal"
                        tooltip="// TODO Tooltip Content"
                        showTooltipSymbol={true}
                      />
                    </div>
                  )}
                  {QUESTION_GROUPS.FREE.includes(questionType) && (
                    <div className="flex-1">
                      <Label
                        label="Einschränkungen:"
                        className="my-auto mr-2 text-lg font-bold"
                        tooltipStyle="text-base font-normal"
                        tooltip="// TODO Tooltip Content"
                        showTooltipSymbol={true}
                      />
                    </div>
                  )}
                  <Switch
                    id="solution switch"
                    checked={values.hasSampleSolution || false}
                    onCheckedChange={(newValue: boolean) =>
                      setFieldValue('hasSampleSolution', newValue, false)
                    }
                    label="Musterlösung"
                  />
                  {QUESTION_GROUPS.CHOICES.includes(questionType) && (
                    <Switch
                      id="feedback switch"
                      checked={values.hasAnswerFeedbacks || false}
                      onCheckedChange={(newValue: boolean) =>
                        setFieldValue('hasAnswerFeedbacks', newValue, false)
                      }
                      label="Antwort-Feedbacks"
                      disabled={!values.hasSampleSolution}
                      className={twMerge(
                        !values.hasSampleSolution && 'opacity-50'
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
                              <div
                                className={twMerge(
                                  'flex flex-row w-full focus:border-uzh-blue-50'
                                )}
                              >
                                {/* // TODO: define maximum height of editor if possible */}
                                <FastField
                                  name={`options.choices.${index}.value`}
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
                                          id={`${choice.value}-correct`}
                                          checked={field.value || false}
                                          label=""
                                          className="gap-0 mr-0.5"
                                          onCheckedChange={(
                                            newValue: boolean
                                          ) => {
                                            setFieldValue(
                                              `options.choices.${index}.correct`,
                                              newValue,
                                              false
                                            )
                                          }}
                                        />
                                      )}
                                    </FastField>
                                  </div>
                                )}

                                <Button
                                  onClick={() => remove(index)}
                                  className="items-center justify-center w-10 h-10 ml-2 text-white bg-red-600 rounded-md"
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
                                              newContent,
                                              false
                                            )
                                          }}
                                          className={{
                                            root: 'bg-white',
                                            content: twMerge(
                                              'w-full rounded border border-uzh-grey-100 focus:border-uzh-blue-50'
                                            ),
                                          }}
                                          showToolbarOnFocus={true}
                                          placeholder="Feedback eingeben…"
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
                          className="font-bold border border-solid border-uzh-grey-100"
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
                              feedback: '<br>',
                            })
                          }
                        >
                          Neue Antwort hinzufügen
                        </Button>
                      </div>
                    )}
                  </FieldArray>
                )}

                {questionType === 'NUMERICAL' && (
                  <div>
                    <div className="w-full">
                      <div className="flex flex-row items-center gap-2">
                        <div className="font-bold">Min: </div>
                        <FastField
                          name="options.restrictions.min"
                          type="number"
                          className={twMerge(
                            'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                          )}
                          placeholder="Minimum"
                        />
                        <div className="font-bold">Max: </div>
                        <FastField
                          name="options.restrictions.max"
                          type="number"
                          className={twMerge(
                            'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                          )}
                          placeholder="Maximum"
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
                                        'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                                      )}
                                      placeholder="Minimum"
                                    />
                                    <div className="font-bold">Max: </div>
                                    <FastField
                                      name={`options.solutionRanges.${index}.max`}
                                      type="number"
                                      className={twMerge(
                                        'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9'
                                      )}
                                      placeholder="Maximum"
                                    />
                                    <Button
                                      onClick={() => remove(index)}
                                      className="ml-2 text-white bg-red-500 hover:bg-red-600"
                                    >
                                      Löschen
                                    </Button>
                                  </div>
                                )
                              )}
                              <Button
                                fluid
                                className="flex-1 font-bold border border-solid border-uzh-grey-100"
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

                {/* // TODO: test this once a free text question was created as well */}
                {questionType === 'FREE_TEXT' && (
                  <div className="flex flex-col">
                    <div className="flex flex-row items-center mb-4">
                      <div className="mr-2 font-bold">Maximale Länge:</div>
                      <FastField
                        name="options.restrictions.maxLength"
                        type="number"
                        className={twMerge(
                          'w-44 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                        )}
                        value={values.options?.restrictions?.maxLength}
                        placeholder="Antwort Länge"
                        min={0}
                      />
                    </div>
                    {values.hasSampleSolution && (
                      <div className="flex flex-col gap-1 w-max">
                        {values.options?.solutions?.map(
                          (solution: string, index: number) => {
                            return (
                              <div
                                className="flex flex-row items-center gap-2"
                                key={index}
                              >
                                <div className="w-40 font-bold">
                                  Mögliche Lösung {String(index + 1)}:{' '}
                                </div>
                                <FastField
                                  name={`options.solutions[${index}]`}
                                  type="text"
                                  className={twMerge(
                                    'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                                  )}
                                  value={solution}
                                  placeholder="Lösung"
                                />
                                <Button
                                  onClick={() => {
                                    values.options.solutions.splice(index, 1)
                                    setFieldValue(
                                      'options.solutions',
                                      values.options.solutions,
                                      false
                                    )
                                  }}
                                  className="ml-2 text-white bg-red-500 hover:bg-red-600"
                                >
                                  Löschen
                                </Button>
                              </div>
                            )
                          }
                        )}
                        <Button
                          fluid
                          className="flex-1 font-bold border border-solid border-uzh-grey-100"
                          onClick={() => {
                            if (values.options.solutions) {
                              setFieldValue(
                                'values.options.solutions',
                                values.options.solutions.push(''),
                                false
                              )
                            } else {
                              setFieldValue('options.solutions', [''], false)
                            }
                          }}
                        >
                          Neue Lösung hinzufügen
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Form>
            </div>
          )
        }}
      </Formik>
    </Modal>
  )
}

export default QuestionEditModal
