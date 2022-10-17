import { useMutation, useQuery } from '@apollo/client'
import {
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateFreetextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  Question,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Field, Form, Formik } from 'formik'
import React, { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

import { Button, Label, Modal, Select, Switch } from '@uzh-bf/design-system'
import { TYPES_LABELS } from 'shared-components'
import ContentInput from './ContentInput'

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
  const {
    loading: loadingQuestion,
    error: errorQuestion,
    data: dataQuestion,
  } = useQuery(GetSingleQuestionDocument, {
    variables: { id: questionId },
    skip: questionId === undefined,
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
    if (mode === 'CREATE') {
      return newQuestionType
    }
    return dataQuestion?.question.type
  }, [mode, dataQuestion?.question.type, newQuestionType])

  const question: Question = useMemo(() => {
    if (mode === 'CREATE') {
      switch (questionType) {
        case 'SC':
        case 'MC':
        case 'KPRIM':
          return {
            type: questionType,
            name: '',
            content: '<br>',
            tags: [],
            attachments: null,
            questionData: {
              options: {
                choices: question?.questionData?.options?.choices
                  ? [...question.questionData.options.choices]
                  : [{ ix: 0, value: '', correct: false, feedback: '' }],
              },
            },
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
          }
        case 'NUMERICAL':
          return {
            type: questionType,
            name: '',
            content: '<br>',
            tags: [],
            attachments: null,
            questionData: {
              options: {
                restrictions: { min: undefined, max: undefined },
                solutionRanges: [{ min: undefined, max: undefined }],
              },
            },
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
          }
        case 'FREE_TEXT':
          return {
            type: questionType,
            name: '',
            content: '<br>',
            tags: [],
            attachments: null,
            questionData: {
              options: {
                restrictions: { maxLength: undefined },
                solutions: [''],
              },
            },
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
          }
        default: {
          return {
            type: questionType,
            name: '',
            content: '<br>',
            tags: [],
            attachments: null,
            questionData: {
              options: {
                choices: [{ ix: 0, value: '', correct: false, feedback: '' }],
                restrictions: {
                  min: undefined,
                  max: undefined,
                  maxLength: undefined,
                },
                solutionRanges: [{ min: undefined, max: undefined }],
                solutions: [''],
              },
            },
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
          }
        }
      }
    }
    return dataQuestion?.question
  }, [dataQuestion?.question, mode, questionType])

  const [initialData, setInitialData] = useState(
    question
      ? {
          type: questionType,
          name: '',
          content: '<br>',
          tags: [],
          attachments: null,

          options: {
            choices: [{ ix: 0, value: '', correct: false, feedback: '' }],
            restrictions: {
              min: undefined,
              max: undefined,
              maxLength: undefined,
            },
            solutionRanges: [{ min: undefined, max: undefined }],
            solutions: [''],
          },
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
        }
      : {}
  )

  useEffect(() => {
    if (question) {
      setInitialData({
        name: question.name,
        tags: question.tags?.map((tag: Tag) => tag.name) || [],
        content: question.content,
        attachments: question.attachments,
        options: question.questionData.options,
        hasSampleSolution: question.hasSampleSolution,
        hasAnswerFeedbacks: question.hasAnswerFeedbacks,
      })
    }
  }, [question])

  const questionManipulationSchema = Yup.object().shape({
    name: Yup.string().required('Geben Sie einen Namen für die Frage ein.'),
    tags: Yup.array().of(Yup.string()),
    content: Yup.string()
      .required('Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu')
      .test({
        message: 'Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu',
        test: (content) => !content?.match(/(<br>(\n)*)/g) && content !== '',
      }),

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
    hasSampleSolution: Yup.boolean(),
    hasAnswerFeedbacks: Yup.boolean(),
  })

  // TODO: styling of tooltips - some are too wide
  // TODO: show errors of form validation below fields as for the login form

  return (
    <Modal
      className="!pb-4"
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
      escapeDisabled={true}
      hideCloseButton={true}
      onPrimaryAction={
        <Button
          className="mt-2 border-uzh-grey-80 bg-uzh-blue-80 font-bold text-white"
          type="submit"
          form="question-manipulation-form"
          // disabled={isSubmitting}
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
              setNewQuestionType(newValue)
            }}
          />
        ) : (
          <div className="my-auto">{TYPES_LABELS[question?.type || '']}</div>
        )}
      </div>
      {question && questionType === question.type && (
        <Formik
          enableReinitialize={true}
          initialValues={initialData}
          validationSchema={questionManipulationSchema}
          onSubmit={async (values) => {
            switch (questionType) {
              case 'SC':
              case 'MC':
              case 'KPRIM':
                await manipulateChoicesQuestion({
                  variables: {
                    id: questionId,
                    type: questionType,
                    name: values.name,
                    content: values.content,
                    contentPlain: values.content, // TODO: remove this field
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
                    hasSampleSolution: values.hasSampleSolution,
                    hasAnswerFeedbacks: values.hasAnswerFeedbacks,
                    attachments: undefined, // TODO: format [ { id: 'attachmendId1' }, { id: 'attachmendId2' }]
                    tags: values.tags,
                  },
                  refetchQueries: [{ query: GetUserQuestionsDocument }],
                })
                break

              case 'NUMERICAL':
                await manipulateNUMERICALQuestion({
                  variables: {
                    id: questionId,
                    name: values.name,
                    content: values.content,
                    contentPlain: values.content, // TODO: remove this field
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
                    hasSampleSolution: values.hasSampleSolution,
                    hasAnswerFeedbacks: values.hasAnswerFeedbacks,
                    attachments: undefined, // TODO: format [ { id: 'attachmendId1' }, { id: 'attachmendId2' }]
                    tags: values.tags,
                  },
                  refetchQueries: [{ query: GetUserQuestionsDocument }],
                })
                break

              case 'FREE_TEXT':
                await manipulateFreeTextQuestion({
                  variables: {
                    id: questionId,
                    name: values.name,
                    content: values.content,
                    contentPlain: values.content, // TODO: remove this field
                    options: {
                      restrictions: {
                        maxLength: values.options?.restrictions?.maxLength,
                      },
                      solutions: values.options?.solutions,
                    },
                    hasSampleSolution: values.hasSampleSolution,
                    hasAnswerFeedbacks: values.hasAnswerFeedbacks,
                    attachments: undefined, // TODO: format [ { id: 'attachmendId1' }, { id: 'attachmendId2' }]
                    tags: values.tags,
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
            setFieldValue,
            setFieldTouched,
          }) => {
            console.log(values)
            console.log(errors)

            return (
              <Form className="w-full" id="question-manipulation-form">
                <div className="flex flex-row mt-2">
                  <Label
                    label="Fragetitel:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                    tooltip="Geben Sie einen kurzen, zusammenfassenden Titel für die Frage ein. Dieser dient lediglich zur besseren Übersicht."
                    showTooltipSymbol={true}
                  />
                  <Field
                    name="name"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                    )}
                    value={values.name}
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
                    <Field
                      name="name"
                      type="text"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                      )}
                      value={values.tags?.join(', ')}
                      onChange={(e: any) => {
                        setFieldValue('tags', e.target.value.split(', '))
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

                  {/* // TODO: wrap in formik field with "as" or "component" */}
                  {values.content && (
                    <ContentInput
                      error={errors.content}
                      touched={touched.content}
                      content={values.content}
                      onChange={(newContent: string): void => {
                        setFieldTouched('content', true, false)
                        setFieldValue('content', newContent)
                      }}
                    />
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
                  {(questionType === 'SC' ||
                    questionType === 'MC' ||
                    questionType === 'KPRIM') && (
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
                  {(questionType === 'NUMERICAL' ||
                    questionType === 'FREE_TEXT') && (
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
                      setFieldValue('hasSampleSolution', newValue)
                    }
                    label="Musterlösung"
                  />
                  {(questionType === 'SC' ||
                    questionType === 'MC' ||
                    questionType === 'KPRIM') && (
                    <Switch
                      id="feedback switch"
                      checked={values.hasAnswerFeedbacks || false}
                      onCheckedChange={(newValue: boolean) =>
                        setFieldValue('hasAnswerFeedbacks', newValue)
                      }
                      label="Antwort-Feedbacks"
                      disabled={!values.hasSampleSolution}
                      className={twMerge(
                        !values.hasSampleSolution && 'opacity-50'
                      )}
                    />
                  )}
                </div>

                {(questionType === 'SC' ||
                  questionType === 'MC' ||
                  questionType === 'KPRIM') && (
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
                          className="w-full px-2 py-1 border border-solid rounded border-uzh-grey-80"
                        >
                          <div className="flex flex-row">
                            <Field
                              name={`options.choices[${index}].value`}
                              type="text"
                              className={twMerge(
                                'w-full rounded border border-uzh-grey-60 focus:border-uzh-blue-50 h-9',
                                choice.correct &&
                                  values.hasSampleSolution &&
                                  'border-green-500 bg-green-100',
                                !choice.correct &&
                                  values.hasSampleSolution &&
                                  'border-red-500 bg-red-100',
                                !values.hasSampleSolution && 'bg-uzh-grey-20'
                              )}
                              value={choice.value}
                              placeholder="Lösungsmöglichkeit eingeben"
                            />
                            {values.hasSampleSolution && (
                              <div className="flex flex-row items-center ml-2">
                                <div className="mr-2">Korrekt?</div>
                                <Switch
                                  id={`${choice.value}-correct`}
                                  checked={choice.correct || false}
                                  label=""
                                  className="gap-0 mr-0.5"
                                  onCheckedChange={(newValue: boolean) => {
                                    setFieldValue(
                                      `options.choices[${index}].correct`,
                                      newValue
                                    )
                                  }}
                                />
                              </div>
                            )}
                            <Button
                              onClick={() => {
                                values.options.choices.splice(index, 1)
                                setFieldValue(
                                  'options.choices',
                                  values.options.choices
                                )
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white ml-2"
                            >
                              Löschen
                            </Button>
                          </div>

                          {values.hasAnswerFeedbacks &&
                            values.hasSampleSolution && (
                              <div className="flex flex-row items-center mt-1">
                                <div className="mr-2 font-bold">Feedback:</div>
                                <Field
                                  name={`options.choices[${index}].feedback`}
                                  type="text"
                                  className={twMerge(
                                    'w-full rounded  bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9'
                                  )}
                                  value={choice.feedback}
                                  placeholder="Feedback eingeben"
                                />
                              </div>
                            )}
                        </div>
                      )
                    )}
                    <Button
                      fluid
                      className="font-bold border border-solid border-uzh-grey-100"
                      onClick={() =>
                        setFieldValue(
                          'values.options.choices',
                          values.options?.choices.push({
                            ix: values.options.choices[
                              values.options.choices.length - 1
                            ]
                              ? values.options.choices[
                                  values.options.choices.length - 1
                                ].ix + 1
                              : 0,
                            value: '',
                            correct: false,
                            feedback: '',
                          })
                        )
                      }
                    >
                      Neue Antwort hinzufügen
                    </Button>
                  </div>
                )}

                {questionType === 'NUMERICAL' && (
                  <div>
                    <div className="w-full">
                      <div className="flex flex-row items-center gap-2">
                        <div className="font-bold">Min: </div>
                        <Field
                          name={`options.restrictions.min`}
                          type="number"
                          className={twMerge(
                            'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                          )}
                          value={values.options?.restrictions?.min}
                          placeholder="Minimum"
                        />
                        <div className="font-bold">Max: </div>
                        <Field
                          name={`options.restrictions.max`}
                          type="number"
                          className={twMerge(
                            'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                          )}
                          value={values.options?.restrictions?.max}
                          placeholder="Maximum"
                        />
                      </div>
                    </div>
                    {values.hasSampleSolution && (
                      <div className="mt-3">
                        <div className="mb-1 mr-2 font-bold">
                          Lösungsbereiche:
                        </div>
                        <div className="flex flex-col gap-1 w-max">
                          {values.options.solutionRanges?.map(
                            (
                              range: { min?: number; max?: number },
                              index: number
                            ) => {
                              return (
                                <div
                                  className="flex flex-row items-center gap-2"
                                  key={index}
                                >
                                  <div className="font-bold">Min: </div>
                                  <Field
                                    name={`options.solutionRanges[${index}].min`}
                                    type="number"
                                    className={twMerge(
                                      'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9 mr-2'
                                    )}
                                    value={range.min}
                                    placeholder="Minimum"
                                  />
                                  <div className="font-bold">Max: </div>
                                  <Field
                                    name={`options.solutionRanges[${index}].max`}
                                    type="number"
                                    className={twMerge(
                                      'w-40 rounded bg-opacity-50 border border-uzh-grey-100 focus:border-uzh-blue-50 h-9'
                                    )}
                                    value={range.max}
                                    placeholder="Maximum"
                                  />
                                  <Button
                                    onClick={() => {
                                      values.options.solutionRanges.splice(
                                        index,
                                        1
                                      )
                                      setFieldValue(
                                        'options.solutionRanges',
                                        values.options.solutionRanges
                                      )
                                    }}
                                    className="bg-red-500 hover:bg-red-600 text-white ml-2"
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
                              if (values.options.solutionRanges) {
                                setFieldValue(
                                  'values.options.solutionRanges',
                                  values.options.solutionRanges.push({
                                    min: undefined,
                                    max: undefined,
                                  })
                                )
                              } else {
                                setFieldValue('options.solutionRanges', [
                                  {
                                    min: undefined,
                                    max: undefined,
                                  },
                                ])
                              }
                            }}
                          >
                            Neuen Lösungsbereich hinzufügen
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* // TODO: test this once a free text question was created as well */}
                {questionType === 'FREE_TEXT' && (
                  <div className="flex flex-col">
                    <div className="flex flex-row items-center mb-4">
                      <div className="mr-2 font-bold">Maximale Länge:</div>
                      <Field
                        name={`options.restrictions.maxLength`}
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
                        {values.options.solutions?.map(
                          (solution: string, index: number) => {
                            return (
                              <div
                                className="flex flex-row items-center gap-2"
                                key={index}
                              >
                                <div className="font-bold w-40">
                                  Mögliche Lösung {String(index + 1)}:{' '}
                                </div>
                                <Field
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
                                      values.options.solutions
                                    )
                                  }}
                                  className="bg-red-500 hover:bg-red-600 text-white ml-2"
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
                                'values.options.solutionRanges',
                                values.options.solutions.push('')
                              )
                            } else {
                              setFieldValue('options.solutions', [''])
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
            )
          }}
        </Formik>
      )}
    </Modal>
  )
}

export default QuestionEditModal
