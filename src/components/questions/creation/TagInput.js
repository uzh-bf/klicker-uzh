import React from 'react'
import PropTypes from 'prop-types'
import TagsInput from 'react-tagsinput'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

import { autocompleteRenderInput } from '../../common'
import styles from './styles-tagsinput'

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
    <a data-tip data-for="tagHelp">
      {' '}
      <FaQuestionCircle className="icon" />
    </a>

    <ReactTooltip id="tagHelp" delayHide={250} place="right">
      <span>Type in your tag and press enter to confirm.</span>
    </ReactTooltip>

    <TagsInput
      renderInput={autocompleteRenderInput(tags)}
      name="tags"
      value={value || []}
      onChange={onChange}
    />

    <style global jsx>
      {styles}
    </style>

    <style jsx>{`
      @import 'src/_theme';

      :global(label) {
        display: inline !important;
      }

      a {
        color: gray;

        :global(.icon) {
          font-size: 1.25rem;
          margin-bottom: 0.2rem;
        }
      }
    `}</style>
  </div>
)

TagInput.propTypes = propTypes
TagInput.defaultProps = defaultProps

export default TagInput
