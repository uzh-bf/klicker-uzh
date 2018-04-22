import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import Editor from 'draft-js-plugins-editor'
import createToolbarPlugin, { Separator } from 'draft-js-static-toolbar-plugin'
import { Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import {
  ItalicButton,
  BoldButton,
  UnderlineButton,
  CodeButton,
  UnorderedListButton,
  OrderedListButton,
  BlockquoteButton,
  CodeBlockButton,
} from 'draft-js-buttons'

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

// instantiate the static toolbar plugin
const toolbarPlugin = createToolbarPlugin({
  structure: [
    BoldButton,
    ItalicButton,
    UnderlineButton,
    CodeButton,
    Separator,
    UnorderedListButton,
    OrderedListButton,
    BlockquoteButton,
    CodeBlockButton,
  ],
})
const { Toolbar } = toolbarPlugin

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

      <Editor
        disabled={disabled}
        editorState={value}
        plugins={[toolbarPlugin]}
        onChange={onChange}
      />

      <Toolbar />
    </Form.Field>

    <style global jsx>{`
      .draftJsToolbar__buttonWrapper__1Dmqh {
        display: inline-block;
      }
      .draftJsToolbar__button__qi1gf {
        background: #fbfbfb;
        color: #888;
        font-size: 18px;
        border: 0;
        padding-top: 5px;
        vertical-align: bottom;
        height: 34px;
        width: 36px;
      }
      .draftJsToolbar__button__qi1gf svg {
        fill: #888;
      }
      .draftJsToolbar__button__qi1gf:hover,
      .draftJsToolbar__button__qi1gf:focus {
        background: #f3f3f3;
        outline: 0; /* reset for :focus */
      }
      .draftJsToolbar__active__3qcpF {
        background: #efefef;
        color: #444;
      }
      .draftJsToolbar__active__3qcpF svg {
        fill: #444;
      }
      .draftJsToolbar__separator__3U7qt {
        display: inline-block;
        border-right: 1px solid #ddd;
        height: 24px;
        margin: 0 0.5em;
      }
      .draftJsToolbar__toolbar__dNtBH {
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 2px;
        box-shadow: 0px 1px 3px 0px rgba(220, 220, 220, 1);
        z-index: 2;
        box-sizing: border-box;
      }
      .draftJsToolbar__toolbar__dNtBH:after {
        border-color: rgba(255, 255, 255, 0);
        border-top-color: #fff;
        border-width: 4px;
        margin-left: -4px;
      }
      .draftJsToolbar__toolbar__dNtBH:before {
        border-color: rgba(221, 221, 221, 0);
        border-top-color: #ddd;
        border-width: 6px;
        margin-left: -6px;
      }
    `}</style>

    <style jsx>{`
      @import 'src/theme';

      .contentInput {
        @include tooltip-icon;

        :global(.public-DraftEditor-content) {
          border: 1px solid lightgrey;
          border-radius: 4px;
          height: 20rem;
          padding: 1rem;
          margin-bottom: 0.5rem;

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
