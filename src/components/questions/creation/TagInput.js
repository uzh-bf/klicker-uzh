import React from 'react'
import TagsInput from 'react-tagsinput'
import { FormattedMessage } from 'react-intl'

import { autocompleteRenderInput } from '../../common/Autosuggest'

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

TagInput.defaultProps = defaultProps

export default TagInput
