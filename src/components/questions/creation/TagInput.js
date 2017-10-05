import React from 'react'
import PropTypes from 'prop-types'
import TagsInput from 'react-tagsinput'
import { FormattedMessage } from 'react-intl'

import { autocompleteRenderInput } from '../../common/Autosuggest'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.array,
  }).isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  tags: [],
}

const TagInput = ({ tags, input: { value, onChange } }) => (
  <div className="field">
    <label htmlFor="tags">
      <FormattedMessage defaultMessage="Tags" id="teacher.createQuestion.tags" />
    </label>
    <TagsInput
      renderInput={autocompleteRenderInput(tags)}
      name="tags"
      value={value || []}
      onChange={onChange}
    />
  </div>
)

TagInput.propTypes = propTypes
TagInput.defaultProps = defaultProps

export default TagInput
