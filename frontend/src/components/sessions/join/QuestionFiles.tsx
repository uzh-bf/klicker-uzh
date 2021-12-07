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
    <div className="flex flex-row flex-wrap gap-2">
      {files.map(({ id, name, description }, ix): React.ReactElement => {
        const fileSrc = `${publicRuntimeConfig.s3root}/${name}`
        const previewImage = (
          <Card>
            <Image alt={description} crossOrigin="anonymous" height={50} objectFit="cover" src={fileSrc} width={75} />
            {!isCompact && (
              <Card.Content extra className="!p-1 !text-xs">
                #{ix + 1}
              </Card.Content>
            )}
          </Card>
        )

        return (
          <div className="w-[75px]" key={id}>
            <Modal closeIcon trigger={previewImage}>
              {description && <Modal.Header>{description}</Modal.Header>}
              <Modal.Content image>
                <SemanticImage alt={description} crossOrigin="anonymous" src={fileSrc} />
              </Modal.Content>
            </Modal>
          </div>
        )
      })}
    </div>
  )
}

QuestionFiles.defaultProps = defaultProps

export default QuestionFiles
