import React from 'react'
import PropTypes from 'prop-types'
import TagsInput from 'react-tagsinput'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

import { autocompleteRenderInput } from '../../common'

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
  <div className="field tagInput">
    <label htmlFor="tags">
      <FormattedMessage defaultMessage="Tags" id="teacher.createQuestion.tagInput.label" />{' '}
      <a data-tip data-for="tagHelp">
        <FaQuestionCircle />
      </a>
    </label>

    <ReactTooltip id="tagHelp" delayHide={250} place="right">
      <FormattedMessage
        defaultMessage="Type in your tag and press enter to confirm."
        id="teacher.createQuestion.tagInput.tooltip"
      />
    </ReactTooltip>

    <TagsInput
      renderInput={autocompleteRenderInput(tags)}
      name="tags"
      value={value || []}
      onChange={onChange}
    />

    <style jsx global>{`
      @import 'src/_theme';

      .react-tagsinput {
        border: 1px solid $color-borders;
        overflow: hidden;
        padding-left: 0.5rem;
        padding-top: 0.5rem;
        padding-right: 0.5rem;
      }

      .react-tagsinput--focused {
        border-color: $color-focus;
      }

      .react-tagsinput-tag {
        background-color: $color-secondary;
        border-radius: 2px;
        border: 1px solid grey;
        color: white;
        display: inline-block;
        margin-bottom: 0.5rem;
        margin-right: 0.5rem;
        padding: 0.7rem;
        text-align: center;
        width: 100%;
      }

      .react-tagsinput-input {
        background: transparent;
        border: 0 !important;
        color: #777;
        font-weight: 400;
        margin-bottom: 0.5rem !important;
        margin-top: 1px !important;
        outline: none;
        padding: 0.7rem;
      }

      .react-autosuggest__container {
        position: relative;
        display: inline;
      }

      .react-autosuggest__suggestions-container {
        position: relative;
        top: -1px;
        z-index: 2;
      }

      .react-autosuggest__suggestion {
        cursor: pointer;
        list-style-type: none;
        padding: 0.5rem;
      }

      .react-autosuggest__suggestion--highlighted {
        background-color: lightgrey;
      }

      .react-autosuggest__input {
        padding: 0.5rem !important;
        text-align: left;
      }

      .react-tagsinput-remove {
        margin-left: 0.5rem;
      }

      .react-tagsinput-remove::after {
        content: 'x';
      }

      @media all and (min-width: 768px) {
        .react-tagsinput {
          padding-right: 0;
        }

        .react-tagsinput-tag {
          margin-bottom: 0.5rem;
          margin-right: 0.5rem;
          padding: 0.5rem;
          text-align: left;
          width: auto;
        }

        .react-tagsinput-remove {
          cursor: pointer;
          font-weight: bold;
        }

        .react-tagsinput-input {
          padding: 0.5rem !important;
          text-align: left;
        }
      }
    `}</style>

    <style jsx>{`
      @import 'src/_theme';

      .tagInput {
        a {
          color: gray;

          :global(svg) {
            font-size: 1.25rem;
            margin-bottom: 0.2rem;
          }
        }
      }
    `}</style>
  </div>
)

TagInput.propTypes = propTypes
TagInput.defaultProps = defaultProps

export default TagInput
