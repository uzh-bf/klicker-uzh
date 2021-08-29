// import dynamic from 'next/dynamic'
import React from 'react'
import ReactTooltip from 'react-tooltip'
import Editor from 'draft-js-plugins-editor'
import createToolbarPlugin /* Separator */ from 'draft-js-static-toolbar-plugin'
import { Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import {
  ItalicButton,
  BoldButton,
  UnderlineButton,
  // CodeButton,
  UnorderedListButton,
  OrderedListButton,
  // BlockquoteButton,
  // CodeBlockButton,
} from 'draft-js-buttons'

interface Props {
  disabled?: boolean
  error?: any
  onChange: any
  touched: any
  value: any
}

const defaultProps = {
  disabled: false,
}

// instantiate the static toolbar plugin
const toolbarPlugin = createToolbarPlugin()
const plugins = [toolbarPlugin]
const { Toolbar } = toolbarPlugin

function ContentInput({ value, onChange, error, touched, disabled }: Props): React.ReactElement {
  return (
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

        <Editor editorState={value} plugins={plugins} readOnly={disabled} onChange={onChange} />

        <Toolbar>
          {(props): React.ReactNode => (
            <>
              <BoldButton {...props} />
              <ItalicButton {...props} />
              <UnderlineButton {...props} />
              <UnorderedListButton {...props} />
              <OrderedListButton {...props} />
              {/* <CodeBlockButton {...props} /> */}
            </>
          )}
        </Toolbar>
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
            min-height: 10rem;
            padding: 0.5rem;
            margin-bottom: 0.5rem;

            &:focus {
              border-color: $color-focus;
            }
          }
        }
      `}</style>
    </div>
  )
}

ContentInput.defaultProps = defaultProps

export default ContentInput
