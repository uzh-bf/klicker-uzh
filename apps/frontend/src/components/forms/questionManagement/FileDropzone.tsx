import React, { useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import getConfig from 'next/config'
import { FormattedMessage } from 'react-intl'
import { Card, Image, Input } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faUpload } from '@fortawesome/free-solid-svg-icons'

const { publicRuntimeConfig } = getConfig()

interface Props {
  disabled: boolean
  files: any[]
  onChangeFiles: any
}

const defaultProps = {
  disabled: false,
  files: [],
}

function FileDropzone({ disabled, files, onChangeFiles }: Props): React.ReactElement<any> {
  // prepare a callback hook that handles added files
  const onDrop = useCallback(
    (acceptedFiles): void => {
      if (!disabled) {
        onChangeFiles(
          files.concat(
            acceptedFiles.map((file): any =>
              Object.assign(file, {
                description: '',
                preview: URL.createObjectURL(file),
              })
            )
          )
        )
      }
    },
    [disabled, files]
  )

  // get properties of the dropzone hook
  const { getRootProps, getInputProps } = useDropzone({
    accept: ['image/png', 'image/jpeg', 'image/gif'],
    disabled,
    onDrop,
  })

  const previews = files.map((file, index): React.ReactElement => {
    const imageSrc = `${publicRuntimeConfig.s3root}/${file.name}`
    return (
      <div className="imagePreview" key={file.id || index}>
        <Card>
          <Image crossOrigin="anonymous" height="auto" src={file.preview || imageSrc} width="100%" />
          <Card.Content>
            <Input
              fluid
              name="description"
              placeholder="Description..."
              value={file.description}
              onChange={(_, { value }): void =>
                onChangeFiles(
                  files.map((existingFile): any => {
                    if (existingFile.id === file.id) {
                      return Object.assign(existingFile, {
                        description: value,
                      })
                    }
                    return existingFile
                  })
                )
              }
            />
          </Card.Content>
          <Card.Content extra>
            <Button
              className="h-10 px-3 text-red-600 border border-red-600 border-solid"
              disabled={disabled}
              onClick={(): void => {
                if (!disabled) {
                  onChangeFiles(files.filter((_, ix): boolean => ix !== index))
                }
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrashCan} />
              </Button.Icon>
              <Button.Label>
                <FormattedMessage defaultMessage="Delete" id="fileDropzone.button.delete" />
              </Button.Label>
            </Button>
          </Card.Content>
        </Card>
      </div>
    )
  })

  useEffect((): void => {
    // Make sure to revoke the data uris to avoid memory leaks
    files.forEach((file): void => URL.revokeObjectURL(file.preview))
  })

  return (
    <div className="fileDropzone">
      <div className="dropzone" {...getRootProps()}>
        <input {...getInputProps()} />
        <Button fluid className="h-10" disabled={disabled}>
          <Button.Icon>
            <FontAwesomeIcon icon={faUpload} />
          </Button.Icon>
          <Button.Label>
            <FormattedMessage defaultMessage="Upload" id="fileDropzone.button.upload" />
          </Button.Label>
        </Button>
        <div className="dndInfo">or Drag & Drop</div>
      </div>

      <div className="previews">{previews}</div>

      <style jsx>{`
        @import 'src/theme';

        .fileDropzone {
          display: flex;

          .dropzone {
            flex: 0 0 auto;

            background-color: #efefef;
            position: relative;
            width: 150px;
            height: 100px;
            border: 1px solid grey;
            border-style: dashed;
            padding: 0.5rem;

            .dndInfo {
              color: grey;
              text-align: center;
              margin-top: 0.3rem;
            }
          }

          .previews {
            flex: 1;

            display: flex;
            flex-flow: row wrap;
            align-items: flex-start;

            border: 1px solid lightgrey;
            margin-left: 1rem;
            padding: 0.5rem;

            :global(.imagePreview) {
              width: 200px;
              margin: 0.5rem;
            }

            .imageIndex {
              padding: 0.5rem;
            }
          }
        }
      `}</style>
    </div>
  )
}

FileDropzone.defaultProps = defaultProps

export default FileDropzone
