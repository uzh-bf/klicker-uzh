import React from 'react'
import Dropzone from 'react-dropzone'
import {
  Icon, Card, Image, Button,
} from 'semantic-ui-react'

export default ({ files, onChangeFiles }) => (
  <div className="fileDropzone">
    <div className="dropzone">
      <Dropzone
        accept="image/*"
        className="reactDropzone"
        onDrop={(acc) => {
          onChangeFiles(files.concat(acc))
        }}
      >
        <Button fluid primary>
          Upload
        </Button>
      </Dropzone>
    </div>
    <div className="previews">
      {files.map((file, index) => (
        <div className="imagePreview">
          <Card>
            <Card.Meta>
              <span className="imageIndex">{`#${index + 1}`}</span>
            </Card.Meta>
            <Image height="auto" src={file.preview} width="100%" />
            <Card.Content extra>
              <Button
                basic
                fluid
                color="red"
                onClick={() => {
                  onChangeFiles(files.filter((val, ix) => ix !== index))
                }}
              >
                <Icon name="trash" />
                Delete
              </Button>
            </Card.Content>
          </Card>
        </div>
      ))}
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
