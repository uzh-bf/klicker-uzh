import { useMutation, useQuery } from '@apollo/client'
import {
  GetSingleQuestionDocument,
  GetUserQuestionDocument,
  ManipulateFreetextQuestionDocument,
  ManipulateKprimQuestionDocument,
  ManipulateMcQuestionDocument,
  ManipulateNumericalQuestionDocument,
  ManipulateScQuestionDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Field, Form, Formik } from 'formik'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button, Label, Modal, Switch } from '@uzh-bf/design-system'
import { TYPES_LABELS } from 'shared-components'
import ContentInput from './ContentInput'

interface QuestionEditModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  questionId: number
}

function QuestionEditModal({
  isOpen,
  handleSetIsOpen,
  questionId,
}: QuestionEditModalProps): React.ReactElement {
  const {
    loading: loadingQuestion,
    error: errorQuestion,
    data: dataQuestion,
  } = useQuery(GetSingleQuestionDocument, {
    variables: { id: questionId },
  })

  const [manipulateSCQuestion] = useMutation(ManipulateScQuestionDocument)
  const [manipulateMCQuestion] = useMutation(ManipulateMcQuestionDocument)
  const [manipulateKPRIMQuestion] = useMutation(ManipulateKprimQuestionDocument)
  const [manipulateNUMERICALQuestion] = useMutation(
    ManipulateNumericalQuestionDocument
  )
  const [manipulateFreeTextQuestion] = useMutation(
    ManipulateFreetextQuestionDocument
  )

  const question = useMemo(
    () => dataQuestion?.question,
    [dataQuestion?.question]
  )

  // TODO: styling of tooltips - some are too wide
  // TODO: FORM VALIDATION!!
  // TODO: ensure that the tag name is unique for every user - different users should be allows to have tags with the same name though

  return (
    <Modal
      className="!pb-4"
      open={isOpen}
      onClose={() => handleSetIsOpen(false)}
    >
      <div className="z-0 flex flex-row">
        <Label label="Fragetyp:" className="my-auto mr-2 text-lg font-bold" />
        <div className="my-auto">{TYPES_LABELS[question?.type || '']}</div>
      </div>
      {question && (
        <Formik
          initialValues={{
            title: question.name,
            tags: question?.tags?.map((tag: Tag) => tag.name) || [],
            // TODO: change to simply question.content once all questions have some content again
            content:
              question.content.length !== 0
                ? question.content
                : 'WARNING: Content missing!',
            attachments: question.attachments,
            options: question.questionData.options,
            hasSampleSolution: question.hasSampleSolution,
            hasAnswerFeedbacks: question.hasAnswerFeedbacks,
          }}
          // TODO: validationSchema={loginSchema}
          // TODO: pass correct values to this function instead of demo values
          onSubmit={async (values) => {
            console.log(values)

            // TODO: remove once all questions have some content again
            if (values.content === 'WARNING: Content missing!') {
              values.content = ''
            }

            switch (question.type) {
              case 'SC':
                // TODO
                await manipulateSCQuestion({
                  variables: {
                    id: questionId,
                    name: 'testName',
                    content: 'testContent',
                    contentPlain: 'testContentPlain',
                    options: {
                      choices: [
                        {
                          ix: 20,
                          value: 'testValueChoice',
                          correct: false,
                          feedback: 'This is a test feedback.',
                        },
                        {
                          ix: 21,
                          value: 'testValueChoice2',
                          correct: false,
                          feedback: 'This is a second test feedback.',
                        },
                      ],
                    },
                    hasSampleSolution: true,
                    hasAnswerFeedbacks: true,
                    attachments: [
                      { id: 'attachmendId1' },
                      { id: 'attachmendId2' },
                    ],
                    tags: [{ name: 'Tag1' }, { name: 'Tag2' }],
                  },
                  refetchQueries: [{ query: GetUserQuestionDocument }],
                })
                break

              // TODO
              case 'MC':
                await manipulateMCQuestion({
                  variables: {
                    id: questionId,
                    name: 'testName',
                    content: 'testContent',
                    contentPlain: 'testContentPlain',
                    options: {
                      choices: [
                        {
                          ix: 20,
                          value: 'testValueChoice',
                          correct: false,
                          feedback: 'This is a test feedback.',
                        },
                        {
                          ix: 21,
                          value: 'testValueChoice2',
                          correct: false,
                          feedback: 'This is a second test feedback.',
                        },
                      ],
                    },
                    hasSampleSolution: true,
                    hasAnswerFeedbacks: true,
                    attachments: [
                      { id: 'attachmendId1' },
                      { id: 'attachmendId2' },
                    ],
                    tags: [{ name: 'Tag1' }, { name: 'Tag2' }],
                  },
                  refetchQueries: [{ query: GetUserQuestionDocument }],
                })
                break

              // TODO: in progress
              case 'KPRIM':
                await manipulateKPRIMQuestion({
                  variables: {
                    id: questionId,
                    name: values.title,
                    content: values.title,
                    contentPlain: '// TODO',
                    options: {
                      choices: values.options.choices.map((choice: any) => {
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
                    attachments: [
                      { id: 'attachmendId1' },
                      { id: 'attachmendId2' },
                    ],
                    tags: values.tags.map((tag: string) => ({ name: tag })),
                  },
                  refetchQueries: [{ query: GetUserQuestionDocument }],
                })
                break

              // TODO
              case 'NUMERICAL':
                await manipulateNUMERICALQuestion({
                  variables: {
                    id: questionId,
                    name: 'testName',
                    content: 'testContent',
                    contentPlain: 'testContentPlain',
                    options: {
                      restrictions: { min: 0, max: 100 },
                      solutionRanges: [
                        { min: 0, max: 1 },
                        { min: 80, max: 100 },
                      ],
                    },
                    hasSampleSolution: true,
                    hasAnswerFeedbacks: true,
                    attachments: [
                      { id: 'attachmendId1' },
                      { id: 'attachmendId2' },
                    ],
                    tags: [{ name: 'Tag1' }, { name: 'Tag2' }],
                  },
                  refetchQueries: [{ query: GetUserQuestionDocument }],
                })
                break

              // TODO
              case 'FREE_TEXT':
                await manipulateFreeTextQuestion({
                  variables: {
                    id: questionId,
                    name: 'testName',
                    content: 'testContent',
                    contentPlain: 'testContentPlain',
                    options: {
                      restrictions: { maxLength: 200 },
                      solutions: [
                        'This is a text solution 1.',
                        'This is a text solution 2.',
                      ],
                    },
                    hasSampleSolution: true,
                    hasAnswerFeedbacks: true,
                    attachments: [
                      { id: 'attachmendId1' },
                      { id: 'attachmendId2' },
                    ],
                    tags: [{ name: 'Tag1' }, { name: 'Tag2' }],
                  },
                  refetchQueries: [{ query: GetUserQuestionDocument }],
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
            return (
              <Form className="w-full">
                <div className="flex flex-row">
                  <Label
                    label="Fragetitel:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                    tooltip="Geben Sie einen kurzen, zusammenfassenden Titel für die Frage ein. Dieser dient lediglich zur besseren Übersicht."
                    showTooltipSymbol={true}
                  />
                  <Field
                    name="title"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                    )}
                    value={values.title}
                  />
                </div>

                {/* {// TODO replace tag input by suitable component including tag suggestions} */}
                <div>
                  Temporary: Enter tags separated by commas e.g.: Tag1, Tag2,
                  Tag3
                </div>
                <div className="flex flex-row">
                  <Label
                    label="Tags:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                    tooltip="Fügen Sie Tags zu Ihrer Frage hinzu, um die Organisation und Wiederverwendbarkeit zu verbessern (änhlich zu bisherigen Ordnern)."
                    showTooltipSymbol={true}
                  />
                  <Field
                    name="title"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                    )}
                    value={values.tags.join(', ')}
                    onChange={(e: any) => {
                      setFieldValue('tags', e.target.value.split(', '))
                    }}
                  />
                </div>

                <div className="">
                  <Label
                    label="Frage:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal text-sm md:text-base max-w-[45%] md:max-w-[70%]"
                    tooltip="Geben Sie die Frage ein, die Sie den Teilnehmenden stellen möchten. Der Rich Text Editor erlaubt Ihnen folgende (Block-) Formatierungen zu nutzen: fetter Text, kursiver Text, Code, Zitate, nummerierte Listen, unnummerierte Listen und LaTeX Formeln. Fahren Sie mit der Maus über die einzelnen Knöpfe für mehr Informationen."
                    showTooltipSymbol={true}
                  />

                  {/* // TODO: wrap in formik field with "as" or "componetn" */}
                  <ContentInput
                    error={errors.content}
                    touched={touched.content}
                    content={values.content}
                    onChange={(newContent: string): void => {
                      setFieldTouched('content', true, false)
                      setFieldValue('content', newContent)
                    }}
                  />
                  {console.log(values.content)}
                  {values.content}
                </div>

                <div className="">
                  <Label
                    label="Anhänge:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal"
                    tooltip="// TODO Tooltip Content"
                    showTooltipSymbol={true}
                  />
                  <div>// TODO: to be released</div>
                </div>

                {(question.type === 'SC' ||
                  question.type === 'MC' ||
                  question.type === 'KPRIM') && (
                  <div className="">
                    <Label
                      label="Restrictions:"
                      className="my-auto mr-2 text-lg font-bold"
                      tooltipStyle="text-base font-normal"
                      tooltip="// TODO Tooltip Content"
                      showTooltipSymbol={true}
                    />
                  </div>
                )}
                {(question.type === 'NUMERICAL' ||
                  question.type === 'FREE_TEXT') && (
                  <div className="">
                    <Label
                      label="Restrictions:"
                      className="my-auto mr-2 text-lg font-bold"
                      tooltipStyle="text-base font-normal"
                      tooltip="// TODO Tooltip Content"
                      showTooltipSymbol={true}
                    />
                  </div>
                )}

                <div className="flex flex-row gap-4">
                  <Switch
                    id="solution switch"
                    checked={values.hasSampleSolution}
                    onCheckedChange={(newValue: boolean) =>
                      setFieldValue('hasSampleSolution', newValue)
                    }
                    label="Sample Solution"
                  />
                  {(question.type === 'SC' ||
                    question.type === 'MC' ||
                    question.type === 'KPRIM') &&
                    values.hasSampleSolution && (
                      <Switch
                        id="feedback switch"
                        checked={values.hasAnswerFeedbacks}
                        onCheckedChange={(newValue: boolean) =>
                          setFieldValue('hasAnswerFeedbacks', newValue)
                        }
                        label="Choices Feedbacks"
                      />
                    )}
                </div>

                {(question.type === 'SC' ||
                  question.type === 'MC' ||
                  question.type === 'KPRIM') && (
                  <div className="flex flex-col w-full gap-1.5 pt-2">
                    {values.options.choices?.map(
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
                          className="w-full p-1 border border-solid rounded border-uzh-grey-80"
                        >
                          <div className="flex flex-row">
                            Choice correct:{' '}
                            <Switch
                              id={`${choice.value}-correct`}
                              checked={choice.correct || false}
                              label=""
                              onCheckedChange={(newValue: boolean) => {
                                setFieldValue(
                                  `options.choices[${index}].correct`,
                                  newValue
                                )
                              }}
                            />
                            {String(choice.correct)}
                          </div>
                          <Field
                            name={`options.choices[${index}].value`}
                            type="text"
                            className={twMerge(
                              'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                            )}
                            value={choice.value}
                          />

                          {values.hasAnswerFeedbacks && (
                            <div className="flex flex-row items-center">
                              <div className="mr-2">Feedback:</div>
                              <Field
                                name={`options.choices[${index}].feedback`}
                                type="text"
                                className={twMerge(
                                  'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9'
                                )}
                                value={choice.feedback}
                              />
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}

                {question.type === 'NUMERICAL' && (
                  <div>
                    NUMERICAL RESTRICTIONS INPUT with potentially Solution
                    enabled
                  </div>
                )}

                {/* // TODO: test this once a free text question was created as well */}
                {question.type === 'FREE_TEXT' && (
                  <div>
                    FREE TEXT RESTRICTIONS INPUT with potentially solution
                    enabled
                  </div>
                )}

                <div className="flex flex-row justify-between float-right">
                  <Button
                    className="mt-2 border-uzh-grey-80"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    <Button.Label>Speichern</Button.Label>
                  </Button>
                </div>
              </Form>
            )
          }}
        </Formik>
      )}
    </Modal>
  )
}

export default QuestionEditModal
