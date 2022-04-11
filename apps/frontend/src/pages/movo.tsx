import React, { useState, useCallback } from 'react'
import { useMutation } from '@apollo/client'
import { useRouter } from 'next/router'
// import Button from '../components/common/Button'
import { Modal, Button, Icon } from 'semantic-ui-react'
import { useDropzone } from 'react-dropzone'
import { FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import MovoImportMutation from '../graphql/mutations/MovoImportMutation.graphql'

// import Ellipsis from '../components/common/Ellipsis'

function MovoImport(): React.ReactElement {
  const [movoImport] = useMutation(MovoImportMutation)
  const [movoJSON, setMovoJSON] = useState('')
  const { addToast } = useToasts()
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles): void => {
    const reader = new FileReader()

    reader.onload = (): void => {
      try {
        const stringMovoJSON = String(reader.result)
        setMovoJSON(stringMovoJSON)
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
    setMovoJSON('')
  }

  return (
    <>
      <h1>Movo Import</h1>
      <Modal closeIcon size="fullscreen" trigger={<Button>Upload</Button>} onClose={onResetImportState}>
        <Modal.Header>Movo Question &amp; Session Import</Modal.Header>
        <Modal.Content>
          <div className="flex flex-row flex-nowrap">
            <div className="flex-[0_0_20%]" {...getRootProps()}>
              <input {...getInputProps()} />
              <Button fluid icon primary disabled={false} type="button">
                <Icon className="!mr-10" name="plus" />
                Upload Movo Export
              </Button>
            </div>
            <div className="flex-1 pl-4">Movo JSON Content: {movoJSON}</div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button
            icon
            primary
            onClick={() => {
              try {
                movoImport({
                  variables: { dataset: movoJSON },
                })
              } catch (error) {
                console.log(error)
              }
              router.push('./questions')
            }}
          >
            {/* disabled={questions.length === 0} */}
            <Icon name="upload" />
            <FormattedMessage defaultMessage="Start Upload" id="questionImport.button.upload" />
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  )
}

export default MovoImport
