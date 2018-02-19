import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  disabled: PropTypes.bool.isRequired,
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  meta: PropTypes.shape({
    dirty: PropTypes.bool,
    invalid: PropTypes.bool,
  }).isRequired,
}

const ContentInput = ({ input: { value, onChange }, meta: { dirty, invalid }, disabled }) => (
  <div className="contentInput">
    <Form.Field required error={dirty && invalid}>
      <label htmlFor="content">
        <FormattedMessage defaultMessage="Question" id="createQuestion.contentInput.label" />
        <a data-tip data-for="contentHelp">
          <Icon name="question circle" />
        </a>
      </label>

      <ReactTooltip delayHide={250} delayShow={250} id="contentHelp" place="right">
        <FormattedMessage
          defaultMessage="Enter the question you want to ask the audience."
          id="createQuestion.contentInput.tooltip"
        />
      </ReactTooltip>

      <textarea disabled={disabled} name="content" value={value} onChange={onChange} />
    </Form.Field>

    <style jsx>{`
      @import 'src/theme';

      .contentInput {
        @include tooltip-icon;

        textarea {
          border: 1px solid lightgrey;
          height: 20rem;
          padding: 1rem;

          &:focus {
            border-color: $color-focus;
          }
        }
      }
    `}</style>
  </div>
)

ContentInput.propTypes = propTypes

export default ContentInput
