import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
}

const ContentInput = ({ input: { value, onChange } }) => (
  <div className="field contentInput">
    <label htmlFor="content">
      <FormattedMessage defaultMessage="Content" id="teacher.createQuestion.content" />
    </label>
    <textarea name="content" value={value} onChange={onChange} />

    <style jsx>{`
      .contentInput textarea {
        border: 1px solid lightgrey;
        height: 20rem;
        padding: 1rem;
      }
    `}</style>
  </div>
)

ContentInput.propTypes = propTypes

export default ContentInput
