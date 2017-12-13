import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import SCAnswerOptions from './SCAnswerOptions'

const propTypes = {
  description: PropTypes.string,
  options: PropTypes.array,
}

const defaultProps = {
  description: '',
  options: {
    choices: [],
  },
}

const SCCreationPreview = ({ description, options }) => (
  <div className="preview">
    <div className="description">{description}</div>
    <div className="options">
      <SCAnswerOptions
        disabled
        activeOption={-1}
        options={options.choices}
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
