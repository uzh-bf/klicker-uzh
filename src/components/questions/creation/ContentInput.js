import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import Editor from 'draft-js-plugins-editor'
import { Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  disabled: PropTypes.bool,
  error: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  touched: PropTypes.bool.isRequired,
  value: PropTypes.string.isRequired,
}

const defaultProps = {
  disabled: false,
}

const ContentInput = ({
  value, onChange, error, touched, disabled,
}) => (
  <div className="contentInput">
    <Form.Field required error={touched && error}>
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

      <Editor disabled={disabled} editorState={value} onChange={onChange} />
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
ContentInput.defaultProps = defaultProps

export default ContentInput
