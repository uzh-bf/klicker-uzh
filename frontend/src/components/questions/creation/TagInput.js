import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Dropdown, Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { withStateHandlers } from 'recompose'

const propTypes = {
  disabled: PropTypes.bool,
  error: PropTypes.string,
  onAddNewTag: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ),
  touched: PropTypes.bool.isRequired,
  value: PropTypes.array,
}

const defaultProps = {
  disabled: false,
  error: null,
  tags: [],
  value: [],
}

const TagInput = ({ tags, value, onChange, error, touched, disabled, onAddNewTag }) => (
  <div className="tagInput">
    <Form.Field required error={touched && error}>
      <label htmlFor="tags">
        <FormattedMessage defaultMessage="Tags" id="createQuestion.tagInput.label" />
        <a data-tip data-for="tagHelp">
          <Icon name="question circle" />
        </a>
      </label>

      <ReactTooltip delayHide={250} delayShow={250} id="tagHelp" place="right">
        <FormattedMessage
          defaultMessage="Add tags to your question to improve organization and reusability (similar to the folders used previously)."
          id="createQuestion.tagInput.tooltip"
        />
      </ReactTooltip>

      <Dropdown
        allowAdditions
        fluid
        multiple
        search
        selection
        disabled={disabled}
        options={tags}
        value={value}
        onAddItem={onAddNewTag}
        onChange={(_, { value: newVal }) => onChange(newVal)}
      />
    </Form.Field>

    <style jsx>
      {`
        @import 'src/theme';

        .tagInput {
          > :global(.field) {
            @include tooltip-icon;
          }

          :global(.error .react-tagsinput) {
            background-color: $color-error-bg;
            border-color: $color-error-border;
          }
        }
      `}
    </style>
  </div>
)

TagInput.propTypes = propTypes
TagInput.defaultProps = defaultProps

export default withStateHandlers(
  ({ tags }) => ({
    tags: tags.map(({ id, name }) => ({ key: id, text: name, value: name })),
  }),
  {
    onAddNewTag: ({ tags }) => (e, { value }) => {
      if (tags.map(({ text }) => text).includes(value)) {
        return null
      }

      return {
        tags: [...tags, { key: value, text: value, value }],
      }
    },
  }
)(TagInput)
