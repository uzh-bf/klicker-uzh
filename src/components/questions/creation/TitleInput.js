import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
}

const TitleInput = ({ input: { value, onChange } }) => (
  <div className="field">
    <label htmlFor="questionTitle">
      <FormattedMessage defaultMessage="Question title" id="teacher.createQuestion.questionTitle" />
    </label>
    <input name="questionTitle" type="text" value={value} onChange={onChange} />
  </div>
)

TitleInput.propTypes = propTypes

export default TitleInput
