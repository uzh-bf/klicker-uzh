import React from 'react'
import { Card, Image as SemanticImage, Modal } from 'semantic-ui-react'
import Image from 'next/image'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

interface Props {
  files: {
    id: string
    name: string
    description?: string
  }[]
  isCompact?: boolean
}

const defaultProps = {
  files: [],
  isCompact: false,
}

function QuestionFiles({ files, isCompact }: Props): React.ReactElement {
  return (
    <div className="questionFiles">
      {files.map(({ id, name, description }, ix): React.ReactElement => {
        const fileSrc = `${publicRuntimeConfig.s3root}/${name}`
        const previewImage = (
          <Card>
            <Image alt={description} crossOrigin="anonymous" height={80} objectFit="cover" src={fileSrc} width={100} />
            {!isCompact && <Card.Content extra>#{ix + 1}</Card.Content>}
          </Card>
        )

        return (
          <div className="file" key={id}>
            <Modal closeIcon trigger={previewImage}>
              {description && <Modal.Header>{description}</Modal.Header>}
              <Modal.Content image>
                <SemanticImage alt={description} crossOrigin="anonymous" src={fileSrc} />
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
            width: 100px;

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
