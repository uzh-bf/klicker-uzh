import React from 'react'
import Dropzone from 'react-dropzone'
import {
  Icon, Card, Image, Button,
} from 'semantic-ui-react'

export default ({ value, onChange }) => (
  <div className="fileDropzone">
    <div className="dropzone">
      <Dropzone
        accept="image/*"
        onDrop={(acc) => {
          onChange(value.concat(acc))
        }}
      />
    </div>
    <div className="previews">
      {value.map((file, index) => (
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
                  onChange(value.filter((val, ix) => ix !== index))
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
