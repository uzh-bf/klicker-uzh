import React from 'react'
import PropTypes from 'prop-types'
import { Card, Image, Modal } from 'semantic-ui-react'

const propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
}
const defaultProps = {
  files: [],
}
const QuestionFiles = ({ files }) => (
  <div className="questionFiles">
    {files.map(({ id, name }) => {
      const fileSrc = `${process.env.S3_BASE_PATH}/${name}`
      const previewImage = (
        <Card>
          <Image height="auto" src={fileSrc} width="100%" />
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
        margin-top: 0.3rem;

        .file {
          margin-right: 0.2rem;
          margin-top: 0.2rem;
          height: 50px;
          width: 50px;
        }
      }
    `}</style>
  </div>
)

QuestionFiles.propTypes = propTypes
QuestionFiles.defaultProps = defaultProps

export default QuestionFiles
