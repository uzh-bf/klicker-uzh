import React from 'react'
import PropTypes from 'prop-types'
import TagsInput from 'react-tagsinput'
import ReactTooltip from 'react-tooltip'
import { Form } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

import { autocompleteRenderInput } from '../../common'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.array,
  }).isRequired,
  meta: PropTypes.shape({
    dirty: PropTypes.bool,
    invalid: PropTypes.bool,
    touched: PropTypes.bool,
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

const TagInput = ({ tags, input: { value, onChange }, meta: { invalid, dirty, touched } }) => (
  <div className="tagInput">
    <Form.Field required error={(dirty || touched) && invalid}>
      <label htmlFor="tags">
        <FormattedMessage defaultMessage="Tags" id="teacher.createQuestion.tagInput.label" />
        <a data-tip data-for="tagHelp">
          <FaQuestionCircle />
        </a>
      </label>

      <ReactTooltip id="tagHelp" delayHide={250} place="right">
        <FormattedMessage
          defaultMessage="Add tags to your question to improve organization and reusability (similar to the folders used previously)."
          id="teacher.createQuestion.tagInput.tooltip"
        />
      </ReactTooltip>

      <TagsInput
        onlyUnique
        renderInput={autocompleteRenderInput(tags, value)}
        name="tags"
        value={value || []}
        onChange={onChange}
      />
    </Form.Field>

    <style jsx global>{`
      @import 'src/_theme';

      .react-tagsinput {
        border: 1px solid $color-borders;
        overflow: hidden;
        padding-left: 0.5rem;
        padding-top: 0.5rem;
        padding-right: 0.5rem;

        &--focused {
          border-color: $color-focus;
        }

        &-tag {
          background-color: $color-secondary;
          border-radius: 2px;
          border: 1px solid grey;
          color: grey;
          display: inline-block;
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
          margin-right: 0.5rem;
          padding: 0.7rem;
          text-align: center;
          width: 100%;
        }

        &-input {
          background: transparent;
          border: 0 !important;
          color: #777;
          font-weight: 400;
          margin-bottom: 0.5rem !important;
          margin-top: 1px !important;
          outline: none;
          padding: 0.7rem;
        }

        &-remove {
          margin-left: 1rem;
        }

        &-remove::after {
          content: 'X';
        }
      }

      .react-autosuggest {
        &__container {
          position: relative;
          display: inline;
        }

        &__suggestions-container {
          position: relative;
          top: -1px;
          z-index: 2;

          padding: 0.5rem;
        }

        &__suggestion {
          cursor: pointer;
          list-style-type: none;
          padding: 0.5rem;
        }

        &__suggestion--highlighted {
          background-color: $color-primary;
        }

        &__input {
          padding: 0.5rem !important;
          text-align: left;
        }
      }

      @media all and (min-width: 768px) {
        .react-tagsinput {
          padding-right: 0;

          &-tag {
            margin-bottom: 0.5rem;
            margin-right: 0.5rem;
            padding: 0.7rem 1rem;
            text-align: left;
            width: auto;
          }

          &-remove {
            cursor: pointer;
            font-weight: bold;
          }

          &-input {
            padding: 0.5rem !important;
            text-align: left;
          }
        }
      }
    `}</style>

    <style jsx>{`
      @import 'src/_theme';

      .tagInput {
        > :global(.field) {
          @include tooltip-icon;
        }

        :global(.error .react-tagsinput) {
          background-color: $color-error-bg;
          border-color: $color-error-border;
        }
      }
    `}</style>
  </div>
)

TagInput.propTypes = propTypes
TagInput.defaultProps = defaultProps

export default TagInput
