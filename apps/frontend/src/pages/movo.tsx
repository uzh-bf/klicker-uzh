import React, { useState, useCallback } from 'react'
import { useMutation } from '@apollo/client'
import { useRouter } from 'next/router'
import Image from 'next/image'
import { Button, Icon } from 'semantic-ui-react'
import { useDropzone } from 'react-dropzone'
import { useToasts } from 'react-toast-notifications'
import MovoImportMutation from '../graphql/mutations/MovoImportMutation.graphql'
import KlickerLogoSrc from '../../public/KlickerUZH_Gray_Transparent.png'

function MovoImport(): React.ReactElement {
  const [movoImport] = useMutation(MovoImportMutation)
  const [movoJSON, setMovoJSON] = useState('')
  const [filename, setFilename] = useState('')
  const { addToast } = useToasts()
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles): void => {
    const reader = new FileReader()

    reader.onload = (): void => {
      try {
        const stringMovoJSON = String(reader.result)
        setMovoJSON(stringMovoJSON)
      } catch (error) {
        addToast('Something went wront with your uploaded file. Plese try again or contact the support email below', {
          appearance: 'error',
        })
      }
    }

    acceptedFiles.forEach((file): void => reader.readAsText(file, 'utf-8'))
    setFilename(acceptedFiles[0].name)
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    accept: ['text/plain', 'application/json'],
    onDrop,
  })

  return (
    <>
      <div className="flex m-4">
        <h1 className="flex-1">Movo.ch Import to KlickerUZH</h1>
        <div className="-mt-4">
          <Image alt="KlickerUZH Logo" height={66} src={KlickerLogoSrc} width={200} />
        </div>
      </div>

      <div className="mx-4">
        <div className="p-3 mb-3 border border-gray-500 border-solid rounded bg-primary-20">
          This page allows users to migrate seemlessly from movo.ch to KlickerUZH without loosing any questions or
          previously run question sets. Plase note that the migration usually takes a few hours to be completed and that
          you should not use your KlickerUZH account in the meantime to avoid conflicts in the data. If you have any
          questions or problems with the migration, please contact: TODO
        </div>
        <div className="flex flex-row flex-nowrap">
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            <Button fluid icon primary disabled={false} type="button">
              <div className="flex flex-row">
                <Icon className="!mr-4" name="plus" />
                <div>Select Movo Export</div>
              </div>
            </Button>
          </div>
          <div className="flex-1 pl-4 my-auto font-bold">Selected File: {filename}</div>
          <Button
            icon
            primary
            className="!bg-green-700 !max-h-10"
            disabled={movoJSON === ''}
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
            <div className="flex flex-row">
              <Icon className="!mr-4" name="upload" />
              <div>Confirm Upload</div>
            </div>
          </Button>
        </div>
      </div>
    </>
  )
}

export default MovoImport
