import React, { useState, useCallback } from 'react'
import { Table } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons'
import { useApolloClient } from '@apollo/client'
import { useDropzone } from 'react-dropzone'
import { FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import clsx from 'clsx'

import Ellipsis from '../common/Ellipsis'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'
import CustomModal from '../common/CustomModal'

interface Props {
  children?: React.ReactChild
  className: string
  open: boolean
  // eslint-disable-next-line no-unused-vars
  setOpen: (arg: boolean) => void
}

const defaultProps = {
  children: undefined,
}

function UploadModal({ className, children, open, setOpen }: Props): React.ReactElement {
  const client = useApolloClient()
  const [isLoading, setIsLoading] = useState(false)
  const [questions, setQuestions] = useState([])
  const { addToast } = useToasts()

  const onDrop = useCallback((acceptedFiles): void => {
    const reader = new FileReader()

    reader.onload = (): void => {
      try {
        const binaryStr = String(reader.result)
        const json = JSON.parse(binaryStr)
        setQuestions(json.exportQuestions)
      } catch (error) {
        addToast(
          <FormattedMessage
            defaultMessage="Unable to parse questions: {errorMessage}"
            id="components.questions.uploadModal.load.error"
            values={{ errorMessage: error.message }}
          />,
          { appearance: 'error' }
        )
      }
    }

    acceptedFiles.forEach((file): void => reader.readAsText(file, 'utf-8'))
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    accept: ['text/plain', 'application/json'],
    onDrop,
  })

  const onResetImportState = (): void => {
    setQuestions([])
  }

  const onImportQuestions = async (): Promise<void> => {
    setIsLoading(true)

    try {
      // ensure that questions are created in sequence
      // such that identical tags can be reused
      await questions.reduce(async (prevPromise, question): Promise<any> => {
        await prevPromise

        const options: any = {}
        if (QUESTION_GROUPS.CHOICES.includes(question.type)) {
          options.randomized = question.options[question.type].randomized
          options.choices = question.options[question.type].choices
        } else if (question.type === QUESTION_TYPES.FREE_RANGE) {
          options.restrictions = question.options[question.type].restrictions
        }

        return client.mutate({
          mutation: CreateQuestionMutation,
          variables: {
            content: question.content,
            files: question.files.map((file) => ({ ...file, originalName: file.name })),
            options,
            tags: question.tags.map((tag) => tag.name),
            title: question.title,
            type: question.type,
          },
        })
      }, Promise.resolve())

      window.location.reload()
    } catch (error) {
      addToast(
        <FormattedMessage
          defaultMessage="Unable to import questions: {errorMessage}"
          id="components.questions.uploadModal.sequence.error"
          values={{ errorMessage: error.message }}
        />,
        { appearance: 'error' }
      )
    }

    setIsLoading(false)
  }

  return (
    <CustomModal
      className={clsx(className, '!pb-2')}
      open={open}
      title={<FormattedMessage defaultMessage="Question Import" id="questionImport.string.header" />}
      trigger={children}
    >
      <div className="flex flex-row flex-nowrap">
        <div className="flex-[0_0_20%]" {...getRootProps()}>
          <input {...getInputProps()} />
          <Button fluid className="h-10" disabled={false}>
            <Button.Icon>
              <FontAwesomeIcon icon={faPlus} />
            </Button.Icon>
            <FormattedMessage defaultMessage="Add questions" id="questionImport.button.addQuestions" />
          </Button>
        </div>
        <div className="flex-1 pl-4">
          <Table unstackable>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>
                  <FormattedMessage defaultMessage="Type" id="questionImport.string.questionType" />
                </Table.HeaderCell>
                <Table.HeaderCell>
                  <FormattedMessage defaultMessage="Title" id="questionImport.string.questionTitle" />
                </Table.HeaderCell>
                <Table.HeaderCell>
                  <FormattedMessage defaultMessage="Content" id="questionImport.string.questionContent" />
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {questions.map(
                (question): React.ReactElement => (
                  <Table.Row key={question.title}>
                    <Table.Cell>{question.type}</Table.Cell>
                    <Table.Cell>{question.title}</Table.Cell>
                    <Table.Cell>
                      <Ellipsis maxLength={15}>{question.description}</Ellipsis>
                    </Table.Cell>
                  </Table.Row>
                )
              )}
              {questions.length === 0 && (
                <Table.Row>
                  <Table.Cell>-</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </div>
      <div className="flex flex-row justify-between">
        <Button
          className="float-right h-10 px-6 mt-2"
          loading={isLoading}
          onClick={() => {
            setOpen(false)
            onResetImportState()
          }}
        >
          <FormattedMessage defaultMessage="Close" id="common.button.close" />
        </Button>
        <Button
          className="float-right h-10 px-5 mt-2 bg-uzh-blue-80 disabled:opacity-60"
          disabled={questions.length === 0}
          loading={isLoading}
          onClick={() => {
            onImportQuestions()
            onResetImportState()
            setOpen(false)
          }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faUpload} />
          </Button.Icon>
          <FormattedMessage defaultMessage="Start Upload" id="questionImport.button.upload" />
        </Button>
      </div>
    </CustomModal>
  )
}

UploadModal.defaultProps = defaultProps
export default UploadModal
