import { useMutation, useQuery } from '@apollo/client'
import {
  EditQuestionDocument,
  GetSingleQuestionDocument,
  GetUserQuestionDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Field, Form, Formik } from 'formik'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button, Label, Modal } from '@uzh-bf/design-system'
import { TYPES_LABELS } from 'shared-components'

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
  const [editQuestion] = useMutation(EditQuestionDocument)

  // TODO replace by proper function call
  const temp = () =>
    editQuestion({
      variables: { id: questionId },
      refetchQueries: [{ query: GetUserQuestionDocument }],
    })

  const question = useMemo(
    () => dataQuestion?.question,
    [dataQuestion?.question]
  )

  console.log(dataQuestion)

  // TODO: styling of tooltips - some are too wide

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
            content: question.content,
            attachments: question.attachments,
            options: question.questionData.options,
          }}
          // TODO: validationSchema={loginSchema}
          // TODO: pass correct values to this function instead of demo values
          onSubmit={async (values) => {
            await editQuestion({
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
                  restrictions: { min: 0, max: 100, maxLength: 200 },
                  solutionRanges: [
                    { min: 0, max: 1 },
                    { min: 80, max: 100 },
                  ],
                  solutions: [
                    'This is a text solution 1.',
                    'This is a text solution 2.',
                  ],
                },
                attachments: [{ id: 'attachmendId1' }, { id: 'attachmendId2' }],
                tags: [{ id: 1 }, { id: 2 }],
              },
              refetchQueries: [{ query: GetUserQuestionDocument }],
            })
            handleSetIsOpen(false)
          }}
        >
          {({ errors, touched, isSubmitting, values }) => {
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

                <div className="flex flex-row mb-8">
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
                    value={'TODO'}
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
                </div>

                <div className="">
                  <Label
                    label="Anhänge:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal"
                    tooltip="// TODO Tooltip Content"
                    showTooltipSymbol={true}
                  />
                </div>

                <div className="">
                  <Label
                    label="Choices / Restrictions:"
                    className="my-auto mr-2 text-lg font-bold"
                    tooltipStyle="text-base font-normal"
                    tooltip="// TODO Tooltip Content"
                    showTooltipSymbol={true}
                  />
                </div>

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
