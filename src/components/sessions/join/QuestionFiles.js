import React from 'react'
import PropTypes from 'prop-types'
import { Card, Image, Modal } from 'semantic-ui-react'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()
const propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ),
}
const defaultProps = {
  files: [],
}
const QuestionFiles = ({ files }) => (
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
          <Modal closeIcon dimmer={false} trigger={previewImage}>
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

QuestionFiles.propTypes = propTypes
QuestionFiles.defaultProps = defaultProps

export default QuestionFiles
