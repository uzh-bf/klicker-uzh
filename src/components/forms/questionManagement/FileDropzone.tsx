import React, { useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import getConfig from 'next/config'
import { FormattedMessage } from 'react-intl'
import { Icon, Card, Image, Button } from 'semantic-ui-react'

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

  const previews = files.map(
    (file, index): React.ReactElement => {
      const imageSrc = `${publicRuntimeConfig.s3root}/${file.name}`
      return (
        <div className="imagePreview" key={file.id || index}>
          <Card>
            <Card.Meta>
              <span className="imageIndex">{`#${index + 1}`}</span>
            </Card.Meta>
            <Image height="auto" src={file.preview || imageSrc} width="100%" />
            <Card.Content extra>
              <Button
                basic
                fluid
                color="red"
                disabled={disabled}
                type="button"
                onClick={(): void => {
                  if (!disabled) {
                    onChangeFiles(files.filter((_, ix): boolean => ix !== index))
                  }
                }}
              >
                <Icon name="trash" />
                <FormattedMessage defaultMessage="Delete" id="fileDropzone.button.delete" />
              </Button>
            </Card.Content>
          </Card>
        </div>
      )
    }
  )

  useEffect((): void => {
    // Make sure to revoke the data uris to avoid memory leaks
    files.forEach((file): void => URL.revokeObjectURL(file.preview))
  })

  return (
    <div className="fileDropzone">
      <div className="dropzone" {...getRootProps()}>
        <input {...getInputProps()} />
        <Button fluid primary disabled={disabled} type="button">
          <FormattedMessage defaultMessage="Upload" id="fileDropzone.button.upload" />
        </Button>
      </div>

      <div className="previews">{previews}</div>

      <style jsx>{`
        @import 'src/theme';

        .fileDropzone {
          display: flex;

          .dropzone {
            flex: 0 0 auto;

            position: relative;
            width: 150px;
            height: 100px;
            border-width: 2px;
            border-color: rgb(102, 102, 102);
            padding: 0.5rem;
            border-style: dashed;
          }

          .previews {
            flex: 1;

            display: flex;
            flex-flow: row wrap;
            align-items: flex-start;

            border: 1px solid lightgrey;
            margin-left: 1rem;
            padding: 0.5rem;

            .imagePreview {
              width: 150px;
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
