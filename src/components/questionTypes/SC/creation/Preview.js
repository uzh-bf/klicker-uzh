import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import AnswerOptions from '../answer/Options'

const propTypes = {
  description: PropTypes.string,
  options: PropTypes.array,
  title: PropTypes.string,
}

const defaultProps = {
  description: 'DESCRIPTION',
  options: [],
  title: 'TITLE',
}

const Preview = ({ title, description, options }) => (
  <div className="preview">
    <div className="title">{title || 'TITLE'}</div>
    <div className="description">{description || 'DESCRIPTION'}</div>
    <div className="options">
      <AnswerOptions
        activeOption={-1}
        options={((!options || options.length === 0) && [{ name: 'OPTION' }]) || options}
        onOptionClick={f => () => f}
      />
    </div>
    <div className="button">
      <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
    </div>

    <style jsx>{`
      .preview {
        display: flex;
        flex-direction: column;

        border: 1px solid lightgrey;
        height: 100%;
        padding: 1rem;
      }

      .title,
      .description,
      .options {
        margin-bottom: 1rem;
      }

      .title {
        font-weight: bold;
      }

      .button {
        align-self: flex-end;

        border: 1px solid lightgrey;
        padding: 0.5rem;
      }
    `}</style>
  </div>
)

Preview.propTypes = propTypes
Preview.defaultProps = defaultProps

export default Preview
