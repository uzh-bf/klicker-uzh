import React from 'react'
import PropTypes from 'prop-types'
import Dropzone from 'react-dropzone'
import getConfig from 'next/config'
import { FormattedMessage } from 'react-intl'
import { Icon, Card, Image, Button } from 'semantic-ui-react'

const { publicRuntimeConfig } = getConfig()

const propTypes = {
  disabled: PropTypes.bool,
  files: PropTypes.arrayOf(PropTypes.shape({})),
  onChangeFiles: PropTypes.func.isRequired,
}
const defaultProps = {
  disabled: false,
  files: [],
}

const FileDropzone = ({ disabled, files, onChangeFiles }) => (
  <div className="fileDropzone">
    <div className="dropzone">
      <Dropzone
        accept="image/*"
        className="reactDropzone"
        disabled={disabled}
        onDrop={acc => {
          if (!disabled) {
            onChangeFiles(files.concat(acc))
          }
        }}
      >
        <Button fluid primary disabled={disabled} type="button">
          <FormattedMessage defaultMessage="Upload" id="fileDropzone.button.upload" />
        </Button>
      </Dropzone>
    </div>

    <div className="previews">
      {files.map((file, index) => {
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
                  onClick={() => {
                    if (!disabled) {
                      onChangeFiles(files.filter((val, ix) => ix !== index))
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
      })}
    </div>

    <style jsx>{`
      @import 'src/theme';

      .fileDropzone {
        display: flex;

        .dropzone {
          flex: 0 0 auto;
        }

        :global(.reactDropzone) {
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

FileDropzone.propTypes = propTypes
FileDropzone.defaultProps = defaultProps

export default FileDropzone
