import React from 'react'
import { Card, Image, Modal } from 'semantic-ui-react'

export default ({ files }) => (
  <div className="questionFiles">
    {files.map((file) => {
      const previewImage = (
        <Card>
          <Image height="auto" src={file} width="100%" />
        </Card>
      )

      return (
        <div className="file">
          <Modal closeIcon trigger={previewImage}>
            <Modal.Content image>
              <Image wrapped src={file} />
            </Modal.Content>
          </Modal>
        </div>
      )
    })}
    <style jsx>{`
      .questionFiles {
        display: flex;
        flex-flow: row wrap;

        .file {
          height: 50px;
          width: 50px;
        }
      }
    `}</style>
  </div>
)
