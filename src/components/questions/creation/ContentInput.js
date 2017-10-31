import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
}

const ContentInput = ({ input: { value, onChange } }) => (
  <div className="field contentInput">
    <label htmlFor="content">
      <FormattedMessage defaultMessage="Question" id="teacher.createQuestion.content" />
    </label>
    <a data-tip data-for="contentHelp">
      {' '}
      <FaQuestionCircle className="icon" />
    </a>
    <textarea name="content" value={value} onChange={onChange} />

    <ReactTooltip id="contentHelp" delayHide={250} place="right">
      <span>Enter the question to ask the audience.</span>
    </ReactTooltip>
    <style jsx>{`
      @import 'src/_theme';

      .contentInput textarea {
        border: 1px solid lightgrey;
        height: 20rem;
        padding: 1rem;
      }

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

ContentInput.propTypes = propTypes

export default ContentInput
