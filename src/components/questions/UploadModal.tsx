import React, { useState, useCallback } from 'react'
import { Modal, Button, Table, Icon } from 'semantic-ui-react'
import { useApolloClient } from '@apollo/client'
import { useDropzone } from 'react-dropzone'
import { FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'

import Ellipsis from '../common/Ellipsis'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'

interface Props {
  children: React.ReactChild
}

function UploadModal({ children }: Props): React.ReactElement {
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
    <Modal closeIcon size="fullscreen" trigger={children} onClose={onResetImportState}>
      <Modal.Header>
        <FormattedMessage defaultMessage="Question Import" id="questionImport.string.header" />
      </Modal.Header>
      <Modal.Content>
        <div className="wrapper">
          <div className="dropzone" {...getRootProps()}>
            <input {...getInputProps()} />
            <Button fluid icon primary disabled={false} type="button">
              <Icon name="plus" />
              <FormattedMessage defaultMessage="Add questions" id="questionImport.button.addQuestions" />
            </Button>
          </div>
          <div className="questions">
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
                    <Table.Row>
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
      </Modal.Content>
      <Modal.Actions>
        <Button icon primary disabled={questions.length === 0} loading={isLoading} onClick={onImportQuestions}>
          <Icon name="upload" />
          <FormattedMessage defaultMessage="Start Upload" id="questionImport.button.upload" />
        </Button>
      </Modal.Actions>

      <style jsx>{`
        .wrapper {
          display: flex;
          flex-flow: row nowrap;
        }

        .dropzone {
          flex: 0 0 20%;
        }

        .questions {
          flex: 1;

          padding-left: 1rem;
        }
      `}</style>
    </Modal>
  )
}

export default UploadModal
