import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Form, Icon, Input } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  meta: PropTypes.shape({
    dirty: PropTypes.bool,
    invalid: PropTypes.bool,
  }).isRequired,
}

const TitleInput = ({ input: { value, onChange }, meta: { dirty, invalid } }) => (
  <div className="titleInput">
    <Form.Field required error={dirty && invalid}>
      <label htmlFor="questionTitle">
        <FormattedMessage defaultMessage="Question Title" id="createQuestion.titleInput.label" />
        <a data-tip data-for="titleHelp">
          <Icon name="question circle" />
        </a>
      </label>

      <ReactTooltip delayHide={250} delayShow={250} id="titleHelp" place="right">
        <FormattedMessage
          defaultMessage="Enter a short summarizing title for the question. This is only visible to you!"
          id="createQuestion.titleInput.tooltip"
        />
      </ReactTooltip>

      <Input name="questionTitle" type="text" value={value} onChange={onChange} />
    </Form.Field>

    <style jsx>{`
      @import 'src/theme';

      .titleInput > :global(.field) {
        @include tooltip-icon;
      }
    `}</style>
  </div>
)

TitleInput.propTypes = propTypes

export default TitleInput
