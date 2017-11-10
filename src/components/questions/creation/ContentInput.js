import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Form } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

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
        <FormattedMessage
          defaultMessage="Question"
          id="teacher.createQuestion.contentInput.label"
        />
        <a data-tip data-for="contentHelp">
          <FaQuestionCircle />
        </a>
      </label>

      <ReactTooltip id="contentHelp" delayShow={250} delayHide={250} place="right">
        <FormattedMessage
          defaultMessage="Enter the question you want to ask the audience."
          id="teacher.createQuestion.contentInput.tooltip"
        />
      </ReactTooltip>

      <textarea disabled={disabled} name="content" value={value} onChange={onChange} />
    </Form.Field>

    <ReactTooltip id="contentHelp" delayHide={250} place="right">
      <span>Enter the question to ask the audience.</span>
    </ReactTooltip>
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
