import React from 'react'
import { Card, Image, Modal } from 'semantic-ui-react'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

interface Props {
  files?: {
    id: string
    name: string
  }[]
}

const defaultProps = {
  files: [],
}

function QuestionFiles({ files }: Props): React.ReactElement {
  return (
    <div className="questionFiles">
      {files.map(({ id, name }, ix) => {
        const fileSrc = `${publicRuntimeConfig.s3root}/${name}`
        const previewImage = (
          <Card>
            <Image height="auto" src={fileSrc} width="100%" />
            <Card.Content extra>#{ix + 1}</Card.Content>
          </Card>
        )

        return (
          <div className="file" key={id}>
            <Modal closeIcon trigger={previewImage}>
              <Modal.Content image>
                <Image wrapped src={fileSrc} />
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
            margin-right: 0.3rem;
            width: 60px;

            :global(.extra) {
              padding: 0 0.3rem;
              text-align: center;
            }
          }
        }
      `}</style>
    </div>
  )
}

QuestionFiles.defaultProps = defaultProps

export default QuestionFiles
