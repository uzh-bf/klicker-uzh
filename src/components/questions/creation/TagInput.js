// @flow

import * as React from 'react'
import TagsInput from 'react-tagsinput'
import { FormattedMessage } from 'react-intl'

import { autocompleteRenderInput } from '../../common/Autosuggest'

import type { TagType, ArrayInputType } from '../../../types'

type Props = {
  tags: Array<TagType>,
  input: ArrayInputType<TagType>,
}

const defaultProps = {
  tags: [],
}

const TagInput = ({ tags, input: { value, onChange } }: Props) => (
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
