import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import SCAnswerOptions from './SCAnswerOptions'

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

const SCCreationPreview = ({ title, description, options }) => (
  <div className="preview">
    <div className="title">{title || 'TITLE'}</div>
    <div className="description">{description || 'DESCRIPTION'}</div>
    <div className="options">
      <SCAnswerOptions
        activeOption={-1}
        options={
          ((!options || options.choices.length === 0) && [{ name: 'OPTION' }]) || options.choices
        }
        onOptionClick={f => () => f}
      />
    </div>
    <div className="button">
      <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
    </div>

    <style jsx>{`
      @import 'src/theme';

      .preview {
        display: flex;
        flex-direction: column;

        border: 1px solid lightgrey;
        height: 100%;
        padding: 1rem;

        @include desktop-tablet-only {
          min-height: 18.5rem;
        }
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

SCCreationPreview.propTypes = propTypes
SCCreationPreview.defaultProps = defaultProps

export default SCCreationPreview
